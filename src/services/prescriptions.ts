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
  return fetchJson(`/api/v1${path}`, schema, {
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

export async function getAllProfessionalPatientPrescriptions(
  patientId: string,
  signal?: AbortSignal,
) {
  const items = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await listProfessionalPatientPrescriptions(
      patientId,
      cursor,
      signal,
    );
    items.push(...page.items);
    if (!page.next_cursor) break;
    if (seen.has(page.next_cursor)) {
      throw new Error(
        "N\u00e3o foi poss\u00edvel concluir a leitura das prescri\u00e7\u00f5es.",
      );
    }
    seen.add(page.next_cursor);
    cursor = page.next_cursor;
  } while (cursor);
  return [...new Map(items.map((item) => [item.id, item])).values()];
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
