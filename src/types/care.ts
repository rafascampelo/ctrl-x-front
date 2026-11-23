import { z } from "zod";

const identity = {
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string(),
};

export const patientProfileSchema = z.object({
  ...identity,
  role: z.literal("PATIENT"),
});
export const professionalProfileSchema = z.object({
  ...identity,
  role: z.literal("PROFESSIONAL"),
  crefito_region: z.number().int().min(1).max(22).nullable(),
  crefito_number: z.string().nullable(),
  account_status: z.literal("active").optional(),
  verification_status: z.enum(["unverified", "verified"]),
});
export const profileSchema = z.discriminatedUnion("role", [
  patientProfileSchema,
  professionalProfileSchema,
]);
export type Profile = z.infer<typeof profileSchema>;
export type PatientProfile = z.infer<typeof patientProfileSchema>;

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Informe seu nome completo.")
  .max(200, "Use até 200 caracteres.");
export const crefitoRegionSchema = z
  .number({ error: "Informe a região do CREFITO." })
  .int()
  .min(1, "Use uma região de 1 a 22.")
  .max(22, "Use uma região de 1 a 22.");
export const crefitoNumberSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9]{1,7}(?:-[fF])?$/,
    "Informe até 7 dígitos, com sufixo -F opcional.",
  )
  .refine(
    (value) => Number.parseInt(value, 10) > 0,
    "Informe um registro maior que zero.",
  );
export const profileFormSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("PATIENT"), full_name: fullNameSchema }),
  z.object({
    role: z.literal("PROFESSIONAL"),
    full_name: fullNameSchema,
    crefito_region: crefitoRegionSchema,
    crefito_number: crefitoNumberSchema,
  }),
]);
export type ProfileValues = z.infer<typeof profileFormSchema>;

export const linkRequestSchema = z.object({
  professional_id: z
    .string()
    .trim()
    .uuid("Informe o código completo enviado pelo fisioterapeuta."),
});
export const linkSchema = z.object({
  id: z.string().uuid(),
  patient_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  status: z.enum(["pending", "active", "revoked", "rejected", "cancelled"]),
  created_at: z.string().datetime({ offset: true }),
  accepted_at: z.string().datetime({ offset: true }).nullable(),
  revoked_at: z.string().datetime({ offset: true }).nullable(),
  closed_at: z.string().datetime({ offset: true }).nullable(),
});
export type CareLink = z.infer<typeof linkSchema>;
export const linkPageSchema = z.object({
  items: z.array(linkSchema),
  next_cursor: z.string().uuid().nullable(),
});
export const patientPageSchema = z.object({
  items: z.array(patientProfileSchema),
  next_cursor: z.string().uuid().nullable(),
});

export const linkStatusLabels: Record<CareLink["status"], string> = {
  pending: "Solicitação pendente",
  active: "Vínculo ativo",
  rejected: "Solicitação recusada",
  cancelled: "Solicitação cancelada",
  revoked: "Vínculo encerrado",
};

export function profileUpdate(profile: Profile, values: ProfileValues) {
  const parsed = profileFormSchema.parse(values);
  if (parsed.role !== profile.role)
    throw new Error("Perfil de acesso incompatível.");
  if (profile.role === "PROFESSIONAL" && parsed.role === "PROFESSIONAL") {
    const normalizedNumber = `${Number.parseInt(parsed.crefito_number, 10)}-F`;
    if (
      profile.crefito_region !== parsed.crefito_region ||
      profile.crefito_number !== normalizedNumber
    ) {
      return {
        full_name: parsed.full_name,
        crefito_region: parsed.crefito_region,
        crefito_number: normalizedNumber,
      };
    }
  }
  return { full_name: parsed.full_name };
}
