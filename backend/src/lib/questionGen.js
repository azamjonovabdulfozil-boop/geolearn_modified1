import { COUNTRIES, CONTINENT_NAMES, flagUrl } from "./countries.js";
import { TOPICS, getTopicById } from "./topics-data.js";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => shuffle(arr).slice(0, n);

// ─── O'xshash bayroqlar guruhlari (bosh qotirma uchun) ───────────
// Bir guruhdagi bayroqlar ranglari/naqshi bo'yicha juda o'xshash.
// Bu distraktorlar bolalarni chinakam fikrlashga majbur qiladi.
const SIMILAR_FLAGS = [
  ["id","pl"],                          // qizil-oq / oq-qizil (teskari)
  ["ro","md","ad","td"],                 // ko'k-sariq-qizil vertikal
  ["nl","ru","lu","hr","si","sk","rs"], // oq/ko'k/qizil gorizontal kombinatsiyalar
  ["it","mx","ie","hu","bg"],           // yashil-oq-qizil
  ["se","no","dk","fi","is"],           // Skandinaviya xochi
  ["co","ec","ve"],                      // sariq-ko'k-qizil
  ["ar","uy"],                           // ochiq ko'k va oq yo'llar
  ["ae","sd","sy","eg","iq","ye","jo","kw","ps"], // pan-arab ranglar
  ["tr","tn","pk","dz","ly","az"],      // qizil/yashil + yarim oy va yulduz
  ["ir","tj"],                           // yashil-oq-qizil + emblema
  ["cn","vn"],                           // qizil + sariq yulduz
  ["jp","bd","pw"],                      // bitta doira (kompozitsiya)
  ["lv","at","pl","id"],                // qizil-oq-qizil yoki yaqin
  ["sn","ml","gn","cm","gh"],           // vertikal yashil-sariq-qizil
  ["au","nz","fj","gb"],                // Union Jack kantoni
  ["by","ir"],                           // qizil-yashil + naqsh
  ["am","es","co"],                      // sariq-qizil yo'llar
  ["be","de"],                           // qora-sariq-qizil
  ["br","ng"],                           // yashil dominant
  ["ge","gb","ch","tn"],                // xoch elementlari
  ["cz","ph","kw"],                      // uchburchak + yo'llar
  ["kr","kp"],                           // ikkala Koreya
  ["us","ma","la"],                      // (ehtimoliy aralashtirish)
];

// Bayroq ISO bo'yicha o'xshash bayroqlar guruhini olish
function similarIsoSet(iso) {
  const out = new Set();
  for (const group of SIMILAR_FLAGS) {
    if (group.includes(iso)) group.forEach(x => { if (x !== iso) out.add(x); });
  }
  return out;
}

// Pool ichidan o'xshash bayroqli boshqa davlatni topish
function pickSimilarCountry(country, pool) {
  const iso = country[1];
  const sims = similarIsoSet(iso);
  // Avval pool ichidan o'xshashlarni qidiramiz
  const candidates = pool.filter(x => sims.has(x[1]));
  if (candidates.length) return pick(candidates);
  // Topilmasa — global COUNTRIES dan
  const global = COUNTRIES.filter(x => sims.has(x[1]));
  if (global.length) return pick(global);
  // Aks holda — oddiy tasodifiy
  const others = pool.filter(x => x[1] !== iso);
  return others.length ? pick(others) : country;
}

// O'xshash bayroqli N ta distraktor (mavjud bo'lsa o'xshash, qolganini tasodifiy to'ldiradi)
function similarDistractors(country, n, fromPool = COUNTRIES) {
  const iso = country[1];
  const sims = similarIsoSet(iso);
  const simList = fromPool.filter(x => x[1] !== iso && sims.has(x[1]));
  const others  = fromPool.filter(x => x[1] !== iso && !sims.has(x[1]));
  const chosen = shuffle(simList).slice(0, n);
  if (chosen.length < n) {
    chosen.push(...shuffle(others).slice(0, n - chosen.length));
  }
  return chosen;
}

