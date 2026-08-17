import { z } from 'zod';
import { DISASTER_TYPES } from '@/lib/disaster-types';

export const incidentInputSchema = z.object({
  disasterType: z.enum(DISASTER_TYPES),
  year: z.number().int().min(2400).max(2700),
  dateText: z.string().min(1),
  method: z.string().default(''),
  areaType: z.string().default(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  imageFile: z.string().default(''),
});
export type IncidentInput = z.infer<typeof incidentInputSchema>;
