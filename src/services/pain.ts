import type { ZodType } from "zod";
import { fetchJson } from "./api-client.ts";
import {
  painRecordCreateSchema,
  painRecordPageSchema,
  painRecordSchema,
  type PainRecordInput,
} from "../types/pain.ts";

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

function dayBoundary(date: string, nextDay = false): string {
  const boundary = new Date(date + "T00:00:00");
  if (nextDay) boundary.setDate(boundary.getDate() + 1);
  return boundary.toISOString();
}

export function listPainRecords(
  params: { cursor?: string; startDate?: string; endDate?: string },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ limit: "20" });
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.startDate) query.set("start", dayBoundary(params.startDate));
  if (params.endDate) query.set("end", dayBoundary(params.endDate, true));

  return request(`/me/pain-entries?${query.toString()}`, painRecordPageSchema, {
    signal,
  });
}

export function createPainRecord(input: PainRecordInput) {
  const parsed = painRecordCreateSchema.parse(input);
  return request("/me/pain-entries", painRecordSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      region: parsed.region,
      intensity: parsed.intensity,
      ...(parsed.description ? { description: parsed.description } : {}),
    }),
  });
}