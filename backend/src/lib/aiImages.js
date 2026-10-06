// ── AI chatidagi rasmlar ──────────────────────────────────────────────────
// 1) O'quvchi yuborgan rasmlar diskka saqlanadi — chatda katta ko'rinishi va
//    keyingi savollarda ("bu qaysi joy?") modelga qayta yuborilishi uchun.
// 2) AI rasm chizishni so'ralganda — rasm yaratiladi (Pollinations, zaxira:
//    HuggingFace FLUX) va shu yerga saqlanadi.
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { randomBytes } from "crypto";
import { saveFile, loadFile } from "./storage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const AI_IMAGE_DIR = join(__dirname, "../../uploads/ai");
const URL_PREFIX = "/api/ai/images/";
// Rasmlar va ovozli xabarlar
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav" };
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav" };

/** Nom faqat tasodifiy hex + kengaytma bo'lishi mumkin (yo'l bilan o'ynab bo'lmaydi). */
export function isImageName(name) {
  return /^[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(String(name));
}

export function imageMime(name) {
  return MIME[name.split(".").pop()] ?? "application/octet-stream";
}

/** Rasmni saqlaydi va uning API manzilini qaytaradi. */
export function saveImage(buf, mime = "image/jpeg") {
  if (!existsSync(AI_IMAGE_DIR)) mkdirSync(AI_IMAGE_DIR, { recursive: true });
  const name = `${randomBytes(12).toString("hex")}.${EXT[mime] ?? "jpg"}`;
  writeFileSync(join(AI_IMAGE_DIR, name), buf);
  saveFile(name, mime, buf);            // Postgres bo'lsa — server qayta ishga tushsa ham yo'qolmaydi
  return URL_PREFIX + name;
}

/** Rasm diskda bo'lmasa (server qayta ishga tushgan) — bazadan tiklaydi. */
export async function ensureImage(name) {
  if (!existsSync(AI_IMAGE_DIR)) mkdirSync(AI_IMAGE_DIR, { recursive: true });
  return loadFile(name, join(AI_IMAGE_DIR, name));
}

/** Saqlangan rasm manzilidan modelga yuboriladigan data URL (fayl o'chgan bo'lsa — null). */
export function imageUrlToDataUrl(url) {
  const name = String(url || "").startsWith(URL_PREFIX) ? url.slice(URL_PREFIX.length) : "";
  if (!isImageName(name)) return null;
  try {
    return `data:${imageMime(name)};base64,${readFileSync(join(AI_IMAGE_DIR, name)).toString("base64")}`;
  } catch { return null; }
}

// ── Rasm yaratish ─────────────────────────────────────────────────────────

async function fromPollinations(prompt) {
  const seed = Math.floor(Math.random() * 1e9);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=768&nologo=true&seed=${seed}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.startsWith("image/")) throw new Error(`Pollinations ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 2000) throw new Error("Pollinations: bo'sh rasm");
  return { buf, mime: type.split(";")[0] };
}

async function fromHuggingFace(prompt) {
  if (!process.env.HF_TOKEN) throw new Error("HF_TOKEN yo'q");
  const r = await fetch("https://router.huggingface.co/nscale/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "black-forest-labs/FLUX.1-schnell", prompt, response_format: "b64_json" }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`HF FLUX ${r.status}`);
  const b64 = (await r.json())?.data?.[0]?.b64_json;
  if (!b64) throw new Error("HF FLUX: bo'sh javob");
  return { buf: Buffer.from(b64, "base64"), mime: "image/png" };
}

/**
 * Matndan rasm yaratadi va saqlaydi.
 * @returns {Promise<string|null>} rasm manzili yoki null
 */
export async function generateImage(prompt) {
  const text = String(prompt || "").trim().slice(0, 500);
  if (!text) return null;
  for (const gen of [fromPollinations, fromHuggingFace]) {
    try {
      const { buf, mime } = await gen(text);
      console.log(`🎨 Rasm yaratildi (${gen.name}): ${text.slice(0, 60)}`);
      return saveImage(buf, mime);
    } catch (e) {
      console.log(`⚠️  Rasm yaratilmadi (${gen.name}): ${e.message}`);
    }
  }
  return null;
}
