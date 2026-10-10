// O'quvchilar ro'yxatini fayldan o'qish: Excel (.xlsx), Word (.docx),
// CSV, TXT va PDF. Qo'shimcha kutubxonasiz — .xlsx/.docx aslida ZIP
// arxiv ichidagi XML fayllar, ularni Node'ning zlib moduli bilan ochamiz.
import { inflateRawSync } from "zlib";
import { extractPdfPages } from "./pdfRead.js";
import { parseClassName } from "./db.js";

// ── ZIP ───────────────────────────────────────────────────────────────────

/** ZIP arxivdagi fayllar: { "word/document.xml": Buffer, ... } (faqat kerakli nomlar). */
function unzip(buf, wanted = () => true) {
  // End of central directory yozuvi — fayl oxiridan qidiramiz
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("ZIP arxiv emas");

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name)) continue;

    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + size);
    if (method === 0) out[name] = data;
    else if (method === 8) out[name] = inflateRawSync(data);
  }
  return out;
}

// ── XML yordamchilari ─────────────────────────────────────────────────────

function decodeXml(s = "") {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** Berilgan teg ichidagi barcha matnlarni qo'shib qaytaradi (<t>, <w:t>). */
function textOf(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  let s = "";
  let m;
  while ((m = re.exec(xml))) s += decodeXml(m[1]);
  return s;
}

function blocks(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${tag}>)`, "g");
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push({ full: m[0], inner: m[1] ?? "" });
  return out;
}

// ── Excel (.xlsx) ─────────────────────────────────────────────────────────

function colIndex(ref = "") {
  const letters = ref.replace(/\d+/g, "").toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return Math.max(0, n - 1);
}

export function xlsxRows(buf) {
  const files = unzip(buf, n => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared = files["xl/sharedStrings.xml"]
    ? blocks(files["xl/sharedStrings.xml"].toString("utf8"), "si").map(b => textOf(b.inner, "t"))
    : [];

  // Barcha varaqlar (odatda bitta) — tartib bo'yicha
  const sheets = Object.keys(files)
    .filter(n => n.startsWith("xl/worksheets/"))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  const rows = [];
  for (const name of sheets) {
    const xml = files[name].toString("utf8");
    for (const row of blocks(xml, "row")) {
      const cells = [];
      for (const c of blocks(row.inner, "c")) {
        const attrs = c.full.slice(0, c.full.indexOf(">"));
        const ref = attrs.match(/\sr="([A-Z]+\d+)"/)?.[1];
        const type = attrs.match(/\st="(\w+)"/)?.[1];
        let value;
        if (type === "s") value = shared[Number(textOf(c.inner, "v"))] ?? "";
        else if (type === "inlineStr") value = textOf(c.inner, "t");
        else value = textOf(c.inner, "v");
        cells[ref ? colIndex(ref) : cells.length] = value;
      }
      rows.push(Array.from(cells, v => v ?? ""));
    }
  }
  return rows;
}

// ── Word (.docx) ──────────────────────────────────────────────────────────

export function docxRows(buf) {
  const files = unzip(buf, n => n === "word/document.xml");
  const xml = files["word/document.xml"]?.toString("utf8");
  if (!xml) throw new Error("Word hujjat ichida matn topilmadi");

  // <w:br/> — paragraf ichidagi qator uzilishi (Shift+Enter): ro'yxat ko'pincha shunday yoziladi
  const paraText = (p) => textOf(
    p.replace(/<w:tab\/>/g, "<w:t>\t</w:t>").replace(/<w:(?:br|cr)(?:\s[^>]*)?\/>/g, "<w:t>\n</w:t>"),
    "w:t",
  );
  const rows = [];

  // Jadvallar — har bir qator alohida
  for (const tbl of blocks(xml, "w:tbl")) {
    for (const tr of blocks(tbl.inner, "w:tr")) {
      rows.push(blocks(tr.inner, "w:tc").map(tc =>
        blocks(tc.inner, "w:p").map(p => paraText(p.inner)).join(" ").replace(/\n/g, " ").trim()));
    }
  }
  // Jadvaldan tashqaridagi paragraflar — har biri bitta qator
  const outside = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, "");
  for (const p of blocks(outside, "w:p")) {
    for (const line of paraText(p.inner).split("\n")) {
      if (line.trim()) rows.push(splitLine(line));
    }
  }
  return rows;
}

// ── Matn (CSV / TXT / PDF) ────────────────────────────────────────────────

function splitLine(line) {
  const l = String(line).trim();
  if (l.includes("\t")) return l.split("\t");
  if (l.includes(";")) return l.split(";");
  // Vergul faqat CSV ustunlari bo'lsa (ism ichida vergul kam uchraydi)
  if ((l.match(/,/g) || []).length >= 1 && !/\d,\d/.test(l)) return l.split(",");
  return [l];
}

function textRows(text) {
  return String(text)
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(l => l.trim())
    .map(l => splitLine(l).map(c => c.replace(/^"|"$/g, "").trim()));
}

// ── Qatorlardan o'quvchilar ───────────────────────────────────────────────

// Sarlavha katagi: "F.I.Sh", "Familiyasi", "Ism", "ФИО", "O'quvchining F.I.Sh" ...
const NAME_HEADER = /^(o['ʻ‘’`]?quvchi(ning)?\s+)?(f\.?\s*i\.?\s*(sh|o)\.?|ф\.?\s*и\.?\s*о\.?|familiya(?:si|lar|lari)?|ism(?:i|lar|lari)?|sharifi?|otasining ismi|фамилия|имя|отчество|name|full name|ученик)(\s*(va|,|и)?\s*(ism(?:i|lar|lari)?|familiya(?:si|lar|lari)?|sharifi?|имя|отчество))*$/i;
const CLASS_HEADER = /^(sinf|sinfi|класс|class|guruh)\b/i;
const HEADER_ONLY = /^(f\.?\s*i\.?\s*sh\.?|ф\.?\s*и\.?\s*о\.?|ism(i)?|familiya(si)?|ism(i)? familiya(si)?|familiya(si)?,? ism(i)?.*|name|full name|o['ʻ‘’`]?quvchi(lar)?( ro['ʻ‘’`]?yxati)?|ученик(и)?|список.*|ro['ʻ‘’`]?yxat.*)$/i;
const NOT_NAME = /(sinf|ro['ʻ‘’`]?yxat|o['ʻ‘’`]?quvchilar|maktab|jadval|список|класс|ученик|школ|итого|jami)/i;
const NUM_HEADER = /^(№|#|n|t\/?r|т\/?р|no\.?|nomer|raqam)$/i;

function cleanName(s) {
  return String(s ?? "")
    .replace(/^\s*\d{1,4}\s*[.)\-–:]?\s*(?=\p{L})/u, "")   // "1. ", "12) ", "3 ", "4-"
    .replace(/\s+/g, " ")
    .trim();
}

function isClassCell(s) {
  const c = parseClassName(s);
  return Boolean(c?.letter);
}

function looksLikeName(s, strict) {
  const v = cleanName(s);
  if (v.length < 3 || v.length > 90) return false;
  if (!/\p{L}{2,}/u.test(v)) return false;
  if (/\d/.test(v)) return false;
  if (HEADER_ONLY.test(v)) return false;               // sarlavha so'zlari ism emas
  if (NOT_NAME.test(v)) return false;                  // "7-B sinf o'quvchilari ro'yxati"
  const words = v.split(" ").filter(w => /\p{L}{2,}/u.test(w));
  return strict ? words.length >= 2 : words.length >= 1;
}

/** Qatorning oxirida yozilgan sinfni ajratadi: "Aliyev Vali 7-A" → ["Aliyev Vali", "7-A"]. */
function splitTrailingClass(text, lenient = false) {
  const m = String(text).match(/^(.*?)[\s,;(]+(\d{1,2}\s*[-–]?\s*["'«]?\p{L}["'»]?)\s*\)?\s*(?:sinf|класс)?\s*$/iu);
  if (m && isClassCell(m[2]) && looksLikeName(m[1], !lenient)) return [m[1], m[2]];
  return [text, null];
}

/**
 * Jadval qatorlaridan o'quvchilar ro'yxati: [{ fullName, className }]
 * Sarlavha qatori bo'lsa (F.I.Sh, Sinf ...) — ustunlar shundan olinadi,
 * aks holda har bir qatordan ism va sinfga o'xshash kataklar topiladi.
 * `lenient` — bir so'zli ismlar ham qabul qilinadi ("Sardor"): qo'lda
 * yozilgan ro'yxat va faqat ismlardan iborat fayllar uchun.
 */
export function rowsToStudents(rows, defaultClass = null, { lenient = false } = {}) {
  const table = rows.map(r => r.map(c => String(c ?? "").replace(/\s+/g, " ").trim()));

  let headerIdx = -1;
  let nameCols = [];
  let classCol = -1;
  for (let i = 0; i < Math.min(table.length, 15); i++) {
    const row = table[i];
    const nc = row.map((c, j) => (NAME_HEADER.test(c) && c.length <= 40 && !isClassCell(c) ? j : -1)).filter(j => j >= 0);
    if (nc.length) {
      headerIdx = i;
      nameCols = nc;
      classCol = row.findIndex(c => CLASS_HEADER.test(c));
      break;
    }
  }

  const out = [];
  const seen = new Set();
  const push = (fullName, className) => {
    const name = cleanName(fullName);
    if (!name) return;
    const cls = parseClassName(className)?.letter ? parseClassName(className).name : defaultClass;
    const key = `${name.toLowerCase()}|${cls ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ fullName: name, className: cls ?? null });
  };

  table.forEach((row, i) => {
    if (i <= headerIdx) return;
    if (!row.some(c => c)) return;

    const headerName = nameCols.map(j => row[j] || "").filter(Boolean).join(" ");
    if (headerIdx >= 0 && headerName) {
      const name = headerName;
      if (!looksLikeName(name, false)) return;
      const cls = classCol >= 0 ? row[classCol] : row.find(isClassCell);
      push(name, cls);
      return;
    }

    // Sarlavhasiz: ism — ikki va undan ortiq so'zli katak (yoki yonma-yon kataklar)
    const cells = row
      .filter(c => c && !NUM_HEADER.test(c) && !/^\d+[.)]?$/.test(c))
      .flatMap(c => {                               // "Aliyev Vali 7-A" → ism + sinf
        const [n, cls] = splitTrailingClass(c, lenient);
        return cls ? [n, cls] : [c];
      });
    const cls = cells.find(isClassCell) ?? null;
    const textCells = cells.filter(c => !isClassCell(c));
    // Bir qatorda vergul bilan yozilgan bir nechta to'liq ism: "Aliyev Vali, Karimova Nigora"
    const full = textCells.filter(c => looksLikeName(c, true));
    if (full.length >= 2) { full.forEach(n => push(n, cls)); return; }
    let name = full[0];
    if (!name && textCells.length >= 2 && textCells.slice(0, 3).every(c => looksLikeName(c, false))) {
      name = textCells.slice(0, 3).join(" ");      // Familiya | Ism | Sharif alohida ustunlarda
    }
    if (!name && lenient && textCells.length === 1) name = textCells[0];
    if (!name) return;
    if (!looksLikeName(name, !lenient)) return;
    push(name, cls);
  });

  return out;
}

