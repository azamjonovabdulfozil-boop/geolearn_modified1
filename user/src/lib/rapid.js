// "Tez javob" o'yinlari uchun savol yaratuvchilar (RapidGame.vue).
// Har bir yaratuvchi urug'li tasodifiy sondan savol qaytaradi:
//   { prompt, big?, color?, options: [matn...], answer: to'g'ri variant indeksi }
// `level` — nechta savolga to'g'ri javob berilgani; savollar asta-sekin qiyinlashadi.
import { shuffle } from "./gameKit";

const int = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

/** To'g'ri javob va unga yaqin noto'g'ri sonlardan 4 ta variant. */
function numberOptions(rng, right, spread = 10) {
  const set = new Set([right]);
  while (set.size < 4) {
    const v = right + int(rng, -spread, spread);
    if (v >= 0) set.add(v);
  }
  const options = shuffle([...set], rng);
  return { options: options.map(String), answer: options.indexOf(right) };
}
function textOptions(rng, right, pool) {
  const wrong = shuffle(pool.filter(x => x !== right), rng).slice(0, 3);
  const options = shuffle([right, ...wrong], rng);
  return { options, answer: options.indexOf(right) };
}

function expression(rng, level) {
  const hard = Math.min(4, Math.floor(level / 4));
  const op = pick(rng, hard ? ["+", "−", "×", "×", "÷"] : ["+", "−", "×"]);
  let a, b, value;
  if (op === "+") { a = int(rng, 5, 20 + hard * 25); b = int(rng, 3, 20 + hard * 25); value = a + b; }
  else if (op === "−") { a = int(rng, 10, 30 + hard * 30); b = int(rng, 2, a); value = a - b; }
  else if (op === "×") { a = int(rng, 2, 6 + hard * 2); b = int(rng, 2, 9); value = a * b; }
  else { b = int(rng, 2, 9); value = int(rng, 2, 9 + hard); a = b * value; }
  return { text: `${a} ${op} ${b}`, value };
}

// ── Geografiya ma'lumotlari ──
const CONTINENTS = ["Osiyo", "Yevropa", "Afrika", "Shimoliy Amerika", "Janubiy Amerika", "Avstraliya va Okeaniya"];
const COUNTRIES = {
  "Osiyo": ["O'zbekiston", "Qozog'iston", "Xitoy", "Hindiston", "Yaponiya", "Turkiya", "Eron", "Indoneziya", "Mo'g'uliston", "Tailand", "Pokiston", "Vyetnam", "Saudiya Arabistoni", "Qirg'iziston", "Tojikiston"],
  "Yevropa": ["Germaniya", "Fransiya", "Italiya", "Ispaniya", "Polsha", "Shvetsiya", "Norvegiya", "Gretsiya", "Portugaliya", "Ukraina", "Niderlandiya", "Shveysariya", "Avstriya", "Finlandiya", "Vengriya"],
  "Afrika": ["Misr", "Nigeriya", "Keniya", "Efiopiya", "Marokash", "Jazoir", "Gana", "Tanzaniya", "Sudan", "Senegal", "Angola", "Madagaskar", "Tunis", "Zambiya"],
  "Shimoliy Amerika": ["AQSH", "Kanada", "Meksika", "Kuba", "Panama", "Gvatemala", "Yamayka", "Kosta-Rika", "Gonduras"],
  "Janubiy Amerika": ["Braziliya", "Argentina", "Chili", "Peru", "Kolumbiya", "Venesuela", "Boliviya", "Urugvay", "Ekvador", "Paragvay"],
  "Avstraliya va Okeaniya": ["Avstraliya", "Yangi Zelandiya", "Fiji", "Papua-Yangi Gvineya", "Samoa", "Tonga"],
};
const GROUPS = {
  "daryo": ["Amudaryo", "Sirdaryo", "Nil", "Amazonka", "Volga", "Dunay", "Gang", "Missisipi", "Yanszi", "Zarafshon", "Kongo", "Yenisey"],
  "tog'": ["Himolay", "Alp", "And", "Tyanshan", "Pomir", "Kavkaz", "Ural", "Oltoy", "Kordilyera", "Hisor"],
  "cho'l": ["Sahroi Kabir", "Qizilqum", "Qoraqum", "Gobi", "Kalaxari", "Atakama", "Namib", "Taklamakon"],
  "dengiz yoki okean": ["Tinch okeani", "Atlantika okeani", "Hind okeani", "O'rta dengiz", "Qora dengiz", "Qizil dengiz", "Boltiq dengizi", "Karib dengizi"],
  "ko'l": ["Baykal", "Kaspiy", "Viktoriya", "Balxash", "Issiqko'l", "Titikaka", "Tanganika", "Aydarko'l"],
  "poytaxt": ["Toshkent", "Parij", "London", "Tokio", "Pekin", "Qohira", "Rim", "Berlin", "Anqara", "Ostona", "Madrid", "Kanberra"],
  "orol": ["Grenlandiya", "Madagaskar", "Saxalin", "Islandiya", "Shri-Lanka", "Kuba", "Borneo", "Sitsiliya"],
};
const WORDS = [
  "TOSHKENT", "SAMARQAND", "BUXORO", "AMUDARYO", "SIRDARYO", "MATERIK", "OKEAN", "VULQON", "EKVATOR", "KOMPAS",
  "XARITA", "IQLIM", "DARYO", "OROL", "AFRIKA", "OSIYO", "YEVROPA", "HIMOLAY", "BAYKAL", "QIZILQUM",
  "POYTAXT", "MERIDIAN", "GLOBUS", "SHIMOL", "JANUB", "ANTARKTIDA", "AMAZONKA", "KASPIY", "ZILZILA", "MUZLIK",
];
const COLORS = [
  { name: "QIZIL", css: "#e53935" }, { name: "KO'K", css: "#1e88e5" }, { name: "YASHIL", css: "#43a047" },
  { name: "SARIQ", css: "#f9a825" }, { name: "BINAFSHA", css: "#8e24aa" }, { name: "QORA", css: "#212121" },
];

