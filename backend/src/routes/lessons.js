import { Router } from "express";
import multer from "multer";
import {
  getLessons, getLessonById, createLesson, deleteLesson,
  getTopicsByLesson, getTopicById, createTopic, updateTopic, deleteTopic,
  updateUser, createActivity, createVariant, getVariant, updateVariant,
} from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { pickSection } from "../lib/scope.js";
import { readPdf, analyzePdf, cleanText } from "../lib/pdfTopics.js";
import { buildQuestionPool, buildWrittenPool, pickVariant } from "../lib/testGen.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

const TESTS_PER_ATTEMPT = 15;   // o'quvchi bir urinishda ko'radigan savollar
const TEST_POOL_SIZE = 40;      // mavzu uchun saqlanadigan savollar zaxirasi
const AI_TESTS_REQUEST = 20;    // AI dan so'raladigan savollar soni
const LOVABLE_MODEL = "google/gemini-3-flash-preview";

function getJsonArray(raw) {
  if (!raw) return null;
  const text = raw.replace(/```json|```/gi, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

async function callAiJson(prompt, maxTokens = 4000) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!lovableKey && !openaiKey) return null;
  try {
    const baseUrl = lovableKey ? "https://ai.gateway.lovable.dev/v1" : "https://api.openai.com/v1";
    const headers = lovableKey
      ? { "Content-Type": "application/json", "Lovable-API-Key": lovableKey }
      : { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` };
    const model = lovableKey ? LOVABLE_MODEL : "gpt-4o-mini";
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST", headers,
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.35, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(35000),
    });
    if (resp.ok) {
      const d = await resp.json();
      const parsed = getJsonArray(d?.choices?.[0]?.message?.content?.trim());
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { console.log("AI JSON xato:", e.message); }
  return null;
}

async function callAiText(prompt, maxTokens = 1400) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!lovableKey && !openaiKey) return null;
  try {
    const baseUrl = lovableKey ? "https://ai.gateway.lovable.dev/v1" : "https://api.openai.com/v1";
    const headers = lovableKey
      ? { "Content-Type": "application/json", "Lovable-API-Key": lovableKey }
      : { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` };
    const model = lovableKey ? LOVABLE_MODEL : "gpt-4o-mini";
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST", headers,
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.45, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(35000),
    });
    if (resp.ok) {
      const d = await resp.json();
      return d?.choices?.[0]?.message?.content?.trim() || null;
    }
  } catch (e) { console.log("AI text xato:", e.message); }
  return null;
}

function splitSentences(text = "") {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/u)
    .map(s => s.trim())
    .filter(s => s.length >= 20 && s.length <= 320);
}

const STOP = new Set(["bilan", "uchun", "yoki", "hamda", "qaysi", "mavzu", "haqida", "bo'yicha", "bo‘yicha", "asosiy", "matnda", "hisoblanadi", "bo'lgan", "bo‘lgan", "uning", "ularning", "shuningdek", "lekin", "ammo", "bo'lib", "edi", "kabi", "qilib", "ko'p"]);

