import { z } from "zod";

export const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(8).max(128).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes.");
export const locationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(""),
  category: z.enum(["academic", "food", "hostel", "sports", "services", "outdoors"]),
  longitude: z.number().finite().min(-180).max(180),
  latitude: z.number().finite().min(-90).max(90),
  entranceLongitude: z.number().finite().min(-180).max(180).nullable().optional(),
  entranceLatitude: z.number().finite().min(-90).max(90).nullable().optional(),
  sourceUrl: z.string().url().max(500).refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "ppsu.ac.in" || url.hostname.endsWith(".ppsu.ac.in"));
  }, "Use an official PPSU website source."),
  routeNodeId: z.string().uuid().nullable().optional(),
});

export const graphNodeSchema = z.object({
  label: z.string().trim().min(2).max(120),
  longitude: z.number().finite().min(-180).max(180),
  latitude: z.number().finite().min(-90).max(90),
});

export const graphEdgeSchema = z.object({
  fromNodeId: z.string().uuid(),
  toNodeId: z.string().uuid(),
  distanceMeters: z.number().positive().max(10000),
  coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2).max(500),
  instruction: z.string().trim().min(3).max(180),
  isBidirectional: z.boolean().default(true),
});