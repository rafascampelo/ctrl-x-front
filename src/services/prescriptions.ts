import { z, type ZodType } from "zod";
import { fetchJson } from "./api-client";
import {
  prescriptionCompletionSchema,
  prescriptionCreateSchema,
  prescriptionPageSchema,
  prescriptionSchema,
  type PrescriptionInput,
} from "@/types/prescriptions";

function request<T>(
  path: string,
  schema: ZodType<T>,
  options: RequestInit = {},
) {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("Endereço da API não configurado.");
  return fetchJson(`${base.replace(/\/$/, "")}${path}`, schema, {
    ...options,
    credentials: "include",
  });
}

export function listPatientPrescriptions(
  cursor?: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", z.string().uuid().parse(cursor));
  return request(`/me/prescriptions?${query.toString()}`, prescriptionPageSchema, {
    signal,
  });
}

export function logPrescriptionCompletion(
  prescriptionId: string,
  notes?: string,
) {
  const id = z.string().uuid().parse(prescriptionId);
  return request(
    `/me/prescriptions/${id}/completions`,
    prescriptionCompletionSchema,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notes?.trim() ? { notes: notes.trim() } : {}),
    },
  );
}

export function listProfessionalPatientPrescriptions(
  patientId: string,
  cursor?: string,
  signal?: AbortSignal,
) {
  const pid = z.string().uuid().parse(patientId);
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", z.string().uuid().parse(cursor));
  return request(
    `/patients/${pid}/prescriptions?${query.toString()}`,
    prescriptionPageSchema,
    { signal },
  );
}

export function createPatientPrescription(
  patientId: string,
  input: PrescriptionInput,
) {
  const pid = z.string().uuid().parse(patientId);
  const parsed = prescriptionCreateSchema.parse(input);
  return request(`/patients/${pid}/prescriptions`, prescriptionSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
}