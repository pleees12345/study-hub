export type WeakArea = {
  subject: string;
  topic: string;
  level: "Needs work" | "Review soon" | "Solid";
  insight: string;
};

export type StudyMaterial = {
  kind: "video" | "audio" | "slides";
  title: string;
  content: string;
};

export type VideoScene = {
  heading: string;
  text: string | string[];
  narration: string; // spoken line (in the detected language)
  imagePrompt: string; // what the on-screen visual should convey
};

export type VideoPlan = {
  language: string; // detected language (e.g. "French", "English")
  title: string;
  overview: string;
  scenes: VideoScene[];
};

export type SlideDeck = {
  title: string;
  slides: Array<{ title: string; bullets: string[] }>;
};

export type ExamLevel = "GCSE" | "A-Level";

export const EXAM_LEVELS: ExamLevel[] = ["GCSE", "A-Level"];

export const EXAM_BOARDS = [
  "AQA",
  "Edexcel",
  "OCR",
  "WJEC / Eduqas",
  "Pearson",
  "CCEA",
  "Cambridge (CIE)",
];

export type ExamQuestion = {
  number: number;
  topic: string;
  marks: number;
  question: string;
  markScheme: string;
};

export type ExamPaper = {
  level: ExamLevel;
  board: string;
  subject: string;
  paper: string;
  title: string;
  overview: string;
  questions: ExamQuestion[];
  sources: Array<{ title: string; url: string }>;
};

/** A student's typed answer to a question, keyed by question number. */
export type ExamAnswer = {
  number: number;
  answer: string;
};

/** AI feedback for a single graded question. */
export type GradedQuestion = {
  number: number;
  marksAwarded: number;
  marksMax: number;
  feedback: string;
  correctPoints: string[];
  missingPoints: string[];
};

/** Full AI marking result for a completed paper. */
export type ExamGrade = {
  totalAwarded: number;
  totalMax: number;
  grade: string;
  feedback: string;
  questions: GradedQuestion[];
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

/**
 * The Groq key is baked into the client build as VITE_GROQ_API_KEY so the AI keeps
 * working in a packaged app (Tauri / Electron / PWA) where there is no dev-server
 * proxy. In local dev we still use the Vite proxy (which hides the key) unless a
 * client key is present.
 */
const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim();
const GROQ_BASE = GROQ_API_KEY ? "https://api.groq.com/openai/v1" : "/api/groq";

function groqHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (GROQ_API_KEY) headers.Authorization = `Bearer ${GROQ_API_KEY}`;
  return headers;
}

