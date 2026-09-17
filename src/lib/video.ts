import type { VideoPlan, VideoScene } from "@/lib/ai";
import { speakText } from "@/lib/ai";

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;

function paletteFor(sceneIndex: number) {
  const palettes = [
    ["#1F4B3A", "#F3EFE6", "#C47A3A"],
    ["#2F6F8F", "#F2F7F9", "#E0B45C"],
    ["#6B4C9A", "#F4F1FA", "#9BD0C0"],
    ["#8B3A4A", "#FAF1F2", "#E7A87E"],
    ["#3F6B4A", "#F1F7F1", "#A8C6A0"],
  ];
  return palettes[sceneIndex % palettes.length];
}

/** Deterministic pseudo-random from a string, so a scene's prompt drives unique shapes. */
function hashSeed(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pick a keyword from the prompt, or fall back to the scene index, to vary the visual. */
function pickMotif(prompt: string, seed: number) {
  const low = prompt.toLowerCase();
  const motifs: Array<[RegExp, () => string]> = [
    [/atom|molecul|particle|electron|nucleus/, () => "molecule"],
    [/graph|chart|curve|plot|line/, () => "graph"],
    [/equat|formula|math|algebra|calculus/, () => "equation"],
    [/map|geograph|region|country|world/, () => "map"],
    [/timeline|chronolog|history|war|era/, () => "timeline"],
    [/cell|organ|body|anatomy|brain|heart|biology/, () => "cell"],
    [/circuit|electron|electric|current|voltage/, () => "circuit"],
    [/planet|space|orbit|star|solar/, () => "planet"],
    [/wave|sound|light|frequency|oscillat/, () => "wave"],
    [/grammar|word|sentence|vocabulary|letter/, () => "text"],
  ];
  for (const [re, pick] of motifs) {
    if (re.test(low)) return pick();
  }
  // Fall back to a shape derived from the seat.
  const shapes = ["circle", "square", "triangle", "star"];
  return shapes[seed % shapes.length];
}

function drawMotif(
  ctx: CanvasRenderingContext2D,
  motif: string,
  cx: number,
  cy: number,
  size: number,
  timeMs: number,
  color: string,
  seed: number,
) {
  const t = timeMs / 1000;
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}`;
  ctx.lineWidth = 6;
  switch (motif) {
    case "molecule": {
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        const a = t * 0.4 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * size * 0.8, cy + Math.sin(a) * size * 0.8, size * 0.22, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "graph": {
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.7, cy + size * 0.5);
      for (let i = 0; i <= 20; i += 1) {
        const x = cx - size * 0.7 + (i / 20) * size * 1.4;
        const y = cy + size * 0.4 - Math.sin(i * 0.5 + t) * size * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case "equation": {
      ctx.font = `bold ${Math.round(size * 0.7)}px sans-serif`;
      ctx.fillText("a²+b²=c²", cx - size * 0.6, cy + size * 0.2);
      break;
    }
    case "map": {
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const a = t * 0.2 + (i * Math.PI * 2) / 5;
        const r = size * (0.5 + 0.15 * Math.sin(t + i));
        ctx.arc(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.4, 0, Math.PI * 2);
      }
      ctx.stroke();
      break;
    }
    case "timeline": {
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.8, cy);
      ctx.lineTo(cx + size * 0.8, cy);
      ctx.stroke();
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(cx - size * 0.6 + i * size * 0.4, cy, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "cell": {
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.6, size * 0.35, t * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "circuit": {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.7, cy - size * 0.3);
      ctx.lineTo(cx + size * 0.7, cy - size * 0.3);
      ctx.moveTo(cx - size * 0.7, cy + size * 0.3);
      ctx.lineTo(cx + size * 0.7, cy + size * 0.3);
      ctx.moveTo(cx - size * 0.3, cy - size * 0.3);
      ctx.lineTo(cx - size * 0.3, cy + size * 0.3);
      ctx.moveTo(cx + size * 0.3, cy - size * 0.3);
      ctx.lineTo(cx + size * 0.3, cy + size * 0.3);
      ctx.stroke();
      break;
    }
    case "planet": {
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.7, size * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "wave": {
      ctx.beginPath();
      for (let i = 0; i <= 40; i += 1) {
        const x = cx - size * 0.9 + (i / 40) * size * 1.8;
        const y = cy + Math.sin(i * 0.4 + t * 2) * size * 0.3;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    default: {
      const shapes = ["circle", "square", "triangle", "star"];
      const shape = shapes[seed % shapes.length];
      ctx.beginPath();
      if (shape === "circle") ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2);
      else if (shape === "square") ctx.rect(cx - size * 0.3, cy - size * 0.3, size * 0.6, size * 0.6);
      else if (shape === "triangle") {
        ctx.moveTo(cx, cy - size * 0.35);
        ctx.lineTo(cx + size * 0.35, cy + size * 0.3);
        ctx.lineTo(cx - size * 0.35, cy + size * 0.3);
        ctx.closePath();
      } else {
        for (let i = 0; i < 5; i += 1) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          const x = cx + Math.cos(a) * size * 0.4;
          const y = cy + Math.sin(a) * size * 0.4;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
      ctx.stroke();
    }
  }
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: VideoScene,
  index: number,
  timeMs: number,
) {
  const [bg, card, accent] = paletteFor(index);
  const t = timeMs / 1000;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Soft animated background waves.
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = card;
  for (let i = 0; i < 6; i += 1) {
    const x = ((i * 220 + t * 40) % (WIDTH + 200)) - 100;
    ctx.beginPath();
    ctx.arc(x, HEIGHT - 80 - (i % 3) * 60, 120 + (i % 2) * 60, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Central visual driven by the scene's imagePrompt.
  const seed = hashSeed(scene.imagePrompt || String(index));
  const motif = pickMotif(scene.imagePrompt || "", seed);
  const cx = WIDTH / 2 + 320;
  const cy = HEIGHT / 2;
  const size = 320;
  ctx.globalAlpha = 0.8;
  drawMotif(ctx, motif, cx, cy, size, timeMs, accent, seed);
  ctx.globalAlpha = 1;

  // Scene number badge.
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(72, 78, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = card;
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(index + 1).padStart(2, "0"), 72, 79);

  // Heading.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = card;
  ctx.font = "bold 58px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 16;
  ctx.fillText(scene.heading.slice(0, 26), 120, 170);
  ctx.shadowBlur = 0;

  // Body text (bullets). `text` may be a string (newline-separated) or an array.
  ctx.fillStyle = card;
  ctx.font = "30px sans-serif";
  const rawLines = Array.isArray(scene.text)
    ? scene.text.map((item) => String(item))
    : String(scene.text ?? "").split("\n");
  const lines = rawLines.filter((line) => line.trim()).slice(0, 4);
  lines.forEach((line, i) => {
    ctx.fillText(line.slice(0, 60), 120, 250 + i * 52);
  });

  // Progress dots.
  const total = index + 1;
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    ctx.arc(WIDTH - 60 - i * 34, HEIGHT - 60, 10, 0, Math.PI * 2);
    ctx.fillStyle = i < total ? accent : "rgba(255,255,255,0.25)";
    ctx.fill();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

/** Approximate spoken words per second at a natural pace (~150 wpm). */
const WORDS_PER_SECOND = 2.5;
/** Minimum on-screen time for any single scene, so short narrations aren't rushed. */
const MIN_SCENE_MS = 5000;

function countWords(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export async function composeVideo(
  plan: VideoPlan,
  onProgress?: (s: string) => void,
  sourceImageDataUrl?: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Attach the canvas to the DOM (offscreen). Safari/WebKit only captures frames
  // from a canvas that is actually rendered, so a detached canvas yields a blank video.
  canvas.style.position = "fixed";
  canvas.style.left = "-10000px";
  canvas.style.top = "0";
  canvas.style.pointerEvents = "none";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  // Pre-load the uploaded document image (if any) so it can be shown in the video.
  let sourceImage: HTMLImageElement | null = null;
  if (sourceImageDataUrl) {
    try {
      sourceImage = await loadImage(sourceImageDataUrl);
    } catch {
      sourceImage = null;
    }
  }

  // Size each scene by how long its narration will take to speak. When TTS audio
  // is available we use the actual audio length; otherwise we estimate from words.
  const sceneDurations = plan.scenes.map((scene) =>
    Math.max((countWords(scene.narration) / WORDS_PER_SECOND) * 1000, MIN_SCENE_MS),
  );
  const outroMs = 1500;

  // Pre-generate narration audio for every scene up front, so timing matches the
  // real spoken audio (and we can fail fast with a clear message).
  const audioCtx = new AudioContext();
  await audioCtx.resume();

  const sceneAudios: (AudioBuffer | null)[] = [];
  let firstAudioError: Error | null = null;
  for (let i = 0; i < plan.scenes.length; i += 1) {
    const scene = plan.scenes[i];
    onProgress?.(`Generating narration ${i + 1}/${plan.scenes.length}…`);
    try {
      // Small gap between requests to stay under Groq's TTS rate limit. On 429,
      // speakText backs off and retries automatically.
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 800));
      const blob = await speakText(scene.narration, { lang: plan.language });
      if (!blob) throw new Error("Empty narration audio");
      const buffer = await audioCtx.decodeAudioData(await blob.arrayBuffer());
      sceneAudios.push(buffer);
    } catch (error) {
      sceneAudios.push(null);
      if (!firstAudioError) {
        firstAudioError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  const hasAudio = sceneAudios.some(Boolean);
  if (!hasAudio && firstAudioError) {
    audioCtx.close();
    canvas.remove();
    throw firstAudioError;
  }

  const stream = canvas.captureStream(FPS);
  const dest = audioCtx.createMediaStreamDestination();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.9;
  gain.connect(dest);
  dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

  const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  const recorded = new Promise<Blob>((resolve) => {
    mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  // Draw one frame before recording starts so the stream has pixels immediately.
  const firstScene = plan.scenes[0] ?? { heading: "Study Hub", text: "", narration: "", imagePrompt: "" };
  drawScene(ctx, firstScene, 0, 0);

  mediaRecorder.start();
  onProgress?.("Recording started…");

  const start = performance.now();

  try {
    for (let i = 0; i < plan.scenes.length; i += 1) {
      const scene = plan.scenes[i];
      const audio = sceneAudios[i];
      // Prefer the real audio duration; fall back to the word-count estimate.
      const sceneDuration = audio
        ? Math.max(audio.duration * 1000, MIN_SCENE_MS)
        : sceneDurations[i];
      onProgress?.(`Scene ${i + 1}/${plan.scenes.length}`);

      // Play this scene's narration through the WebAudio graph (capturable), if available.
      let source: AudioBufferSourceNode | null = null;
      if (audio) {
        source = audioCtx.createBufferSource();
        source.buffer = audio;
        source.connect(gain);
        source.start();
      }

      // Draw this scene for its full duration. `sceneStart` is captured fresh each
      // iteration so scenes don't collapse into the first one.
      const sceneStart = performance.now();
      while (performance.now() < sceneStart + sceneDuration) {
        drawScene(ctx, scene, i, performance.now() - start);
        if (sourceImage) {
          const iw = 420;
          const ihh = (sourceImage.height / sourceImage.width) * iw;
          ctx.globalAlpha = 0.55;
          ctx.drawImage(sourceImage, WIDTH - iw - 40, HEIGHT - ihh - 40, iw, ihh);
          ctx.globalAlpha = 1;
        }
        await new Promise((r) => setTimeout(r, 1000 / FPS));
      }
    }

    const outro: VideoScene = {
      heading: "Study Hub",
      text: plan.overview,
      narration: "",
      imagePrompt: "",
    };
    const outroStart = performance.now();
    while (performance.now() < outroStart + outroMs) {
      drawScene(ctx, outro, 0, performance.now() - start);
      await new Promise((r) => setTimeout(r, 1000 / FPS));
    }
  } finally {
    mediaRecorder.stop();
    canvas.remove();
  }

  onProgress?.("Composing track…");
  const blob = await recorded;
  audioCtx.close();
  onProgress?.("Done");
  return blob;
}
