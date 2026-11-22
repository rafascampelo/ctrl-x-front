import { z } from "zod";

export const exerciseItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome do exercício.")
    .max(150, "Use até 150 caracteres."),
  sets: z
    .number({ error: "Informe as séries." })
    .int()
    .min(1, "Mínimo 1 série.")
    .max(20, "Máximo 20 séries."),
  reps: z
    .string()
    .trim()
    .min(1, "Informe repetições ou tempo.")
    .max(60, "Use até 60 caracteres."),
  notes: z
    .string()
    .trim()
    .max(500, "Use até 500 caracteres.")
    .nullable()
    .optional(),
});

export type ExerciseItem = z.infer<typeof exerciseItemSchema>;

export const prescriptionCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Informe o título da rotina.")
    .max(150, "Use até 150 caracteres."),
  frequency: z
    .string()
    .trim()
    .min(1, "Informe a frequência recomendada.")
    .max(120, "Use até 120 caracteres."),
  clinical_notes: z
    .string()
    .trim()
    .max(1000, "Use até 1000 caracteres.")
    .optional(),
  exercises: z
    .array(exerciseItemSchema)
    .min(1, "Adicione pelo menos um exercício à prescrição."),
});

export type PrescriptionInput = z.infer<typeof prescriptionCreateSchema>;

export const prescriptionCompletionSchema = z.object({
  id: z.string().uuid(),
  completed_at: z.string().datetime({ offset: true }),
  notes: z.string().nullable().optional(),
});

export const prescriptionSchema = z.object({
  id: z.string().uuid(),
  patient_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  professional_name: z.string().nullable().optional(),
  title: z.string(),
  frequency: z.string(),
  clinical_notes: z.string().nullable().optional(),
  status: z.enum(["active", "archived"]).default("active"),
  created_at: z.string().datetime({ offset: true }),
  exercises: z.array(exerciseItemSchema),
  completions: z.array(prescriptionCompletionSchema).default([]),
});

export type Prescription = z.infer<typeof prescriptionSchema>;

export const prescriptionPageSchema = z.object({
  items: z.array(prescriptionSchema),
  next_cursor: z.string().uuid().nullable().optional(),
});