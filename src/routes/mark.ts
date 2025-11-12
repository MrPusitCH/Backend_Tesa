// src/routes/mark.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  createMark,
  getAllMarks,
  getMarkById,
  updateMark,
  deleteMark,
  clearAllMarks,
} from "../services/marks.js";
import { createMarkSchema, updateMarkSchema } from "../schemas/mark.js";

export default async function markRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // GET /marks - Get all marks
  app.get("/marks", {
    schema: {
      tags: ["Mark"],
      summary: "Get all marks",
      description: "Retrieves all marks from the database",
      response: {
        200: {
          description: "List of all marks",
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              color: { type: "string" },
              pos: {
                type: "array",
                items: { type: "number" },
                minItems: 2,
                maxItems: 2,
                description: "[lat, lng]",
              },
              radius: { type: "number" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const marks = await getAllMarks();
      // Transform database format to API format
      const formatted = marks.map((m: any) => ({
        id: m.id,
        name: m.name,
        color: m.color,
        pos: [m.latDeg, m.lonDeg],
        radius: m.radiusM,
        createdAt: m.createdAt.toISOString(),
      }));
      return reply.send(formatted);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message || "Failed to fetch marks" });
    }
  });

  // GET /marks/:id - Get a specific mark
  app.get("/marks/:id", {
    schema: {
      tags: ["Mark"],
      summary: "Get mark by ID",
      description: "Retrieves a specific mark by its ID",
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string",
            description: "Mark identifier",
          },
        },
      },
      response: {
        200: {
          description: "Mark details",
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            color: { type: "string" },
            pos: {
              type: "array",
              items: { type: "number" },
              minItems: 2,
              maxItems: 2,
            },
            radius: { type: "number" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        404: {
          description: "Mark not found",
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const mark = await getMarkById(id);
      
      if (!mark) {
        return reply.code(404).send({ error: "Mark not found" });
      }

      return reply.send({
        id: mark.id,
        name: mark.name,
        color: mark.color,
        pos: [mark.latDeg, mark.lonDeg],
        radius: mark.radiusM,
        createdAt: mark.createdAt.toISOString(),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message || "Failed to fetch mark" });
    }
  });

  // POST /marks - Create a new mark
  app.post("/marks", {
    schema: {
      tags: ["Mark"],
      summary: "Create a new mark",
      description: "Creates a new mark with the provided data",
      body: {
        type: "object",
        required: ["name", "color", "pos", "radius"],
        properties: {
          name: { type: "string", minLength: 1 },
          color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
          pos: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
            description: "[lat, lng]",
          },
          radius: { type: "number", minimum: 0 },
        },
      },
      response: {
        201: {
          description: "Mark created successfully",
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            color: { type: "string" },
            pos: {
              type: "array",
              items: { type: "number" },
            },
            radius: { type: "number" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        400: {
          description: "Invalid input data",
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const validated = createMarkSchema.parse(req.body);
      const mark = await createMark(validated);
      
      return reply.code(201).send({
        id: mark.id,
        name: mark.name,
        color: mark.color,
        pos: [mark.latDeg, mark.lonDeg],
        radius: mark.radiusM,
        createdAt: mark.createdAt.toISOString(),
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return reply.code(400).send({ error: error.errors[0]?.message || "Validation error" });
      }
      return reply.code(500).send({ error: error.message || "Failed to create mark" });
    }
  });

  // PUT /marks/:id - Update a mark
  app.put("/marks/:id", {
    schema: {
      tags: ["Mark"],
      summary: "Update a mark",
      description: "Updates an existing mark by ID",
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
        },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
          pos: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
          },
          radius: { type: "number", minimum: 0 },
        },
      },
      response: {
        200: {
          description: "Mark updated successfully",
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            color: { type: "string" },
            pos: {
              type: "array",
              items: { type: "number" },
            },
            radius: { type: "number" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        404: {
          description: "Mark not found",
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const validated = updateMarkSchema.parse(req.body);
      
      const mark = await updateMark(id, validated);
      
      return reply.send({
        id: mark.id,
        name: mark.name,
        color: mark.color,
        pos: [mark.latDeg, mark.lonDeg],
        radius: mark.radiusM,
        createdAt: mark.createdAt.toISOString(),
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        // Prisma record not found
        return reply.code(404).send({ error: "Mark not found" });
      }
      if (error.name === "ZodError") {
        return reply.code(400).send({ error: error.errors[0]?.message || "Validation error" });
      }
      return reply.code(500).send({ error: error.message || "Failed to update mark" });
    }
  });

  // DELETE /marks/:id - Delete a mark
  app.delete("/marks/:id", {
    schema: {
      tags: ["Mark"],
      summary: "Delete a mark",
      description: "Deletes a mark by its ID",
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
        },
      },
      response: {
        200: {
          description: "Mark deleted successfully",
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
        404: {
          description: "Mark not found",
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await deleteMark(id);
      return reply.send({ message: "Mark deleted successfully" });
    } catch (error: any) {
      if (error.code === "P2025") {
        // Prisma record not found
        return reply.code(404).send({ error: "Mark not found" });
      }
      return reply.code(500).send({ error: error.message || "Failed to delete mark" });
    }
  });

  // DELETE /marks - Clear all marks (optional admin endpoint)
  app.delete("/marks", {
    schema: {
      tags: ["Mark"],
      summary: "Clear all marks",
      description: "Deletes all marks from the database (admin operation)",
      response: {
        200: {
          description: "All marks deleted",
          type: "object",
          properties: {
            message: { type: "string" },
            count: { type: "number" },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const result = await clearAllMarks();
      return reply.send({
        message: "All marks deleted successfully",
        count: result.count,
      });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message || "Failed to clear marks" });
    }
  });
}

