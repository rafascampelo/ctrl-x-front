import { z, type ZodType } from "zod";
import { fetchJson } from "./api-client";
import {
  amendmentCreateSchema,
  clinicalAmendmentSchema,
  clinicalRecordFormSchema,
  clinicalRecordPageSchema,
  clinicalRecordSchema,
  type AmendmentInput,
  type ClinicalRecordInput,
} from "@/types/clinical-records";

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

export function listClinicalRecords(
  params: { patientId?: string; cursor?: string },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ limit: "20" });
  if (params.patientId) {
    query.set("patient_id", z.string().uuid().parse(params.patientId));
  }
  if (params.cursor) query.set("cursor", z.string().uuid().parse(params.cursor));

  return request(
    `/clinical-records?${query.toString()}`,
    clinicalRecordPageSchema,
    { signal },
  );
}

export function createClinicalRecordDraft(
  patientId: string,
  input: ClinicalRecordInput,
) {
  const pid = z.string().uuid().parse(patientId);
  const parsed = clinicalRecordFormSchema.parse(input);
  return request("/clinical-records", clinicalRecordSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_id: pid,
      ...parsed,
    }),
  });
}

export function updateClinicalRecordDraft(
  recordId: string,
  input: ClinicalRecordInput,
) {
  const id = z.string().uuid().parse(recordId);
  const parsed = clinicalRecordFormSchema.parse(input);
  return request(`/clinical-records/${id}`, clinicalRecordSchema, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
}

export function finalizeClinicalRecord(recordId: string) {
  const id = z.string().uuid().parse(recordId);
  return request(`/clinical-records/${id}/finalize`, clinicalRecordSchema, {
    method: "POST",
  });
}

export function appendClinicalRecordAmendment(
  recordId: string,
  input: AmendmentInput,
) {
  const id = z.string().uuid().parse(recordId);
  const parsed = amendmentCreateSchema.parse(input);
  return request(
    `/clinical-records/${id}/amendments`,
    clinicalAmendmentSchema,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    },
  );
}