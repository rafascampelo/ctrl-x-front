import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/services/api-client.ts";
import {
  getAllLinks,
  getPatient,
  getPatients,
  getProfile,
  requestLink,
  transitionLink,
  updateProfile,
} from "../src/services/care.ts";
import {
  linkSchema,
  profileFormSchema,
  profileSchema,
  profileUpdate,
} from "../src/types/care.ts";
import { registrationSchema } from "../src/features/auth/auth.ts";

export const patient = {
  id: "10000000-0000-4000-8000-000000000001",
  user_id: "20000000-0000-4000-8000-000000000001",
  full_name: "Paciente de teste",
  role: "PATIENT" as const,
};
export const professional = {
  ...patient,
  id: "10000000-0000-4000-8000-000000000002",
  user_id: "20000000-0000-4000-8000-000000000002",
  role: "PROFESSIONAL" as const,
  full_name: "Fisioterapeuta de teste",
  crefito_region: 3,
  crefito_number: "12345-F",
  verification_status: "unverified" as const,
};
export const pendingLink = {
  id: "30000000-0000-4000-8000-000000000001",
  patient_id: patient.id,
  professional_id: professional.id,
  status: "pending" as const,
  created_at: "2026-11-15T12:00:00Z",
  accepted_at: null,
  revoked_at: null,
  closed_at: null,
};

test("profiles support legacy CREFITO and require paired valid fields when editing", () => {
  assert.equal(profileSchema.safeParse(patient).success, true);
  assert.equal(
    profileSchema.safeParse({
      ...professional,
      crefito_region: null,
      crefito_number: null,
    }).success,
    true,
  );
  assert.equal(
    profileFormSchema.safeParse({ role: "PATIENT", full_name: "  " }).success,
    false,
  );
  assert.equal(
    profileFormSchema.safeParse({ role: "PROFESSIONAL", full_name: "Pessoa" })
      .success,
    false,
  );
  for (const number of ["000-F", "12345678-F", "123-TO", "../123-F"]) {
    assert.equal(
      profileFormSchema.safeParse({ ...professional, crefito_number: number })
        .success,
      false,
    );
  }
  assert.deepEqual(profileUpdate(professional, professional), {
    full_name: professional.full_name,
  });
  assert.deepEqual(
    profileUpdate(professional, {
      ...professional,
      crefito_number: "000123-f",
    }),
    {
      full_name: professional.full_name,
      crefito_region: 3,
      crefito_number: "123-F",
    },
  );
  assert.throws(() => profileUpdate(patient, professional));
});

test("professional registration requires CREFITO while patient registration remains compatible", () => {
  const values = {
    email: "synthetic@example.test",
    full_name: "Pessoa de teste",
    password: "synthetic-pass-123",
    confirmation: "synthetic-pass-123",
    role: "PROFESSIONAL",
  };
  assert.equal(registrationSchema.safeParse(values).success, false);
  assert.equal(
    registrationSchema.safeParse({
      ...values,
      crefito_region: 3,
      crefito_number: "123-F",
    }).success,
    true,
  );
  assert.equal(
    registrationSchema.safeParse({ ...values, role: "PATIENT" }).success,
    true,
  );
});

test("profile GET enforces session identity and role", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options: RequestInit) => {
      assert.equal(options.credentials, "include");
      assert.equal(options.cache, "no-store");
      return Response.json(patient);
    },
  );
  assert.deepEqual(await getProfile(patient.user_id, patient.role), patient);
  await assert.rejects(
    getProfile(professional.user_id, "PROFESSIONAL"),
    (error) => error instanceof ApiError && error.status === 403,
  );
});

test("profile PATCH sends only editable fields and preserves the input on failure", async (context) => {
  const values = {
    ...professional,
    full_name: "Nome atualizado",
    verification_status: "verified",
  };
  context.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(url, "/api/v1/me");
      assert.equal(options.method, "PATCH");
      assert.deepEqual(JSON.parse(String(options.body)), {
        full_name: "Nome atualizado",
      });
      return Response.json(
        { detail: "Unable to update profile with these details" },
        { status: 409 },
      );
    },
  );
  await assert.rejects(
    updateProfile(professional, values),
    (error) => error instanceof ApiError && error.status === 409,
  );
  assert.equal(values.full_name, "Nome atualizado");
});

