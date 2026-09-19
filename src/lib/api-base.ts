/**
 * Base URL for the Study Hub API proxy backend.
 *
 * When VITE_API_BASE is set (e.g. "https://study-hub-api.example.com"), every
 * external API call — Groq AI, Wikipedia and DuckDuckGo research — is routed
 * through that single origin. This is what lets the app work behind a school
 * firewall: only ONE domain needs to be allowed through, and the Groq API key
 * stays on the server instead of being baked into each device.
 *
 * When left empty, the app keeps its existing behaviour (Vite dev proxy for
 * Groq, and direct Wikipedia/DuckDuckGo calls).
 */
const raw = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export const API_BASE = raw.trim().replace(/\/+$/, "");