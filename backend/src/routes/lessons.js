import { Router } from "express";
import multer from "multer";
import {
  getLessons, getLessonById, createLesson, deleteLesson,
  getTopicsByLesson, getTopicById, createTopic, updateTopic, deleteTopic,
  updateUser, createActivity,
} from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

const TESTS_PER_TOPIC = 15;
const CLOSED_TESTS_PER_TOPIC = 15;
const LOVABLE_MODEL = "google/gemini-3-flash-preview";

function cleanText(text = "") {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return cleanText(result?.text || "");
  } catch (e) {
    console.log("pdf-parse xato, fallback:", e.message);
    return cleanText(buffer.toString("utf8").replace(/[^\p{L}\p{N}\s.,:;!?()\-–—'"/%§]/gu, " "));
  }
}

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

function isLikelyHeading(line) {
  const l = line.trim();
  if (l.length < 4 || l.length > 120) return false;
  if (/^(\d+(\.\d+)*[.)]?|[IVXLC]+[.)]?|§\s*\d+|mavzu\s*\d*|bob\s*\d*|bo['‘’`]?lim\s*\d*)\s+/iu.test(l)) return true;
  if (/\b(mavzu|bob|bo['‘’`]?lim|paragraf|amaliy|laboratoriya|xulosa|kirish)\b/iu.test(l) && l.length < 95) return true;
  const words = l.split(/\s+/);
  return words.length >= 2 && words.length <= 10 && !/[.!?,;:]$/.test(l) && /^[\p{Lu}\d§]/u.test(l);
}

function titleFromText(text, fallback) {
  const first = cleanText(text).split(/\n|[.!?]/)[0]?.trim() || fallback;
  return first.replace(/^\d+(\.\d+)*[.)]?\s*/, "").slice(0, 90) || fallback;
}

function splitPdfIntoTopics(pdfText, lessonTitle) {
  const lines = cleanText(pdfText).split(/\n+/).map(l => l.trim()).filter(Boolean);
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (isLikelyHeading(line)) {
      if (current && current.content.length > 80) sections.push(current);
      current = { title: line, content: "" };
    } else if (current) {
      current.content += (current.content ? "\n" : "") + line;
    } else {
      current = { title: titleFromText(line, lessonTitle), content: line };
    }
  }
  if (current && current.content.length > 40) sections.push(current);

  // If headings produced <2 sections OR most content lives in one section, force chunking
  const tooFew = sections.length < 2;
  const oneFat = sections.length >= 1 && sections[0].content.length > 2500;
  if (tooFew || oneFat) {
    const fullText = cleanText(pdfText);
    const paragraphs = fullText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 40);
    const source = paragraphs.length >= 3 ? paragraphs : splitSentences(fullText);
    const CHUNK = 1400;
    const chunked = [];
    let buf = "";
    for (const p of source) {
      if ((buf + " " + p).length > CHUNK && buf.length > 400) {
        chunked.push(buf);
        buf = p;
      } else {
        buf += (buf ? " " : "") + p;
      }
    }
    if (buf.length > 80) chunked.push(buf);
    if (chunked.length >= 2) {
      return chunked.map((c, i) => ({
        title: `${lessonTitle} — ${i + 1}-qism: ${titleFromText(c, "")}`.slice(0, 110),
        content: c,
      }));
    }
  }

  const seen = new Set();
  return sections
    .map((s, i) => ({
      title: cleanText(s.title).replace(/^[#\-–—\s]+/, "").slice(0, 110) || `${lessonTitle} — ${i + 1}-mavzu`,
      content: cleanText(s.content || s.title),
    }))
    .filter(s => {
      const key = s.title.toLowerCase();
      if (seen.has(key) || s.content.length < 40) return false;
      seen.add(key);
      return true;
    });
}

const STOP = new Set(["bilan", "uchun", "yoki", "hamda", "qaysi", "mavzu", "haqida", "bo'yicha", "bo‘yicha", "asosiy", "matnda", "hisoblanadi", "bo'lgan", "bo‘lgan", "uning", "ularning", "shuningdek", "lekin", "ammo", "bo'lib", "edi", "kabi", "qilib", "ko'p"]);

function keywords(text = "") {
  return [...new Set((text.toLowerCase().match(/[a-zа-яёіїўқғҳʼ'‘’`-]{4,}/giu) || [])
    .map(w => w.replace(/[ʼ'‘’`]/g, "'"))
    .filter(w => !STOP.has(w)))].slice(0, 60);
}

function shuffleOptions(options) {
  const unique = [...new Set(options.filter(Boolean).map(o => String(o).trim()).filter(o => o.length > 1))].slice(0, 4);
  while (unique.length < 4) unique.push(["tabiiy hodisa", "jarayon", "geografik obyekt", "hudud"][unique.length]);
  const correct = unique[0];
  const mixed = unique.map((v, i) => ({ v, sort: (v.charCodeAt(0) + i * 17) % 11 })).sort((a, b) => a.sort - b.sort).map(x => x.v);
  return { options: mixed, correctIndex: mixed.indexOf(correct) };
}

function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ── Varied local OPEN tests (with 4 options) ─────────────────────────────
function localTests(topicTitle, topicContent) {
  const sentences = splitSentences(topicContent);
  const terms = keywords(`${topicTitle} ${topicContent}`);
  const tests = [];
  const used = new Set();

  const patterns = [
    (s, t) => s && s.toLowerCase().includes(t.toLowerCase())
      ? { q: `Bo'sh joyni to'ldiring: «${s.replace(new RegExp(escapeRegex(t), "iu"), "_____")}»`, correct: t }
      : null,
    (s, t) => ({ q: `«${topicTitle}» mavzusida «${t}» tushunchasi nimani anglatadi?`, correct: t }),
    (s, t) => ({ q: `Quyidagi atamalardan qaysi biri «${topicTitle}» mavzusiga bevosita aloqador?`, correct: t }),
    (s, t) => s ? { q: `Matnda «${s.slice(0, 80)}...» — bu fikr nima haqida?`, correct: t } : null,
    (s, t) => ({ q: `«${t}» so'zining geografik ma'nosi nima?`, correct: t }),
    (s, t) => ({ q: `«${topicTitle}» mavzusining asosiy tushunchalaridan biri qaysi?`, correct: t }),
    (s, t) => s ? { q: `Matndagi «${s.slice(0, 70)}» fikriga eng mos kelgan tushuncha qaysi?`, correct: t } : null,
    (s, t) => ({ q: `Quyidagilardan qaysi biri «${topicTitle}» bilan bog'liq emas?`, correct: t, invert: true }),
    (s, t) => ({ q: `«${t}» qanday geografik obyekt yoki hodisa hisoblanadi?`, correct: t }),
    (s, t) => ({ q: `Matnga ko'ra «${topicTitle}» mavzusida nima alohida ta'kidlangan?`, correct: t }),
    (s, t) => ({ q: `«${topicTitle}»ni o'rganishda qaysi tushuncha kalit hisoblanadi?`, correct: t }),
    (s, t) => s ? { q: `«${s.slice(0, 90)}» — bu jumla qaysi tushuncha haqida?`, correct: t } : null,
    (s, t) => ({ q: `Geografiya nuqtai nazaridan «${t}» nimani bildiradi?`, correct: t }),
    (s, t) => ({ q: `«${topicTitle}» mavzusi doirasida qaysi atama keng yoritilgan?`, correct: t }),
    (s, t) => ({ q: `Berilgan matnda qaysi tushuncha asosiy o'rin tutadi?`, correct: t }),
  ];

  let pi = 0, si = 0, ti = 0;
  while (tests.length < TESTS_PER_TOPIC && pi < patterns.length * 4) {
    const pattern = patterns[pi % patterns.length];
    const sentence = sentences[si % Math.max(sentences.length, 1)] || "";
    const term = terms[ti % Math.max(terms.length, 1)] || topicTitle.split(/\s+/)[0] || "mavzu";
    const out = pattern(sentence, term);
    pi++; si++; ti++;
    if (!out || used.has(out.q)) continue;
    used.add(out.q);
    const distractors = terms.filter(t => t !== out.correct).slice(ti, ti + 3);
    const filler = ["tabiat", "iqlim", "relyef", "aholi", "xarita", "okean", "qit'a", "harorat"];
    while (distractors.length < 3) {
      const f = filler[(distractors.length + ti) % filler.length];
      if (f !== out.correct && !distractors.includes(f)) distractors.push(f);
    }
    const { options, correctIndex } = shuffleOptions([out.correct, ...distractors]);
    tests.push({ id: tests.length + 1, question: out.q, questionText: out.q, options, correctIndex });
  }
  // Final padding if still short
  while (tests.length < TESTS_PER_TOPIC) {
    const i = tests.length;
    const term = terms[i % Math.max(terms.length, 1)] || "tushuncha";
    const q = `${topicTitle} mavzusida ${i + 1}-savol: qaysi tushuncha matnda muhim deb belgilangan?`;
    const { options, correctIndex } = shuffleOptions([term, "boshqa hodisa", "tasodifiy element", "ortiqcha ma'lumot"]);
    tests.push({ id: i + 1, question: q, questionText: q, options, correctIndex });
  }
  return tests.slice(0, TESTS_PER_TOPIC).map((t, i) => ({ ...t, id: i + 1 }));
}

function normalizeTests(raw, topicTitle, topicContent) {
  const aiTests = Array.isArray(raw) ? raw : [];
  const fallback = localTests(topicTitle, topicContent);
  const normalized = aiTests.map((q, i) => {
    const question = (q.question || q.questionText || "").toString().trim();
    const options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()).filter(Boolean) : [];
    const correctIndex = Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0;
    if (!question || options.length !== 4) return null;
    return { id: i + 1, question, questionText: question, options, correctIndex };
  }).filter(Boolean);
  const merged = [...normalized, ...fallback].slice(0, TESTS_PER_TOPIC);
  return merged.map((q, i) => ({ ...q, id: i + 1, questionText: q.questionText || q.question }));
}

// ── Varied local CLOSED tests (question only) ────────────────────────────
function localClosedTests(topicTitle, topicContent) {
  const sentences = splitSentences(topicContent);
  const terms = keywords(`${topicTitle} ${topicContent}`);
  const templates = [
    (t, s) => `«${topicTitle}» mavzusida «${t}» tushunchasi nimani anglatadi va matnda qanday yoritilgan?`,
    (t, s) => `«${t}» atamasi geografiyada qanday ma'noga ega? Misol bilan tushuntiring.`,
    (t, s) => `${topicTitle} mavzusining asosiy g'oyalarini o'z so'zingiz bilan bayon qiling.`,
    (t, s) => `Matnga ko'ra «${t}» qanday xususiyatlarga ega?`,
    (t, s) => `«${topicTitle}» mavzusi qaysi tabiiy yoki ijtimoiy hodisalar bilan bog'liq?`,
    (t, s) => s ? `Quyidagi jumlani izohlang: «${s.slice(0, 140)}»` : `«${topicTitle}» mavzusining ahamiyatini tushuntiring.`,
    (t, s) => `«${t}» va «${topicTitle}» o'rtasidagi bog'liqlikni izohlang.`,
    (t, s) => `${topicTitle} mavzusini o'rganish kundalik hayotda nima uchun zarur?`,
    (t, s) => `Matndan «${t}» bilan bog'liq misol keltiring va tahlil qiling.`,
    (t, s) => `«${topicTitle}» mavzusida qaysi geografik qonuniyatlar uchraydi?`,
    (t, s) => `«${t}» tushunchasining kelib chiqishi va rivojlanishini bayon qiling.`,
    (t, s) => s ? `«${s.slice(0, 120)}» — bu fikrga qanday qo'shimcha izoh berish mumkin?` : `${topicTitle} bo'yicha xulosa yozing.`,
    (t, s) => `${topicTitle} mavzusining inson hayotidagi amaliy ahamiyati nimada?`,
    (t, s) => `«${t}» bilan bog'liq qiziqarli geografik fakt keltiring.`,
    (t, s) => `${topicTitle} mavzusini o'rganishdan keyin qanday xulosa chiqarish mumkin?`,
  ];
  const out = [];
  const used = new Set();
  for (let i = 0; i < CLOSED_TESTS_PER_TOPIC; i++) {
    const term = terms[i % Math.max(terms.length, 1)] || topicTitle.split(/\s+/)[0] || "mavzu";
    const sentence = sentences[i % Math.max(sentences.length, 1)] || "";
    let q = templates[i % templates.length](term, sentence);
    let guard = 0;
    while (used.has(q) && guard < templates.length) {
      guard++;
      q = templates[(i + guard) % templates.length](terms[(i + guard) % Math.max(terms.length, 1)] || term, sentence);
    }
    used.add(q);
    out.push({ id: i + 1, question: q, questionText: q });
  }
  return out;
}

function normalizeClosedTests(raw, topicTitle, topicContent) {
  const aiTests = Array.isArray(raw) ? raw : [];
  const normalized = aiTests
    .map((q, i) => {
      const question = (q.question || q.questionText || (typeof q === "string" ? q : "")).toString().trim();
      if (!question) return null;
      return { id: i + 1, question, questionText: question };
    })
    .filter(Boolean);
  const fallback = localClosedTests(topicTitle, topicContent);
  // De-duplicate
  const seen = new Set();
  const merged = [...normalized, ...fallback].filter(q => {
    const k = q.question.toLowerCase().slice(0, 60);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, CLOSED_TESTS_PER_TOPIC);
  // Pad if still short
  while (merged.length < CLOSED_TESTS_PER_TOPIC) {
    const i = merged.length;
    const q = `${topicTitle} mavzusi bo'yicha ${i + 1}-savol: matndan kelib chiqib o'z fikringizni bayon qiling.`;
    merged.push({ id: i + 1, question: q, questionText: q });
  }
  return merged.map((q, i) => ({ ...q, id: i + 1, questionText: q.questionText || q.question }));
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

// ── Routes ───────────────────────────────────────────────────────────────
router.get("/lessons", requireAuth, (req, res) => {
  const lessons = getLessons().map(l => ({ ...l, topics: getTopicsByLesson(l.id) }));
  res.json(lessons);
});

router.post("/lessons", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const { title, description, grade } = req.body;
  if (!title || !grade) return res.status(400).json({ error: "Sarlavha va sinf kerak" });
  const lesson = createLesson({ title, description: description || "", grade: Number(grade), teacherId: req.user.id });
  res.status(201).json(lesson);
});

router.get("/lessons/:id", requireAuth, (req, res) => {
  const lesson = getLessonById(Number(req.params.id));
  if (!lesson) return res.status(404).json({ error: "Topilmadi" });
  res.json({ ...lesson, topics: getTopicsByLesson(lesson.id) });
});

router.delete("/lessons/:id", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  deleteLesson(Number(req.params.id));
  res.json({ success: true });
});

router.post("/lessons/:id/pdf", requireAuth, upload.single("pdf"), async (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const lessonId = Number(req.params.id);
  const lesson = getLessonById(lessonId);
  if (!lesson) return res.status(404).json({ error: "Topilmadi" });
  if (!req.file) return res.status(400).json({ error: "PDF fayl kerak" });

  try {
    const pdfText = await extractPdfText(req.file.buffer);
    if (!pdfText || pdfText.length < 30) {
      return res.status(400).json({ error: "PDF dan matn o'qib bo'lmadi. Skaner qilingan PDF bo'lishi mumkin." });
    }

    const discovered = splitPdfIntoTopics(pdfText, lesson.title);
    const topicPrompt = `Quyidagi PDF matnidan barcha asosiy mavzularni ajrat.
Qoidalar:
- Hamma asosiy bo'limlar ko'rinsin (3 tadan kam bo'lmasin, agar matn katta bo'lsa 5-12 ta mavzu chiqar).
- Har bir mavzu boshqalaridan farqli bo'lsin.
- Har bir content KAMIDA 17-18 ta to'liq gap bo'lsin (ta'rif, misollar, faktlar, ahamiyati).
- Faqat o'zbek tilida, faqat JSON array qaytar.

Matn:
${pdfText.slice(0, 16000)}

Format:
[{"title":"Mavzu nomi","content":"17-18 gapdan iborat batafsil mazmun"}]`;

    const aiTopics = await callAiJson(topicPrompt, 8000);
    const topics = (Array.isArray(aiTopics) && aiTopics.length >= 1 ? aiTopics : discovered)
      .map((t, i) => ({
        title: cleanText(t.title || `${lesson.title} — ${i + 1}-mavzu`).slice(0, 110),
        content: cleanText(t.content || discovered[i]?.content || t.title || pdfText.slice(i * 1200, (i + 1) * 1200)),
      }))
      .filter(t => t.title && t.content)
      .slice(0, 20);

    const createdTopics = [];
    let totalTests = 0;

    for (const t of topics) {
      const topicTitle = t.title;
      let topicContent = t.content;
      try {
        topicContent = await expandTopicContent(topicTitle, topicContent || topicTitle);
      } catch {
        topicContent = synthesizeRichContent(topicTitle, topicContent || topicTitle);
      }
      if (!topicContent || (topicContent.match(/[.!?]+/g) || []).length < 15) {
        topicContent = synthesizeRichContent(topicTitle, topicContent || topicTitle);
      }

      const openPrompt = `"${topicTitle}" mavzusi bo'yicha PDF matniga tayanib ${TESTS_PER_TOPIC} ta VARIANTLI (4 javobli, ABC) test yarat.
Qoidalar:
- Savollar BIR-BIRIDAN FARQLI bo'lsin, takrorlanmasin.
- Har xil turdagi savollar bo'lsin: ta'rif, misol, taqqoslash, sabab-oqibat, bo'sh joyni to'ldirish.
- 4 ta variant bo'lsin, faqat bittasi to'g'ri.
- correctIndex 0-3 oralig'ida.
- Faqat JSON array qaytar.

Mavzu matni:
${topicContent.slice(0, 3500)}

Format:
[{"question":"...","options":["A","B","C","D"],"correctIndex":0}]`;
      const openTests = normalizeTests(await callAiJson(openPrompt, 6000), topicTitle, topicContent);

      const closedPrompt = `"${topicTitle}" mavzusi bo'yicha PDF matniga tayanib ${CLOSED_TESTS_PER_TOPIC} ta YOZMA (faqat savol, variantsiz) savol yarat.
Qoidalar:
- Savollar BIR-BIRIDAN FARQLI bo'lsin, TAKRORLANMASIN.
- Turli xil: izohlash, taqqoslash, misol so'rash, sabab-oqibat, fikr bildirish, xulosa chiqarish.
- O'quvchi yozma javob berishi kerak.
- Faqat JSON array qaytar.

Mavzu matni:
${topicContent.slice(0, 3500)}

Format:
[{"question":"Savol matni?"}]`;
      const closedTests = normalizeClosedTests(await callAiJson(closedPrompt, 4000), topicTitle, topicContent);

      const createdTopic = createTopic({
        lessonId, title: topicTitle, content: topicContent,
        tests: openTests, openTests, closedTests,
      });
      createdTopics.push({ id: createdTopic.id, title: topicTitle, testsCount: openTests.length, closedCount: closedTests.length });
      totalTests += openTests.length + closedTests.length;
    }

    res.json({
      success: true,
      summary: [
        `✅ PDF muvaffaqiyatli qayta ishlandi`,
        `📚 Aniqlangan mavzular soni: ${createdTopics.length}`,
        `📝 Jami testlar: ${totalTests} (har mavzuda ${TESTS_PER_TOPIC} variantli + ${CLOSED_TESTS_PER_TOPIC} yozma)`,
        ``,
        ...createdTopics.map((tp, i) => `${i + 1}. ${tp.title} — ${tp.testsCount} variantli + ${tp.closedCount} yozma`),
      ].join("\n"),
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
  res.json(getTopicsByLesson(Number(req.params.id)));
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
  const content = req.body?.topicContent || topic.content || topic.title;
  const tests = normalizeTests(null, topic.title, String(content));
  const updated = updateTopic(topic.id, { tests });
  res.json({ success: true, tests, testsCount: tests.length, topic: updated });
});

router.delete("/topics/:id", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  deleteTopic(Number(req.params.id));
  res.json({ success: true });
});

router.get("/topics/:id", requireAuth, (req, res) => {
  const topic = getTopicById(Number(req.params.id));
  if (!topic) return res.status(404).json({ error: "Topilmadi" });
  res.json(topic);
});

router.get("/topics/:id/tests", requireAuth, (req, res) => {
  const topic = getTopicById(Number(req.params.id));
  if (!topic) return res.status(404).json({ error: "Topilmadi" });
  const mode = String(req.query.mode || "open");
  if (mode === "closed") return res.json(topic.closedTests ?? []);
  res.json(topic.openTests ?? topic.tests ?? []);
});

router.post("/topics/:id/submit", requireAuth, (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Faqat o'quvchilar" });
  const topic = getTopicById(Number(req.params.id));
  if (!topic) return res.status(404).json({ error: "Topilmadi" });
  const { answers, timeTaken } = req.body;
  const tests = topic.openTests ?? topic.tests ?? [];
  let correct = 0;
  for (let i = 0; i < tests.length; i++) {
    if (answers?.[i] === tests[i].correctIndex) correct++;
  }
  const percentage = tests.length > 0 ? (correct / tests.length) * 100 : 0;
  const points = Math.round(percentage);
  updateUser(req.user.id, { totalScore: (req.user.totalScore || 0) + points });
  createActivity({
    userId: req.user.id, studentName: req.user.name,
    topicId: topic.id, topicTitle: topic.title,
    correct, total: tests.length, percentage, pointsEarned: points,
    timeTaken: timeTaken || 0,
  });
  res.json({ correct, total: tests.length, percentage, pointsEarned: points });
});

export default router;
