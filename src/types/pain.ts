import { z } from "zod";

export const BODY_REGIONS = [
  { id: "cervical", label: "Cervical / Pescoço", group: "Coluna" },
  { id: "ombro_direito", label: "Ombro Direito", group: "Membros Superiores" },
  { id: "ombro_esquerdo", label: "Ombro Esquerdo", group: "Membros Superiores" },
  { id: "toracica", label: "Coluna Torácica / Costas", group: "Coluna" },
  { id: "cotovelo_punho", label: "Cotovelo, Punho ou Mão", group: "Membros Superiores" },
  { id: "lombar", label: "Coluna Lombar", group: "Coluna" },
  { id: "quadril", label: "Quadril / Pelve", group: "Membros Inferiores" },
  { id: "joelho_direito", label: "Joelho Direito", group: "Membros Inferiores" },
  { id: "joelho_esquerdo", label: "Joelho Esquerdo", group: "Membros Inferiores" },
  { id: "tornozelo_pe", label: "Tornozelo ou Pé", group: "Membros Inferiores" },
] as const;

export const painRecordCreateSchema = z.object({
  region: z
    .string()
    .trim()
    .min(1, "Selecione ou informe a região do corpo.")
    .max(100, "Use até 100 caracteres."),
  intensity: z
    .number({ error: "Selecione a intensidade da dor." })
    .int()
    .min(0, "A intensidade mínima é 0.")
    .max(10, "A intensidade máxima é 10."),
  description: z
    .string()
    .trim()
    .max(1000, "Use até 1000 caracteres.")
    .optional(),
});

export type PainRecordInput = z.infer<typeof painRecordCreateSchema>;

export const painRecordSchema = z.object({
  id: z.string().uuid(),
  patient_id: z.string().uuid().optional(),
  region: z.string(),
  intensity: z.number().int().min(0).max(10),
  description: z.string().nullable().optional(),
  recorded_at: z.string().datetime({ offset: true }).optional(),
  created_at: z.string().datetime({ offset: true }),
});

export type PainRecord = z.infer<typeof painRecordSchema>;

export const painRecordPageSchema = z.object({
  items: z.array(painRecordSchema),
  next_cursor: z.string().uuid().nullable().optional(),
});

export function getPainSeverity(intensity: number): {
  level: "none" | "mild" | "moderate" | "severe";
  label: string;
} {
  if (intensity === 0) return { level: "none", label: "Sem dor" };
  if (intensity <= 3) return { level: "mild", label: "Dor leve" };
  if (intensity <= 6) return { level: "moderate", label: "Dor moderada" };
  return { level: "severe", label: "Dor intensa" };
}

export function formatBodyRegion(regionId: string): string {
  const found = BODY_REGIONS.find((r) => r.id === regionId);
  return found ? found.label : regionId;
}