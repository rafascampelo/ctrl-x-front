import assert from "node:assert/strict";
import { test } from "node:test";
import { getPatientCalendar, getPatientTimeline } from "../src/services/timeline.ts";

process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api/v1";

test("timeline sends a local date, category and opaque cursor", async (t) => {
  const cursor = "2026-11-01T03:00:00+00:00|10000000-0000-4000-8000-000000000001";
  const request = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ items: [], next_cursor: cursor }));
  const page = await getPatientTimeline({
    cursor,
    date: "2026-11-01",
    month: "2026-11",
    timezone: "America/Sao_Paulo",
    category: "pain",
  });
  assert.equal(page.next_cursor, cursor);
  const [input, init] = request.mock.calls[0].arguments as unknown as [string, RequestInit];
  const url = new URL(input);
  assert.equal(url.pathname, "/api/v1/me/timeline");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    limit: "25",
    timezone: "America/Sao_Paulo",
    cursor,
    category: "pain",
    date: "2026-11-01",
  });
  assert.equal(init.credentials, "include");
});

test("calendar preserves zero intensity and its local monthly totals", async (t) => {
  const fixture = {
    month: "2026-11",
    timezone: "America/Sao_Paulo",
    days: [{ date: "2026-11-01", pain_count: 1 }],
    pain: { count: 1, average_intensity: 0, latest_intensity: 0 },
  };
  const request = t.mock.method(globalThis, "fetch", async () => Response.json(fixture));
  const result = await getPatientCalendar(fixture.month, fixture.timezone);
  assert.deepEqual(result.pain, fixture.pain);
  const [input] = request.mock.calls[0].arguments as unknown as [string];
  const url = new URL(input);
  assert.equal(url.pathname, "/api/v1/me/calendar");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    month: fixture.month, timezone: fixture.timezone,
  });
});
