// ─────────────────────────────────────────────────────────────────────────
// Mavzu matnidan test savollari yasash.
//
// Muhim shart: har bir savol FAQAT o'sha mavzuning o'z matnidan kelib
// chiqadi — umumiy ("tabiat", "iqlim" kabi) tayyor chalg'ituvchilar
// ishlatilmaydi. Yetarli chalg'ituvchi topilmasa, savol umuman
// yaratilmaydi — mavzuga aloqasiz savol chiqib qolmasin.
//
// Savol turlari: ta'rif, teskari ta'rif, bo'sh joy (cloze), raqamli fakt,
// to'g'ri fikrni tanlash.
// ─────────────────────────────────────────────────────────────────────────

const STOP = new Set([
  "bilan","uchun","yoki","hamda","qaysi","mavzu","haqida","bo'yicha","bo‘yicha",
  "asosiy","matnda","hisoblanadi","bo'lgan","bo‘lgan","uning","ularning","shuningdek",
  "lekin","ammo","bo'lib","bo‘lib","kabi","qilib","juda","ushbu","quyidagi","ya'ni",
  "yani","ba'zi","barcha","har","ham","esa","edi","emas","keyin","oldin","o'rtasida",
  "orqali","tomonidan","natijasida","davomida","sifatida","misol","masalan","ko'p",
  "ko‘p","katta","kichik","yangi","eski","birinchi","ikkinchi","uchinchi","hozirgi",
  "mumkin","kerak","zarur","o'zining","ozining","degan","deb","deyiladi","ataladi",
  "bo'ladi","bo‘ladi","bo'lishi","qiladi","etadi","olib","ega","turli","asosan",
]);

const norm = (w = "") => String(w).toLowerCase().replace(/[ʼʻ‘’`´]/g, "'").trim();

export function splitSentences(text = "") {
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/u)
    .map(s => s.trim())
    .filter(s => s.length >= 25 && s.length <= 300);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Mavzu matnidagi ma'noli atamalar — takrorlanishiga qarab tartiblanadi. */
export function topicTerms(text = "", title = "") {
  const counts = new Map();
  const words = `${title} ${text}`.match(/[\p{L}][\p{L}'’ʻ`-]{4,}/gu) || [];
  for (const w of words) {
    const k = norm(w);
    if (STOP.has(k) || k.length < 5) continue;
    if (!counts.has(k)) counts.set(k, { word: w.replace(/[ʼʻ‘’`´]/g, "'"), n: 0 });
    counts.get(k).n++;
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || b.word.length - a.word.length)
    .map(x => x.word);
}

/**
 * Mavzuning "asosiy" atamalari: ta'rifi berilgan, matnda bir necha marta
 * uchraydigan yoki bosh harf bilan yozilgan so'zlar. Chalg'ituvchilar va
 * bo'sh joylar faqat shulardan olinadi — shunda savol mavzuga tegishli
 * va mazmunli bo'ladi (fe'l yoki ergash so'z tushib qolmaydi).
 */
export function coreTerms(text = "", title = "", defs = []) {
  const all = topicTerms(text, title);
  const defTerms = new Set(defs.map(d => norm(d.term)));
  const counts = new Map();
  for (const w of text.match(/[\p{L}][\p{L}'’ʻ`-]{4,}/gu) || []) {
    const k = norm(w);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const capitalized = new Set(
    (text.match(/\b\p{Lu}[\p{L}'’ʻ`-]{4,}/gu) || []).map(norm)
  );
  const core = all.filter(t => {
    const k = norm(t);
    return defTerms.has(k) || (counts.get(k) || 0) >= 2 || capitalized.has(k);
  });
  return core.length >= 4 ? core : all;
}

/** "Kartografiya - xaritalarni o'rganadigan fan." ko'rinishidagi ta'riflar. */
export function definitions(sentences) {
  const out = [];
  for (const s of sentences) {
    const m = s.match(/^([\p{L}][\p{L}\s'’ʻ`-]{2,58}?)\s+[-–—]\s+(?:bu\s+)?(.{20,})$/u);
    if (!m) continue;
    const term = m[1].trim();
    const def = m[2].trim();
    if (term.split(/\s+/).length > 4) continue;
    if (def.length < 20 || def.length > 200) continue;
    out.push({ term, def, sentence: s });
  }
  return out;
}

const NUM_RE = /(\d[\d\s.,]{0,12}\d|\d)\s*(km²|km2|km|metr|m|mm|%|foiz|mln|mlrd|milliard|million|daraja|soat|kun|yil|ta)\b/iu;

/** Raqamli faktlar: "... 760 mm simob ustuniga teng." */
export function numberFacts(sentences) {
  const out = [];
  for (const s of sentences) {
    const m = s.match(NUM_RE);
    if (!m) continue;
    const value = m[0].replace(/\s+/g, " ").trim();
    if (!/\d/.test(value)) continue;
    out.push({ sentence: s, value, raw: m[1], unit: m[2] });
  }
  return out;
}

/** Raqamga o'xshash, lekin noto'g'ri qiymatlar yasaydi. */
function fakeNumbers(fact, others) {
  const num = Number(String(fact.raw).replace(/[\s,]/g, "").replace(",", "."));
  const set = new Set();
  if (Number.isFinite(num) && num > 0) {
    for (const k of [0.5, 1.5, 2, 0.25, 3, 10]) {
      const v = Math.round(num * k);
      if (v > 0 && v !== num) set.add(`${v.toLocaleString("ru-RU").replace(/ /g, " ")} ${fact.unit}`);
    }
  }
  for (const o of others) if (o.value !== fact.value) set.add(o.value);
  return [...set];
}

function escapeRegex(t) { return String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** 4 ta variantli savol yasaydi. Chalg'ituvchi yetmasa — null. */
/**
 * 4 ta variantli savol yasaydi.
 * `fallback` — asosiy chalg'ituvchilar yetmaganda ishlatiladigan zaxira
 * ro'yxat. U bo'lmasa savol yasalmaydi va savollar soni tasodifiy kamayib
 * ketardi; zaxira bilan har safar barqaror natija chiqadi.
 */
function makeQuestion(questionText, correct, candidates, fallback = []) {
  const seen = new Set([norm(correct)]);
  const distractors = [];
  for (const c of [...shuffle(candidates), ...shuffle(fallback)]) {
    const k = norm(c);
    if (!k || seen.has(k)) continue;
    if (k.length > 200) continue;
    seen.add(k);
    distractors.push(String(c).trim());
    if (distractors.length === 3) break;
  }
  if (distractors.length < 3) return null;
  const options = shuffle([String(correct).trim(), ...distractors]);
  return {
    question: questionText,
    questionText,
    options,
    correctIndex: options.indexOf(String(correct).trim()),
  };
}

const short = (s, n = 150) => (s.length <= n ? s : s.slice(0, n - 1).trim() + "…");

/**
 * Mavzu matnidan test savollari to'plamini yasaydi.
 * Savollar turlari navbatma-navbat aralashtiriladi.
 */
export function buildQuestionPool(title, content, limit = 40) {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  const sentences = splitSentences(text);
  const defs = definitions(sentences);
  const nums = numberFacts(sentences);
  const terms = coreTerms(text, title, defs);

  const byType = { def: [], rdef: [], cloze: [], num: [], fact: [] };

  // Umumiy zaxira chalg'ituvchilar — matndagi atamalar va gap bo'laklari.
  // Shular tufayli savol yasash "chalg'ituvchi yetmadi" deb to'xtamaydi.
  const fbTerms = [...terms, ...defs.map(d => d.term)]
    .filter((t, i, a) => a.findIndex(x => norm(x) === norm(t)) === i);
  const fbTexts = [
    ...defs.map(d => short(d.def, 120)),
    ...sentences.map(x => short(x, 120)),
  ];

  // 1) Ta'rif → tushuncha nimani anglatadi
  for (const d of defs) {
    const others = defs.filter(x => x.term !== d.term).map(x => short(x.def, 120));
    const q = makeQuestion(`«${d.term}» — bu nima?`, short(d.def, 120), others.length >= 3 ? others : [
      ...others,
      ...sentences.filter(s => s !== d.sentence).map(s => short(s, 120)),
    ], fbTexts);
    if (q) byType.def.push(q);
  }

  // 2) Teskari ta'rif → ta'rif qaysi tushunchaga tegishli
  for (const d of defs) {
    const others = [...defs.filter(x => x.term !== d.term).map(x => x.term), ...terms.filter(t => norm(t) !== norm(d.term))];
    const q = makeQuestion(`Quyidagi ta'rif qaysi tushunchaga tegishli: «${short(d.def, 130)}»`, d.term, others, fbTerms);
    if (q) byType.rdef.push(q);
  }

  // 3) Bo'sh joyni to'ldirish — matndagi haqiqiy gapdan
  for (const term of terms.slice(0, 25)) {
    const re = new RegExp(`\\b${escapeRegex(term)}\\w*`, "iu");
    const s = sentences.find(x => re.test(x) && x.length <= 220);
    if (!s) continue;
    const blanked = s.replace(new RegExp(`\\b${escapeRegex(term)}`, "giu"), "_____");
    if (blanked === s) continue;
    const q = makeQuestion(`Bo'sh joyni to'ldiring: «${blanked}»`, term, terms.filter(t => norm(t) !== norm(term)), fbTerms);
    if (q) byType.cloze.push(q);
  }

  // 4) Raqamli faktlar
  for (const f of nums) {
    const blanked = f.sentence.replace(f.value, "_____");
    const q = makeQuestion(`Matnga ko'ra, bo'sh joyga qaysi qiymat mos keladi: «${short(blanked, 190)}»`,
      f.value, fakeNumbers(f, nums));   // raqamlar uchun zaxira matn mos emas
    if (q) byType.num.push(q);
  }

  // 5) To'g'ri fikrni tanlash — gapdagi atama boshqasiga almashtirilib,
  //    ishonarli, lekin noto'g'ri variantlar yasaladi.
  // Almashtirish uchun faqat ta'rifi bor yoki bosh harfli atamalar —
  // shunda noto'g'ri variantlar ham mazmunan tushunarli bo'ladi.
  const swapPool = defs.length >= 2
    ? defs.map(d => d.term)
    : terms.filter(t => /^\p{Lu}/u.test(t)).slice(0, 8);
  if (swapPool.length >= 4) {
    for (const s of sentences.filter(x => x.length <= 150)) {
      const term = swapPool.find(t => new RegExp(`\\b${escapeRegex(t)}\\b`, "iu").test(s));
      if (!term) continue;
      const swaps = swapPool.filter(t => norm(t) !== norm(term) && !new RegExp(`\\b${escapeRegex(t)}\\b`, "iu").test(s));
      if (swaps.length < 3) continue;
      const wrong = swaps.slice(0, 6).map(w => s.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, "iu"), w));
      const q = makeQuestion(
        `«${term}» haqida quyidagi fikrlardan qaysi biri to'g'ri?`, s, wrong, fbTexts);
      if (q) byType.fact.push(q);
    }
  }

  // Turlarni navbatma-navbat aralashtirib, takrorlarini olib tashlaymiz
  const order = ["def", "cloze", "num", "rdef", "fact"];
  for (const k of order) byType[k] = shuffle(byType[k]);
  const pool = [];
  const seen = new Set();
  let added = true;
  while (pool.length < limit && added) {
    added = false;
    for (const k of order) {
      const q = byType[k].shift();
      if (!q) continue;
      const key = norm(q.questionText).slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(q);
      added = true;
      if (pool.length >= limit) break;
    }
  }
  return pool.map((q, i) => ({ ...q, id: i + 1 }));
}

/** Yozma (variantsiz) savollar — ular ham faqat mavzu matnidan. */
/** Atama tilga olingan birinchi gapni topadi (namunaviy javob uchun). */
function sentenceAbout(sentences, term) {
  const t = norm(term);
  return sentences.find(s => norm(s).includes(t)) || "";
}

/**
 * Yozma (variantsiz) savollar zaxirasi.
 * Har bir savol yoniga NAMUNAVIY JAVOB ham saqlanadi — u matnning
 * savol olingan qismidan tuziladi va faqat o'qituvchiga ko'rsatiladi.
 */
export function buildWrittenPool(title, content, limit = 40) {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  const sentences = splitSentences(text);
  const defs = definitions(sentences);
  const nums = numberFacts(sentences);
  const terms = coreTerms(text, title, defs);
  const out = [];
  const seen = new Set();

  const push = (item) => {
    const q = typeof item === "string" ? item : item?.q;
    const key = norm(q).slice(0, 80);
    if (!q || seen.has(key)) return;
    seen.add(key);
    out.push({
      id: out.length + 1,
      question: q,
      questionText: q,
      answer: (typeof item === "string" ? "" : item?.a || "").trim() || null,
    });
  };

  // Nomi tilga olinadigan savollar uchun — faqat "toza" atamalar
  // (ta'rifi berilgan yoki bosh harfli), qo'shimchali so'z shakllari emas.
  const named = (defs.length >= 2 ? defs.map(d => d.term) : terms.filter(t => /^\p{Lu}/u.test(t)))
    .filter((t, i, arr) => arr.findIndex(x => norm(x) === norm(t)) === i);

  const groups = [
    defs.map(d => ({
      q: `«${d.term}» tushunchasiga ta'rif bering va uni o'z so'zlaringiz bilan izohlang.`,
      a: d.sentence || `${d.term} — ${d.def}`,
    })),
    sentences.filter(s => !/[«»]/.test(s)).map(s => ({
      q: `Quyidagi fikrni izohlang: «${short(s, 160)}»`,
      a: s,
    })),
    named.slice(0, 20)
      .filter(t => !norm(title).includes(norm(t)))
      .map(t => ({
        q: `«${t}» ${title} mavzusida qanday o'rin tutadi? Matnga tayanib javob bering.`,
        a: sentenceAbout(sentences, t),
      })),
    nums.map(f => ({
      q: `Matnda keltirilgan ${f.value} ko'rsatkichi nimani anglatadi? Tushuntiring.`,
      a: f.sentence,
    })),
    defs.map(d => ({
      q: `«${d.term}» ga oid hayotdan misol keltiring va uning ahamiyatini yozing.`,
      a: d.sentence || `${d.term} — ${d.def}`,
    })),
    named.length >= 2
      ? named.slice(0, 12).map((t, i) => {
          const other = named[(i + 1) % named.length];
          if (!other || norm(other) === norm(t)) return null;
          const a1 = sentenceAbout(sentences, t);
          const a2 = sentenceAbout(sentences, other);
          return {
            q: `«${t}» va «${other}» tushunchalarini taqqoslang: o'xshash va farqli tomonlarini yozing.`,
            a: [a1, a2].filter(Boolean).join(" "),
          };
        }).filter(Boolean)
      : [],
    sentences
      .filter(s => !/[«»]/.test(s))
      .map(s => ({
        q: `Ushbu fikr nima uchun muhim ekanini asoslang: «${short(s, 140)}»`,
        a: s,
      })),
  ].map(g => shuffle(g));

  let added = true;
  while (out.length < limit && added) {
    added = false;
    for (const g of groups) {
      const q = g.shift();
      if (!q) continue;
      const before = out.length;
      push(q);
      if (out.length > before) added = true;
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Bitta urinish uchun variant: savollar tasodifiy tanlanadi, tartibi va
 * javob variantlari aralashtiriladi. Shu tufayli har safar yangi test.
 */
export function pickVariant(pool, count) {
  const chosen = shuffle(pool).slice(0, Math.min(count, pool.length));
  return chosen.map((q, i) => {
    if (!Array.isArray(q.options)) {
      return { id: q.id, num: i + 1, questionText: q.questionText || q.question };
    }
    const correct = q.options[q.correctIndex];
    const options = shuffle(q.options);
    return {
      id: q.id,
      num: i + 1,
      questionText: q.questionText || q.question,
      options,
      correctIndex: options.indexOf(correct),
    };
  });
}
