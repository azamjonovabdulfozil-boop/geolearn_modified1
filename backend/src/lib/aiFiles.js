// ── AI yordamchiga biriktirilgan fayllar ──────────────────────────────────
// PDF, Word (.docx), Excel (.xlsx), CSV/TXT — matni ajratib olinib savolga
// qo'shiladi. Rasmlar esa ko'ra oladigan (vision) modelga yuboriladi.
import { readPdf } from "./pdfRead.js";
import { xlsxRows, docxRows } from "./rosterParse.js";

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_PER_FILE = 15000;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function kindOf(name, type) {
  const n = name.toLowerCase();
  if (IMAGE_TYPES.includes(type) || /\.(png|jpe?g|webp|gif)$/.test(n)) return "image";
  if (n.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (n.endsWith(".docx")) return "word";
  if (/\.(xlsx|xlsm)$/.test(n)) return "sheet";
  if (/\.(csv|txt|md|json)$/.test(n) || type.startsWith("text/")) return "text";
  if (/\.(doc|xls)$/.test(n)) throw new Error(`"${name}": eski format — faylni .docx yoki .xlsx qilib saqlang`);
  throw new Error(`"${name}": bu turdagi fayl qo'llab-quvvatlanmaydi`);
}

async function extractText(kind, buf, name) {
  if (kind === "pdf") {
    const { pages } = await readPdf(buf);
    if (!pages.length) throw new Error(`"${name}": PDF ichida matn topilmadi (skaner qilingan bo'lsa, rasm sifatida yuboring)`);
    return pages.join("\n\n");
  }
  if (kind === "word") {
    return docxRows(buf).map(r => r.filter(Boolean).join(" | ")).join("\n");
  }
  if (kind === "sheet") {
    return xlsxRows(buf)
      .filter(r => r.some(c => String(c).trim()))
      .map(r => r.join(" | "))
      .join("\n");
  }
  return buf.toString("utf8").replace(/^﻿/, "");
}

/**
 * Mijozdan kelgan [{ name, type, data(base64) }] ro'yxatini qayta ishlaydi.
 * @returns {Promise<{ texts: {name, kind, text}[], images: {name, dataUrl}[], meta: {name, kind}[] }>}
 */
export async function processAttachments(list) {
  const files = Array.isArray(list) ? list : [];
  if (files.length > MAX_FILES) throw new Error(`Bir martada ko'pi bilan ${MAX_FILES} ta fayl yuborish mumkin`);

  const texts = [], images = [], meta = [];
  for (const f of files) {
    const name = String(f?.name || "fayl").slice(0, 120);
    const type = String(f?.type || "").toLowerCase();
    const buf = Buffer.from(String(f?.data || "").replace(/^data:[^,]*,/, ""), "base64");
    if (!buf.length) throw new Error(`"${name}": fayl bo'sh`);
    if (buf.length > MAX_FILE_BYTES) throw new Error(`"${name}": fayl juda katta (maks. 10 MB)`);

    const kind = kindOf(name, type);
    meta.push({ name, kind });
    if (kind === "image") {
      const mime = IMAGE_TYPES.includes(type) ? type : "image/png";
      images.push({ name, dataUrl: `data:${mime};base64,${buf.toString("base64")}` });
      continue;
    }
    let text;
    try { text = (await extractText(kind, buf, name)).trim(); }
    catch (e) { throw new Error(e.message.startsWith(`"${name}"`) ? e.message : `"${name}": faylni o'qib bo'lmadi`); }
    if (!text) throw new Error(`"${name}": fayl ichida matn topilmadi`);
    texts.push({ name, kind, text: text.length > MAX_TEXT_PER_FILE ? text.slice(0, MAX_TEXT_PER_FILE) + "\n…(qisqartirildi)" : text });
  }
  return { texts, images, meta };
}

/** Fayl matnlarini model uchun savol matniga qo'shadi. */
export function withFileTexts(question, texts) {
  if (!texts?.length) return question;
  const parts = texts.map(t => `[Biriktirilgan fayl: ${t.name}]\n${t.text}\n[Fayl oxiri]`);
  return `${parts.join("\n\n")}\n\n${question}`;
}
