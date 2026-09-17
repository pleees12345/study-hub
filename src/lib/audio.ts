import { speakText } from "@/lib/ai";

/**
 * Split a narration script into speakable chunks. We split on sentence boundaries
 * (keeping chunks reasonably short) so each Groq TTS request stays well under the
 * input limit and avoids being truncated.
 */
function splitSentences(text: string, maxChars = 280): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  // Prefer sentence boundaries (., !, ?, and newlines). Fall back to words.
  const parts = clean
    .split(/(?<=[.!?])\s+|\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    if ((current + " " + part).trim().length <= maxChars) {
      current = current ? `${current} ${part}` : part;
    } else {
      if (current) chunks.push(current);
      current = part;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

/**
 * Speak a full narration script and return a single playable audio blob.
 *
 * Each chunk is spoken via Groq TTS, decoded, and concatenated into one WAV
 * (PCM 16-bit, mono) so the result is a single downloadable/playable track.
 */
export async function composeAudio(
  text: string,
  opts?: { lang?: string; onProgress?: (s: string) => void },
): Promise<Blob> {
  const chunks = splitSentences(text);

  const audioCtx = new AudioContext();
  await audioCtx.resume();

  const buffers: AudioBuffer[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    opts?.onProgress?.(`Generating narration ${i + 1}/${chunks.length}…`);
    const blob = await speakText(chunks[i], { lang: opts?.lang });
    if (!blob) throw new Error("The AI produced no audio for a segment.");
    const buffer = await audioCtx.decodeAudioData(await blob.arrayBuffer());
    buffers.push(buffer);
    // Small gap to stay under Groq's TTS rate limit.
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 400));
  }

  // Concatenate all buffers into one.
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const sampleRate = buffers[0]?.sampleRate ?? audioCtx.sampleRate;
  const channels = buffers[0]?.numberOfChannels ?? 1;

  const combined = audioCtx.createBuffer(channels, totalLength, sampleRate);
  let offset = 0;
  for (const buffer of buffers) {
    for (let ch = 0; ch < channels; ch += 1) {
      combined.copyToChannel(buffer.getChannelData(ch), ch, offset);
    }
    offset += buffer.length;
  }

  // Render to WAV.
  const wav = encodeWav(combined);
  audioCtx.close();
  return wav;
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channelsData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch += 1) {
    channelsData.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      let sample = Math.max(-1, Math.min(1, channelsData[ch][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
