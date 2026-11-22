import { z, type ZodType } from "zod";
import { fetchJson } from "./api-client";
import {
  calendarMonthSchema,
  timelinePageSchema,
  type TimelineCategory,
} from "@/types/timeline";

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

export function getPatientTimeline(
  params: {
    cursor?: string;
    category?: TimelineCategory | "all";
    date?: string;
  },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ limit: "25" });
  if (params.cursor) query.set("cursor", z.string().uuid().parse(params.cursor));
  if (params.category && params.category !== "all") {
    query.set("category", params.category);
  }
  if (params.date) query.set("date", params.date);

  return request(`/me/timeline?${query.toString()}`, timelinePageSchema, {
    signal,
  });
}

export function getPatientCalendar(month: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ month });
  return request(`/me/calendar?${query.toString()}`, calendarMonthSchema, {
    signal,
  });
}