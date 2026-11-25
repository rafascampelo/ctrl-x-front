import { expect, test } from "@playwright/test";

test("login survives navigation, reload and renewal, then logout ends the session", async ({ page, context }) => {
  await page.goto("/login");
  // An unrelated frontend cookie must never reach the API.
  await context.addCookies([{ name: "frontend_only", value: "fixture", url: page.url() }]);
  await page.locator("#email").fill("patient@example.test");
  await page.locator("#password").fill("synthetic-password");
  const login = page.waitForResponse(response => response.url().endsWith("/api/v1/auth/login"));
  await page.getByRole("button", { name: /entrar no meu/i }).click();
  const issued = await (await login).headerValue("set-cookie");
  expect(/;\s*SameSite=Lax(?:;|$)/i.test(issued ?? "")).toBe(true);
  await expect(page).toHaveURL(/\/patient\/dashboard$/);
  const me = page.waitForResponse(response => response.url().endsWith("/api/v1/auth/me") && response.ok());
  await page.reload();
  expect((await me).headers()["cache-control"]).toContain("no-store");

  // Inspect only metadata so assertion output never includes a session value.
  const cookie = (await context.cookies()).find(item => item.name === "ctrlx_access");
  expect([cookie?.domain, cookie?.path, cookie?.httpOnly])
    .toEqual(["127.0.0.1", "/api/v1", true]);

  // Isolate explicit rotation from background dashboard requests using the previous session.
  await page.goto("/api/health");
  const status = (path: string, method: string) => page.evaluate(async ([path, method]) =>
    (await fetch("/api/v1/auth/" + path, { method })).status, [path, method]);
  expect(await status("refresh", "POST")).toBe(204);
  expect(await status("me", "GET")).toBe(200);
  expect(await status("logout", "POST")).toBe(204);
  expect(await status("me", "GET")).toBe(401);
  expect((await context.cookies()).some(item => item.name === "ctrlx_access")).toBe(false);
});

test("writes require the frontend origin", async ({ request }) => {
  for (const headers of [undefined, { Origin: "https://other.example.test" }]) {
    const response = await request.post("/api/v1/auth/login", { headers });
    expect(response.status()).toBe(403);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
