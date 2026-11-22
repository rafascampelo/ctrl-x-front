import { z, type ZodType } from "zod";
import { fetchJson } from "./api-client";
import {
  painRecordCreateSchema,
  painRecordPageSchema,
  painRecordSchema,
  type PainRecordInput,
} from "@/types/pain";

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

export function listPainRecords(
  params: { cursor?: string; startDate?: string; endDate?: string },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ limit: "20" });
  if (params.cursor) query.set("cursor", z.string().uuid().parse(params.cursor));
  if (params.startDate) query.set("start_date", params.startDate);
  if (params.endDate) query.set("end_date", params.endDate);

  return request(`/pain-records?${query.toString()}`, painRecordPageSchema, {
    signal,
  });
}

export function createPainRecord(input: PainRecordInput) {
  const parsed = painRecordCreateSchema.parse(input);
  return request("/pain-records", painRecordSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      region: parsed.region,
      intensity: parsed.intensity,
      ...(parsed.description ? { description: parsed.description } : {}),
    }),
  });
}