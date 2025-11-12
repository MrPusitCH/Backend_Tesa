// src/routes/admin.ts  (แก้ย้อนหลัง/รีโปรเซสแบบง่าย)
import type { FastifyInstance } from "fastify";
import { getRawById } from "../services/raw.js";
import { droneDetectionSchema } from "../schemas/drone-detection.js";
import { saveDroneDetection } from "../services/drone-detections.js";

export default async function adminRoutes(app: FastifyInstance) {
  app.post("/admin/reprocess/:rawId", {
    schema: {
      tags: ["Admin"],
      summary: "Reprocess raw message",
      description: "Reprocesses a raw message by ID, optionally patching fields before validation and saving. Useful for fixing failed parses or updating detection data.",
      params: {
        type: "object",
        required: ["rawId"],
        properties: {
          rawId: {
            type: "string",
            description: "Raw message identifier to reprocess"
          }
        }
      },
      body: {
        type: "object",
        properties: {
          set: {
            type: "object",
            description: "Optional fields to patch/override in the raw message before reprocessing"
          }
        }
      },
      response: {
        200: {
          description: "Reprocessing successful",
          type: "object",
          properties: {
            ok: {
              type: "boolean",
              description: "Operation success status"
            },
            id: {
              type: "string",
              description: "Processed detection identifier"
            }
          }
        },
        400: {
          description: "Bad request - invalid JSON or validation error",
          type: "object",
          properties: {
            ok: {
              type: "boolean",
              description: "Success status (always false)"
            },
            error: {
              type: "string",
              description: "Error message"
            }
          }
        },
        404: {
          description: "Raw message not found",
          type: "object",
          properties: {
            ok: {
              type: "boolean",
              description: "Success status (always false)"
            },
            error: {
              type: "string",
              description: "Error message"
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    const { rawId } = req.params as { rawId: string };
    const raw = await getRawById(rawId);
    if (!raw) return reply.code(404).send({ ok: false, error: "raw not found" });

    let json: any;
    try { json = JSON.parse(raw.payload); } catch { return reply.code(400).send({ ok:false, error:"invalid raw json" }); }

    const patch = (req.body as any)?.set ?? {};
    const patched = { ...json, ...patch };
    try {
      const d = droneDetectionSchema.parse(patched);
      const id = await saveDroneDetection(d, BigInt(rawId));
      return { ok: true, id: id.toString() };
    } catch (e: any) {
      return reply.code(400).send({ ok: false, error: e?.message ?? String(e) });
    }
  });
}