// src/routes/drone.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { getLatestDroneDetection, listDetections } from "../services/drone-detections.js";
import { getDronePaths } from "../services/Drone/path.js";
import { parseDronePathQuery, DronePathValidationError } from "../schemas/drone-path-query.js";

export default async function droneRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get("/drone/latest", {
    schema: {
      tags: ["Drone"],
      summary: "Get latest drone detection",
      description: "Retrieves the most recent detection for a specific drone, or the latest detection overall if no drone_id is provided.",
      querystring: {
        type: "object",
        properties: {
          drone_id: {
            type: "string",
            description: "Optional drone identifier. If omitted, returns the latest detection from any drone."
          }
        }
      },
      response: {
        200: {
          description: "Latest drone detection with detailed information",
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique detection identifier"
            },
            receivedAt: {
              type: "string",
              format: "date-time",
              description: "Server receive timestamp (ISO 8601)"
            },
            deviceTs: {
              type: "string",
              format: "date-time",
              description: "Device timestamp (ISO 8601)"
            },
            drone_id: {
              type: "string",
              description: "Drone identifier"
            },
            latitude: {
              type: "number",
              description: "Latitude in degrees"
            },
            longitude: {
              type: "number",
              description: "Longitude in degrees"
            },
            altitude_m: {
              type: "number",
              description: "Altitude in meters"
            },
            speed_mps: {
              type: "number",
              description: "Speed in meters per second"
            },
            radius_m: {
              type: "number",
              nullable: true,
              description: "Detection radius in meters"
            },
            angle_deg: {
              type: "number",
              nullable: true,
              description: "Angle in degrees"
            },
            source_id: {
              type: "string",
              nullable: true,
              description: "Source camera/device identifier"
            },
            confidence: {
              type: "number",
              nullable: true,
              description: "Detection confidence score"
            },
            bbox: {
              type: "array",
              items: { type: "number", nullable: true },
              nullable: true,
              description: "Bounding box [x, y, width, height]"
            },
            type: {
              type: "string",
              nullable: true,
              description: "Drone type classification"
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    const { drone_id } = (req.query as any) ?? {};
    const r = await getLatestDroneDetection(drone_id);
    if (!r) return reply.send({});
    return reply.send({
      id: r.id.toString?.() ?? r.id,
      receivedAt: r.receivedAt,
      deviceTs: r.deviceTs,
      drone_id: r.droneId,
      latitude: r.latDeg,
      longitude: r.lonDeg,
      altitude_m: r.altM,
      speed_mps: r.speedMps,
      radius_m: r.radiusM,
      angle_deg: r.angleDeg,
      // new fields
      source_id: (r as any).sourceId ?? null,
      confidence: (r as any).confidence ?? null,
      bbox: [
        (r as any).bboxX ?? null,
        (r as any).bboxY ?? null,
        (r as any).bboxW ?? null,
        (r as any).bboxH ?? null,
      ],
      type: (r as any).type ?? null,
    });
  });

  app.get("/drone/history", {
    schema: {
      tags: ["Drone"],
      summary: "Get drone detection history",
      description: "Retrieves historical detection records for a specific drone, ordered by timestamp (most recent first).",
      querystring: {
        type: "object",
        required: ["drone_id"],
        properties: {
          drone_id: {
            type: "string",
            description: "Drone identifier (required)"
          },
          limit: {
            type: "integer",
            default: 100,
            minimum: 1,
            maximum: 1000,
            description: "Maximum number of records to return (default: 100, max: 1000)"
          }
        }
      },
      response: {
        200: {
          description: "Array of historical drone detection points",
          type: "array",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Unique detection identifier"
              },
              ts: {
                type: "string",
                format: "date-time",
                description: "Timestamp from device (ISO 8601)"
              },
              lat: {
                type: "number",
                description: "Latitude in degrees"
              },
              lon: {
                type: "number",
                description: "Longitude in degrees"
              },
              alt_m: {
                type: "number",
                nullable: true,
                description: "Altitude in meters"
              },
              speed_mps: {
                type: "number",
                nullable: true,
                description: "Speed in meters per second"
              },
              radius_m: {
                type: "number",
                nullable: true,
                description: "Detection radius in meters"
              },
              angle_deg: {
                type: "number",
                nullable: true,
                description: "Angle in degrees"
              },
              source_id: {
                type: "string",
                nullable: true,
                description: "Source camera/device identifier"
              },
              confidence: {
                type: "number",
                nullable: true,
                description: "Detection confidence score"
              },
              bbox: {
                type: "array",
                items: { type: "number", nullable: true },
                nullable: true,
                description: "Bounding box [x, y, width, height]"
              },
              type: {
                type: "string",
                nullable: true,
                description: "Drone type classification"
              }
            }
          }
        },
        400: {
          description: "Bad request - missing or invalid parameters",
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message"
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    const { drone_id, limit } = (req.query as any) ?? {};
    if (!drone_id) return reply.code(400).send({ error: "drone_id required" });
    const rows = await listDetections(drone_id, Number(limit) || 100);
    return rows.map((r: any) => ({
      id: r.id.toString?.() ?? r.id,
      ts: r.deviceTs,
      lat: r.latDeg, lon: r.lonDeg,
      alt_m: r.altM, speed_mps: r.speedMps,
    radius_m: r.radiusM, angle_deg: r.angleDeg,
    // new fields
    source_id: (r as any).sourceId ?? null,
    confidence: (r as any).confidence ?? null,
    bbox: [
      (r as any).bboxX ?? null,
      (r as any).bboxY ?? null,
      (r as any).bboxW ?? null,
      (r as any).bboxH ?? null,
    ],
    type: (r as any).type ?? null,
    }));
  });

  app.get("/drone/path", {
    schema: {
      tags: ["Drone"],
      summary: "Get drone flight path",
      description: "Retrieves flight path data for one or more drones within a specified time range. Returns path points for visualization.",
      querystring: {
        type: "object",
        required: ["drone_ids", "start", "end"],
        properties: {
          drone_ids: {
            type: "string",
            description: "Comma-separated list of drone identifiers (e.g., 'drone1,drone2')"
          },
          start: {
            type: "string",
            format: "date-time",
            description: "Start time in ISO 8601 format (e.g., '2024-01-01T00:00:00Z')"
          },
          end: {
            type: "string",
            format: "date-time",
            description: "End time in ISO 8601 format (e.g., '2024-01-01T23:59:59Z')"
          }
        }
      },
      response: {
        200: {
          description: "Flight path data for requested drones",
          type: "array",
          items: {
            type: "object",
            properties: {
              droneId: {
                type: "string",
                description: "Drone identifier"
              },
              points: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      description: "Point identifier"
                    },
                    ts: {
                      type: "string",
                      format: "date-time",
                      description: "Timestamp"
                    },
                    lat: {
                      type: "number",
                      description: "Latitude"
                    },
                    lon: {
                      type: "number",
                      description: "Longitude"
                    },
                    alt_m: {
                      type: "number",
                      nullable: true,
                      description: "Altitude in meters"
                    },
                    speed_mps: {
                      type: "number",
                      nullable: true,
                      description: "Speed in meters per second"
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - validation error",
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message"
            },
            issues: {
              description: "Validation issues (if available)"
            }
          }
        },
        500: {
          description: "Internal server error",
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message"
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const params = parseDronePathQuery(req.query);
      const data = await getDronePaths(params);
      return reply.send(data);
    } catch (err: unknown) {
      if (err instanceof DronePathValidationError) {
        return reply.status(400).send({ error: err.message, issues: err.issues ?? null });
      }
      console.error("Failed to fetch drone path", err);
      return reply.status(500).send({ error: "Failed to fetch drone path" });
    }
  });
}