export const RAPID = {
  // Tez hisob
  math: {
    hint: "Misolning javobini tanlang",
    make(rng, level) {
      const e = expression(rng, level);
      return { prompt: `${e.text} = ?`, big: true, ...numberOptions(rng, e.value, 6 + Math.floor(level / 3)) };
    },
  },
  // To'g'rimi-noto'g'rimi: hisob
  mathtf: {
    hint: "Tenglik to'g'rimi?",
    make(rng, level) {
      const e = expression(rng, level);
      const truth = rng() < 0.5;
      const shown = truth ? e.value : Math.max(0, e.value + pick(rng, [-3, -2, -1, 1, 2, 3, 10, -10]));
      const isTrue = shown === e.value;
      return { prompt: `${e.text} = ${shown}`, big: true, options: ["To'g'ri", "Noto'g'ri"], answer: isTrue ? 0 : 1 };
    },
  },
  // Qaysi biri katta?
  compare: {
    hint: "Qiymati kattasini tanlang",
    make(rng, level) {
      const a = expression(rng, level);
      let b = expression(rng, level);
      for (let i = 0; i < 6 && b.value === a.value; i++) b = expression(rng, level);
      if (b.value === a.value) b = { text: `${a.value} + 1`, value: a.value + 1 };
      return { prompt: "Qaysi biri katta?", options: [a.text, b.text], answer: a.value > b.value ? 0 : 1, wide: true };
    },
  },
  // Ketma-ketlikni davom ettir
  sequence: {
    hint: "Qonuniyatni toping va keyingi sonni tanlang",
    make(rng, level) {
      const kind = pick(rng, level < 3 ? ["add", "add", "mul"] : ["add", "mul", "grow", "alt"]);
      const seq = [int(rng, 1, 9)];
      const d = int(rng, 2, 6 + Math.min(6, level));
      const m = int(rng, 2, 3);
      for (let i = 1; i < 5; i++) {
        const p = seq[i - 1];
        seq.push(kind === "add" ? p + d : kind === "mul" ? p * m : kind === "grow" ? p + d + i - 1 : p + (i % 2 ? d : -1));
      }
      const right = seq.pop();
      return { prompt: `${seq.join(",  ")},  ?`, big: true, ...numberOptions(rng, right, Math.max(4, Math.round(right * 0.25))) };
    },
  },
  // Rang va so'z (Strup testi)
  stroop: {
    hint: "So'z nima deb yozilganiga emas — qaysi RANGDA yozilganiga qarang",
    make(rng) {
      const word = pick(rng, COLORS);
      const ink = pick(rng, COLORS.filter(c => c !== word));
      return { prompt: word.name, big: true, color: ink.css, ...textOptions(rng, ink.name, COLORS.map(c => c.name)) };
    },
  },
  // Harflarni tartibla
  anagram: {
    hint: "Aralashgan harflardan qaysi so'z chiqadi?",
    make(rng) {
      const word = pick(rng, WORDS);
      let mixed = word;
      for (let i = 0; i < 8 && mixed === word; i++) mixed = shuffle([...word], rng).join("");
      // Variantlar harf soni yaqin so'zlardan — uzunligiga qarab topib bo'lmasin
      const near = WORDS.filter(w => Math.abs(w.length - word.length) <= 1);
      return { prompt: [...mixed].join(" "), big: true, ...textOptions(rng, word, near.length >= 4 ? near : WORDS) };
    },
  },
  // Davlat qaysi qit'ada?
  continent: {
    hint: "Davlat joylashgan qit'ani tanlang",
    make(rng) {
      const cont = pick(rng, CONTINENTS);
      return { prompt: pick(rng, COUNTRIES[cont]), big: true, ...textOptions(rng, cont, CONTINENTS) };
    },
  },
  // Ortiqchasini top
  oddone: {
    hint: "Boshqalaridan farq qiladigan bittasini toping",
    make(rng) {
      const kinds = shuffle(Object.keys(GROUPS), rng);
      const same = shuffle(GROUPS[kinds[0]], rng).slice(0, 3);
      const odd = pick(rng, GROUPS[kinds[1]]);
      const options = shuffle([...same, odd], rng);
      return { prompt: "Qaysi biri ortiqcha?", options, answer: options.indexOf(odd), note: `Qolgan uchtasi — ${kinds[0]}`, wide: true };
    },
  },
};
