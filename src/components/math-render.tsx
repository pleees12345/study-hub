import { useMemo } from "react";
import DOMPurify from "dompurify";

/**
 * Lightweight, dependency-free renderer for two kinds of AI-generated figures:
 *  1. Function graphs  -> a code fence with language "graph" containing plain math
 *     expressions, e.g.  ```graph  y=x^2, y=sin(x)  ```
 *     or a JSON spec:    ```graph  {"xmin":-5,"xmax":5,"fns":["x^2","sin(x)"]}  ```
 *  2. Geometry figures -> an SVG code fence, e.g.  ```svg  <svg>...</svg>  ```
 *     Rendered safely as parsed DOM (no innerHTML injection).
 */

const WIDTH = 360;
const HEIGHT = 260;
const PAD = 30;

// ---- Safe math parser -----------------------------------------------------
// A tiny recursive-descent parser supporting + - * / ^ ( ) sqrt sin cos tan abs pi e
type Token = { t: "num" | "var" | "op" | "lp" | "rp" | "const"; v: string };

function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const cleaned = s.replace(/\s+/g, "").toLowerCase();
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < cleaned.length && /[0-9.]/.test(cleaned[i])) num += cleaned[i++];
      out.push({ t: "num", v: num });
    } else if (ch === "x") {
      out.push({ t: "var", v: "x" });
      i++;
    } else if ("+-*/^".includes(ch)) {
      out.push({ t: "op", v: ch });
      i++;
    } else if (ch === "(") {
      out.push({ t: "lp", v: "(" });
      i++;
    } else if (ch === ")") {
      out.push({ t: "rp", v: ")" });
      i++;
    } else {
      // functions / constants
      const ident = cleaned.slice(i).match(/^(sqrt|sin|cos|tan|abs|pi|e)/)?.[1];
      if (ident) {
        out.push({ t: "const", v: ident });
        i += ident.length;
      } else {
        throw new Error("Unexpected char: " + ch);
      }
    }
  }
  return out;
}

function evaluate(tokens: Token[], x: number): number {
  let pos = 0;
  function peek(): Token | undefined {
    return tokens[pos];
  }
  function consume(): Token | undefined {
    return tokens[pos++];
  }
  function parseExpr(): number {
    let v = parseTerm();
    while (peek()?.t === "op" && (peek()!.v === "+" || peek()!.v === "-")) {
      const op = consume()!.v;
      const rhs = parseTerm();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek()?.t === "op" && (peek()!.v === "*" || peek()!.v === "/")) {
      const op = consume()!.v;
      const rhs = parseFactor();
      v = op === "*" ? v * rhs : v / rhs;
    }
    return v;
  }
  function parseFactor(): number {
    let v = parseUnary();
    if (peek()?.t === "op" && peek()!.v === "^") {
      consume();
      const rhs = parseFactor();
      v = Math.pow(v, rhs);
    }
    return v;
  }
  function parseUnary(): number {
    if (peek()?.t === "op" && (peek()!.v === "-" || peek()!.v === "+")) {
      const op = consume()!.v;
      const v = parseUnary();
      return op === "-" ? -v : v;
    }
    return parsePostfix();
  }
  function parsePostfix(): number {
    const tok = consume();
    if (!tok) return NaN;
    if (tok.t === "num") return parseFloat(tok.v);
    if (tok.t === "var") return x;
    if (tok.t === "const") {
      switch (tok.v) {
        case "pi":
          return Math.PI;
        case "e":
          return Math.E;
        case "sqrt":
          return Math.sqrt(arg());
        case "sin":
          return Math.sin(arg());
        case "cos":
          return Math.cos(arg());
        case "tan":
          return Math.tan(arg());
        case "abs":
          return Math.abs(arg());
      }
    }
    if (tok.t === "lp") {
      const v = parseExpr();
      consume(); // rp
      return v;
    }
    return NaN;
  }
  function arg(): number {
    // function call: expect '(' expr ')'
    if (peek()?.t === "lp") {
      consume();
      const v = parseExpr();
      consume(); // rp
      return v;
    }
    return parsePostfix();
  }
  return parseExpr();
}

