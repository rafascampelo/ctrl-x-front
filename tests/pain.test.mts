import assert from "node:assert/strict";
import { test } from "node:test";
import { createPainRecord, listPainRecords } from "../src/services/pain.ts";
import { ApiError } from "../src/services/api-client.ts";

process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api/v1/";
process.env.TZ = "America/New_York";

const entry = {
  id: "10000000-0000-4000-8000-000000000001",
  patient_id: "20000000-0000-4000-8000-000000000002",
  region: "lombar",
  intensity: 0,
  description: null,
  occurred_at: "2026-03-08T05:30:00Z",
  created_at: "2026-03-08T06:00:00Z",
  updated_at: "2026-03-08T06:00:00Z",
};

test("creates a diary entry with the patient's cookie and valid zero intensity", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch",
    async () => Response.json(entry, { status: 201 }));
  const saved = await createPainRecord({ region: " lombar ", intensity: 0, description: " " });
  assert.equal(saved.occurred_at, entry.occurred_at);
  const [url, options] = fetchMock.mock.calls[0].arguments as unknown as [string, RequestInit];
  assert.equal(url, "http://localhost:8000/api/v1/me/pain-entries");
  assert.equal(options.credentials, "include");
  assert.equal(options.method, "POST");
  assert.equal(options.cache, "no-store");
  assert.deepEqual(JSON.parse(String(options.body)), { region: "lombar", intensity: 0 });
});

test("lists the patient's own entries using the opaque cursor and local date boundaries", async (t) => {
  const cursor = "2026-03-08T05:30:00+00:00|" + entry.id;
  const fetchMock = t.mock.method(globalThis, "fetch",
    async () => Response.json({ items: [entry], next_cursor: cursor }));
  const signal = new AbortController().signal;
  const page = await listPainRecords({
    startDate: "2026-03-08",
    endDate: "2026-03-08",
    cursor,
  }, signal);
  assert.equal(page.items[0].occurred_at, entry.occurred_at);
  assert.equal(page.next_cursor, cursor);
  const [url, options] = fetchMock.mock.calls[0].arguments as unknown as [string, RequestInit];
  const parsed = new URL(url);
  assert.equal(parsed.pathname, "/api/v1/me/pain-entries");
  assert.deepEqual(Object.fromEntries(parsed.searchParams), {
    limit: "20",
    cursor,
    start: "2026-03-08T05:00:00.000Z",
    end: "2026-03-09T04:00:00.000Z",
  });
  assert.equal(options.credentials, "include");
  assert.equal(options.signal, signal);
});

test("a missing history response stays an error", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ detail: "Profile not found" }, { status: 404 }));
  await assert.rejects(listPainRecords({}), (error) =>
    error instanceof ApiError && error.status === 404);
});
