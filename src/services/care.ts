import { z, type ZodType } from "zod";
import { ApiError, fetchJson } from "./api-client.ts";
import {
  linkPageSchema,
  linkRequestSchema,
  linkSchema,
  patientPageSchema,
  patientProfileSchema,
  profileSchema,
  profileUpdate,
  type Profile,
  type ProfileValues,
} from "../types/care.ts";

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

function pageQuery(cursor?: string) {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", z.string().uuid().parse(cursor));
  return params;
}

export async function getProfile(
  userId: string,
  role: Profile["role"],
  signal?: AbortSignal,
) {
  const profile = await request("/me", profileSchema, { signal });
  if (profile.user_id !== userId || profile.role !== role)
    throw new ApiError(403);
  return profile;
}

export async function updateProfile(profile: Profile, values: ProfileValues) {
  const updated = await request("/me", profileSchema, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profileUpdate(profile, values)),
  });
  if (
    updated.id !== profile.id ||
    updated.user_id !== profile.user_id ||
    updated.role !== profile.role
  )
    throw new ApiError(403);
  return updated;
}

export function getLinks(cursor?: string, signal?: AbortSignal) {
  return request(
    `/me/professional-links?${pageQuery(cursor)}`,
    linkPageSchema,
    { signal },
  );
}

// Read every page before deciding whether a patient already has an active link.
export async function getAllLinks(signal?: AbortSignal) {
  const items = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await getLinks(cursor, signal);
    items.push(...page.items);
    if (!page.next_cursor) break;
    if (seen.has(page.next_cursor))
      throw new Error("Não foi possível concluir a leitura dos vínculos.");
    seen.add(page.next_cursor);
    cursor = page.next_cursor;
  } while (cursor);
  const unique = [...new Map(items.map((link) => [link.id, link])).values()];
  const activePatients = unique
    .filter((link) => link.status === "active")
    .map((link) => link.patient_id);
  if (new Set(activePatients).size !== activePatients.length)
    throw new Error(
      "Não foi possível confirmar o vínculo ativo. Atualize a página.",
    );
  return unique;
}

export function requestLink(professionalId: string) {
  return request("/me/professional-links", linkSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      linkRequestSchema.parse({ professional_id: professionalId }),
    ),
  });
}

export function transitionLink(
  id: string,
  action: "accept" | "reject" | "revoke",
) {
  const linkId = z.string().uuid().parse(id);
  const path = `/me/professional-links/${linkId}/${action}`;
  if (action === "accept") return request(path, linkSchema, { method: "POST" });
  return request(path, z.undefined(), { method: "POST" });
}

export function getPatients(cursor?: string, signal?: AbortSignal) {
  return request(`/patients?${pageQuery(cursor)}`, patientPageSchema, {
    signal,
  });
}

export async function getAllPatients(signal?: AbortSignal) {
  const items = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await getPatients(cursor, signal);
    items.push(...page.items);
    if (!page.next_cursor) break;
    if (seen.has(page.next_cursor)) {
      throw new Error(
        "N\u00e3o foi poss\u00edvel concluir a leitura dos pacientes.",
      );
    }
    seen.add(page.next_cursor);
    cursor = page.next_cursor;
  } while (cursor);
  return [...new Map(items.map((patient) => [patient.id, patient])).values()];
}

export async function getPatient(id: string, signal?: AbortSignal) {
  const patient = await request(
    `/patients/${z.string().uuid().parse(id)}`,
    patientProfileSchema,
    { signal },
  );
  if (patient.id !== id) throw new ApiError(403);
  return patient;
}
