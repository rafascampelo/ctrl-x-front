import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const sessions = new Set();
const user = { id: randomUUID(), role: "PATIENT", email: "patient@example.test" };

createServer((req, res) => {
  const cookie = req.headers.cookie ?? "";
  const token = cookie.replace(/^ctrlx_access=/, "");
  const sessionCookie = value => "ctrlx_access=" + value + "; HttpOnly; Path=/; SameSite=None";
  if (req.url === "/health") return res.end("ok");
  if (req.method === "POST" && req.headers.origin !== "http://127.0.0.1:4310") {
    return res.writeHead(403).end();
  }
  if (req.url === "/api/v1/auth/login" && req.method === "POST") {
    const id = randomUUID();
    sessions.add(id);
    res.setHeader("Set-Cookie", sessionCookie(id) + "; Max-Age=900");
  } else if (!sessions.has(token)) {
    return res.writeHead(401).end();
  } else if (req.url === "/api/v1/auth/refresh") {
    sessions.delete(token);
    const id = randomUUID();
    sessions.add(id);
    return res.writeHead(204, { "Set-Cookie": sessionCookie(id) + "; Max-Age=900",
      "X-Session-Remaining": "900" }).end();
  } else if (req.url === "/api/v1/auth/logout") {
    sessions.delete(token);
    return res.writeHead(204, { "Set-Cookie": sessionCookie("") + "; Max-Age=0" }).end();
  } else if (req.url !== "/api/v1/auth/me") {
    return res.writeHead(404).end();
  }
  res.writeHead(200, { "Content-Type": "application/json", "X-Session-Remaining": "900" });
  res.end(JSON.stringify(user));
}).listen(4311, "127.0.0.1");
