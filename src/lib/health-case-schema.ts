import { z } from 'zod';

export const registryCaseInputSchema = z.object({
  disease: z.enum(['dengue', 'chikungunya']),
  yearBE: z.number().int().min(2400).max(2700),
  fullName: z.string().default(''),
  ageYears: z.number().int().min(0).max(150).nullable().default(null),
  address: z.string().default(''),
  moo: z.number().int().min(1).max(30).nullable().default(null),
  onsetDate: z.string().nullable().default(null),
  treatDate: z.string().nullable().default(null),
  notifyDate: z.string().nullable().default(null),
  diagnosis: z.string().default(''),
  careType: z.string().default(''),
  hospital: z.string().default(''),
  note: z.string().default(''),
});
export type RegistryCaseInput = z.infer<typeof registryCaseInputSchema>;

export interface RegistryDocFields {
  disease: 'dengue' | 'chikungunya';
  yearBE: number; fullName: string; ageYears: number | null; address: string; moo: number | null;
  onsetDate: Date | null; treatDate: Date | null; notifyDate: Date | null;
  diagnosis: string; careType: string; hospital: string; note: string;
}

/** แปลง input (ISO string) → ฟิลด์ document (Date|null) — วันที่พัง/ว่าง = null */
export function toRegistryDocFields(input: RegistryCaseInput): RegistryDocFields {
  const d = (s: string | null): Date | null => {
    if (!s) return null;
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };
  return {
    disease: input.disease, yearBE: input.yearBE, fullName: input.fullName, ageYears: input.ageYears,
    address: input.address, moo: input.moo,
    onsetDate: d(input.onsetDate), treatDate: d(input.treatDate), notifyDate: d(input.notifyDate),
    diagnosis: input.diagnosis, careType: input.careType, hospital: input.hospital, note: input.note,
  };
}
