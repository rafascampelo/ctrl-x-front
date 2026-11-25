import type { NextRequest } from "next/server";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path.every(segment => /^[a-zA-Z0-9_-]+$/.test(segment))) {
    return new Response(null, { status: 400, headers: privateHeaders });
  }
  const read = request.method === "GET" || request.method === "HEAD";
  const origin = request.headers.get("origin");
  // Keep the original Origin for FastAPI's independent exact allowlist check.
  if (!read && (!origin || origin !== request.nextUrl.protocol + "//" + request.headers.get("host"))) {
    return new Response(null, { status: 403, headers: privateHeaders });
  }

  try {
    const base = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (!base) throw new Error();
    const url = new URL(base);
    const health = path.length === 1 && path[0] === "health";
    url.pathname = health ? "/health" : url.pathname.replace(/\/$/, "") + "/" + path.join("/");
    url.search = request.nextUrl.search;

    const headers = new Headers();
    for (const name of ["accept", "content-type", "origin"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const session = request.cookies.get("ctrlx_access");
    if (!health && session) headers.set("cookie", "ctrlx_access=" + encodeURIComponent(session.value));

    const options: RequestInit & { duplex: "half" } = {
      method: request.method, headers, body: read ? undefined : request.body, duplex: "half",
      cache: "no-store", redirect: "error", signal: request.signal,
    };
    const upstream = await fetch(url, options);
    const outgoing = new Headers(privateHeaders);
    for (const name of ["content-type", "content-disposition", "retry-after", "x-session-remaining"]) {
      const value = upstream.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) {
      if (cookie.startsWith("ctrlx_access=")) {
        // Keep FastAPI's expiry, HttpOnly and Secure settings on issue, renewal and deletion.
        outgoing.append("set-cookie", cookie.replace(/;\s*Domain=[^;]*/ig, "")
          .replace(/;\s*SameSite=[^;]*/ig, "").replace(/;\s*Path=[^;]*/ig, "")
          + "; SameSite=Lax; Path=/api/v1");
      }
    }
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch {
    return new Response(null, { status: 502, headers: privateHeaders });
  }
}

export { proxy as GET, proxy as HEAD, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
