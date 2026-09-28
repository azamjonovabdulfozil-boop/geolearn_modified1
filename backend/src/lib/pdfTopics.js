// ─────────────────────────────────────────────────────────────────────────
// PDF darslikdan mavzularni ajratib olish.
//
// PDF dan chiqadigan matnning eng katta muammosi: har bir KO'RINISH qatori
// alohida \n bilan keladi, ya'ni bitta gap 3-4 qatorga bo'linib ketadi va
// xatboshi chegaralari yo'qoladi. Shu sababli "qisqa qator = sarlavha"
// degan taxmin ishlamaydi — u gap bo'laklarini mavzu deb chiqaradi.
//
// Bu yerdagi tartib:
//   1) sahifalarga bo'lib o'qish;
//   2) kolontitul (har sahifada takrorlanadigan qator) va sahifa
//      raqamlarini olib tashlash;
//   3) mundarija satrlarini tashlab yuborish;
//   4) FAQAT ishonchli sarlavha belgilariga qarab bo'limlarni ajratish
//      ("1-§.", "12-mavzu", "§ 5", "2.3.", rim raqamlari, BOSH HARFLI qator);
//   5) uzilgan qatorlarni qayta birlashtirib, bo'lim matnini tiklash;
//   6) sarlavha topilmasa — matnni mazmunli bo'laklarga bo'lish.
// ─────────────────────────────────────────────────────────────────────────

import { extractPdfPages as readPdfPages } from "./pdfRead.js";

const MAX_TOPICS = 40;
const MIN_SECTION_CHARS = 160;   // bundan kichik bo'lim oldingisiga qo'shiladi
const CHUNK_CHARS = 1600;        // sarlavhasiz PDF uchun bo'lak kattaligi