// Build a 4-option quiz question
function buildQuiz(text, correct, distractors, imageUrl) {
  const opts = shuffle([correct, ...pickN(distractors.filter(d => d !== correct), 3)]);
  return {
    questionText: text,
    options: opts,
    correctIndex: opts.indexOf(correct),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

function buildBT(text, isTrue, explanation = "") {
  return { questionText: text, isTrue, explanation };
}

// ─── per-kind quiz generators ───────────────────────────────
function genQuizForKind(kind, pool) {
  switch (kind) {
    case "flag_to_country": {
      const c = pick(pool);
      // O'xshash bayroqli davlatlar — chalg'ituvchi sifatida
      const sims = similarDistractors(c, 3, pool.length >= 8 ? pool : COUNTRIES);
      const opts = shuffle([c[0], ...sims.map(x => x[0])]);
      return {
        questionText: `Bu qaysi davlatning bayrog'i?`,
        options: opts,
        correctIndex: opts.indexOf(c[0]),
        imageUrl: flagUrl(c[1]),
      };
    }
    case "country_to_flag": {
      const c = pick(pool);
      // To'g'ri javob + 3 ta o'xshash bayroq
      const sims = similarDistractors(c, 3, pool.length >= 8 ? pool : COUNTRIES);
      const all = shuffle([c, ...sims]);
      return {
        questionText: `${c[0]} bayrog'i qaysi?`,
        options: all.map(x => x[0]),               // names (we'll render flag images for each)
        optionImages: all.map(x => flagUrl(x[1])),
        correctIndex: all.findIndex(x => x[1] === c[1]),
        layout: "flag-grid",
      };
    }
    case "country_to_capital": {
      const c = pick(pool);
      const distractors = COUNTRIES.map(x => x[2]).filter(x => x !== c[2]);
      return buildQuiz(`${c[0]} davlatining poytaxti qaysi?`, c[2], distractors);
    }
    case "capital_to_country": {
      const c = pick(pool);
      const distractors = COUNTRIES.map(x => x[0]).filter(x => x !== c[0]);
      return buildQuiz(`${c[2]} qaysi davlatning poytaxti?`, c[0], distractors);
    }
    case "country_to_continent": {
      const c = pick(pool);
      const distractors = Object.values(CONTINENT_NAMES);
      return buildQuiz(`${c[0]} qaysi materikda joylashgan?`, CONTINENT_NAMES[c[3]], distractors);
    }
    case "rivers": {
      const r = pick(pool);
      const distractors = pool.map(x => x[0]).filter(n => n !== r[0]);
      return buildQuiz(`Quyidagi daryolardan qaysi biri ${CONTINENT_NAMES[r[2]]}da oqadi: ${r[0]}, ${pickN(distractors,2).join(", ")} dan?`, r[0], distractors);
    }
    case "rivers_longest": {
      const r = pick(pool);
      const distractors = pool.map(x => `${x[1]} km`).filter(n => n !== `${r[1]} km`);
      return buildQuiz(`${r[0]} daryosining uzunligi qancha?`, `${r[1]} km`, distractors);
    }
    case "mountains": {
      const m = pick(pool);
      const distractors = pool.map(x => x[2]).filter(x => x !== m[2]);
      return buildQuiz(`${m[0]} cho'qqisi qaysi davlatda?`, m[2], distractors);
    }
    case "mountains_highest": {
      const m = pick(pool);
      const distractors = pool.map(x => `${x[1]} m`).filter(x => x !== `${m[1]} m`);
      return buildQuiz(`${m[0]} cho'qqisining balandligi qancha?`, `${m[1]} m`, distractors);
    }
    case "seas": {
      const s = pick(pool);
      const distractors = pool.map(x => x[1]).filter(x => x !== s[1]);
      return buildQuiz(`${s[0]} qaysi okean havzasiga kiradi?`, s[1], distractors);
    }
    case "lakes": {
      const l = pick(pool);
      const distractors = pool.map(x => x[2]).filter(x => x !== l[2]);
      return buildQuiz(`${l[0]} ko'li qayerda joylashgan?`, l[2], distractors);
    }
    case "deserts": {
      const d = pick(pool);
      const distractors = pool.map(x => x[2]).filter(x => x !== d[2]);
      return buildQuiz(`${d[0]} cho'li qayerda joylashgan?`, d[2], distractors);
    }
    case "oceans": {
      const o = pick(pool);
      return buildQuiz(`Quyidagilardan qaysi biri okean?`, o, pool);
    }
    case "continents": {
      const c = pick(pool);
      const distractors = pool.map(x => `${x[1].toLocaleString()} km²`).filter(x => x !== `${c[1].toLocaleString()} km²`);
      return buildQuiz(`${c[0]} materigining maydoni qancha?`, `${c[1].toLocaleString()} km²`, distractors);
    }
    case "volcanoes": {
      const v = pick(pool);
      const distractors = pool.map(x => x[1]).filter(x => x !== v[1]);
      return buildQuiz(`${v[0]} vulqoni qaysi davlatda?`, v[1], distractors);
    }
    case "islands": {
      const i = pick(pool);
      const distractors = pool.map(x => `${x[1].toLocaleString()} km²`).filter(x => x !== `${i[1].toLocaleString()} km²`);
      return buildQuiz(`${i[0]} orolining maydoni qancha?`, `${i[1].toLocaleString()} km²`, distractors);
    }
    case "currencies": {
      const c = pick(pool);
      const distractors = pool.map(x => x[1]).filter(x => x !== c[1]);
      return buildQuiz(`${c[0]} qaysi davlatning pul birligi?`, c[1], distractors);
    }
    case "continents_size": {
      const arr = [...pool].sort((a,b)=>b[1]-a[1]);
      const idx = Math.floor(Math.random() * Math.min(5, arr.length));
      const c = arr[idx];
      const distractors = arr.map(x => x[0]).filter(x => x !== c[0]);
      const labels = ["birinchi","ikkinchi","uchinchi","to'rtinchi","beshinchi"];
      return buildQuiz(`Maydoni bo'yicha ${labels[idx]} eng katta materik qaysi?`, c[0], distractors);
    }
    case "uzbekistan": {
      const qs = [
        ["O'zbekistonning poytaxti qaysi shahar?","Toshkent",["Samarqand","Buxoro","Andijon"]],
        ["O'zbekistondagi eng katta cho'l qaysi?","Qizilqum",["Qoraqum","Mojave","Sahroyi Kabir"]],
        ["O'zbekistonning eng baland cho'qqisi?","Hazrati Sulton",["Everest","Elbrus","Pobeda"]],
        ["O'zbekistonda nechta viloyat bor?","12 ta",["10 ta","14 ta","9 ta"]],
        ["O'zbekistonning eng katta daryosi?","Amudaryo",["Sirdaryo","Zarafshon","Volga"]],
        ["Aydarko'l qaysi viloyatda?","Jizzax",["Buxoro","Toshkent","Surxondaryo"]],
        ["Qoraqalpog'iston poytaxti?","Nukus",["Urganch","Xiva","Buxoro"]],
      ];
      const q = pick(qs);
      return buildQuiz(q[0], q[1], q[2]);
    }
    case "geo_records": {
      const qs = [
        ["Dunyodagi eng baland tog' cho'qqisi qaysi?","Everest",["K2","Elbrus","Akonkagua"]],
        ["Dunyodagi eng uzun daryo?","Nil",["Amazonka","Yantszi","Volga"]],
        ["Dunyodagi eng katta okean?","Tinch okean",["Atlantika","Hind okeani","Shimoliy Muz"]],
        ["Dunyodagi eng katta cho'l?","Sahroyi Kabir",["Gobi","Atakama","Arab"]],
        ["Dunyodagi eng chuqur ko'l?","Baykal",["Tanganika","Kaspiy","Viktoriya"]],
        ["Dunyodagi eng katta orol?","Grenlandiya",["Yangi Gvineya","Madagaskar","Kalimantan"]],
        ["Eng aholisi ko'p davlat?","Hindiston",["Xitoy","AQSh","Indoneziya"]],
        ["Eng katta maydonli davlat?","Rossiya",["Kanada","Xitoy","AQSh"]],
      ];
      const q = pick(qs);
      return buildQuiz(q[0], q[1], q[2]);
    }
    case "flag_colors": {
      const items = [
        ["Yashil-oq-qizil rangli bayroq", ["Italiya","Vengriya","Bolgariya"]],
        ["Faqat qizil va oq rangli bayroq", ["Yaponiya","Indoneziya","Polsha"]],
        ["Bayrog'ida yulduz va yarim oy bor", ["Turkiya","Pokiston","Tunis"]],
        ["Ko'k-oq-qizil yo'lli bayroq", ["Rossiya","Niderlandiya","Lyuksemburg"]],
      ];
      const it = pick(items);
      const correct = pick(it[1]);
      const distractors = COUNTRIES.map(x => x[0]).filter(n => !it[1].includes(n));
      return buildQuiz(it[0], correct, [...it[1].filter(x=>x!==correct), ...distractors]);
    }
    default:
      // mixed/bt-only kinds — pick something from countries as a safe fallback
      const c = pick(COUNTRIES);
      return buildQuiz(`${c[0]} qaysi materikda?`, CONTINENT_NAMES[c[3]], Object.values(CONTINENT_NAMES));
  }
}

// Generate a data-URL SVG visual using an emoji + label (used when no real photo exists)
function emojiVisual(emoji, label = "") {
  const safe = String(label).slice(0, 24).replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
    <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/>
    </linearGradient></defs>
    <rect width="320" height="200" rx="14" fill="url(#g)"/>
    <text x="160" y="120" font-size="96" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    <text x="160" y="178" font-size="14" font-family="Inter,system-ui,sans-serif" font-weight="700" fill="#94a3b8" text-anchor="middle">${safe}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const KIND_EMOJI = {
  rivers: "🏞️", rivers_longest: "💧",
  mountains: "🏔️", mountains_highest: "🗻",
  seas: "🌊", oceans: "🌊", lakes: "🏞️",
  deserts: "🏜️", continents: "🌐", continents_size: "📐",
  volcanoes: "🌋", islands: "🏝️", currencies: "💰",
  uzbekistan: "🇺🇿", geo_records: "🏆",
  flag_colors: "🎨", climate_bt: "🌡️", peninsulas_bt: "🗺️",
  population_bt: "👥", stars_bt: "⭐", geo_bt: "🧠", mixed_bt: "🧩",
  country_to_continent: "🗺️", country_to_capital: "🏛️", capital_to_country: "📍",
};

// ─── per-kind bosh_qotirma generators ──────────────────────
function genBTForKind(kind, pool) {
  const emoji = KIND_EMOJI[kind] || "🌍";
  switch (kind) {
    case "flag_to_country":
    case "country_to_flag": {
      // QIYIN rejim: yolg'on holatda — rasmdagi bayroqqa juda o'xshash
      // boshqa davlatning nomi beriladi. Bola haqiqatan ham diqqat
      // qilib farqlashga majbur bo'ladi.
      const shown = pick(pool);
      const isTrue = Math.random() < 0.5;
      const asked = isTrue ? shown : pickSimilarCountry(shown, pool);
      const hint = !isTrue
        ? ` Diqqat: ${asked[0]} bayrog'i bunga juda o'xshash, lekin farqi bor.`
        : "";
      return {
        questionText: `Bu rasm ${asked[0]} bayrog'i. Shundaymi?`,
        isTrue,
        explanation: isTrue
          ? `To'g'ri — bu haqiqatan ham ${asked[0]} bayrog'i.`
          : `Noto'g'ri — rasmdagi bayroq aslida ${shown[0]} davlatiga tegishli.${hint}`,
        imageUrl: flagUrl(shown[1]),
      };
    }
    case "country_to_capital":
    case "capital_to_country": {
      const a = pick(pool);
      const isTrue = Math.random() < 0.5;
      const b = isTrue ? a : pick(pool.filter(x => x[2] !== a[2]).length ? pool.filter(x => x[2] !== a[2]) : pool);
      return {
        ...buildBT(`Quyidagi bayroqdagi davlatning poytaxti — ${b[2]}.`, isTrue,
          isTrue ? `To'g'ri.` : `Noto'g'ri. Aslida ${a[0]} poytaxti — ${a[2]}.`),
        imageUrl: flagUrl(a[1]),
      };
    }
    case "country_to_continent": {
      const a = pick(pool);
      const isTrue = Math.random() < 0.5;
      const cont = isTrue ? a[3] : pick(Object.keys(CONTINENT_NAMES).filter(k => k !== a[3]));
      return {
        ...buildBT(`Bu bayroqdagi davlat ${CONTINENT_NAMES[cont]} materigida joylashgan.`, isTrue,
          isTrue ? `To'g'ri.` : `Noto'g'ri. Aslida ${CONTINENT_NAMES[a[3]]} materigida.`),
        imageUrl: flagUrl(a[1]),
      };
    }
    case "rivers":
    case "rivers_longest": {
      const r = pick(pool);
      const isTrue = Math.random() < 0.5;
      // Make false values plausible: ±20-40% of real length
      const delta = Math.floor(r[1] * (0.2 + Math.random() * 0.25)) * (Math.random() < 0.5 ? -1 : 1);
      const val = isTrue ? r[1] : Math.max(200, r[1] + delta);
      return { ...buildBT(`${r[0]} daryosining uzunligi ${val} km.`, isTrue,
        isTrue ? `To'g'ri.` : `Yo'q, aslida ${r[1]} km.`), imageUrl: emojiVisual(emoji, r[0]) };
    }
    case "mountains":
    case "mountains_highest": {
      const m = pick(pool);
      const isTrue = Math.random() < 0.5;
      const delta = Math.floor(m[1] * (0.1 + Math.random() * 0.15)) * (Math.random() < 0.5 ? -1 : 1);
      const val = isTrue ? m[1] : Math.max(500, m[1] + delta);
      return { ...buildBT(`${m[0]} cho'qqisining balandligi ${val} m.`, isTrue,
        isTrue ? `To'g'ri.` : `Yo'q, aslida ${m[1]} m.`), imageUrl: emojiVisual(emoji, m[0]) };
    }
    case "uzbekistan": {
      const items = [
        ["O'zbekiston poytaxti — Toshkent.", true],
        ["O'zbekistonda 14 ta viloyat bor.", false, "Aslida 12 ta viloyat va Qoraqalpog'iston Respublikasi."],
        ["Amudaryo Orol dengiziga quyiladi.", true],
        ["Qoraqalpog'iston poytaxti — Xiva.", false, "Aslida Nukus."],
        ["O'zbekiston Markaziy Osiyodagi davlatdir.", true],
        ["O'zbekiston dengiz bilan chegaradosh.", false, "O'zbekiston quruqlikda joylashgan."],
        ["Buxoro tarixiy shahar hisoblanadi.", true],
        ["O'zbekistondagi eng baland cho'qqi — Hazrati Sulton.", true],
        ["Zarafshon daryosi Sirdaryoga quyiladi.", false, "U Amudaryo havzasiga oqib boradi."],
        ["Toshkent — Markaziy Osiyodagi eng katta shahar.", true],
        ["Qizilqum cho'li Tojikistonda joylashgan.", false, "Asosiy qismi O'zbekistonda."],
        ["Surxondaryo viloyati janubda joylashgan.", true],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: flagUrl("uz") };
    }
    case "geo_records": {
      const items = [
        ["Everest — dunyodagi eng baland tog'.", true],
        ["Amazonka — dunyodagi eng uzun daryo.", false, "Nil daryosi (6650 km) eng uzun hisoblanadi."],
        ["Sahroyi Kabir — Afrikadagi eng katta cho'l.", true],
        ["Baykal — dunyodagi eng chuqur ko'l.", true],
        ["Avstraliya — eng katta materik.", false, "Eng katta materik — Osiyo."],
        ["Grenlandiya — dunyodagi eng katta orol.", true],
        ["Atlantika — eng katta okean.", false, "Eng katta — Tinch okean."],
        ["Mariana botig'i — okeandagi eng chuqur joy.", true],
        ["Antarktida — eng sovuq materik.", true],
        ["Kaspiy — dunyodagi eng katta ko'l (yopiq).", true],
        ["Niagara — dunyodagi eng baland sharshara.", false, "Eng balandi — Anxel sharsharasi (Venesuela)."],
        ["Vatikan — aholisi eng oz davlat.", true],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Geografik rekordlar") };
    }
    case "climate_bt": {
      const items = [
        ["Ekvator yaqinida iqlim issiq va nam.", true],
        ["Antarktidada doimiy tropik iqlim mavjud.", false, "Antarktida — eng sovuq materik."],
        ["Sahroyi Kabirda kunduz juda issiq, kechasi sovuq.", true],
        ["Tundra iqlimi qutbga yaqin hududlarda uchraydi.", true],
        ["Yamayka qutb iqlim mintaqasida joylashgan.", false, "U tropik iqlim mintaqasida."],
        ["Musson shamollari Janubiy Osiyoga xos.", true],
        ["Tayga — mo''tadil iqlim o'rmonlari.", true],
        ["Savanna iqlimi Yevropada keng tarqalgan.", false, "Savanna asosan Afrika va Janubiy Amerikada."],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Iqlim") };
    }
    case "peninsulas_bt": {
      const items = [
        ["Arabiston yarim oroli Osiyoda joylashgan.", true],
        ["Apennin yarim oroli — Italiya.", true],
        ["Kamchatka yarim oroli Afrikada.", false, "U Rossiyaning Uzoq Sharqida."],
        ["Pireney yarim oroli — Ispaniya va Portugaliya.", true],
        ["Skandinaviya yarim orolida Shvetsiya va Norvegiya bor.", true],
        ["Hindiston yarim oroli Janubiy Osiyoda.", true],
        ["Florida yarim oroli AQShda joylashgan.", true],
        ["Bolqon yarim oroli Janubiy Amerikada.", false, "Bolqon — Janubi-Sharqiy Yevropada."],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Yarim orollar") };
    }
    case "population_bt": {
      const items = [
        ["Hindiston aholisi 1 mlrd dan ortiq.", true],
        ["O'zbekiston aholisi 35 mln atrofida.", true],
        ["Vatikan dunyodagi eng kichik davlat.", true],
        ["Monako Afrikada joylashgan.", false, "U Yevropada — Frantsiya yaqinida."],
        ["Xitoy va Hindiston dunyodagi eng ko'p aholili davlatlar.", true],
        ["Tokio — dunyodagi eng yirik aglomeratsiya.", true],
        ["AQSh aholisi 50 mln atrofida.", false, "Aslida 330 mln dan ortiq."],
        ["Nigeriya — Afrikadagi eng ko'p aholili davlat.", true],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Aholi") };
    }
    case "continents":
    case "continents_size": {
      const items = [
        ["Osiyo eng katta materik.", true],
        ["Antarktida eng kichik materik.", false, "Eng kichik — Avstraliya."],
        ["Yevropa va Osiyo birgalikda Yevrosiyoni tashkil etadi.", true],
        ["Afrika ekvator chizig'ini kesib o'tadi.", true],
        ["Janubiy Amerika va Shimoliy Amerika Panama bilan tutashgan.", true],
        ["Avstraliya bir vaqtning o'zida ham materik, ham davlat.", true],
        ["Yevropa Osiyodan kattaroq.", false, "Osiyo Yevropadan deyarli 4,5 marta katta."],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Materiklar") };
    }
    case "oceans":
    case "seas": {
      const items = [
        ["Tinch okean dunyodagi eng katta okean.", true],
        ["Kaspiy — eng katta yopiq suv havzasi.", true],
        ["Qora dengiz Atlantika havzasiga kiradi.", true],
        ["Orol dengizi Yevropada joylashgan.", false, "U Markaziy Osiyoda."],
        ["O'rta yer dengizi Afrika va Yevropa o'rtasida.", true],
        ["Shimoliy Muz okeani eng issiq okean.", false, "Aksincha — eng sovuq okean."],
        ["Hind okeani uchburchak shaklida.", true],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Okean / dengiz") };
    }
    case "lakes": {
      const items = [
        ["Baykal — dunyodagi eng chuqur ko'l.", true],
        ["Viktoriya ko'li — Afrikadagi eng katta ko'l.", true],
        ["Orol dengizi aslida ko'l hisoblanadi.", true],
        ["Titikaka ko'li Afrikada joylashgan.", false, "U Janubiy Amerikada (Peru va Boliviya)."],
        ["Issiqko'l — Qirg'izistonda.", true],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Ko'llar") };
    }
    case "deserts": {
      const items = [
        ["Sahroyi Kabir Afrikadagi eng katta cho'l.", true],
        ["Atakama — dunyodagi eng quruq cho'l.", true],
        ["Qoraqum cho'li Turkmanistonda.", true],
        ["Gobi cho'li Janubiy Amerikada.", false, "Aslida Mo'g'uliston va Xitoyda."],
        ["Qizilqum O'zbekiston va Qozog'iston hududida.", true],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Cho'llar") };
    }
    case "volcanoes": {
      const items = [
        ["Fudziyama — Yaponiyadagi vulqon.", true],
        ["Vezuviy Italiyada joylashgan.", true],
        ["Etna — Yevropadagi eng faol vulqon.", true],
        ["Kilimanjaro Janubiy Amerikada.", false, "U Afrikada (Tanzaniya)."],
        ["Krakatau Indoneziyada.", true],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Vulqonlar") };
    }
    case "islands": {
      const items = [
        ["Grenlandiya — dunyodagi eng katta orol.", true],
        ["Madagaskar Hind okeanida joylashgan.", true],
        ["Yangi Gvineya — ikkinchi katta orol.", true],
        ["Islandiya Tinch okeanida.", false, "U Atlantika okeanida."],
        ["Kalimantan oroli bir necha davlatga tegishli.", true],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Orollar") };
    }
    case "currencies": {
      const items = [
        ["Yaponiyaning pul birligi — iyena.", true],
        ["AQSh pul birligi — dollar.", true],
        ["O'zbekiston pul birligi — so'm.", true],
        ["Germaniya pul birligi — frank.", false, "Aslida — yevro."],
        ["Buyuk Britaniya pul birligi — funt sterling.", true],
        ["Hindiston pul birligi — yuan.", false, "Aslida — rupiya (yuan — Xitoy pul birligi)."],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Pul birliklari") };
    }
    case "flag_colors": {
      const items = [
        ["Yaponiya bayrog'ida faqat qizil va oq ranglar bor.", true],
        ["Italiya bayrog'i — yashil, oq, qizil (vertikal yo'llar).", true],
        ["Rossiya bayrog'i tartibi — qizil, oq, ko'k (yuqoridan pastga).", false, "Aslida: oq–ko'k–qizil."],
        ["Turkiya bayrog'ida yarim oy va yulduz bor.", true],
        ["Kanada bayrog'ida palma bargi tasvirlangan.", false, "Aslida — chinor (klyon) bargi."],
        ["Indoneziya va Polsha bayroqlari bir xil ikkita rangdan iborat, faqat tartibi teskari.", true],
        ["Ruminiya va Chad bayroqlarini farqlash juda qiyin — deyarli bir xil.", true],
        ["Niderlandiya bayrog'i — qizil, oq, ko'k gorizontal yo'llar.", true],
        ["Lyuksemburg va Niderlandiya bayroqlari deyarli bir xil ko'rinadi.", true],
        ["Sloveniya, Slovakiya va Rossiya bayroqlarida bir xil 3 rang bor.", true],
        ["Vetnam bayrog'ida qizil fonda 5 burchakli sariq yulduz bor.", true],
        ["Xitoy bayrog'ida 1 ta katta va 4 ta kichik yulduz bor.", true],
        ["Yaponiya va Bangladesh bayroqlarining ikkalasida ham fon yashil rangda.", false, "Yaponiya — oq fonda, Bangladesh — yashil fonda. Ikkalasida ham qizil doira bor."],
        ["Avstraliya va Yangi Zelandiya bayroqlarida Buyuk Britaniya bayrog'i tasviri bor.", true],
        ["AQSh bayrog'idagi yulduzlar soni shtatlar soniga teng — 50 ta.", true],
        ["AQSh bayrog'idagi qizil-oq yo'llar soni — 13 ta (dastlabki shtatlar soni).", true],
        ["Shvetsariya bayrog'i to'rtburchak shaklida.", false, "Shvetsariya va Vatikan bayroqlari kvadrat shaklida."],
        ["Nepal bayrog'i to'rtburchak emas, uchburchakdan tashkil topgan.", true],
        ["Senegal, Mali va Gvineya bayroqlari bir xil 3 rangdan: yashil, sariq, qizil.", true],
        ["Pokiston bayrog'ida yarim oy va yulduz oq fon ustida.", false, "Yashil fon ustida, chap tomonda yupqa oq yo'l bor."],
        ["Janubiy Koreya bayrog'ida In-Yan belgisi va 4 ta trigramma bor.", true],
        ["Braziliya bayrog'ida yulduzlar joylashuvi haqiqiy osmon manzarasini aks ettiradi.", true],
        ["Buyuk Britaniya bayrog'i 3 ta xochning birlashmasi.", true],
        ["Argentina va Urugvay bayroqlarining ikkalasida ham Quyosh tasviri bor.", true],
        ["Skandinaviya davlatlari bayroqlari (Shvetsiya, Norvegiya, Daniya, Finlyandiya, Islandiya) yon tomonga siljigan xoch bilan ajralib turadi.", true],
        ["Kuba va Puerto-Riko bayroqlari deyarli bir xil, faqat ranglari teskari.", true],
        ["Iordaniya va Falastin bayroqlarida bir xil 4 rang bor.", true],
        ["Eron va Tojikiston bayroqlarida bir xil 3 rang bor: yashil, oq, qizil.", true],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Bayroq jumboqlari") };
    }
    default: {
      const items = [
        ["Yer 7 ta materikdan iborat.", true],
        ["Quyosh g'arbdan chiqadi.", false, "Quyosh sharqdan chiqadi."],
        ["Ekvator Yerni shimoliy va janubiy yarim sharlarga ajratadi.", true],
        ["Grinvich meridiani 0° geografik uzunlik hisoblanadi.", true],
        ["Yerda 4 ta okean rasman tan olingan, ba'zilarida 5 ta.", true],
        ["Quyosh tizimida 8 ta sayyora bor.", true],
        ["Yer Quyosh atrofida 365 kunda aylanadi.", true],
        ["Oy Quyoshning sun'iy yo'ldoshi.", false, "Oy — Yerning tabiiy yo'ldoshi."],
      ];
      const it = pick(items);
      return { ...buildBT(it[0], it[1], it[2] || ""), imageUrl: emojiVisual(emoji, "Geografiya") };
    }
  }
}


export function generateQuestions({ topicId, gameType, count = 10 }) {
  const topic = getTopicById(topicId);
  if (!topic) throw new Error("Mavzu topilmadi");

  const seen = new Set();
  const out = [];
  const gen = gameType === "bosh_qotirma" ? genBTForKind : genQuizForKind;
  let tries = 0;

  while (out.length < count && tries < count * 20) {
    tries++;
    const q = gen(topic.kind, topic.pool);
    const key = q.questionText + "|" + (q.imageUrl || "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: out.length + 1, ...q });
  }

  // Fill the rest with anything if generator can't diversify enough
  while (out.length < count) {
    const q = gen(topic.kind, topic.pool);
    out.push({ id: out.length + 1, ...q });
  }

  return out;
}
