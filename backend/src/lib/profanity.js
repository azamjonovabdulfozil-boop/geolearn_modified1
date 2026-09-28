// ── So'kinish (haqoratli so'zlar) filtri ──────────────────────────────────
// O'zbek (lotin/kirill), rus va ingliz tillaridagi so'kinishlarni topadi.
// Yashirishga urinishlar ham ushlanadi: "suuuka", "f.u.c.k", "sh1t", "бля".
//
// Har bir yozuv: [ildiz, rejim]
//   prefix   — so'z shu ildiz bilan boshlansa   (jalab → jalabning)
//   exact    — so'zning o'zi                   (qisqa, ko'p ma'noli ildizlar uchun)
//   contains — so'z ichida uchrasa ham          (motherfucker, распиздяй)
//   phrase   — bir necha so'zli ibora          (itdan tarqagan)
// Ildizlar avtomatik normallanadi: kirill → lotin, q → k, x → h, tutuq belgisi
// olib tashlanadi, takroriy harflar qisqaradi. Shuning uchun "qo'taq", "kotak",
// "қўтоқ", "qotooq" — hammasi bitta ildizga tushadi.
// Ro'yxatni kengaytirish uchun shu yerga qo'shing.
const WORDS = [
  // ── o'zbekcha ──
  ["jalab", "prefix"], ["jallob", "prefix"], ["qanjiq", "prefix"], ["qanjik", "prefix"],
  ["qotoq", "prefix"], ["qotaq", "prefix"], ["qotog", "prefix"],
  ["haromi", "prefix"], ["haromzoda", "prefix"], ["haromxor", "prefix"], ["itvachcha", "prefix"], ["itvachca", "prefix"],
  ["padarlanat", "prefix"], ["padarkush", "prefix"], ["onaingni", "prefix"],
  // "sikka" (tanga) va "sikl" toza so'zlar — shuning uchun faqat so'kinish shakllari
  ["sikay", "prefix"], ["sikam", "prefix"], ["sikib", "prefix"], ["sikd", "prefix"], ["sikish", "prefix"],
  ["siktir", "prefix"], ["sikvor", "prefix"], ["sikan", "prefix"], ["sikaver", "prefix"], ["sikin", "prefix"], ["sikil", "prefix"],
  ["skay", "exact"], ["skaman", "prefix"], ["skey", "exact"],
  ["koting", "prefix"], ["kotinga", "prefix"], ["kotini", "prefix"], ["kotingni", "prefix"], ["kotak", "prefix"],
  ["aming", "exact"], ["amingni", "prefix"], ["amingga", "prefix"], ["amjalab", "prefix"],
  ["ami", "exact"], ["amini", "exact"], ["amiga", "exact"], ["amimni", "exact"], ["amimga", "exact"], ["amingdan", "exact"],
  ["onangni am", "phrase"], ["oneni am", "phrase"], ["onengni am", "phrase"], ["onangni ami", "phrase"], ["opangni am", "phrase"],
  ["dalbayob", "prefix"], ["dolboyob", "prefix"], ["dalbayop", "prefix"],
  ["gandon", "prefix"], ["hezalak", "prefix"], ["xezalak", "prefix"], ["ablah", "prefix"],
  ["ahmoq", "prefix"], ["axmoq", "prefix"], ["tentak", "prefix"], ["maraz", "prefix"], ["xunasa", "prefix"],
  ["itdan tarqagan", "phrase"], ["it emgan", "phrase"], ["onangni ski", "phrase"],

  // ── ruscha (kirill matn lotinga o'giriladi) ──
  ["blyat", "contains"], ["blya", "exact"], ["bliat", "contains"], ["blyad", "contains"], ["bleat", "exact"],
  ["suka", "prefix"], ["suchka", "prefix"], ["sucara", "prefix"],
  ["pizd", "contains"], ["pezd", "contains"],
  ["xuy", "contains"], ["xuye", "contains"], ["xuev", "contains"], ["xuil", "prefix"], ["xuis", "prefix"], ["xui", "exact"],
  ["ebat", "prefix"], ["ebal", "prefix"], ["eban", "prefix"], ["eblan", "prefix"], ["eblo", "prefix"], ["ebnu", "prefix"], ["ebuch", "prefix"], ["ebash", "prefix"],
  ["yeban", "prefix"], ["yebat", "prefix"], ["yebal", "prefix"], ["yoban", "prefix"], ["yobn", "prefix"], ["yobt", "prefix"], ["yopt", "exact"],
  ["zaeb", "prefix"], ["zayeb", "prefix"], ["dolboeb", "prefix"], ["dolbaeb", "prefix"], ["vyeb", "prefix"], ["vieb", "prefix"],
  ["uebok", "prefix"], ["ueban", "prefix"], ["uyobok", "prefix"], ["podyeb", "prefix"], ["otyeb", "prefix"], ["naeb", "prefix"],
  ["mudak", "prefix"], ["mudil", "prefix"], ["mudozvon", "prefix"],
  ["pidor", "prefix"], ["pidar", "prefix"], ["pidr", "prefix"], ["pedik", "prefix"],
  ["shlyux", "prefix"], ["shlux", "prefix"], ["shalava", "prefix"], ["prostitutka", "prefix"],
  ["gavno", "prefix"], ["govno", "prefix"], ["gavnyuk", "prefix"], ["zalupa", "prefix"], ["zhopa", "prefix"], ["jopa", "prefix"],
  ["debil", "prefix"], ["idiot", "prefix"], ["durak", "prefix"], ["dura", "exact"], ["tupoy", "prefix"], ["tupaya", "prefix"],
  ["kozel", "exact"], ["kozyol", "prefix"], ["urod", "prefix"], ["tvar", "exact"], ["svoloch", "prefix"], ["ublyudok", "prefix"],
  ["padla", "prefix"], ["chmo", "exact"], ["chmoshnik", "prefix"], ["lox", "exact"], ["loh", "exact"], ["dermo", "prefix"], ["srat", "prefix"], ["sran", "prefix"],
  ["mandavosh", "prefix"], ["shmar", "prefix"], ["pososi", "prefix"], ["otsosi", "prefix"], ["soska", "exact"],

  // ── inglizcha ──
  ["fuck", "contains"], ["fck", "exact"], ["fuk", "exact"], ["fuq", "prefix"], ["fcking", "exact"], ["phuck", "contains"],
  ["shit", "exact"], ["shitty", "exact"], ["shithead", "prefix"], ["bullshit", "contains"], ["shits", "exact"],
  ["bitch", "prefix"], ["biatch", "prefix"], ["asshole", "prefix"], ["arse", "exact"], ["jackass", "prefix"], ["dumbass", "prefix"],
  ["bastard", "prefix"], ["cunt", "prefix"], ["dick", "exact"], ["dickhead", "prefix"], ["cock", "exact"], ["cocksucker", "prefix"],
  ["pussy", "prefix"], ["whore", "prefix"], ["slut", "prefix"], ["wanker", "prefix"], ["twat", "prefix"], ["prick", "exact"],
  ["douche", "prefix"], ["moron", "prefix"], ["retard", "prefix"], ["nigger", "prefix"], ["nigga", "prefix"], ["faggot", "prefix"], ["fag", "exact"],
  ["wtf", "exact"], ["stfu", "exact"], ["motherfucker", "contains"], ["pissed", "exact"], ["pissoff", "exact"], ["crap", "exact"], ["damn", "exact"],
];

