// src/server.ts
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import type { FastifyRequest } from "fastify";
import "./mqtt/ingest.js";          // start ingest
import healthRoutes from "./routes/health.js";
import droneRoutes from "./routes/drone.js";
import adminRoutes from "./routes/admin.js";
import markRoutes from "./routes/mark.js";
import { registerClient } from "./ws/hub.js";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyCors from "@fastify/cors";

const server = Fastify();

async function start() {
  await server.register(websocket);
  
  // Enable CORS for frontend requests (Next.js can make direct requests if needed)
  await server.register(fastifyCors, {
    origin: true, // Allow all origins in development, specify in production
    credentials: true
  });

  await server.register(fastifySwagger, {
    openapi: {
      info: {
        title: "TESA Drone Backend",
        description: "API documentation for drone telemetry services",
        version: "1.0.0"
      },
      tags: [
        {
          name: "Health",
          description: "Health check and readiness endpoints for monitoring server status"
        },
        {
          name: "Drone",
          description: "Endpoints for querying drone detection data, latest positions, and flight paths"
        },
        {
          name: "Admin",
          description: "Administrative endpoints for reprocessing and managing drone data"
        },
        {
          name: "Mark",
          description: "Endpoints for managing map marks (zones, points of interest)"
        }
      ],
      components: {
        schemas: {
          DronePoint: {
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
          },
          DronePointDetailed: {
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
          },
          HealthResponse: {
            type: "object",
            properties: {
              ok: {
                type: "boolean",
                description: "Health status"
              }
            }
          },
          ReadinessResponse: {
            type: "object",
            properties: {
              server: {
                type: "string",
                description: "Server status"
              },
              mqtt: {
                type: "string",
                description: "MQTT broker status"
              },
              db: {
                type: "string",
                description: "Database status"
              }
            }
          },
          ReprocessResponse: {
            type: "object",
            properties: {
              ok: {
                type: "boolean",
                description: "Operation success status"
              },
              id: {
                type: "string",
                description: "Processed detection ID"
              }
            }
          },
          ErrorResponse: {
            type: "object",
            properties: {
              error: {
                type: "string",
                description: "Error message"
              },
              ok: {
                type: "boolean",
                description: "Success status (always false)"
              }
            }
          }
        }
      },
      // Initial servers array - will be dynamically updated by onSend hook
      servers: [
        { url: "http://localhost:3000", description: "Local dev" }
      ]
    }
  });
  
  // Hook to dynamically set server URL based on the actual request origin
  // This ensures Swagger UI calls the correct server, even behind proxies
  server.addHook('onSend', async (request, reply, payload) => {
    // Only modify the OpenAPI spec JSON response
    if (reply.getHeader('content-type')?.toString().includes('application/json') && 
        typeof payload === 'string' && 
        payload.includes('"openapi"')) {
      try {
        const spec = JSON.parse(payload);
        
        // Extract protocol, host, and port from the request
        const forwardedProto = request.headers['x-forwarded-proto'];
        const protocol: string = (typeof forwardedProto === 'string' ? forwardedProto : 
                         (Array.isArray(forwardedProto) ? forwardedProto[0] : undefined)) || 
                        (request.protocol === 'https' ? 'https' : 'http');
        const forwardedHost = request.headers['x-forwarded-host'];
        const host: string = (typeof forwardedHost === 'string' ? forwardedHost : 
                     (Array.isArray(forwardedHost) ? forwardedHost[0] : undefined)) || 
                    (typeof request.headers.host === 'string' ? request.headers.host : 
                     (Array.isArray(request.headers.host) ? request.headers.host[0] : undefined)) || 
                    'localhost:3000';
        
        // Build the base URL
        const baseUrl = `${protocol}://${host}`;
        
        // Update the servers array with the dynamic URL
        if (spec.openapi) {
          // OpenAPI 3.x format
          spec.servers = [
            { url: baseUrl, description: "Current server" }
          ];
        } else if (spec.swagger) {
          // Swagger 2.0 format (if you switch to swagger mode)
          spec.host = host;
          spec.schemes = [protocol as 'http' | 'https'];
        }
        
        return JSON.stringify(spec);
      } catch {
        // If parsing fails, return original payload
        return payload;
      }
    }
    return payload;
  });
  
  await server.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      operationsSorter: "alpha",
      tagsSorter: "alpha",
      defaultModelsExpandDepth: -1
    }
  });

  server.get("/ws", { websocket: true }, async (conn, req: FastifyRequest) => {
    const query = req.query as any;
    const role = query.role as "pi" | "viewer" | undefined;
    
    console.log(`🔌 New WebSocket connection: role=${role || "legacy"}`);
    
    // Legacy MQTT viewer or new viewer
    if (!role || role === "viewer") {
      registerClient(conn);
      conn.send(JSON.stringify({ type: "hello", ok: true }));
      return;
    }
    
    // Pi camera connection
    if (role === "pi") {
      const sourceId = query.source_id;
      const camId = query.cam_id;
      const token = query.token;
      
      console.log(`📷 Pi camera connected: source_id=${sourceId}, cam_id=${camId}`);
      
      let pendingMetadata: any = null;
      
      conn.on("message", async (data: Buffer) => {
        try {
          // Check if JSON or binary
          if (data[0] === 0x7b || data[0] === 0x22) {
            // JSON metadata
            const text = data.toString("utf8");
            const json = JSON.parse(text);
            const { frameSchema } = await import("./schemas/frame.js");
            pendingMetadata = frameSchema.parse(json);
            console.log(`📋 Received metadata for frame ${pendingMetadata.fram_id}`);
          } else {
            // Binary image
            if (!pendingMetadata) {
              console.warn("⚠️  Received image without metadata");
              return;
            }
            
            const imageBase64 = data.toString("base64");
            
            // Fetch camera info if available
            let cameraInfo = null;
            if (camId && token) {
              try {
                const axios = (await import("axios")).default;
                const response = await axios.get(
                  `https://tesa-api.crma.dev/api/object-detection/info/${camId}`,
                  {
                    headers: {
                      "x-camera-token": token,
                      "Accept": "application/json",
                    },
                  }
                );
                const apiData = response.data;
                cameraInfo = {
                  name: String(apiData.name || ""),
                  sort: String(apiData.sort || ""),
                  location: String(apiData.location || ""),
                  institute: String(apiData.Institute || apiData.institute || ""),
                };
              } catch (error: any) {
                console.error(`❌ Failed to fetch camera info: ${error.message}`);
              }
            }
            
            // Build frame payload
            const framePayload = {
              kind: "frame",
              meta: {
                ...pendingMetadata,
                ...(cameraInfo && {
                  token_id: {
                    camera_info: cameraInfo,
                  },
                }),
              },
              image_jpeg_base64: imageBase64,
            };
            
            // Broadcast to all viewers
            const { broadcast } = await import("./ws/hub.js");
            broadcast(framePayload);
            console.log(`📤 Broadcasted frame ${pendingMetadata.fram_id}`);
            
            pendingMetadata = null;
          }
        } catch (error: any) {
          console.error("❌ Error processing Pi message:", error.message);
        }
      });
    }
  });

  server.register(healthRoutes);
  server.register(droneRoutes);
  server.register(adminRoutes);
  server.register(markRoutes);

  const port = Number(process.env.PORT) || 3000;
  server.listen({ port, host: "0.0.0.0" }, (err, address) =>  {
    if (err) { console.error(err); process.exit(1); }
    console.log(`🚀 Server ready at ${address}`);
  });
}
start();
