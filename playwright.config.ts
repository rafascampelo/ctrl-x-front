import { defineConfig } from "@playwright/test";

const frontend = "http://127.0.0.1:4310";
const api = "http://127.0.0.1:4311";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: frontend, viewport: { width: 390, height: 844 }, trace: "off" },
  projects: [{ name: "webkit", use: { browserName: "webkit" } },
    { name: "chromium", use: { browserName: "chromium" } }],
  webServer: [
    { command: "node e2e/auth-api.mjs", url: api + "/health" },
    { command: "npm run start -- --hostname 127.0.0.1 --port 4310", url: frontend + "/api/health",
      env: { API_URL: api + "/api/v1" } },
  ],
});
