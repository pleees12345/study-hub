/**
 * Study Hub API proxy — Cloudflare Workers edition.
 * Free tier, runs on the public internet (outside the school firewall), handles
 * CORS for you, and keeps the Groq API key server-side.
 *
 * Deploy:
 *   1. npx wrangler login
 *   2. npx wrangler secret put GROQ_API_KEY   (or set it in the dashboard)
 *   3. npx wrangler deploy
 *   4. Point the app at your worker: build with VITE_API_BASE=https://<your-worker>.workers.dev
 *
 * Endpoints (same as backend/server.mjs):
 *   POST /api/groq/*  -> api.groq.com/openai/v1/*
 *   GET  /api/wiki?*  -> en.wikipedia.org/w/api.php?*   (read-only actions)
 *   GET  /api/ddg?*   -> api.duckduckgo.com/?*
 *   GET  /            -> health check
 */

const GROQ_BASE = "https://api.groq.com/openai/v1";
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const DDG_API = "https://api.duckduckgo.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "Study Hub API proxy",
        groq: env.GROQ_API_KEY ? "configured" : "missing",
      });
    }

    // ---- Groq ----
    if (url.pathname.startsWith("/api/groq/")) {
      if (!env.GROQ_API_KEY) {
        return json({ error: "GROQ_API_KEY is not configured on this worker." }, 500);
      }
      const upstream = `${GROQ_BASE}${url.pathname.slice("/api/groq".length)}${url.search}`;
      const upstreamReq = new Request(upstream, {
        method: request.method,
        headers: {
          "Content-Type": request.headers.get("content-type") || "application/json",
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: request.method === "POST" ? await request.arrayBuffer() : undefined,
      });
      const upstreamRes = await fetch(upstreamReq);
      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: { "Content-Type": upstreamRes.headers.get("content-type") || "application/json", ...CORS },
      });
    }

    // ---- Wikipedia (read-only actions only) ----
    if (url.pathname === "/api/wiki" && request.method === "GET") {
      const action = url.searchParams.get("action");
      if (!action || !/^(query|parse)$/.test(action)) {
        return json({ error: "Unsupported Wikipedia action." }, 400);
      }
      const upstreamRes = await fetch(`${WIKI_API}${url.search}`);
      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: { "Content-Type": upstreamRes.headers.get("content-type") || "application/json", ...CORS },
      });
    }

    // ---- DuckDuckGo ----
    if (url.pathname === "/api/ddg" && request.method === "GET") {
      const upstreamRes = await fetch(`${DDG_API}${url.search}`);
      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: { "Content-Type": upstreamRes.headers.get("content-type") || "application/json", ...CORS },
      });
    }

    return json({ error: "not_found" }, 404);
  },
};