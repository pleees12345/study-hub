/**
 * Keyless web research helpers for the tutor chat.
 *
 * Uses the Wikipedia API (anonymously, CORS-enabled via `origin=*`) for most
 * factual lookups, with the DuckDuckGo Instant Answer API as a supplementary
 * source for quick facts and definitions. No API keys required.
 */

export type WebSource = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResult = {
  text: string; // combined, model-ready context
  sources: WebSource[];
};

const WIKI_API = "https://en.wikipedia.org/w/api.php";

/** Tops out a snippet so we don't feed the model thousands of words per result. */
function clip(text: string, max = 1200): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

// Common question/command words that add noise to a search query.
const STOP_WORDS = [
  "summarise",
  "summarize",
  "summary",
  "explain",
  "tell me",
  "what is",
  "what are",
  "what was",
  "what were",
  "who is",
  "who was",
  "when is",
  "when was",
  "when did",
  "where is",
  "where was",
  "why is",
  "why was",
  "how is",
  "how do",
  "how does",
  "can you",
  "could you",
  "please",
  "about",
  "define",
  "describe",
  "meaning of",
  "research",
  "find",
];

/**
 * Strip question/command phrasing so Wikipedia gets a clean keyphrase,
 * e.g. "can you summarise the woman in black by susan hill" → "the woman in black susan hill".
 */
function cleanQuery(query: string): string {
  let q = query.toLowerCase();
  for (const stop of STOP_WORDS) {
    q = q.replace(new RegExp(`\\b${stop}\\b`, "g"), " ");
  }
  // Remove punctuation ("the woman in black, by susan hill" → "the woman in black susan hill").
  q = q.replace(/[^\p{L}\p{N}\s]/gu, " ");
  // Collapse whitespace.
  return q.replace(/\s+/g, " ").trim();
}

/** Full-text search (list=search) — much better than opensearch for natural-language queries. */
async function wikiSearchTitles(query: string, limit = 6): Promise<string[]> {
  const url = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&srlimit=${limit}&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia search failed (${res.status})`);
  const data = (await res.json()) as {
    query?: { search?: Array<{ title: string; snippet?: string }> };
  };
  return (data.query?.search ?? [])
    .map((r) => r.title)
    // Filter out obvious non-article matches (disambiguation-heavy titles are fine, but drop lists like "List of ...")
    .filter((t) => !/^List of /i.test(t));
}

async function wikiExtracts(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const joined = titles.join("|");
  // NOTE: do NOT use exintro=1 — the intro is often just adaptation trivia and
  // omits the actual plot/content. Fetch the full article text instead.
  const url = `${WIKI_API}?action=query&prop=extracts&explaintext=1&format=json&origin=*&titles=${encodeURIComponent(
    joined,
  )}`;
  const res = await fetch(url);
  if (!res.ok) return out;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { title?: string; extract?: string }> };
  };
  const pages = data.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    if (page.title && page.extract) out.set(page.title, clip(page.extract, 4000));
  }
  return out;
}

async function duckDuckGoAnswer(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query,
    )}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const data = (await res.json()) as {
      AbstractText?: string;
      Answer?: string;
      Definition?: string;
    };
    const text = data.AbstractText || data.Answer || data.Definition || "";
    return text ? clip(text) : "";
  } catch {
    return ""; // DuckDuckGo is best-effort; Wikipedia is the primary source.
  }
}

export async function searchWeb(query: string): Promise<WebSearchResult | null> {
  const q = query.trim();
  if (!q) return null;

  const keyphrase = cleanQuery(q);
  const sources: WebSource[] = [];
  const parts: string[] = [];

  // 1) Wikipedia titles + full article extracts, using a cleaned keyphrase.
  try {
    const titles = await wikiSearchTitles(keyphrase, 5);
    const extracts = await wikiExtracts(titles);
    for (const title of titles) {
      const snippet = extracts.get(title);
      if (!snippet) continue;
      sources.push({
        title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        snippet,
      });
      parts.push(`### ${title}\n${snippet}`);
    }
  } catch {
    // fall through to DuckDuckGo
  }

  // 2) DuckDuckGo quick answer as a supplement.
  const ddg = await duckDuckGoAnswer(q);
  if (ddg) {
    sources.push({ title: "DuckDuckGo", url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`, snippet: ddg });
    parts.push(`### Quick answer\n${ddg}`);
  }

  if (parts.length === 0) return null;

  return {
    text: parts.join("\n\n"),
    sources,
  };
}