function keywords(text = "") {
  return [...new Set((text.toLowerCase().match(/[a-zа-яёіїўқғҳʼ'‘’`-]{4,}/giu) || [])
    .map(w => w.replace(/[ʼ'‘’`]/g, "'"))
    .filter(w => !STOP.has(w)))].slice(0, 60);
}

// ── Testlar: faqat mavzu matnidan (testGen.js) ───────────────────────────
// Har bir mavzuda katta savollar to'plami (pool) saqlanadi; o'quvchiga
// har urinishda undan tasodifiy TESTS_PER_ATTEMPT ta savol beriladi.

/** Bir nechta ro'yxatni takrorlarsiz birlashtiradi. */
function mergeQuestions(lists, limit, alreadyHave = []) {
  const key = q => q.questionText.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  const seen = new Set(alreadyHave.map(key));
  const out = [];
  for (const list of lists) {
    for (const q of list) {
      if (out.length >= limit) return out;
      const k = key(q);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(q);
    }
  }
  return out;
}

/**
 * Zaxirani kamida TESTS_PER_ATTEMPT tagacha to'ldiradi.
 * `build` har chaqirilganda savollarni qaytadan (tasodifiy) yasaydi —
 * shuning uchun bir necha urinish yangi savollar qo'shadi.
 */
function fillPool(pool, build, maxRounds = 12) {
  let idle = 0;
  for (let i = 0; i < maxRounds && pool.length < TESTS_PER_ATTEMPT; i++) {
    const before = pool.length;
    pool.push(...mergeQuestions([build()], TEST_POOL_SIZE - pool.length, pool));
    // Generator tasodifiy, shuning uchun bo'sh urinish bo'lishi normal —
    // ketma-ket uch marta yangi savol chiqmasa, zaxira tugagan deb bilamiz.
    idle = pool.length === before ? idle + 1 : 0;
    if (idle >= 3) break;
  }
  return pool;
}

/** AI savollarini tekshirib, mavzu matnidan yasalgan savollar bilan to'ldiradi. */
function normalizeTests(raw, topicTitle, topicContent, sourceText = "") {
  const aiTests = (Array.isArray(raw) ? raw : []).map(q => {
    const question = (q?.question || q?.questionText || "").toString().trim();
    const options = Array.isArray(q?.options)
      ? [...new Set(q.options.map(o => String(o).trim()).filter(Boolean))]
      : [];
    const correctIndex = Number.isInteger(q?.correctIndex) ? q.correctIndex : 0;
    if (!question || options.length !== 4) return null;
    if (correctIndex < 0 || correctIndex > 3) return null;
    return { question, questionText: question, options, correctIndex };
  }).filter(Boolean);

  // Avval PDF ning o'z matnidan va AI dan — bular darslikdagi haqiqiy
  // ma'lumotga tayanadi. Kengaytirilgan matn faqat savol yetmasa qo'shiladi.
  const fromSource = sourceText ? buildQuestionPool(topicTitle, sourceText, TEST_POOL_SIZE) : [];
  const merged = mergeQuestions([fromSource, aiTests], TEST_POOL_SIZE);

  // Generator har safar savollarni tasodifiy tanlaydi, shuning uchun matni
  // qisqa mavzularda bitta urinish 15 tagacha yetmasligi mumkin. Yangi
  // savol qo'shilmay qolgunicha yoki chegaraga yetgunicha takrorlaymiz.
  fillPool(merged, () => buildQuestionPool(topicTitle, topicContent, TEST_POOL_SIZE));
  if (sourceText) fillPool(merged, () => buildQuestionPool(topicTitle, sourceText, TEST_POOL_SIZE));

  return merged.map((q, i) => ({ ...q, id: i + 1 }));
}

/** Yozma savollar to'plami — AI + mavzu matnidan yasalganlari. */
function normalizeClosedTests(raw, topicTitle, topicContent, sourceText = "") {
  const aiTests = (Array.isArray(raw) ? raw : [])
    .map(q => (q?.question || q?.questionText || (typeof q === "string" ? q : "")).toString().trim())
    .filter(Boolean)
    .map(question => ({ question, questionText: question }));

  const fromSource = sourceText ? buildWrittenPool(topicTitle, sourceText, TEST_POOL_SIZE) : [];
  const merged = mergeQuestions([fromSource, aiTests], TEST_POOL_SIZE);

  fillPool(merged, () => buildWrittenPool(topicTitle, topicContent, TEST_POOL_SIZE));
  if (sourceText) fillPool(merged, () => buildWrittenPool(topicTitle, sourceText, TEST_POOL_SIZE));

  return merged.map((q, i) => ({ ...q, id: i + 1 }));
}


// ── Rich, NON-repetitive content synthesis ───────────────────────────────
function synthesizeRichContent(topicTitle, baseContent) {
  const base = cleanText(baseContent || "");
  const sentences = splitSentences(base);
  const terms = keywords(`${topicTitle} ${base}`);
  const t = (n) => terms[n] || topicTitle.split(/\s+/)[n] || "geografik tushuncha";

  const out = [];
  out.push(`${topicTitle} — geografiya darsining muhim mavzularidan biri bo'lib, quyida uning asosiy mazmuni batafsil yoritiladi.`);
  if (sentences[0]) out.push(sentences[0]);
  out.push(`Ushbu mavzu doirasida o'quvchilar ${topicTitle.toLowerCase()} bilan bog'liq asosiy tushunchalar, ta'riflar va qonuniyatlar bilan tanishadilar.`);
  for (const s of sentences.slice(1, 14)) out.push(s);

  const enrich = [
    `«${t(0)}» tushunchasi mavzuda markaziy o'rin tutadi va uning ma'nosini bilish bilimni mustahkamlaydi.`,
    `«${t(1)}» bilan bog'liq jihatlar mavzuni chuqurroq anglashga yordam beradi.`,
    `«${t(2)}» kabi atamalar geografik ma'lumotlarni tizimli o'rganishda alohida ahamiyatga ega.`,
    `${topicTitle} tabiat, jamiyat va inson faoliyati o'rtasidagi o'zaro aloqalarni ko'rsatib beradi.`,
    `Mavzu doirasida keltirilgan misollar nazariy bilimlarni amaliyot bilan bog'lashga xizmat qiladi.`,
    `Geografik xaritalar, statistik ma'lumotlar va tabiiy hodisalarni tahlil qilish ushbu mavzuni o'zlashtirishni osonlashtiradi.`,
    `Mavzuni o'rganish o'quvchilarda kuzatish, taqqoslash va xulosa chiqarish ko'nikmalarini shakllantiradi.`,
    `«${t(3)}» va «${t(4)}» tushunchalari mavzu mazmunini kengaytiradi va yangi qirralarini ochib beradi.`,
    `Bu mavzudan olingan bilimlar kundalik hayotda, sayohatlarda va atrof-muhitni anglashda foydali bo'ladi.`,
    `${topicTitle}ni o'rganish geografiya fani bo'yicha umumiy savodxonlikni va dunyoqarashni boyitadi.`,
    `Mavzu yakunida o'quvchilar olgan bilimlarini misollar va vazifalar orqali mustahkamlaydi.`,
  ];
  for (const s of enrich) {
    if (out.length >= 20) break;
    if (!out.includes(s)) out.push(s);
  }
  const seen = new Set();
  return out.filter(s => {
    const k = s.toLowerCase().slice(0, 50);
    if (seen.has(k)) return false;
    seen.add(k); return s.length > 20;
  }).slice(0, 22).join(" ");
}

async function expandTopicContent(topicTitle, baseContent) {
  const prompt = `Sen geografiya o'qituvchisisan. "${topicTitle}" mavzusi bo'yicha PDF parchasiga tayanib batafsil ma'lumot yoz.

QOIDALAR:
- KAMIDA 17-18 ta to'liq gap bo'lsin.
- Faqat o'zbek tilida yoz.
- Mavzuni keng yorit: ta'rif, asosiy tushunchalar, misollar, geografik faktlar, ahamiyati.
- Matn ravon va o'quvchi tushunadigan bo'lsin.
- Bir xil gapni TAKRORLAMA.
- Faqat matnni qaytar.

PDF parchasi:
${String(baseContent).slice(0, 3500)}`;
  const text = await callAiText(prompt, 1500);
  const cleaned = text ? cleanText(text).replace(/^#+\s*.+\n+/g, "") : "";
  const sCount = (cleaned.match(/[.!?]+/g) || []).length;
  if (cleaned && sCount >= 15) return cleaned;
  return synthesizeRichContent(topicTitle, baseContent);
}

const MAX_PDF_TOPICS = 40;      // bitta PDF dan chiqadigan mavzular chegarasi
const MAX_TOPIC_CHARS = 20000;  // bitta mavzu matnining chegarasi

/** Matnni belgilangan uzunlikda, gap oxiridan kesadi. */
function trimToSentence(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut).trim();
}
const AI_BATCH = 3;          // bir vaqtda nechta mavzu AI bilan tayyorlanadi

/** Uzun matnni AI ga yuborish uchun oynalarga bo'ladi (butun hujjat qamraladi). */
function textWindows(text, size = 12000, max = 6) {
  const out = [];
  const step = Math.max(size, Math.ceil(text.length / max));
  for (let i = 0; i < text.length && out.length < max; i += step) {
    out.push(text.slice(i, i + step));
  }
  return out;
}

/**
 * PDF da aniq sarlavhalar bo'lmasa — mavzularni AI ajratadi.
 * Butun matn bo'ylab yuriladi, faqat birinchi sahifalar emas.
 */
async function aiSplitTopics(pdfText, lessonTitle) {
  const found = [];
  for (const part of textWindows(pdfText)) {
    const prompt = `Quyida darslik PDF sining bir qismi berilgan. Undagi ASOSIY MAVZULARNI ajrat.
Qoidalar:
- Mavzu nomlari matnning o'zidan olinsin, o'ylab topilmasin.
- Har bir mavzu boshqasidan farq qilsin, takrorlanmasin.
- content — o'sha mavzuga oid matnning mazmuni (kamida 5 ta gap).
- Matn qaysi tilda bo'lsa, mavzu nomi ham o'sha tilda bo'lsin.
- Faqat JSON array qaytar, boshqa hech narsa yozma.

Matn:
${part}

Format:
[{"title":"Mavzu nomi","content":"Mavzu mazmuni"}]`;
    const arr = await callAiJson(prompt, 6000);
    if (!Array.isArray(arr)) continue;
    for (const t of arr) {
      const title = cleanText(t?.title || "").slice(0, 110);
      const content = cleanText(t?.content || "");
      if (title.length < 3 || title.length > 110) continue;
      if (content.length < 80) continue;
      found.push({ title, content, source: "ai" });
    }
  }
  const seen = new Set();
  return found.filter(t => {
    const key = t.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Bitta mavzu uchun matn + testlarni tayyorlab, bazaga yozadi. */
async function buildTopicRecord(lessonId, topic, order) {
  const topicTitle = topic.title;
  const sourceText = cleanText(topic.content || "");   // PDF dagi asl matn
  let topicContent = sourceText || topicTitle;

  // PDF dagi matn yetarlicha to'liq bo'lsa — uni o'zgartirmaymiz.
  // Faqat qisqa bo'lsa AI (yoki mahalliy sintez) bilan kengaytiramiz.
  const sentenceCount = (topicContent.match(/[.!?]+/g) || []).length;
  if (sentenceCount < 12) {
    try {
      topicContent = await expandTopicContent(topicTitle, topicContent);
    } catch {
      topicContent = synthesizeRichContent(topicTitle, topicContent);
    }
  }
  if (!topicContent || topicContent.length < 120) {
    topicContent = synthesizeRichContent(topicTitle, topic.content || topicTitle);
  }

  const openPrompt = `"${topicTitle}" mavzusi bo'yicha quyidagi matnga tayanib ${AI_TESTS_REQUEST} ta VARIANTLI (4 javobli) test yarat.
Qoidalar:
- Savollar BIR-BIRIDAN FARQLI bo'lsin, takrorlanmasin.
- Har xil turdagi savollar bo'lsin: ta'rif, misol, taqqoslash, sabab-oqibat, bo'sh joyni to'ldirish.
- Savollar shu matndagi ma'lumotga asoslansin.
- 4 ta variant bo'lsin, faqat bittasi to'g'ri, correctIndex 0-3 oralig'ida.
- Faqat JSON array qaytar.

Mavzu matni:
${topicContent.slice(0, 3500)}

Format:
[{"question":"...","options":["A","B","C","D"],"correctIndex":0}]`;

  const closedPrompt = `"${topicTitle}" mavzusi bo'yicha quyidagi matnga tayanib ${AI_TESTS_REQUEST} ta YOZMA (variantsiz) savol yarat.
Qoidalar:
- Savollar BIR-BIRIDAN FARQLI bo'lsin, TAKRORLANMASIN.
- Turli xil: izohlash, taqqoslash, misol so'rash, sabab-oqibat, xulosa chiqarish.
- O'quvchi yozma javob berishi kerak.
- Faqat JSON array qaytar.

Mavzu matni:
${topicContent.slice(0, 3500)}

Format:
[{"question":"Savol matni?"}]`;

  const [openRaw, closedRaw] = await Promise.all([
    callAiJson(openPrompt, 6000),
    callAiJson(closedPrompt, 4000),
  ]);
  const openTests = normalizeTests(openRaw, topicTitle, topicContent, sourceText);
  const closedTests = normalizeClosedTests(closedRaw, topicTitle, topicContent, sourceText);

  const created = createTopic({
    lessonId, order, title: topicTitle, content: topicContent,
    tests: openTests, openTests, closedTests,
  });
  return { id: created.id, title: topicTitle, testsCount: openTests.length, closedCount: closedTests.length };
}

// ── Routes ───────────────────────────────────────────────────────────────

/**
 * O'quvchiga mavzu qaytarilganda savollar va to'g'ri javoblar yuborilmaydi —
 * faqat nechta savol borligi ko'rsatiladi. Aks holda javoblarni brauzerdan
 * ko'rib olish mumkin bo'lardi.
 */
function safeTopic(topic, user) {
  if (!topic) return topic;
  if (user?.role === "teacher") return topic;
  const { tests, openTests, closedTests, ...rest } = topic;
  const openPool = openTests ?? tests ?? [];
  const closedPool = closedTests ?? [];
  return {
    ...rest,
    openCount: Math.min(TESTS_PER_ATTEMPT, openPool.length),
    closedCount: Math.min(TESTS_PER_ATTEMPT, closedPool.length),
  };
}

router.get("/lessons", requireAuth, (req, res) => {
  const lessons = getLessons().map(l => ({
    ...l,
    topics: getTopicsByLesson(l.id).map(t => safeTopic(t, req.user)),
  }));
  res.json(lessons);
});

router.post("/lessons", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const { title, description, grade, section } = req.body;
  if (!title || !grade) return res.status(400).json({ error: "Sarlavha va sinf kerak" });
  const lesson = createLesson({
    title, description: description || "", grade: Number(grade),
    section: pickSection(section),
    teacherId: req.user.id,
  });
  res.status(201).json(lesson);
});

router.get("/lessons/:id", requireAuth, (req, res) => {
  const lesson = getLessonById(Number(req.params.id));
  if (!lesson) return res.status(404).json({ error: "Topilmadi" });
  res.json({ ...lesson, topics: getTopicsByLesson(lesson.id).map(t => safeTopic(t, req.user)) });
});

router.delete("/lessons/:id", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  deleteLesson(Number(req.params.id));
  res.json({ success: true });
});

/** PDF o'qilmagan sababiga qarab tushunarli xabar. */
function pdfReadErrorMessage(readError) {
  const e = String(readError || "").toLowerCase();
  if (e.includes("password") || e.includes("encrypt")) {
    return "PDF parol bilan himoyalangan. Parolsiz nusxasini yuklang.";
  }
  if (e.includes("invalid") || e.includes("corrupt") || e.includes("structure")) {
    return "PDF fayl buzilgan yoki to'liq yuklanmagan. Faylni qayta saqlab ko'ring.";
  }
  return "PDF ichida matn topilmadi — bu skaner qilingan (rasm ko'rinishidagi) PDF. "
    + "Matnli PDF yuklang yoki faylni matn tanib oluvchi (OCR) dastur orqali o'tkazing.";
}

router.post("/lessons/:id/pdf", requireAuth, upload.single("pdf"), async (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const lessonId = Number(req.params.id);
  const lesson = getLessonById(lessonId);
  if (!lesson) return res.status(404).json({ error: "Topilmadi" });
  if (!req.file) return res.status(400).json({ error: "PDF fayl kerak" });

  // Fayl haqiqatan PDF mi? (boshida "%PDF-" imzosi turadi)
  if (req.file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return res.status(400).json({
      error: `Bu fayl PDF emas (${req.file.originalname || "fayl"}). Iltimos, .pdf faylni tanlang.`,
    });
  }

  try {
    // 1) PDF ni sahifalarga bo'lib o'qiymiz.
    //    readPdf ikki usulni ketma-ket sinaydi: pdf.js va zaxira o'qigich.
    const { pages, method, error: readError } = await readPdf(req.file.buffer);
    const pdfText = cleanText(pages.join("\n"));
    if (!pdfText || pdfText.length < 30) {
      return res.status(400).json({ error: pdfReadErrorMessage(readError) });
    }

    // 2) Mavzularni PDF ning o'z tuzilishidan ajratamiz:
    //    sarlavhalar ("1-§.", "12-mavzu", BOSH HARFLI nomlar) bo'yicha.
    const analysis = analyzePdf(pages, lesson.title);
    let topics = analysis.topics;
    let mode = analysis.mode;

    // 3) Sarlavhalar topilmasa (uzluksiz matn) — AI yordamida bo'lamiz
    if (mode !== "headings" || topics.length < 2) {
      const aiTopics = await aiSplitTopics(pdfText, lesson.title);
      if (aiTopics.length >= 2) {
        topics = aiTopics;
        mode = "ai";
      }
    }

    topics = topics
      .map(t => ({
        title: cleanText(t.title).slice(0, 110),
        content: trimToSentence(cleanText(t.content || t.title), MAX_TOPIC_CHARS),
      }))
      .filter(t => t.title && t.content)
      .slice(0, MAX_PDF_TOPICS);

    if (!topics.length) {
      return res.status(400).json({ error: "PDF dan mavzu ajratib bo'lmadi. Fayl matnini tekshirib ko'ring." });
    }

    // 4) Har bir mavzu uchun matn va testlar tayyorlanadi.
    //    Mavzular PDF dagi ketma-ketlikda saqlanadi (order maydoni).
    const createdTopics = [];
    let totalTests = 0;
    for (let i = 0; i < topics.length; i += AI_BATCH) {
      const batch = await Promise.all(
        topics.slice(i, i + AI_BATCH).map((t, k) => buildTopicRecord(lessonId, t, i + k))
      );
      for (const tp of batch) {
        createdTopics.push(tp);
        totalTests += tp.testsCount + tp.closedCount;
      }
    }

    const modeLabel = {
      headings: "PDF sarlavhalari bo'yicha",
      ai: "matn tahlili (AI) bo'yicha",
      chunks: "matn bo'laklari bo'yicha",
    }[mode] || "matn bo'yicha";

    res.json({
      success: true,
      summary: [
        `✅ PDF muvaffaqiyatli qayta ishlandi`,
        `📄 Sahifalar: ${analysis.pages} ta${method === "raw" ? " (zaxira o'qish usuli)" : ""}`,
        `🔍 Mavzular ${modeLabel} ajratildi`,
        `📚 Aniqlangan mavzular soni: ${createdTopics.length}`,
        `📝 Savollar zaxirasi: ${totalTests} ta (har urinishda ${TESTS_PER_ATTEMPT} tasi tasodifiy tanlanadi)`,
        ``,
        ...createdTopics.map((tp, i) => `${i + 1}. ${tp.title} — ${tp.testsCount} variantli + ${tp.closedCount} yozma`),
      ].join("\n"),
      mode,
      pages: analysis.pages,
      topicsCreated: createdTopics.length,
      testsCreated: totalTests,
      topics: createdTopics,
    });
  } catch (e) {
    console.error("PDF parsing error:", e);
    res.status(500).json({ error: e.message || "PDF qayta ishlashda xato" });
  }
});

router.get("/lessons/:id/topics", requireAuth, (req, res) => {
  res.json(getTopicsByLesson(Number(req.params.id)).map(t => safeTopic(t, req.user)));
});

router.post("/lessons/:id/topics", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const { title, content } = req.body;
  if (!title) return res.status(400).json({ error: "Sarlavha kerak" });
  const topic = createTopic({ lessonId: Number(req.params.id), title, content: content || "", tests: [] });
  res.status(201).json(topic);
});

router.post("/topics/generate-tests", requireAuth, async (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const topicId = Number(req.body?.topicId);
  const topic = getTopicById(topicId);
  if (!topic) return res.status(404).json({ error: "Topilmadi" });
  const content = String(req.body?.topicContent || topic.content || topic.title);
  const tests = normalizeTests(null, topic.title, content);
  const closedTests = normalizeClosedTests(null, topic.title, content);
  const updated = updateTopic(topic.id, { tests, openTests: tests, closedTests });
  res.json({
    success: true,
    perAttempt: TESTS_PER_ATTEMPT,
    counts: { open: tests.length, closed: closedTests.length },
    open: tests,
    closed: closedTests,
    // eski mijozlar uchun
    tests, testsCount: tests.length, closedCount: closedTests.length,
    topic: updated,
  });
});

router.delete("/topics/:id", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  deleteTopic(Number(req.params.id));
  res.json({ success: true });
});

router.get("/topics/:id", requireAuth, (req, res) => {
  const topic = getTopicById(Number(req.params.id));
  if (!topic) return res.status(404).json({ error: "Topilmadi" });
  res.json(safeTopic(topic, req.user));
});

// Savollar zaxirasi (javoblari bilan) — faqat o'qituvchi ko'ra oladi.
//   ?mode=open   → variantli savollar (default)
//   ?mode=closed → yozma savollar
//   ?mode=all    → ikkalasi + hisoblar
router.get("/topics/:id/tests", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const topic = getTopicById(Number(req.params.id));
  if (!topic) return res.status(404).json({ error: "Topilmadi" });

  const open = topic.openTests ?? topic.tests ?? [];
  const closed = topic.closedTests ?? [];
  const mode = String(req.query.mode || "open");

  if (mode === "all") {
    return res.json({
      topicId: topic.id,
      title: topic.title,
      perAttempt: TESTS_PER_ATTEMPT,
      counts: { open: open.length, closed: closed.length },
      open,
      closed,
    });
  }
  if (mode === "closed") return res.json(closed);
  res.json(open);
});

/**
 * Yangi urinish. Har chaqirilganda savollar zaxiradan qaytadan tanlanadi,
 * tartibi va javob variantlari aralashtiriladi — ya'ni o'quvchi testni
 * tashlab chiqib ketsa yoki qayta boshlasa, savollar yangilanadi.
 * To'g'ri javoblar javobda yuborilmaydi.
 */
router.post("/topics/:id/attempt", requireAuth, (req, res) => {
  const topic = getTopicById(Number(req.params.id));
  if (!topic) return res.status(404).json({ error: "Topilmadi" });

  const mode = req.body?.mode === "closed" ? "closed" : "open";
  const pool = mode === "closed"
    ? (topic.closedTests ?? [])
    : (topic.openTests ?? topic.tests ?? []);
  if (!pool.length) return res.json({ variantId: null, mode, total: 0, questions: [] });

  const picked = pickVariant(pool, TESTS_PER_ATTEMPT);
  const variant = createVariant({
    topicId: topic.id,
    userId: req.user.id,
    mode,
    key: picked.map(q => ({ id: q.id, correctIndex: q.correctIndex ?? null })),
  });

  res.json({
    variantId: variant.id,
    mode,
    total: picked.length,
    poolSize: pool.length,
    questions: picked.map(q => ({
      id: q.id,
      num: q.num,
      questionText: q.questionText,
      ...(q.options ? { options: q.options } : {}),
    })),
  });
});

/** {questionId: javob} ko'rinishidagi mijoz javoblarini tozalaydi. */
function normalizeClientAnswers(given) {
  const out = {};
  if (given && typeof given === "object") {
    for (const [k, v] of Object.entries(given)) {
      if (Number.isInteger(v)) out[Number(k)] = v;
    }
  }
  return out;
}

/** Variantni tekshiradi va shu o'quvchiga tegishliligini ta'minlaydi. */
function loadVariant(req, topicId) {
  const variant = getVariant(String(req.body?.variantId || ""));
  if (!variant) return null;
  if (variant.userId !== req.user.id || variant.topicId !== topicId) return null;
  return variant;
}

// Bitta savolga javob — to'g'riligi serverda tekshiriladi
router.post("/topics/:id/answer", requireAuth, (req, res) => {
  const topicId = Number(req.params.id);
  const variant = loadVariant(req, topicId);
  if (!variant) return res.status(400).json({ error: "Test varianti topilmadi" });
  if (variant.finished) return res.status(400).json({ error: "Test yakunlangan" });

  const questionId = Number(req.body?.questionId);
  const item = (variant.key || []).find(k => k.id === questionId);
  if (!item) return res.status(400).json({ error: "Savol topilmadi" });

  const answers = { ...(variant.answers || {}) };
  const given = Number.isInteger(req.body?.answer) ? req.body.answer : -1;
  // Faqat birinchi javob hisobga olinadi
  if (!(questionId in answers)) {
    answers[questionId] = given;
    updateVariant(variant.id, { answers });
  }
  res.json({ correct: given === item.correctIndex, correctIndex: item.correctIndex });
});

router.post("/topics/:id/submit", requireAuth, (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Faqat o'quvchilar" });
  const topicId = Number(req.params.id);
  const topic = getTopicById(topicId);
  if (!topic) return res.status(404).json({ error: "Topilmadi" });
  const { answers, timeTaken } = req.body;

  let correct = 0;
  let total = 0;
  const variant = loadVariant(req, topicId);
  if (variant) {
    // Natija serverdagi variant bo'yicha hisoblanadi
    // Serverda qayd etilgan javoblar ustun: mijoz ularni o'zgartira olmaydi,
    // yuborgan qiymatlari faqat qayd etilmay qolgan savollarga qo'llanadi.
    const given = { ...normalizeClientAnswers(req.body?.given), ...(variant.answers || {}) };
    for (const item of variant.key || []) {
      total++;
      if (given[item.id] === item.correctIndex) correct++;
    }
    updateVariant(variant.id, { finished: true, answers: given });
  } else {
    // Eski mijozlar uchun zaxira yo'l
    const tests = topic.openTests ?? topic.tests ?? [];
    total = Math.min(tests.length, Array.isArray(answers) ? answers.length : tests.length);
    for (let i = 0; i < total; i++) {
      if (answers?.[i] === tests[i]?.correctIndex) correct++;
    }
  }
  const percentage = total > 0 ? (correct / total) * 100 : 0;
  const points = Math.round(percentage);
  updateUser(req.user.id, { totalScore: (req.user.totalScore || 0) + points });
  createActivity({
    userId: req.user.id, studentName: req.user.name,
    topicId: topic.id, topicTitle: topic.title,
    correct, total, percentage, pointsEarned: points,
    timeTaken: timeTaken || 0,
  });
  res.json({ correct, total, percentage, pointsEarned: points });
});

export default router;