async function groqChat(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number; json?: boolean; maxTokens?: number },
) {
  const response = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: groqHeaders(),
    body: JSON.stringify({
      model: options?.model ?? "openai/gpt-oss-20b",
      messages,
      temperature: options?.temperature ?? 0.4,
      max_tokens: options?.maxTokens ?? 1200,
      ...(options?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    // Strict JSON mode sometimes rejects long output that's truncated mid-JSON.
    // Retry once without the strict format and rely on extractJson instead.
    if (options?.json && response.status === 400) {
      const retry = await fetch(`${GROQ_BASE}/chat/completions`, {
        method: "POST",
        headers: groqHeaders(),
        body: JSON.stringify({
          model: options?.model ?? "openai/gpt-oss-20b",
          messages,
          temperature: options?.temperature ?? 0.4,
          max_tokens: options?.maxTokens ?? 1200,
        }),
      });
      if (retry.ok) {
        const retryData = (await retry.json()) as {
          choices?: Array<{ message?: { content?: string; reasoning?: string } }>;
        };
        const retryMessage = retryData.choices?.[0]?.message;
        const retryContent = (retryMessage?.content ?? retryMessage?.reasoning ?? "").trim();
        if (retryContent) return retryContent;
      }
    }
    const detail = await response.text();
    throw new Error(detail || `Groq request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning?: string } }>;
  };
  const message = data.choices?.[0]?.message;
  // Reasoning models may write the answer to `reasoning` and leave `content` empty.
  const content = (message?.content ?? message?.reasoning ?? "").trim();
  if (!content) throw new Error("Empty response from Groq");
  return content;
}

function extractJson<T>(raw: string): T {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  // Fall back to the first balanced { ... } block if the model wrapped the JSON in prose.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return JSON.parse(text) as T;
}

export function hasGroqKey() {
  // Works in local dev via the Vite proxy, or in a packaged app via the baked-in key.
  return Boolean(GROQ_API_KEY);
}

export async function analyzeExam(input: {
  notes: string;
  fileName?: string;
  imageDataUrl?: string;
}): Promise<{ summary: string; weakAreas: WeakArea[] }> {
  const system = `You are a study coach. Analyze exam content and return JSON:
{
  "summary": "2-3 sentence overview",
  "weakAreas": [
    { "subject": "", "topic": "", "level": "Needs work" | "Review soon" | "Solid", "insight": "" }
  ]
}
Return 3 to 5 weakAreas. Be concrete and actionable.`;

  const userParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: "text",
      text: `File: ${input.fileName || "none"}\nStudent notes / extracted text:\n${input.notes || "(no notes provided)"}`,
    },
  ];

  if (input.imageDataUrl) {
    userParts.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  }

  const useVision = Boolean(input.imageDataUrl);
  const raw = await groqChat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: useVision ? userParts : userParts[0].text || "",
      },
    ],
    {
      model: useVision ? "qwen/qwen3.6-27b" : "openai/gpt-oss-20b",
      json: true,
    },
  );

  return extractJson(raw);
}

export async function generateMaterial(input: {
  kind: "video" | "audio" | "slides";
  topic: string;
  subject?: string;
}): Promise<StudyMaterial> {
  const kindPrompt = {
    video:
      "You are generating an actual short educational VIDEO (about 2 minutes). " +
      "Produce a complete, film-ready video: a title, a shot-by-shot scene breakdown, " +
      "spoken narration lines, on-screen text, and any visual/audio cues. " +
      "The AI VIDEO ITSELF must be created — this is not just a script. " +
      "Output the narration and scene list that would be used to render the final video.",
    audio:
      "You are generating an actual AUDIO track (about 3 minutes). " +
      "Produce a listen-and-learn audio segment for a student commuting or revising: " +
      "a spoken narration script, pacing cues, and what the AI VOICE should say. " +
      "The AI AUDIO ITSELF must be created — deliver the narration to be rendered as audio.",
    slides:
      "You are generating a real SLIDES deck. " +
      "Produce a finished slide outline with 6-8 slides, each with a title and 3 bullet points. " +
      "The AI SLIDES THEMSELVES must be created — provide the full deck content to render.",
  }[input.kind];

  const raw = await groqChat(
    [
      {
        role: "system",
        content: `You are a revision material generator. Return JSON:
{ "title": "", "content": "" }
${kindPrompt}`,
      },
      {
        role: "user",
        content: `Subject: ${input.subject || "General"}\nTopic: ${input.topic}`,
      },
    ],
    { json: true, maxTokens: 4000 },
  );

  const parsed = extractJson<{ title: string; content: string }>(raw);
  return { kind: input.kind, title: parsed.title, content: parsed.content };
}

export async function generateSlides(input: {
  subject?: string;
  topic: string;
  notes?: string;
}): Promise<SlideDeck> {
  const system = `You create clear, presentable educational slide decks. Return JSON:
{
  "title": "deck title",
  "slides": [
    { "title": "slide title", "bullets": ["bullet 1", "bullet 2", "bullet 3"] }
  ]
}

Rules:
- Create 6 to 10 slides.
- Each slide has a short, clear title and 3 to 5 concise bullets.
- Ground the content in the student's notes when provided; otherwise write a complete lesson from your own knowledge.
- Keep bullets readable on a slide (under ~14 words each).`;

  const raw = await groqChat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `Subject: ${input.subject || "General"}\nTopic: ${input.topic}\nNotes:\n${input.notes || "(no notes)"}`,
      },
    ],
    { json: true, temperature: 0.4, maxTokens: 4000 },
  );

  const parsed = extractJson<SlideDeck>(raw);
  const slides = Array.isArray(parsed.slides) ? parsed.slides : [];
  if (slides.length === 0) {
    throw new Error("The AI returned an empty slide deck. Add more notes or try again.");
  }
  return {
    title: parsed.title || input.topic,
    slides: slides.map((s) => ({
      title: typeof s?.title === "string" ? s.title : "",
      bullets: Array.isArray(s?.bullets)
        ? s.bullets.map((b) => (typeof b === "string" ? b : String(b)))
        : [],
    })),
  };
}

export async function generateExamPaper(input: {
  subject: string;
  level: ExamLevel;
  board: string;
  topic?: string;
}): Promise<ExamPaper> {
  const { searchWeb } = await import("./search");

  // Try to ground the paper in real past-paper context found on the web.
  const query = `${input.subject} ${input.level} ${input.board} past paper questions`;
  let contextBlock = "";
  let sources: Array<{ title: string; url: string }> = [];

  try {
    const web = await searchWeb(query);
    if (web && web.sources.length > 0) {
      contextBlock = `\n\nUseful context found on the web (use it to inspire the question styles and topics):\n${web.text}`;
      sources = web.sources.map((s) => ({ title: s.title, url: s.url }));
    }
  } catch {
    // Web search is best-effort — fall through to the model's own knowledge.
  }

  const system = `You are a UK exam paper setter for ${input.level} ${input.board} ${input.subject}. Return JSON:
{
  "paper": "Paper 1",
  "title": "short title",
  "overview": "one or two sentence summary",
  "questions": [
    {
      "number": 1,
      "topic": "the topic this question covers",
      "marks": 4,
      "question": "the full question, written like a real exam question using exam command words",
      "markScheme": "the model answer / mark scheme points"
    }
  ]
}

Create a realistic exam paper with 8 to 12 questions covering the ${input.level} specification for ${input.subject} (${input.board}).
- Use authentic exam command words and question styles for ${input.level} (e.g. "State", "Explain", "Describe", "Calculate", "Evaluate", "Discuss").
- Match the mark allocation to the difficulty (e.g. 1-2 marks for recall, 3-4 for explanation, 5-6 for evaluation/essay).
- Mirror the format of real past papers (${input.board}) and ${input.level} mark schemes.
- MATH FORMATTING: When a question or mark scheme involves maths, write it in LaTeX using inline math between single dollar signs (e.g. \\(\\sqrt{2}\\)) and display math between double dollar signs (e.g. \\[\\frac{a}{b}\\]). Never write "sqrt(2)" or "x^2" as plain text.${contextBlock}`;

  const raw = await groqChat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `Subject: ${input.subject}\nExam level: ${input.level}\nExam board: ${input.board}\nTopic focus (optional): ${input.topic || "full specification"}`,
      },
    ],
    { json: true, temperature: 0.5, maxTokens: 6000 },
  );

  const parsed = extractJson<Omit<ExamPaper, "level" | "board" | "subject" | "sources">>(raw);
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.map((q, i) => ({
        number: typeof q?.number === "number" ? q.number : i + 1,
        topic: typeof q?.topic === "string" ? q.topic : "",
        marks: typeof q?.marks === "number" ? q.marks : 0,
        question: typeof q?.question === "string" ? q.question : "",
        markScheme: typeof q?.markScheme === "string" ? q.markScheme : "",
      }))
    : [];

  if (questions.length === 0) {
    throw new Error("The AI returned an empty exam paper. Try again or add a topic.");
  }

  return {
    level: input.level,
    board: input.board,
    subject: input.subject,
    paper: parsed.paper || "Paper 1",
    title: parsed.title || `${input.subject} ${input.level} paper`,
    overview: parsed.overview || "",
    questions,
    sources,
  };
}

export async function gradeExam(input: {
  paper: ExamPaper;
  answers: ExamAnswer[];
}): Promise<ExamGrade> {
  const questionsBlock = input.paper.questions
    .map(
      (q) =>
        `Question ${q.number} (${q.marks} marks): ${q.question}\nMark scheme: ${q.markScheme || "not provided"}`,
    )
    .join("\n\n");

  const answersBlock = input.answers
    .map((a) => `Question ${a.number}:\n${a.answer || "(no answer given)"}`)
    .join("\n\n");

  const system = `You are a strict but encouraging UK exam marker for ${input.paper.level} ${input.paper.board} ${input.paper.subject}. Mark the student's answers against the provided mark scheme, following the official mark-scheme guidance for ${input.paper.level} (apply the correct command words, levels of response, and mark allocation). Return JSON:
{
  "totalAwarded": 0,
  "totalMax": 0,
  "grade": "e.g. 8, 7, A*, A, B, C or 'U'",
  "feedback": "2-3 sentences of overall feedback on strengths and areas to improve",
  "questions": [
    {
      "number": 1,
      "marksAwarded": 0,
      "marksMax": 0,
      "feedback": "specific feedback on this answer",
      "correctPoints": ["what they got right"],
      "missingPoints": ["what they missed"]
    }
  ]
}

Mark every question. Be fair and precise: award marks only for points that genuinely match the mark scheme, but give credit for partially correct answers. Be encouraging in the feedback.
MATH FORMATTING: When you reference maths in feedback or mark scheme points, write it in LaTeX using inline math between single dollar signs (e.g. \\(\\sqrt{2}\\)) and display math between double dollar signs (e.g. \\[\\frac{a}{b}\\]). Never write "sqrt(2)" or "x^2" as plain text.`;

  const raw = await groqChat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `PAPER QUESTIONS:\n${questionsBlock}\n\nSTUDENT ANSWERS:\n${answersBlock}`,
      },
    ],
    { json: true, temperature: 0.3, maxTokens: 6000 },
  );

  const parsed = extractJson<Omit<ExamGrade, "totalMax">>(raw);
  const totalMax = input.paper.questions.reduce((sum, q) => sum + q.marks, 0);
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.map((g) => ({
        number: typeof g?.number === "number" ? g.number : 0,
        marksAwarded: typeof g?.marksAwarded === "number" ? g.marksAwarded : 0,
        marksMax: typeof g?.marksMax === "number" ? g.marksMax : 0,
        feedback: typeof g?.feedback === "string" ? g.feedback : "",
        correctPoints: Array.isArray(g?.correctPoints)
          ? g.correctPoints.map((p) => String(p))
          : [],
        missingPoints: Array.isArray(g?.missingPoints)
          ? g.missingPoints.map((p) => String(p))
          : [],
      }))
    : [];

  const totalAwarded = questions.reduce((sum, g) => sum + g.marksAwarded, 0);

  return {
    totalAwarded,
    totalMax,
    grade: parsed.grade || "Not graded",
    feedback: parsed.feedback || "",
    questions,
  };
}

export async function generateVideoPlan(input: {
  subject?: string;
  topic: string;
  notes: string;
  imageDataUrl?: string;
}): Promise<VideoPlan> {
  const system = `You are a film director turning a student's study document into a full-length educational video.
You will: (1) read the document, (2) extract the main information and key points, (3) split them into a sequence of sections, and (4) write a spoken narration for each section.

Return JSON only:
{
  "language": "the spoken language (detected from the document/notes, e.g. French or English)",
  "title": "short, clear title",
  "overview": "one or two sentence summary",
  "scenes": [
    {
      "heading": "short slide title",
      "text": "2-3 bullet points shown on the slide",
      "narration": "the exact spoken sentence(s) for the AI voice (in the detected language)",
      "imagePrompt": "a single vivid, precise sentence describing the photo to show for this scene. Be concrete: subject, setting, action, mood, and style (e.g. 'close-up of a glowing water molecule, blue and white, photorealistic, soft light, science photo style')."
    }
  ]
}

Rules:
- Ground everything in the provided document when it has content. If the document/notes are empty or sparse, DO NOT refuse or ask for more input — instead write a complete, self-contained lesson on the given topic from your own knowledge.
- Detect the language of the notes/document and write the title AND every narration line in that same language.
- ALWAYS return a valid JSON object with a non-empty "scenes" array.
- Create 10 to 14 scenes, one per main idea/section.
- The total spoken narration must be at least 600 words (about 4 minutes at a natural speaking pace). Each narration line should be 3 to 6 full sentences. Do not truncate — write the full explanation for each section.
- Keep the narration natural, expressive and easy to read aloud: vary sentence length, use punctuation for emphasis, avoid flat monotone phrasing.
- Make every imagePrompt distinct and descriptive enough to become a real photo.`;

  const userParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: "text",
      text: `Subject: ${input.subject || "General"}\nTopic: ${input.topic}\nDocument/notes:\n${input.notes || "(no notes)"}`,
    },
  ];

  if (input.imageDataUrl) {
    userParts.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  }

  const raw = await groqChat(
    [
      { role: "system", content: system },
      { role: "user", content: userParts },
    ],
    {
      json: true,
      temperature: 0.5,
      maxTokens: 8000,
      model: input.imageDataUrl ? "qwen/qwen3.6-27b" : undefined,
    },
  );

  const plan = extractJson<VideoPlan>(raw);
  if (!Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    throw new Error("The AI returned an empty script. Add more notes or try again.");
  }

  // Normalize scenes so downstream rendering can rely on string fields. The model
  // sometimes emits `text` (or `heading`) as an array or drops fields entirely.
  const toStr = (value: unknown): string => {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map((v) => String(v)).join("\n");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const scenes: VideoScene[] = plan.scenes.map((scene) => ({
    heading: toStr(scene.heading),
    text: toStr(scene.text),
    narration: toStr(scene.narration),
    imagePrompt: toStr(scene.imagePrompt),
  }));

  return { ...plan, language: toStr(plan.language), title: toStr(plan.title), overview: toStr(plan.overview), scenes };
}

/**
 * Generate spoken narration audio via Groq's text-to-speech API.
 * Returns a Blob of audio (wav/mp3) usable inside a MediaRecorder stream.
 *
 * Groq rate-limits TTS requests, so this retries with exponential backoff on
 * HTTP 429 (and transient 5xx), and gives the caller a way to know it was delayed.
 */
export async function speakText(
  text: string,
  opts?: { lang?: string; maxRetries?: number },
): Promise<Blob | null> {
  const lang = (opts?.lang || "en").toLowerCase();
  const isArabic = lang.startsWith("ar");
  const model = isArabic ? "canopylabs/orpheus-arabic-saudi" : "canopylabs/orpheus-v1-english";
  const voice = isArabic ? "noura" : "hannah";
  const maxRetries = opts?.maxRetries ?? 6;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(`${GROQ_BASE}/audio/speech`, {
      method: "POST",
      headers: groqHeaders(),
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: "wav",
      }),
    });

    if (response.ok) {
      return response.blob();
    }

    // Rate limited or transient server error: back off and retry.
    const retriable = response.status === 429 || response.status >= 500;
    if (retriable && attempt < maxRetries) {
      const delayMs = 2000 * 2 ** attempt; // 2s, 4s, 8s, 16s, 32s, 64s
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    const detail = await response.text();
    throw new Error(detail || `TTS request failed (${response.status})`);
  }

  return null;
}

const TEACHER_SYSTEM_PROMPT = `You are a patient, encouraging teacher and study tutor for a secondary/school student.
Help the student learn: explain concepts clearly, break hard topics into simple steps, give concrete examples,
ask a guiding question back when useful, and always keep the tone friendly, clear, and motivating.
Answer the student's question directly first, then add a short "Try this" tip or a quick check question.
Keep answers concise (a few short paragraphs). No need to repeat this instruction.

MATH FORMATTING: Whenever you write math, use LaTeX inline math between single dollar signs (e.g. \\(\\sqrt{2}\\), \\(x^2\\)) and display math between double dollar signs (e.g. \\[\\frac{a}{b}\\]). Always use LaTeX for symbols like square roots, fractions, powers, and equations instead of plain text (never write "sqrt(2)" or "x^2" as plain text).

FIGURES: When a diagram helps, include one as a fenced code block:
- For a function graph, use a \`\`\`graph fence with the expressions, e.g.
  \`\`\`graph
  y=x^2, y=sin(x)
  \`\`\`
  You may list up to 6 curves separated by commas. You can pass a JSON spec for custom ranges: \`\`\`graph {"xmin":-5,"xmax":5,"ymin":-2,"ymax":10,"fns":["x^2","sin(x)"]}.
- For a geometric figure (triangle, circle, angle, etc.), use a \`\`\`svg fence with an <svg> ... </svg> block, e.g.
  \`\`\`svg
  <svg viewBox="0 0 200 200" width="300">
    <polygon points="100,20 20,180 180,180" fill="#fde68a" stroke="#b45309" stroke-width="3"/>
    <text x="100" y="200" text-anchor="middle" font-size="12">A triangle</text>
  </svg>
  \`\`\`
Use \`\`\`graph for curves/plots and \`\`\`svg for shapes. Do not use these for simple ASCII drawings.`;

export async function chatWithTeacher(
  messages: ChatMessage[],
  context?: string,
): Promise<string> {
  const contextBlock = context?.trim()
    ? `\n\nThe student has these study documents. Use them to ground your explanation and references:\n${context.trim()}`
    : "";
  const withSystem: ChatMessage[] = [
    { role: "system", content: `${TEACHER_SYSTEM_PROMPT}${contextBlock}` },
    ...messages,
  ];
  return groqChat(withSystem, {
    model: "openai/gpt-oss-20b",
    temperature: 0.5,
    maxTokens: 1200,
  });
}

export type ResearchAnswer = {
  answer: string;
  sources: Array<{ title: string; url: string }>;
};

/**
 * Research the user's question on the web (keyless Wikipedia + DuckDuckGo)
 * and return a cited, model-written answer. Falls back to a plain chat answer
 * when the web search returns nothing.
 */
export async function researchWithTeacher(
  question: string,
  context?: string,
): Promise<ResearchAnswer> {
  const { searchWeb } = await import("./search");

  const web = await searchWeb(question);

  if (!web || web.sources.length === 0) {
    // No results — answer from the model's own knowledge.
    const answer = await chatWithTeacher([{ role: "user", content: question }], context);
    return { answer, sources: [] };
  }

  const contextBlock = context?.trim()
    ? `\n\nThe student also has these study documents (use them to tie back when relevant):\n${context.trim()}`
    : "";

  const system = `You are a patient, encouraging study tutor with live web access.
Below are fresh web search results about the student's question. Use them as your
primary source and answer accurately and specifically.

IMPORTANT:
- Ground your answer in the provided web results. If they conflict or are thin, say so and use your own knowledge as a supplement.
- When you use a fact from a result, cite it inline with a bracketed number like [1], [2] mapping to the numbered sources listed at the end you receive.
- If the question is about a BOOK, FILM, or other creative WORK and both the work's article and the author's biography appear, base your answer primarily on the WORK's article, not the author.
- Keep the tone friendly and clear, like a teacher. Break hard topics into simple steps.
- End with a short "Try this" tip or quick check question.
- Keep it a few short paragraphs.
- MATH FORMATTING: Whenever you write math, use LaTeX inline math between single dollar signs (e.g. \\(\\sqrt{2}\\), \\(x^2\\)) and display math between double dollar signs (e.g. \\[\\frac{a}{b}\\]). Never write "sqrt(2)" or "x^2" as plain text.
- FIGURES: When a diagram helps, include a fenced code block. For a function graph use a \`\`\`graph fence with comma-separated expressions (e.g. \`\`\`graph y=x^2, y=sin(x)). For a geometric shape use a \`\`\`svg fence containing an <svg> ... </svg> block.${contextBlock}`;

  const sourceList = web.sources
    .map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`)
    .join("\n");

  const user = `Student question: ${question}\n\nWeb search results:\n\n${web.text}\n\nSources:\n${sourceList}`;

  const answer = await groqChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      model: "openai/gpt-oss-20b",
      temperature: 0.4,
      maxTokens: 1600,
    },
  );

  return { answer, sources: web.sources };
}
