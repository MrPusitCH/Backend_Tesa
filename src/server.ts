// src/server.ts
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import type { FastifyRequest } from "fastify";
import "./mqtt/ingest.js";          // start ingest
import healthRoutes from "./routes/health.js";
import droneRoutes from "./routes/drone.js";
import adminRoutes from "./routes/admin.js";
import { registerClient } from "./ws/hub.js";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
// Optional: Install @fastify/cors if /docs and API are served from different origins
// npm install @fastify/cors
// import fastifyCors from "@fastify/cors";

const server = Fastify();

async function start() {
  await server.register(websocket);
  
  // Optional: Register CORS if /docs and API are served from different origins
  // Uncomment if you need CORS support
  // await server.register(fastifyCors, {
  //   origin: true, // Allow all origins, or specify: ["https://yourdomain.com"]
  //   credentials: true
  // });

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

  server.get("/ws", { websocket: true }, (conn, _req: FastifyRequest) => {
    console.log("🔌 New WebSocket connection");
    registerClient(conn);
    conn.send(JSON.stringify({ type: "hello", ok: true }));
  });

  server.register(healthRoutes);
  server.register(droneRoutes);
  server.register(adminRoutes);

  const port = Number(process.env.PORT) || 3000;
  server.listen({ port, host: "0.0.0.0" }, (err, address) =>  {
    if (err) { console.error(err); process.exit(1); }
    console.log(`🚀 Server ready at ${address}`);
  });
}
start();
