import { z } from "zod";

export const ocrStatusSchema = z.enum([
  "pending",
  "completed",
  "failed",
  "unsupported",
]);

export const clinicalDocumentSchema = z.object({
  id: z.string().uuid(),
  patient_id: z.string().uuid(),
  uploaded_by: z.string().uuid(),
  title: z.string(),
  file_name: z.string(),
  content_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  ocr_status: ocrStatusSchema.default("pending"),
  extracted_text: z.string().nullable().optional(),
  ocr_error: z.string().nullable().optional(),
  is_verified: z.boolean().default(false),
  verified_at: z.string().datetime({ offset: true }).nullable().optional(),
  created_at: z.string().datetime({ offset: true }),
});

export type ClinicalDocument = z.infer<typeof clinicalDocumentSchema>;

export const clinicalDocumentPageSchema = z.object({
  items: z.array(clinicalDocumentSchema),
  next_cursor: z.string().uuid().nullable().optional(),
});

export const verifyOcrSchema = z.object({
  extracted_text: z
    .string()
    .trim()
    .max(20000, "Use até 20.000 caracteres."),
});

export type VerifyOcrInput = z.infer<typeof verifyOcrSchema>;

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB