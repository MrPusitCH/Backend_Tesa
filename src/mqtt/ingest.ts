// src/mqtt/ingest.ts
import { mqttClient } from "./client.js";
import { frameSchema } from "../schemas/frame.js";
import { saveRaw } from "../services/raw.js";
import { saveFrame } from "../services/frames.js";
import { broadcast } from "../ws/hub.js";

const TOPIC_FRAME = process.env.MQTT_TOPIC_FRAME || "drones/frames";

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
      // frame message with exact structure
      const json = JSON.parse(text);
      const frame = frameSchema.parse(json);

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