import assert from "node:assert/strict";
import { test } from "node:test";
import { authRequest, AuthError, credentialsSchema, dashboardPath, registrationSchema, logout } from "../src/features/auth/auth.ts";
import { ApiError } from "../src/services/api-client.ts";

test("registration validates password, confirmation and required name", () => {
  const input = { email: "patient@example.test", password: "valid-password-123", confirmation: "valid-password-123", full_name: "Person", role: "PATIENT" };
  assert.equal(registrationSchema.safeParse(input).success, true);
  assert.equal(registrationSchema.safeParse({ ...input, confirmation: "different" }).success, false);
  assert.equal(registrationSchema.safeParse({ ...input, full_name: "  " }).success, false);
  assert.equal(credentialsSchema.safeParse({ email: "invalid", password: "short" }).success, false);
});

test("logout revokes the cookie session through the API and accepts HTTP 204", async (context) => {
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/v1/auth/logout");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "include");
    assert.equal(options.cache, "no-store");
    return new Response(null, { status: 204 });
  });
  assert.equal(await logout(), undefined);
});

test("logout propagates backend failures so the UI can offer another attempt", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ detail: "Forbidden" }, { status: 403 }));
  await assert.rejects(logout(), (error) => error instanceof ApiError && error.status === 403);
});

test("authentication sends credentials and validates the API response", async (context) => {
  context.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "/api/v1/auth/login");
    assert.equal(init?.credentials, "include");
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.equal(headers.has("Authorization"), false);
    assert.deepEqual(JSON.parse(String(init?.body)), {
      email: "patient@example.test",
      password: "valid-password-123",
    });
    return Response.json({ id: "00000000-0000-4000-8000-000000000001", email: "patient@example.test", role: "PATIENT" });
  });
  const user = await authRequest("login", { email: "patient@example.test", password: "valid-password-123" });
  assert.equal(dashboardPath(user.role), "/patient/dashboard");
  assert.equal(dashboardPath("PROFESSIONAL"), "/professional/dashboard");
});

test("registration posts to the configured API and accepts a successful 201 response", async (context) => {
  const body = {
    email: "patient@example.test",
    password: "valid-password-123",
    full_name: "Synthetic Patient",
    role: "PATIENT",
  };
  context.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "/api/v1/auth/register");
    assert.equal(init?.method, "POST");
    assert.equal(init?.credentials, "include");
    assert.equal(new Headers(init?.headers).get("Content-Type"), "application/json");
    assert.deepEqual(JSON.parse(String(init?.body)), body);
    return Response.json({
      id: "00000000-0000-4000-8000-000000000001",
      email: body.email,
      role: body.role,
    }, { status: 201 });
  });

  assert.deepEqual(await authRequest("register", body), {
    id: "00000000-0000-4000-8000-000000000001",
    email: body.email,
    role: body.role,
  });
});

test("session lookup includes browser-managed credentials and prevents caching", async (context) => {
  context.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "/api/v1/auth/me");
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "include");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.body, undefined);
    return Response.json({
      id: "00000000-0000-4000-8000-000000000001",
      email: "patient@example.test",
      role: "PATIENT",
    });
  });
  assert.equal((await authRequest("me")).role, "PATIENT");
});

test("API errors preserve status and message", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ detail: "Not authenticated" }, { status: 401 }));
  await assert.rejects(authRequest("me"), (error) => error instanceof AuthError && error.status === 401 && error.message === "Not authenticated");
});
