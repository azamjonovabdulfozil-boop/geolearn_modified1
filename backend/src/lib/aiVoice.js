// ── AI chat uchun ovoz ────────────────────────────────────────────────────
// • synthesize — AI javobini ovozga aylantiradi (Microsoft Edge neural ovozlari:
//   o'zbekcha "Madina", ruscha "Svetlana"; kalit kerak emas).
// • transcribe — o'quvchining ovozli xabarini matnga aylantiradi
//   (HuggingFace Whisper; til aniq beriladi, aks holda o'zbekchani qozoqcha deb o'ylaydi).
import { createHash } from "crypto";
import { detectLanguage } from "./aiPrompt.js";

const VOICES = { uz: "uz-UZ-MadinaNeural", ru: "ru-RU-SvetlanaNeural" };
const MAX_TTS_CHARS = 3000;

/** Markdown va rasmlarni olib tashlab, o'qishga mos matn qoldiradi. */
export function speakableText(md) {
  return String(md || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")          // rasmlar
    .replace(/```[\s\S]*?```/g, " ")                 // kod bloklari
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")         // havolalar → matni
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, " ")    // jadval chiziqlari
    .replace(/[|#*_`>~]+/g, " ")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, ".\n")
    .trim()
    .slice(0, MAX_TTS_CHARS);
}

// Bir xil javobni qayta bosganda qayta yaratmaslik uchun kichik kesh
const ttsCache = new Map();
const TTS_CACHE_MAX = 40;

/** @returns {Promise<Buffer>} mp3 */
export async function synthesize(text, language) {
  const clean = speakableText(text);
  if (!clean) throw new Error("O'qiladigan matn yo'q");
  const lang = language === "ru" || language === "uz" ? language : detectLanguage(clean);
  const voice = VOICES[lang] ?? VOICES.uz;
  const key = createHash("sha1").update(voice + clean).digest("hex");
  if (ttsCache.has(key)) return ttsCache.get(key);

  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(clean));
    const chunks = [];
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Ovoz yaratish vaqti tugadi")), 45000);
      audioStream.on("data", c => chunks.push(c));
      audioStream.on("end", () => { clearTimeout(timer); resolve(); });
      audioStream.on("close", () => { clearTimeout(timer); resolve(); });
      audioStream.on("error", e => { clearTimeout(timer); reject(e); });
    });
    const buf = Buffer.concat(chunks);
    if (buf.length < 500) throw new Error("Ovoz yaratilmadi");
    ttsCache.set(key, buf);
    if (ttsCache.size > TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value);
    return buf;
  } finally {
    try { tts.close?.(); } catch {}
  }
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const WHISPER_MODELS = ["openai/whisper-large-v3-turbo", "openai/whisper-large-v3"];
const WHISPER_LANG = { uz: "uzbek", ru: "russian" };

/**
 * Ovozli xabarni matnga aylantiradi.
 * @param {Buffer} buf  webm/ogg/mp4/mp3/wav
 * @param {"uz"|"ru"} language  foydalanuvchi interfeysi tili
 * @returns {Promise<string>}
 */
export async function transcribe(buf, language = "uz") {
  if (!process.env.HF_TOKEN) throw new Error("Ovozni matnga aylantirish sozlanmagan (HF_TOKEN yo'q)");
  const body = JSON.stringify({
    inputs: buf.toString("base64"),
    parameters: { generate_kwargs: { language: WHISPER_LANG[language] ?? "uzbek", task: "transcribe" } },
  });
  let lastErr;
  for (const model of WHISPER_MODELS) {
    try {
      const r = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error(`${model} ${r.status}: ${(await r.text()).slice(0, 120)}`);
      const text = String((await r.json())?.text ?? "").trim();
      if (text) return text;
      throw new Error(`${model}: bo'sh natija`);
    } catch (e) {
      lastErr = e;
      console.log(`⚠️  Whisper: ${e.message}`);
    }
  }
  throw new Error("Ovozli xabarni tushunib bo'lmadi — qayta yozib ko'ring");
}
