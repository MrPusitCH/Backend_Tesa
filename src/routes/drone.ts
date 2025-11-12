// src/routes/drone.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { getLatestFrame, getFramesByCamId, getAllFrames } from "../services/frames.js";

export default async function droneRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // GET /frames/latest - Get latest frame
  app.get("/frames/latest", {
    schema: {
      tags: ["Drone"],
      summary: "Get latest frame",
      description: "Retrieves the most recent frame with all objects.",
      response: {
        200: {
          description: "Latest frame with exact structure",
          type: "object",
          properties: {
            fram_id: { type: "string" },
            cam_id: { type: "string" },
            token_id: {
              type: "object",
              properties: {
                camera_info: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    sort: { type: "string" },
                    location: { type: "string" },
                    institute: { type: "string" },
                  },
                },
              },
            },
            timestamp: { type: "string", format: "date-time" },
            image_info: {
              type: "object",
              properties: {
                width: { type: "number" },
                height: { type: "number" },
              },
            },
            objects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  obj_id: { type: "string" },
                  type: { type: "string", nullable: true },
                  lat: { type: "number" },
                  lng: { type: "number" },
                  alt: { type: "number" },
                  speed_kt: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const frame = await getLatestFrame();
    if (!frame) return reply.send({});
    
    return reply.send({
      fram_id: frame.framId,
      cam_id: frame.camId,
      token_id: {
        camera_info: {
          name: frame.cameraName,
          sort: frame.cameraSort,
          location: frame.cameraLocation,
          institute: frame.cameraInstitute,
        },
      },
      timestamp: frame.timestamp.toISOString(),
      image_info: {
        width: frame.imageWidth,
        height: frame.imageHeight,
      },
      objects: frame.objects.map((obj: any) => ({
        obj_id: obj.objId,
        type: obj.type ?? null,
        lat: obj.lat,
        lng: obj.lng,
        alt: obj.alt,
        speed_kt: obj.speedKt,
      })),
    });
  });

  // GET /frames - Get frames (optionally filtered by cam_id)
  app.get("/frames", {
    schema: {
      tags: ["Drone"],
      summary: "Get frames",
      description: "Retrieves frames, optionally filtered by cam_id.",
      querystring: {
        type: "object",
        properties: {
          cam_id: {
            type: "string",
            description: "Optional camera identifier to filter frames",
          },
          limit: {
            type: "integer",
            default: 100,
            minimum: 1,
            maximum: 1000,
            description: "Maximum number of frames to return",
          },
        },
      },
      response: {
        200: {
          description: "Array of frames with exact structure",
          type: "array",
          items: {
            type: "object",
            properties: {
              fram_id: { type: "string" },
              cam_id: { type: "string" },
              token_id: {
                type: "object",
                properties: {
                  camera_info: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      sort: { type: "string" },
                      location: { type: "string" },
                      institute: { type: "string" },
                    },
                  },
                },
              },
              timestamp: { type: "string", format: "date-time" },
              image_info: {
                type: "object",
                properties: {
                  width: { type: "number" },
                  height: { type: "number" },
                },
              },
              objects: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    obj_id: { type: "string" },
                    type: { type: "string", nullable: true },
                    lat: { type: "number" },
                    lng: { type: "number" },
                    alt: { type: "number" },
                    speed_kt: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { cam_id, limit } = (req.query as any) ?? {};
    const frames = cam_id 
      ? await getFramesByCamId(cam_id, Number(limit) || 100)
      : await getAllFrames(Number(limit) || 100);
    
    return reply.send(frames.map((frame: any) => ({
      fram_id: frame.framId,
      cam_id: frame.camId,
      token_id: {
        camera_info: {
          name: frame.cameraName,
          sort: frame.cameraSort,
          location: frame.cameraLocation,
          institute: frame.cameraInstitute,
        },
      },
      timestamp: frame.timestamp.toISOString(),
      image_info: {
        width: frame.imageWidth,
        height: frame.imageHeight,
      },
      objects: frame.objects.map((obj: any) => ({
        obj_id: obj.objId,
        type: obj.type ?? null,
        lat: obj.lat,
        lng: obj.lng,
        alt: obj.alt,
        speed_kt: obj.speedKt,
      })),
    })));
  });
}