function tryEval(fn: string, x: number): number | null {
  try {
    const v = evaluate(tokenize(fn), x);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

// ---- Graph renderer -------------------------------------------------------
function parseGraphSpec(raw: string): {
  xmin: number;
  xmax: number;
  ymin?: number;
  ymax?: number;
  fns: string[];
} {
  const trimmed = raw.trim();
  let xmin = -6;
  let xmax = 6;
  let ymin: number | undefined;
  let ymax: number | undefined;
  let fns: string[] = [];

  if (trimmed.startsWith("{")) {
    try {
      const spec = JSON.parse(trimmed);
      if (typeof spec.xmin === "number") xmin = spec.xmin;
      if (typeof spec.xmax === "number") xmax = spec.xmax;
      if (typeof spec.ymin === "number") ymin = spec.ymin;
      if (typeof spec.ymax === "number") ymax = spec.ymax;
      if (Array.isArray(spec.fns)) fns = spec.fns.map(String);
      else if (typeof spec.fns === "string") fns = [spec.fns];
      return { xmin, xmax, ymin, ymax, fns };
    } catch {
      // fall through to expression parsing
    }
  }

  fns = trimmed
    .split(/[,\n]/)
    .map((f) => f.replace(/^y\s*=\s*/, "").trim())
    .filter(Boolean);
  return { xmin, xmax, ymin, ymax, fns };
}

function buildGraphSvg(raw: string): string {
  const { xmin, xmax, ymin, ymax, fns } = parseGraphSpec(raw.trim());
  const fnsValid = fns.filter((f) => f && tryEval(f, 0) !== null);
  if (fnsValid.length === 0) return "";

  const samples = 240;
  const xs: number[] = [];
  for (let i = 0; i <= samples; i++) xs.push(xmin + ((xmax - xmin) * i) / samples);

  // Determine y-range from data if not provided.
  let lo = ymin ?? Infinity;
  let hi = ymax ?? -Infinity;
  if (ymin === undefined || ymax === undefined) {
    for (const f of fnsValid) {
      for (const x of xs) {
        const y = tryEval(f, x);
        if (y === null) continue;
        if (!Number.isFinite(y)) continue;
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "";
  // pad and avoid lo===hi
  const pad = (hi - lo || 2) * 0.12;
  lo -= pad;
  hi += pad;
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }

  const sx = (x: number) => PAD + ((x - xmin) / (xmax - xmin)) * (WIDTH - 2 * PAD);
  const sy = (y: number) => HEIGHT - PAD - ((y - lo) / (hi - lo)) * (HEIGHT - 2 * PAD);

  // axes
  const hasZeroX = xmin <= 0 && xmax >= 0;
  const hasZeroY = lo <= 0 && hi >= 0;
  let axes = "";
  if (hasZeroY) axes += `<line x1="${PAD}" y1="${sy(0)}" x2="${WIDTH - PAD}" y2="${sy(0)}" stroke="#94a3b8" stroke-width="1"/>`;
  if (hasZeroX) axes += `<line x1="${sx(0)}" y1="${PAD}" x2="${sx(0)}" y2="${HEIGHT - PAD}" stroke="#94a3b8" stroke-width="1"/>`;

  // grid ticks
  let grid = "";
  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const x = xmin + ((xmax - xmin) * i) / xTicks;
    const px = sx(x);
    grid += `<line x1="${px}" y1="${PAD}" x2="${px}" y2="${HEIGHT - PAD}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    const label = Math.round(x * 100) / 100;
    if (hasZeroY || i === 0 || i === xTicks)
      grid += `<text x="${px}" y="${HEIGHT - PAD + 12}" font-size="9" fill="#64748b" text-anchor="middle">${label}</text>`;
  }
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = lo + ((hi - lo) * i) / yTicks;
    const py = sy(y);
    grid += `<line x1="${PAD}" y1="${py}" x2="${WIDTH - PAD}" y2="${py}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    const label = Math.round(y * 100) / 100;
    if (hasZeroX || i === 0 || i === yTicks)
      grid += `<text x="${PAD - 6}" y="${py + 3}" font-size="9" fill="#64748b" text-anchor="end">${label}</text>`;
  }

  const palette = ["#0f766e", "#b45309", "#1d4ed8", "#be185d", "#4d7c0f", "#7c3aed"];
  let paths = "";
  fnsValid.forEach((f, idx) => {
    const color = palette[idx % palette.length];
    let d = "";
    let started = false;
    for (const x of xs) {
      const y = tryEval(f, x);
      const ok = y !== null && Number.isFinite(y) && y >= lo - 2 && y <= hi + 2;
      if (!ok) {
        started = false;
        continue;
      }
      const px = sx(x);
      const py = sy(y);
      d += started ? ` L ${px} ${py}` : ` M ${px} ${py}`;
      started = true;
    }
    if (d) {
      paths += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
      // legend
      const ly = PAD + 14 + idx * 16;
      paths += `<rect x="${WIDTH - PAD - 150}" y="${ly - 9}" width="10" height="10" fill="${color}" rx="1"/>`;
      paths += `<text x="${WIDTH - PAD - 136}" y="${ly}" font-size="10" fill="#334155">y=${f}</text>`;
    }
  });

  const box = `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#ffffff" rx="10"/>`;
  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Graph">${box}${grid}${axes}${paths}</svg>`;
}

// ---- SVG geometry (flexibly scaled) ---------------------------------------
function normalizeSvg(raw: string): string {
  // Strip any wrapper fences/triple backticks that might have leaked in.
  let s = raw.trim();
  s = s.replace(/^```(?:svg)?\s*/i, "").replace(/```\s*$/i, "");
  if (!/^<svg/i.test(s)) {
    // wrap bare shapes
    s = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
  }
  // Force a concrete viewBox if missing so it scales nicely.
  if (!/viewBox=/i.test(s)) {
    s = s.replace(/<svg([^>]*)>/, (_m, attrs) => `<svg${attrs} viewBox="0 0 200 200">`);
  }
  return s;
}

// ---- Export component -----------------------------------------------------
export function MathRender({ kind, value }: { kind: "graph" | "svg"; value: string }) {
  const html = useMemo(() => {
    if (kind === "graph") {
      return buildGraphSvg(value);
    }
    // Sanitize any AI-generated SVG so scripts/bad attributes can't execute.
    return DOMPurify.sanitize(normalizeSvg(value), { USE_PROFILES: { svg: true, svgFilters: true } });
  }, [kind, value]);

  if (!html) {
    return <div className="rounded-md bg-muted px-3 py-2 font-mono text-xs">{value}</div>;
  }

  return (
    <div className="my-2 flex justify-center overflow-x-auto">
      <div
        className="max-w-full"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
