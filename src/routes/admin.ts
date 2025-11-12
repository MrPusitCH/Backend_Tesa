// src/routes/admin.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getRawById } from "../services/raw.js";
import { frameSchema } from "../schemas/frame.js";
import { saveFrame } from "../services/frames.js";

export default async function adminRoutes(app: FastifyInstance) {
  app.post("/admin/reprocess/:rawId", {
    schema: {
      tags: ["Admin"],
      summary: "Reprocess raw message",
      description: "Reprocesses a raw message by ID, optionally patching fields before validation and saving. Useful for fixing failed parses or updating frame data.",
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
              description: "Processed frame identifier"
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
  }, async (req: FastifyRequest<{ Params: { rawId: string }; Body: { set?: any } }>, reply: FastifyReply) => {
    const { rawId } = req.params;
    const raw = await getRawById(rawId);
    if (!raw) return reply.code(404).send({ ok: false, error: "raw not found" });

    let json: any;
    try { json = JSON.parse(raw.payload); } catch { return reply.code(400).send({ ok:false, error:"invalid raw json" }); }

    const patch = req.body?.set ?? {};
    const patched = { ...json, ...patch };
    try {
      const frame = frameSchema.parse(patched);
      const id = await saveFrame({
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
      return { ok: true, id: id.toString() };
    } catch (e: any) {
      return reply.code(400).send({ ok: false, error: e?.message ?? String(e) });
    }
  });
}