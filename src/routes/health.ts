// src/routes/health.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";

export default async function healthRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.get("/health", {
    schema: {
      tags: ["Health"],
      summary: "Health check endpoint",
      description: "Returns server health status. Use this to verify the server is responding.",
      response: {
        200: {
          description: "Server is healthy",
          type: "object",
          properties: {
            ok: {
              type: "boolean",
              description: "Health status indicator"
            }
          }
        }
      }
    }
  }, async () => ({ ok: true }));

  app.get("/ready", {
    schema: {
      tags: ["Health"],
      summary: "Readiness check endpoint",
      description: "Returns readiness status for server, MQTT broker, and database. Useful for Kubernetes liveness/readiness probes.",
      response: {
        200: {
          description: "Readiness status",
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
        }
      }
    }
  }, async () => ({
    server: "up",
    mqtt: "assumed-up",
    db: "assumed-up",
  }));

  app.post("/echo", {
    schema: {
      tags: ["Health"],
      summary: "Echo endpoint for testing",
      description: "Echoes back the request body. Useful for testing POST requests and JSON payloads.",
      body: {
        type: "object",
        description: "Any JSON object to echo back"
      },
      response: {
        200: {
          description: "Echoed request body",
          type: "object",
          properties: {
            received: {
              description: "The request body that was sent"
            }
          }
        }
      }
    }
  }, async (req, _reply) => {
    return { received: req.body };
  });
}