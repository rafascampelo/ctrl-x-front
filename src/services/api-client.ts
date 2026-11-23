import type { ZodType } from "zod";
import { reportUnauthorized } from "./session.ts";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly detail?: string) {
    super(detail ?? `A requisição falhou (HTTP ${status}).`);
    this.name = "ApiError";
  }
}

export async function fetchJson<T>(
  url: string | URL,
  schema: ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  const response = await fetch(url, { ...options, headers, cache: "no-store" });
  if (!response.ok) {
    if (response.status === 401) reportUnauthorized();
    const payload: unknown = await response.json().catch(() => null);
    const detail = payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
      ? payload.detail
      : undefined;
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return schema.parse(undefined);
  const data: unknown = await response.json();
  return schema.parse(data);
}
