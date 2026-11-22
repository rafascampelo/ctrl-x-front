import { z, type ZodType } from "zod";
import { ApiError, fetchJson } from "./api-client";
import {
  clinicalDocumentPageSchema,
  clinicalDocumentSchema,
  verifyOcrSchema,
  type VerifyOcrInput,
} from "@/types/documents";

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("Endereço da API não configurado.");
  return base.replace(/\/$/, "");
}

function request<T>(
  path: string,
  schema: ZodType<T>,
  options: RequestInit = {},
) {
  return fetchJson(`${getBaseUrl()}${path}`, schema, {
    ...options,
    credentials: "include",
  });
}

export function listDocuments(
  params: { patientId?: string; cursor?: string },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ limit: "20" });
  if (params.patientId) {
    query.set("patient_id", z.string().uuid().parse(params.patientId));
  }
  if (params.cursor) query.set("cursor", z.string().uuid().parse(params.cursor));

  return request(`/documents?${query.toString()}`, clinicalDocumentPageSchema, {
    signal,
  });
}

export async function uploadClinicalDocument(params: {
  title: string;
  file: File;
  patientId?: string;
}) {
  const formData = new FormData();
  formData.append("title", params.title.trim());
  formData.append("file", params.file);
  if (params.patientId) {
    formData.append("patient_id", z.string().uuid().parse(params.patientId));
  }

  const response = await fetch(`${getBaseUrl()}/documents`, {
    method: "POST",
    body: formData,
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const detail =
      payload &&
      typeof payload === "object" &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : undefined;
    throw new ApiError(response.status, detail);
  }

  return clinicalDocumentSchema.parse(await response.json());
}

export function verifyDocumentOcr(documentId: string, input: VerifyOcrInput) {
  const id = z.string().uuid().parse(documentId);
  const parsed = verifyOcrSchema.parse(input);
  return request(`/documents/${id}/verify`, clinicalDocumentSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
}

export function getDocumentDownloadUrl(documentId: string) {
  const id = z.string().uuid().parse(documentId);
  return `${getBaseUrl()}/documents/${id}/download`;
}