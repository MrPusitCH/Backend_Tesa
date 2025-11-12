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
          Frame: {
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
  server.register(markRoutes);

  const port = Number(process.env.PORT) || 3000;
  server.listen({ port, host: "0.0.0.0" }, (err, address) =>  {
    if (err) { console.error(err); process.exit(1); }
    console.log(`🚀 Server ready at ${address}`);
  });
}
start();