test("link requests use professional profile UUID and confirmed transition endpoints", async (context) => {
  const calls: string[] = [];
  context.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      calls.push(url);
      assert.equal(options.credentials, "include");
      assert.equal(options.method, "POST");
      if (url.endsWith("/professional-links")) {
        assert.deepEqual(JSON.parse(String(options.body)), {
          professional_id: professional.id,
        });
        return Response.json(pendingLink, { status: 201 });
      }
      assert.equal(options.body, undefined);
      if (url.endsWith("/accept"))
        return Response.json({
          ...pendingLink,
          status: "active",
          accepted_at: "2026-11-15T12:01:00Z",
        });
      return new Response(null, { status: 204 });
    },
  );
  assert.equal((await requestLink(professional.id)).status, "pending");
  assert.equal(
    (await transitionLink(pendingLink.id, "accept"))?.status,
    "active",
  );
  assert.equal(await transitionLink(pendingLink.id, "reject"), undefined);
  assert.equal(await transitionLink(pendingLink.id, "revoke"), undefined);
  assert.deepEqual(
    calls.map((url) => url.split("/").at(-1)),
    ["professional-links", "accept", "reject", "revoke"],
  );
});

test("all link pages are read before reporting an active relationship", async (context) => {
  context.mock.method(globalThis, "fetch", async (url: string) =>
    Response.json(
      url.includes("cursor=")
        ? {
            items: [
              {
                ...pendingLink,
                id: "30000000-0000-4000-8000-000000000002",
                status: "active",
              },
            ],
            next_cursor: null,
          }
        : { items: [pendingLink], next_cursor: pendingLink.id },
    ),
  );
  assert.deepEqual(
    (await getAllLinks()).map((link) => link.status),
    ["pending", "active"],
  );
});

test("pagination rejects cursor loops and inconsistent multiple active links", async (context) => {
  const fetch = context.mock.method(globalThis, "fetch", async () =>
    Response.json({ items: [pendingLink], next_cursor: pendingLink.id }),
  );
  await assert.rejects(getAllLinks(), /leitura dos vínculos/);
  fetch.mock.mockImplementation(async () =>
    Response.json({
      items: [
        { ...pendingLink, status: "active" },
        {
          ...pendingLink,
          id: "30000000-0000-4000-8000-000000000002",
          status: "active",
        },
      ],
      next_cursor: null,
    }),
  );
  await assert.rejects(getAllLinks(), /vínculo ativo/);
});

test("every backend link status is parsed and unknown states fail closed", () => {
  for (const status of [
    "pending",
    "active",
    "rejected",
    "revoked",
    "cancelled",
  ])
    assert.equal(
      linkSchema.safeParse({ ...pendingLink, status }).success,
      true,
    );
  assert.equal(
    linkSchema.safeParse({ ...pendingLink, status: "invented" }).success,
    false,
  );
});

test("patients use authorized list and detail endpoints with cursor support", async (context) => {
  context.mock.method(globalThis, "fetch", async (url: string) => {
    if (url.includes("?")) {
      assert.ok(url.includes(`cursor=${patient.id}`));
      return Response.json({ items: [patient], next_cursor: null });
    }
    assert.ok(url.endsWith(`/patients/${patient.id}`));
    return Response.json(patient);
  });
  assert.equal((await getPatients(patient.id)).items[0].id, patient.id);
  assert.equal((await getPatient(patient.id)).full_name, patient.full_name);
});

for (const status of [401, 403, 404, 409, 422]) {
  test(`care requests preserve HTTP ${status} and the service message`, async (context) => {
    context.mock.method(globalThis, "fetch", async () =>
      Response.json({ detail: "Service message" }, { status }),
    );
    await assert.rejects(
      requestLink(professional.id),
      (error) =>
        error instanceof ApiError &&
        error.status === status &&
        error.detail === "Service message",
    );
  });
}

test("network failures and invalid UUIDs do not return synthetic success", async (context) => {
  const fetch = context.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fetch failed");
  });
  await assert.rejects(getAllLinks(), /fetch failed/);
  const count = fetch.mock.callCount();
  assert.throws(() => requestLink("invalid"));
  assert.equal(fetch.mock.callCount(), count);
});
