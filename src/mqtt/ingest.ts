// src/mqtt/ingest.ts
import { mqttClient } from "./client.js";
import { droneDetectionSchema } from "../schemas/drone-detection.js";
import { frameSchema } from "../schemas/frame.js";
import { saveRaw } from "../services/raw.js";
import { saveDroneDetection, saveDroneDetectionFromFrame } from "../services/drone-detections.js";
import { saveFrame } from "../services/frames.js";
import { broadcast } from "../ws/hub.js";

const TOPIC_DRONE = process.env.MQTT_TOPIC_DRONE || "drones/detections";
const TOPIC_FRAME = process.env.MQTT_TOPIC_FRAME || "drones/frames";

const CONFIDENT_PASS_WS = (()=> {
  const confident = Number(process.env.CONFIDENT_PASS_WS);
  return Number.isFinite(confident) ? confident : undefined;
})();

// subscribe when app starts
// A2 note: listen both topics
mqttClient.subscribe([TOPIC_DRONE, TOPIC_FRAME], (err) => {
  if (err) console.error("❌ MQTT subscribe error", err);
  else console.log(`✅ MQTT subscribed to ${TOPIC_DRONE} and ${TOPIC_FRAME}`);
});

mqttClient.on("message", async (topic, message) => {
  const text = message.toString("utf8");
  let rawId: bigint | undefined;

  try {
    // 1) save raw first
    rawId = await saveRaw(topic, text);

    if (topic === TOPIC_DRONE) {
      // legacy single-drone message
      const json = JSON.parse(text);
      const d = droneDetectionSchema.parse(json);

      // save to DB
      const id = await saveDroneDetection(d, rawId);

      // send to WS
      broadcast({
        type: "drone",
        drone_id: d.drone_id,
        timestamp : d.timestamp,
        latitude: d.latitude,
        longitude: d.longitude,
        altitude_m: d.altitude_m,
        speed_mps: d.speed_mps,
      });

      await saveRaw(topic, text, { parseOk: true });
      console.log("🛰️ Saved legacy detection", { id: id.toString(), drone_id: d.drone_id });
      return;
    }

    if (topic === TOPIC_FRAME) {
      // new frame message (many objects)
      const json = JSON.parse(text);
      const frame = frameSchema.parse(json);

      // save frame row
      const frameParams: {
        frameNo: number;
        deviceTs: Date;
        sourceId: string;
        objectsCount: number;
      } = {
        frameNo: parseInt(frame.fram_id),
        deviceTs: frame.timestamp,
        sourceId: frame.cam_id,
        objectsCount: frame.objects.length,
      };
      const frameId = await saveFrame(frameParams);

      // save each object as detection
      for (const obj of frame.objects) {
        // build detection params without undefined fields
        const detParams: {
          droneId: string;
          deviceTs: Date;
          lat: number;
          lon: number;
          altM: number;
          speedMps: number;
          sourceId: string;
          type?: string;
          frameId?: bigint;
          rawId?: bigint;
        } = {
          droneId: obj.obj_id,
          deviceTs: frame.timestamp,
          lat: obj.lat,
          lon: obj.lng,
          altM: obj.alt,
          speedMps: obj.speed_kt,
          sourceId: frame.cam_id,
          frameId,
        };
        if (rawId !== undefined) detParams.rawId = rawId;
        if (typeof obj.type === "string") detParams.type = obj.type;
        await saveDroneDetectionFromFrame(detParams);

        // send to WS (simple per object)
        broadcast({
          type: "drone",
          drone_id: obj.obj_id,
          timestamp: frame.timestamp,
          latitude: obj.lat,
          longitude: obj.lng,
          altitude_m: obj.alt,
          speed_mps: obj.speed_kt,
          source_id: frame.cam_id,
        });
      }

      await saveRaw(topic, text, { parseOk: true });
      console.log("🖼️ Saved frame & detections", { frameId: frameId.toString(), count: frame.objects.length });
      return;
    }
  } catch (e: any) {
    // save error info
    await saveRaw(topic, text, { parseOk: false, error: e?.message ?? String(e) });
    console.error("❌ Ingest error:", e?.message ?? e);
  }
});