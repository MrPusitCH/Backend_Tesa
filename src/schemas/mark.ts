// src/schemas/mark.ts
import { z } from "zod";

export const markSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color (e.g., #FF5733)"),
  pos: z.array(z.number()).length(2, "Position must be [lat, lng]"),
  radius: z.preprocess(
    v => typeof v === "string" ? parseFloat(v) : v,
    z.number().positive("Radius must be a positive number")
  ),
}).passthrough();

export const createMarkSchema = markSchema;

export const updateMarkSchema = markSchema.partial();

export type Mark = z.infer<typeof markSchema> & {
  id: string;
  createdAt: string;
};

export type CreateMarkInput = z.infer<typeof createMarkSchema>;
export type UpdateMarkInput = z.infer<typeof updateMarkSchema>;

