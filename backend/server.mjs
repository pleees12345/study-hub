/**
 * Study Hub API proxy
 * --------------------
 * Routes every external API call through a single origin so the app works behind
 * a school firewall, and keeps the Groq API key server-side (never on the device).
 *
 * Endpoints:
 *   POST /api/groq/*           -> https://api.groq.com/openai/v1/*  (server injects the key)
 *   GET  /api/wiki?action=...  -> https://en.wikipedia.org/w/api.php (read-only actions only)
 *   GET  /api/ddg?q=...        -> https://api.duckduckgo.com/
 *   GET  /                     -> health check
 *
 * Zero dependencies — runs with any Node.js 18+:
 *   GROQ_API_KEY=... node backend/server.mjs
 * or put the key in backend/.env and just run:
 *   node backend/server.mjs
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---- Minimal .env loader (no dependencies) ----
const here = path.dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(path.join(here, ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
    }
  }
} catch {
  // No backend/.env — rely on real environment variables instead.
}

const PORT = Number(process.env.PORT || 8787);
const GROQ_API_KEY = (process.env.GROQ_API_KEY || "").trim();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const GROQ_BASE = "https://api.groq.com/openai/v1";
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const DDG_API = "https://api.duckduckgo.com";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Forward a request to an upstream host and stream the response back. */
async function proxy(res, { url, method = "GET", headers = {}, body }) {
  try {
    const upstream = await fetch(url, { method, headers, body });
    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get("content-type");
    res.writeHead(upstream.status, {
      ...(contentType ? { "Content-Type": contentType } : {}),
      "Content-Length": buf.length,
    });
    res.end(buf);
  } catch (err) {
    json(res, 502, { error: "upstream_failed", detail: String(err?.message || err) });
  }
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // Health check.
  if (url.pathname === "/" || url.pathname === "/health") {
    json(res, 200, {
      ok: true,
      service: "Study Hub API proxy",
      groq: GROQ_API_KEY ? "configured" : "missing",
    });
    return;
  }

  // ---- Groq: /api/groq/* -> https://api.groq.com/openai/v1/* ----
  if (url.pathname.startsWith("/api/groq/") && (req.method === "POST" || req.method === "GET")) {
    if (!GROQ_API_KEY) {
      json(res, 500, { error: "GROQ_API_KEY is not configured on this server." });
      return;
    }
    const sub = url.pathname.slice("/api/groq".length); // e.g. "/chat/completions"
    const upstreamUrl = `${GROQ_BASE}${sub}${url.search}`;
    const body = await readBody(req);
    await proxy(res, {
      url: upstreamUrl,
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: body.length ? body : undefined,
    });
    return;
  }

  // ---- Wikipedia: /api/wiki?* -> en.wikipedia.org/w/api.php?* (read-only) ----
  if (url.pathname === "/api/wiki" && req.method === "GET") {
    const action = url.searchParams.get("action");
    if (!action || !/^(query|parse)$/.test(action)) {
      json(res, 400, { error: "Unsupported Wikipedia action." });
      return;
    }
    await proxy(res, { url: `${WIKI_API}${url.search}`, method: "GET" });
    return;
  }

  // ---- DuckDuckGo: /api/ddg?* -> api.duckduckgo.com/?* ----
  if (url.pathname === "/api/ddg" && req.method === "GET") {
    await proxy(res, { url: `${DDG_API}${url.search}`, method: "GET" });
    return;
  }

  json(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Study Hub API proxy listening on http://localhost:${PORT}`);
  console.log(`Groq key: ${GROQ_API_KEY ? "configured" : "MISSING — set GROQ_API_KEY"}`);
});