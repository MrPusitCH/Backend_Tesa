// src/mqtt/ingest.ts
import { mqttClient } from "./client.js";
import { frameSchema } from "../schemas/frame.js";
import { saveRaw } from "../services/raw.js";
import { saveFrame } from "../services/frames.js";
import { broadcast } from "../ws/hub.js";
import { mapCameraInfo } from "../services/camera-info.js";

const TOPIC_FRAME = process.env.MQTT_TOPIC_FRAME || "drones/frames";
const CAMERA_TOKEN = process.env.CAMERA_TOKEN || "";

// subscribe when app starts
mqttClient.subscribe([TOPIC_FRAME], (err: Error | null) => {
  if (err) console.error("❌ MQTT subscribe error", err);
  else console.log(`✅ MQTT subscribed to ${TOPIC_FRAME}`);
});

mqttClient.on("message", async (topic: string, message: Buffer) => {
  const text = message.toString("utf8");
  let rawId: bigint | undefined;

  try {
    // 1) save raw first
    rawId = await saveRaw(topic, text);

    if (topic === TOPIC_FRAME) {
      // Parse incoming frame message
      const json = JSON.parse(text);
      
      // Extract fram_id and cam_id for API call
      const { fram_id, cam_id, token_id } = json;
      if (!fram_id || !cam_id) {
        throw new Error("fram_id and cam_id are required in frame message");
      }

      // Determine which token to use: from payload (if string) or from environment
      const token = typeof token_id === "string" ? token_id : CAMERA_TOKEN;
      
      console.log(`🔑 Using token: ${token ? token.substring(0, 8) + '...' : 'NONE'}`);
      console.log(`📦 Incoming payload cam_id: ${cam_id}, fram_id: ${fram_id}`);

      // Fetch camera_info from API and enrich payload
      let enrichedPayload;
      if (token) {
        try {
          // Remove token_id from payload before enriching (it will be replaced with object structure)
          const { token_id: _, ...payloadWithoutToken } = json;
          console.log(`🔄 Calling mapCameraInfo for cam_id: ${cam_id}`);
          enrichedPayload = await mapCameraInfo(payloadWithoutToken, token);
          console.log(`✅ Successfully enriched payload with camera_info`);
        } catch (apiError: any) {
          console.error(`⚠️ Failed to fetch camera info for cam_id ${cam_id}:`, apiError.message);
          console.error(`   Error details:`, apiError);
          // If API call fails, check if camera_info is already in the payload
          if (json.token_id?.camera_info) {
            console.log(`   Using camera_info from payload as fallback`);
            enrichedPayload = json;
          } else {
            throw new Error(`Camera info not available and API call failed: ${apiError.message}`);
          }
        }
      } else {
        console.warn(`⚠️ No token available (neither in payload nor CAMERA_TOKEN env)`);
        // No token available, use camera_info from payload if present
        if (json.token_id?.camera_info) {
          console.log(`   Using camera_info from payload`);
          enrichedPayload = json;
        } else {
          throw new Error("No camera token available (neither in payload nor CAMERA_TOKEN env) and camera_info not in payload");
        }
      }

      // Validate enriched frame with schema
      const frame = frameSchema.parse(enrichedPayload);

      // Save frame with objects
      await saveFrame({
        framId: frame.fram_id,
        camId: frame.cam_id,
        cameraName: frame.token_id.camera_info.name,
        cameraSort: frame.token_id.camera_info.sort,
        cameraLocation: frame.token_id.camera_info.location,
        cameraInstitute: frame.token_id.camera_info.institute,
        timestamp: frame.timestamp,
        imageWidth: frame.image_info.width,
        imageHeight: frame.image_info.height,
        objects: frame.objects.map((obj: any) => ({
          objId: obj.obj_id,
          type: obj.type,
          lat: obj.lat,
          lng: obj.lng,
          alt: obj.alt,
          speedKt: obj.speed_kt,
        })),
      });

      // Broadcast to WebSocket clients
      broadcast({
        fram_id: frame.fram_id,
        cam_id: frame.cam_id,
        token_id: frame.token_id,
        timestamp: frame.timestamp.toISOString(),
        image_info: frame.image_info,
        objects: frame.objects,
      });

      await saveRaw(topic, text, { parseOk: true });
      console.log("🖼️ Saved frame", { fram_id: frame.fram_id, objects_count: frame.objects.length });
      return;
    }
  } catch (e: any) {
    // save error info
    await saveRaw(topic, text, { parseOk: false, error: e?.message ?? String(e) });
    console.error("❌ Ingest error:", e?.message ?? e);
  }
});