const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts",
  ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

/** Matnni taqqoslash uchun bir xil ko'rinishga keltiradi. */
function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, ch => CYR[ch] ?? ch)
    .replace(/[0-9@$!]/g, ch => LEET[ch] ?? ch)
    .replace(/[''`ʻʼ‘’]/g, "")        // o'zbekcha tutuq belgilari
    .replace(/q/g, "k").replace(/x/g, "h") // q/k va x/h aralash yoziladi: qotaq = kotak, xuy = huy
    .replace(/(\p{L})\1+/gu, "$1");     // takrorlangan harflar: suuuka → suka
}

/** "f.u.c.k" / "s u k a" kabi bo'lib yozilganlarni birlashtiradi. */
function joinSpelled(s) {
  return s.replace(/\b(?:\p{L}[\s.\-_*]+){2,}\p{L}\b/gu, m => m.replace(/[\s.\-_*]+/g, ""));
}

const RULES = WORDS.filter(([, m]) => m !== "phrase").map(([w, mode]) => ({ stem: normalize(w), mode, word: w }));
const PHRASES = WORDS.filter(([, m]) => m === "phrase").map(([w]) => normalize(w));

/**
 * Matnda so'kinish bormi?
 * @returns {string[]} topilgan so'zlar (bo'sh massiv — toza)
 */
export function findProfanity(text) {
  const norm = joinSpelled(normalize(text));
  const tokens = norm.split(/[^\p{L}]+/u).filter(Boolean);
  const found = new Set();
  const flat = ` ${tokens.join(" ")} `;
  for (const p of PHRASES) if (flat.includes(` ${p}`)) found.add(p);
  if (/🖕/u.test(String(text ?? ""))) found.add("🖕");
  for (const t of tokens) {
    for (const r of RULES) {
      const hit = r.mode === "exact" ? t === r.stem
        : r.mode === "prefix" ? t.startsWith(r.stem)
        : t.includes(r.stem);
      if (hit) { found.add(t); break; }
    }
  }
  return [...found];
}

/** Topilgan so'zlarni yulduzcha bilan yopadi (admin uchun ko'rsatishda). */
export function maskWord(w) {
  return w.length <= 2 ? "*".repeat(w.length) : w[0] + "*".repeat(w.length - 2) + w.at(-1);
}
