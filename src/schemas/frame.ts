import { z } from "zod";

// simple helper: allow string numbers
const num = z.preprocess((v: unknown) => typeof v === "string" ? parseFloat(v) : v, z.number());
const int = z.preprocess((v: unknown) => typeof v === "string" ? parseInt(String(v), 10) : v, z.number().int());

// frame message schema (topic: drones/frames)
export const frameSchema = z.object({
  fram_id: z.string(),           // frame id (as string)
  cam_id: z.string().min(1),     // camera id
  token_id: z.object({
    camera_info: z.object({
      name: z.string(),
      sort: z.string(),
      location: z.string(),
      institute: z.string(),
    }),
  }),
  timestamp: z.coerce.date(),    // time of frame
  image_info: z.object({
    width: int,
    height: int,
  }),
  objects: z.array(z.object({
    obj_id: z.string().min(1),   // object id (was drone_id)
    type: z.string().optional(),
    lat: num,
    lng: num,                     // was lon
    alt: num,                     // was alt_m
    speed_kt: num,                // was speed_mps (knots instead of m/s)
  })),
});

export type FramePayload = z.infer<typeof frameSchema>;






