import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { z } from "zod";
import { authRequest } from "../src/features/auth/auth.ts";
import { fetchJson } from "../src/services/api-client.ts";
import {
  reportSessionLifetime,
  reportSignedOut,
  reportUnauthorized,
  watchSession,
} from "../src/services/session.ts";

process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api/v1";

function observe(t: TestContext, pathname: string, broadcastChannel?: object) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const browser = Object.assign(new EventTarget(), {
    location: { pathname },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    BroadcastChannel: broadcastChannel,
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  const expire = t.mock.fn();
  const stop = watchSession(expire);
  t.after(() => {
    stop();
    Reflect.deleteProperty(globalThis, "window");
  });
  return { expire, browser };
}

test("login starts expiry and me uses the remaining lifetime", async (t) => {
  const { expire } = observe(t, "/patient/dashboard");
  const user = { id: "10000000-0000-4000-8000-000000000001", email: "synthetic@example.test", role: "PATIENT" };
  t.mock.method(globalThis, "fetch", async (input: string) =>
    Response.json(user, { headers: { "X-Session-Remaining": input.endsWith("/login") ? "900" : "1" } }));
  await authRequest("login", { email: user.email, password: "synthetic-password" });
  t.mock.timers.tick(899_000);
  assert.equal(expire.mock.callCount(), 0);
  await authRequest("me");
  t.mock.timers.tick(999);
  assert.equal(expire.mock.callCount(), 0);
  t.mock.timers.tick(1);
  reportUnauthorized();
  assert.equal(expire.mock.callCount(), 1);
});

test("guest session lookup and invalid login leave the login form available", async (t) => {
  const { expire, browser } = observe(t, "/login");
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ detail: "Unauthorized" }, { status: 401 }));
  await assert.rejects(authRequest("me"), { status: 401 });
  assert.equal(expire.mock.callCount(), 0);
  browser.location.pathname = "/professional/dashboard";
  await assert.rejects(authRequest("login", {}), { status: 401 });
  assert.equal(expire.mock.callCount(), 0);
  await assert.rejects(fetchJson("/me/calendar", z.unknown()), { status: 401 });
  assert.equal(expire.mock.callCount(), 1);
});

test("returning to the page catches an elapsed deadline after timer throttling", (t) => {
  const { expire, browser } = observe(t, "/patient/timeline");
  reportSessionLifetime("60");
  t.mock.timers.setTime(61_000);
  browser.dispatchEvent(new Event("pageshow"));
  assert.equal(expire.mock.callCount(), 1);
});

test("broadcasts successful logout and ends the session in another tab", (t) => {
  const channel = Object.assign(new EventTarget(), {
    postMessage: t.mock.fn(),
    close: t.mock.fn(),
  });
  const { expire } = observe(t, "/patient/timeline", class {
    constructor() {
      return channel;
    }
  });
  reportSessionLifetime("900");
  reportSignedOut();
  assert.equal(channel.postMessage.mock.callCount(), 1);
  assert.deepEqual(channel.postMessage.mock.calls[0].arguments, ["signed-out"]);
  assert.equal(expire.mock.callCount(), 0);

  channel.dispatchEvent(new MessageEvent("message", { data: "signed-out" }));
  assert.equal(expire.mock.callCount(), 1);
  assert.deepEqual(expire.mock.calls[0].arguments, ["signed-out"]);
  t.mock.timers.tick(900_000);
  assert.equal(expire.mock.callCount(), 1);
});
