import { z } from "zod";

export const clinicalRecordFormSchema = z.object({
  chief_complaint: z
    .string()
    .trim()
    .min(1, "Informe a queixa principal do paciente.")
    .max(1000, "Use até 1000 caracteres."),
  anamnesis: z
    .string()
    .trim()
    .min(1, "Preencha a anamnese clínica.")
    .max(4000, "Use até 4000 caracteres."),
  physical_assessment: z
    .string()
    .trim()
    .min(1, "Descreva a avaliação física.")
    .max(4000, "Use até 4000 caracteres."),
  body_region: z
    .string()
    .trim()
    .min(1, "Informe a região corporal avaliada.")
    .max(120, "Use até 120 caracteres."),
  pain_intensity: z
    .number()
    .int()
    .min(0, "Mínimo 0.")
    .max(10, "Máximo 10.")
    .nullable()
    .optional(),
  functional_limitations: z
    .string()
    .trim()
    .min(1, "Descreva as limitações funcionais.")
    .max(2000, "Use até 2000 caracteres."),
  therapeutic_goals: z
    .string()
    .trim()
    .min(1, "Informe as metas terapêuticas.")
    .max(2000, "Use até 2000 caracteres."),
  care_plan: z
    .string()
    .trim()
    .min(1, "Defina o plano de cuidado.")
    .max(3000, "Use até 3000 caracteres."),
  notes: z
    .string()
    .trim()
    .max(2000, "Use até 2000 caracteres.")
    .nullable()
    .optional(),
});

export type ClinicalRecordInput = z.infer<typeof clinicalRecordFormSchema>;

export const amendmentCreateSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Informe o motivo do adendo.")
    .max(300, "Use até 300 caracteres."),
  content: z
    .string()
    .trim()
    .min(1, "Escreva o conteúdo complementar do adendo.")
    .max(3000, "Use até 3000 caracteres."),
});

export type AmendmentInput = z.infer<typeof amendmentCreateSchema>;

export const clinicalAmendmentSchema = z.object({
  id: z.string().uuid(),
  author_id: z.string().uuid(),
  author_name: z.string().nullable().optional(),
  reason: z.string(),
  content: z.string(),
  created_at: z.string().datetime({ offset: true }),
});

export type ClinicalAmendment = z.infer<typeof clinicalAmendmentSchema>;

export const clinicalRecordSchema = z.object({
  id: z.string().uuid(),
  patient_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  professional_name: z.string().nullable().optional(),
  status: z.enum(["draft", "finalized"]),
  chief_complaint: z.string(),
  anamnesis: z.string(),
  physical_assessment: z.string(),
  body_region: z.string(),
  pain_intensity: z.number().int().min(0).max(10).nullable().optional(),
  functional_limitations: z.string(),
  therapeutic_goals: z.string(),
  care_plan: z.string(),
  notes: z.string().nullable().optional(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  finalized_at: z.string().datetime({ offset: true }).nullable().optional(),
  amendments: z.array(clinicalAmendmentSchema).default([]),
});

export type ClinicalRecord = z.infer<typeof clinicalRecordSchema>;

export const clinicalRecordPageSchema = z.object({
  items: z.array(clinicalRecordSchema),
  next_cursor: z.string().uuid().nullable().optional(),
});