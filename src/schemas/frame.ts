import { z } from "zod";

// simple helper: allow string numbers
const num = z.preprocess(v => typeof v === "string" ? parseFloat(v) : v, z.number());
const int = z.preprocess(v => typeof v === "string" ? parseInt(String(v), 10) : v, z.number().int());

// frame message schema (topic: drones/frames)
export const frameSchema = z.object({
  fram_id: z.string(),
  cam_id: z.string(),
  token_id: z.object({
    camera_info: z.object({
      name: z.string(),
      sort: z.string(),
      location: z.string(),
      institute: z.string(),
    }),
  }).optional(),
  timestamp: z.coerce.date(),
  image_info: z.object({
    width: int,
    height: int,
  }).optional(),
  objects: z.array(z.object({
    obj_id: z.string(),
    type: z.string(),
    lat: num,
    lng: num,
    alt: num,
    speed_kt: num,
  })),
});

export type FramePayload = z.infer<typeof frameSchema>;