/**
 * Qo'lda yozilgan ro'yxat: har bir qator (yoki vergul bilan ajratilgan qism)
 * — bitta o'quvchi. Faqat ism yozilgan bo'lsa ham qabul qilinadi.
 */
export function textToStudents(text, defaultClass = null) {
  const rows = String(text ?? "")
    .split(/[\r\n]+/)
    .flatMap(line => line.split(/[,;]/))
    .map(part => part.replace(/\t/g, " ").trim())
    .filter(Boolean)
    .map(part => [part]);
  return rowsToStudents(rows, defaultClass, { lenient: true });
}

/**
 * Yuklangan fayldan o'quvchilar ro'yxati.
 * @returns {Promise<{ fullName: string, className: string|null }[]>}
 */
export async function parseRosterFile(file, defaultClass = null) {
  const name = String(file.originalname || "").toLowerCase();
  const buf = file.buffer;
  const isZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;

  let rows;
  if (name.endsWith(".xls") && !isZip) {
    throw new Error("Eski .xls formati qo'llab-quvvatlanmaydi — faylni Excel'da .xlsx qilib saqlang");
  } else if (name.endsWith(".doc") && !isZip) {
    throw new Error("Eski .doc formati qo'llab-quvvatlanmaydi — faylni Word'da .docx qilib saqlang");
  } else if (/\.(xlsx|xlsm)$/.test(name)) {
    rows = xlsxRows(buf);
  } else if (name.endsWith(".docx")) {
    rows = docxRows(buf);
  } else if (name.endsWith(".pdf")) {
    const pages = await extractPdfPages(buf);
    if (!pages.length) throw new Error("PDF ichida matn topilmadi");
    rows = textRows(pages.join("\n"));
  } else if (isZip) {
    // Kengaytmasi noma'lum ZIP — avval Excel, keyin Word sifatida urinamiz
    try { rows = xlsxRows(buf); } catch { rows = docxRows(buf); }
  } else {
    rows = textRows(buf.toString("utf8").replace(/^﻿/, ""));
  }
  const strict = rowsToStudents(rows, defaultClass);
  // Faylda faqat ismlar yozilgan bo'lsa (familiyasiz) — bir so'zli qatorlar ham olinadi
  return strict.length ? strict : rowsToStudents(rows, defaultClass, { lenient: true });
}

// ── Ismlarni taqqoslash ───────────────────────────────────────────────────

function nameTokens(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[ʻʼ’‘`'´"]/g, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Ro'yxatdagi F.I.Sh va o'quvchi yozgan ism bir odammi?
 * Tartib muhim emas ("Ali Valiyev" = "Valiyev Ali"), otasining ismi
 * yozilmagan bo'lsa ham mos keladi.
 */
export function namesMatch(a, b) {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (small.length < 2 && big.length >= 2) return false;
  return small.every(t => big.includes(t));
}