export function cleanText(text = "") {
  return String(text)
    .replace(/\r/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// PDF ni sahifalarga bo'lib o'qish pdfRead.js da (polyfill + zaxira usul).
export { readPdf } from "./pdfRead.js";
export { extractPdfPages } from "./pdfRead.js";

/** Barcha sahifalarni bitta matnga qo'shadi (eski xatti-harakat bilan mos). */
export async function extractPdfText(buffer) {
  const pages = await readPdfPages(buffer);
  return cleanText(pages.join("\n"));
}

// ── Shovqin qatorlar ────────────────────────────────────────────────────

/** Sahifa raqami, "-- 1 of 2 --", "12 | Geografiya" kabi qatorlar. */
function isNoiseLine(line) {
  const l = line.trim();
  if (!l) return true;
  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(l)) return true;
  if (/^[-–—\s|.]*\d{1,4}[-–—\s|.]*$/.test(l)) return true;          // "12", "- 12 -"
  if (/^(page|sahifa|bet)\s*\.?\s*\d{1,4}$/i.test(l)) return true;
  if (/^\d{1,4}\s*[|/]\s*.{0,40}$/.test(l) && l.length < 46) return true; // "12 | Geografiya"
  if (/^[^\p{L}]+$/u.test(l)) return true;                            // faqat belgilar
  return false;
}

/** Mundarija satri: "1-§. Nomi ......... 5" yoki "Nomi 5". */
function isTocLine(line) {
  const l = line.trim();
  if (/[.·•…]{3,}\s*\d{1,4}$/.test(l)) return true;
  if (/^\d{1,2}[-.\s]?\s*(§|mavzu|bob)[^\n]{3,70}\s{2,}\d{1,4}$/iu.test(l)) return true;
  return false;
}

/**
 * Har sahifaning boshi/oxirida takrorlanadigan kolontitullarni topadi.
 * (3 va undan ortiq sahifada aynan takrorlansa — kolontitul deb hisoblanadi.)
 */
function runningLines(pages) {
  const counts = new Map();
  for (const page of pages) {
    const lines = page.split("\n").map(l => l.trim()).filter(Boolean);
    const edge = [...lines.slice(0, 2), ...lines.slice(-2)];
    for (const l of new Set(edge)) {
      const key = l.replace(/\d+/g, "#");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const limit = Math.max(3, Math.ceil(pages.length * 0.5));
  return new Set([...counts.entries()].filter(([, n]) => n >= limit).map(([k]) => k));
}

/** Sahifalarni tozalab, bitta qatorlar ro'yxatiga aylantiradi. */
export function pagesToLines(pages) {
  const running = pages.length >= 4 ? runningLines(pages) : new Set();
  const out = [];
  for (const page of pages) {
    for (const raw of page.split("\n")) {
      const line = raw.replace(/ /g, " ").replace(/[ \t]+/g, " ").trim();
      if (!line || isNoiseLine(line)) continue;
      if (running.has(line.replace(/\d+/g, "#"))) continue;
      if (isTocLine(line)) continue;
      out.push(line);
    }
  }
  return out;
}

// ── Sarlavhalarni aniqlash ──────────────────────────────────────────────

// Raqamlangan bo'lim sarlavhalari — eng ishonchli belgi
const NUMBERED_HEADING = [
  /^\d{1,3}\s*[-–—]?\s*§/,                                      // 1-§.  12 §
  /^§\s*\d{1,3}/,                                               // § 5.
  /^\d{1,3}\s*[-–—]\s*(mavzu|dars|bob|bo['`‘’]?lim|paragraf|tema)\b/iu,
  /^(mavzu|bob|bo['`‘’]?lim|paragraf|dars|glava|tema|chapter|unit|lesson)\s*[-–—№]?\s*\d{1,3}\b/iu,
  /^\d{1,2}\.\d{1,2}\.?\s+\p{L}/u,                              // 2.3. Sarlavha
  /^[IVXLC]{1,5}[.)]\s+\p{Lu}/u,                                // IV. Sarlavha
];

// Sarlavha bo'la olmaydigan qatorlar (mashq, savol bloklari matn ichida qoladi)
const NEVER_HEADING = /^(savol|topshiriq|mashq|tayanch|test|nazorat|uy vazifasi|mustaqil ish|javob|izoh|manba|adabiyot|rasm|jadval|chizma|\d+\s*-?\s*rasm)\b/iu;

function letterStats(line) {
  const letters = line.replace(/[^\p{L}]/gu, "");
  const upper = line.replace(/[^\p{Lu}]/gu, "").length;
  return { letters: letters.length, upper };
}

/** "GEOGRAFIYA FANI" kabi bosh harflar bilan yozilgan sarlavha. */
function isUpperHeading(line) {
  if (line.length < 4 || line.length > 120) return false;
  if (/[.!?;]$/.test(line)) return false;
  const { letters, upper } = letterStats(line);
  if (letters < 4) return false;
  return upper / letters >= 0.75;
}

/** Raqamli sarlavha ("7. Atmosfera va iqlim") — nuqta bilan tugamasligi shart. */
function isNumberedHeading(line) {
  if (line.length > 120) return false;
  if (NUMBERED_HEADING.some(re => re.test(line))) return true;
  return /^\d{1,3}[.)]\s+\p{Lu}[^.!?]{4,}$/u.test(line) && line.split(/\s+/).length <= 12;
}

/** Ishonchli sarlavha: raqamlangan yoki BOSH HARFLI. */
export function isStrongHeading(line) {
  const l = line.trim();
  if (!l || l.length < 4) return false;
  if (NEVER_HEADING.test(l)) return false;
  if (isTocLine(l)) return false;
  return isNumberedHeading(l) || isUpperHeading(l);
}

/**
 * Zaif sarlavha — hujjatda ishonchli sarlavhalar topilmagandagina
 * ishlatiladi: qisqa, tinish belgisisiz, katta harf bilan boshlanuvchi,
 * oldingi gap tugagandan keyin keluvchi qator.
 */
function isWeakHeading(line, prevLine, nextLine, maxLen) {
  const l = line.trim();
  if (!l || l.length < 6 || l.length > 70) return false;
  if (NEVER_HEADING.test(l)) return false;
  if (/[.,;:!?»"]$/.test(l)) return false;
  if (!/^[\p{Lu}\d]/u.test(l)) return false;
  if (l.split(/\s+/).length > 8) return false;
  if (prevLine && !/[.!?:»"]$/.test(prevLine)) return false;   // gap o'rtasi
  // Keyingi qator kichik harfdan boshlansa — bu sarlavha emas, uzilgan gap
  if (nextLine && !/^[\p{Lu}\d«"]/u.test(nextLine.trim())) return false;
  // Sarlavha odatda oddiy matn qatoridan sezilarli kalta bo'ladi
  if (maxLen && l.length > maxLen * 0.8) return false;
  return true;
}

/** BOSH HARFLI sarlavhani o'qishga qulay ko'rinishga keltiradi. */
function prettifyTitle(title) {
  let t = cleanText(title).replace(/^[#*\-–—\s]+/, "").replace(/[\s.:–—-]+$/, "").trim();
  const { letters, upper } = letterStats(t);
  if (letters >= 4 && upper / letters >= 0.75) {
    // BOSH HARFLI sarlavha → oddiy jumla ko'rinishi
    t = t.toLowerCase().replace(/(^[^\p{L}]*|[.!?]\s+)(\p{L})/gu, (m, pre, c) => pre + c.toUpperCase());
  }
  return t.slice(0, 110);
}

/** Uzilgan qatorlarni qayta birlashtiradi (tire bilan ko'chirilganini ham). */
function joinLines(lines) {
  let out = "";
  for (const line of lines) {
    if (!out) { out = line; continue; }
    if (/[\p{L}]-$/u.test(out) && /^\p{Ll}/u.test(line)) out = out.slice(0, -1) + line;
    else out += " " + line;
  }
  return cleanText(out);
}

function splitSentences(text = "") {
  return cleanText(text)
    .split(/(?<=[.!?])\s+/u)
    .map(s => s.trim())
    .filter(s => s.length >= 20);
}

/** Sarlavhasiz matnni mazmunli bo'laklarga bo'ladi. */
function chunkText(text, lessonTitle) {
  const sentences = splitSentences(text);
  const chunks = [];
  let buf = [];
  let len = 0;
  for (const s of sentences) {
    buf.push(s);
    len += s.length + 1;
    if (len >= CHUNK_CHARS) { chunks.push(buf.join(" ")); buf = []; len = 0; }
  }
  if (buf.length) {
    if (chunks.length && len < 400) chunks[chunks.length - 1] += " " + buf.join(" ");
    else chunks.push(buf.join(" "));
  }
  return chunks.map((c, i) => ({
    title: `${lessonTitle} — ${i + 1}-qism: ${topicNameFromText(c)}`.slice(0, 110),
    content: c,
    source: "chunk",
  }));
}

/** Bo'lak matnidan qisqa nom yasaydi (birinchi gapning bosh qismi). */
function topicNameFromText(text) {
  const first = splitSentences(text)[0] || cleanText(text);
  const words = first.replace(/^[\d\s.)-]+/, "").split(/\s+/).slice(0, 7).join(" ");
  return words.replace(/[,;:]$/, "").slice(0, 70);
}

/** Sarlavhalar bo'yicha bo'limlarni yig'adi. */
// "1-§." yoki "12-mavzu." — o'zi yolg'iz turgan raqamli sarlavha bo'lagi;
// keyingi qator uning davomi bo'ladi.
const BARE_NUMBER_HEADING = /^(\d{1,3}\s*[-–—]?\s*§|§\s*\d{1,3}|\d{1,3}\s*[-–—]\s*(mavzu|dars|bob|bo['`‘’]?lim)|[IVXLC]{1,5})[.)\s]*$/iu;

// Mashq/savol bloki — mavzu matnining oxiri
const EXERCISE_START = /^(savol|topshiriq|mashq|test savollari|nazorat savollari|tayanch (so['`‘’]?z|ibora)|uy vazifasi|mustaqil ish)/iu;

function buildSections(lines, headingFlags) {
  const sections = [];
  let cur = null;
  let skipToNextHeading = false;

  const flush = () => {
    if (cur) sections.push(cur);
    cur = null;
  };

  lines.forEach((line, i) => {
    if (headingFlags[i]) {
      skipToNextHeading = false;
      // "1-§." alohida qatorda, nomi keyingi qatorda bo'lsa — birlashtiramiz
      if (cur && cur.lines.length === 0 && cur.title && BARE_NUMBER_HEADING.test(cur.title.trim())) {
        cur.title = `${cur.title} ${line}`.replace(/\s+/g, " ").trim();
        return;
      }
      flush();
      cur = { title: line, lines: [] };
      return;
    }
    if (skipToNextHeading) return;
    if (!cur) cur = { title: null, lines: [] };
    // Mavzu matni yetarli bo'lsa, mashq bloki matnga qo'shilmaydi
    if (EXERCISE_START.test(line) && joinLines(cur.lines).length >= 200) {
      skipToNextHeading = true;
      return;
    }
    cur.lines.push(line);
  });
  flush();

  return sections.map(s => ({
    title: s.title,
    content: joinLines(s.lines),
  }));
}

/** Kichik bo'limlarni oldingisiga qo'shadi, keraksizlarini tashlaydi. */
function mergeSmallSections(sections, lessonTitle) {
  const out = [];
  for (const s of sections) {
    const content = cleanText(s.content);
    const title = s.title ? prettifyTitle(s.title) : null;
    if (!title && !content) continue;

    // Sarlavhasiz kirish qismi qisqa bo'lsa (muqova, mundarija) — tashlanadi
    if (!title && content.length < 600 && out.length === 0) continue;
    // Matnsiz sarlavha (muqova nomi, "MUNDARIJA", bo'lim nomi) — mavzu emas
    if (content.length < 40) continue;

    if (content.length < MIN_SECTION_CHARS && out.length) {
      const prev = out[out.length - 1];
      prev.content = cleanText(`${prev.content} ${title ? title + "." : ""} ${content}`);
      continue;
    }
    out.push({
      title: title || `${lessonTitle} — kirish`,
      content: content || title,
    });
  }

  const seen = new Set();
  return out
    .filter(s => {
      const key = s.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return (s.content || "").length >= 80;
    })
    .slice(0, MAX_TOPICS);
}

/**
 * PDF matnidan mavzularni ajratadi.
 * @returns {{topics: {title,content,source}[], mode: "headings"|"chunks", pages: number}}
 */
export function analyzePdf(pages, lessonTitle = "Darslik") {
  const lines = pagesToLines(pages);
  const fullText = joinLines(lines);

  if (!lines.length) return { topics: [], mode: "chunks", pages: pages.length };

  // 1-urinish: ishonchli sarlavhalar
  let flags = lines.map(l => isStrongHeading(l));
  let strongCount = flags.filter(Boolean).length;

  // Butun hujjat bosh harflar bilan yozilgan bo'lsa — "BOSH HARF" belgisi
  // ma'nosini yo'qotadi, faqat raqamlangan sarlavhalarni qoldiramiz.
  if (strongCount > lines.length * 0.4) {
    flags = lines.map(l => isNumberedHeading(l.trim()) && !NEVER_HEADING.test(l.trim()));
    strongCount = flags.filter(Boolean).length;
  }

  let sections = strongCount >= 2 ? mergeSmallSections(buildSections(lines, flags), lessonTitle) : [];

  // 2-urinish: zaif sarlavhalar (faqat natija ishonchli bo'lsa qabul qilinadi)
  if (sections.length < 2) {
    const lens = lines.map(l => l.length).sort((a, b) => a - b);
    const medianLen = lens[Math.floor(lens.length / 2)] || 0;
    const weak = lines.map((l, i) => isWeakHeading(l, lines[i - 1], lines[i + 1], medianLen));
    if (weak.filter(Boolean).length >= 3) {
      const weakSections = mergeSmallSections(buildSections(lines, weak), lessonTitle);
      const solid = weakSections.filter(s => s.content.length >= 300);
      if (solid.length >= 3) sections = solid;
    }
  }

  if (sections.length >= 2) {
    return {
      topics: sections.map(s => ({ ...s, source: "heading" })),
      mode: "headings",
      pages: pages.length,
    };
  }

  // 3-urinish: sarlavha yo'q — matnni bo'laklarga bo'lamiz
  const chunks = chunkText(fullText, lessonTitle);
  if (chunks.length >= 2) return { topics: chunks, mode: "chunks", pages: pages.length };

  return {
    topics: fullText.length >= 80
      ? [{ title: lessonTitle, content: fullText, source: "chunk" }]
      : [],
    mode: "chunks",
    pages: pages.length,
  };
}

export const _test = { isNoiseLine, isTocLine, isUpperHeading, isNumberedHeading, prettifyTitle, joinLines };
