import { COUNTRIES, CONTINENT_NAMES, flagUrl } from "./countries.js";
import { RIVERS, MOUNTAINS, CURRENCIES } from "./geoData.js";
import { getTopicById } from "./topics-data.js";

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

// ─── Bag: bitta o'yin ichida bir manbani takrorlamaslik ──────────
// Har bir kalit uchun aralashtirilgan navbat saqlanadi va elementlar
// birma-bir olinadi. Navbat tugagandagina qaytadan aralashtiriladi.
// Shu tufayli 10 ta savol — 10 xil davlat/daryo/fakt ustida bo'ladi.
function makeCtx() { return { bags: new Map() }; }

function next(ctx, key, arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let bag = ctx.bags.get(key);
  if (!bag || bag.length === 0) {
    bag = shuffle(arr);
    ctx.bags.set(key, bag);
  }
  return bag.pop();
}

// Savol shakllarini ham navbat bilan almashtiramiz (bir xil shakl
// ketma-ket kelmasin).
function nextTpl(ctx, kind, n) {
  return next(ctx, `tpl:${kind}`, Array.from({ length: n }, (_, i) => i));
}

// Bir-biridan farq qiluvchi ikkita element
function nextPair(ctx, key, arr) {
  const a = next(ctx, key, arr);
  if (arr.length < 2) return [a, a];
  let b = pick(arr);
  let guard = 0;
  while (b === a && guard++ < 30) b = pick(arr);
  return [a, b];
}

const RANK_LABELS = ["birinchi","ikkinchi","uchinchi","to'rtinchi","beshinchi","oltinchi","yettinchi"];

// 0 → "eng katta", 1 → "ikkinchi eng katta", ...
function superLabel(i, adj) {
  return i === 0 ? `eng ${adj}` : `${RANK_LABELS[i]} eng ${adj}`;
}

// ─── O'xshash bayroqlar guruhlari (bosh qotirma uchun) ───────────
const SIMILAR_FLAGS = [
  ["id","pl"],
  ["ro","md","ad","td"],
  ["nl","ru","lu","hr","si","sk","rs"],
  ["it","mx","ie","hu","bg"],
  ["se","no","dk","fi","is"],
  ["co","ec","ve"],
  ["ar","uy"],
  ["ae","sd","sy","eg","iq","ye","jo","kw","ps"],
  ["tr","tn","pk","dz","ly","az"],
  ["ir","tj"],
  ["cn","vn"],
  ["jp","bd","pw"],
  ["lv","at","pl","id"],
  ["sn","ml","gn","cm","gh"],
  ["au","nz","fj","gb"],
  ["by","ir"],
  ["am","es","co"],
  ["be","de"],
  ["br","ng"],
  ["ge","gb","ch","tn"],
  ["cz","ph","kw"],
  ["kr","kp"],
  ["us","ma","la"],
];

function similarIsoSet(iso) {
  const out = new Set();
  for (const group of SIMILAR_FLAGS) {
    if (group.includes(iso)) group.forEach(x => { if (x !== iso) out.add(x); });
  }
  return out;
}

function pickSimilarCountry(country, pool) {
  const iso = country[1];
  const sims = similarIsoSet(iso);
  const candidates = pool.filter(x => sims.has(x[1]));
  if (candidates.length) return pick(candidates);
  const global = COUNTRIES.filter(x => sims.has(x[1]));
  if (global.length) return pick(global);
  const others = pool.filter(x => x[1] !== iso);
  return others.length ? pick(others) : country;
}

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

// 4 variantli savol. `key` — takrorni aniqlash uchun mavzu belgisi.
function buildQuiz(text, correct, distractors, extra = {}) {
  const uniq = [...new Set(distractors.filter(d => d != null && d !== correct))];
  const opts = shuffle([correct, ...pickN(uniq, 3)]);
  return {
    questionText: text,
    options: opts,
    correctIndex: opts.indexOf(correct),
    ...extra,
  };
}

function buildBT(text, isTrue, explanation = "") {
  return { questionText: text, isTrue, explanation };
}

// Bank savolini ([savol, to'g'ri, [chalg'ituvchilar]]) savolga aylantiradi
function fromBank(ctx, key, bank, extra = {}) {
  const it = next(ctx, `bank:${key}`, bank);
  return buildQuiz(it[0], it[1], it[2], { _key: `${key}:${it[0]}`, ...extra });
}

// Bank faktini ([matn, isTrue, izoh?]) bosh qotirmaga aylantiradi.
// "To'g'ri" va "noto'g'ri" javoblar navbatma-navbat keladi — shunda
// o'quvchi hammasiga "ha" deb javob berib qo'ya olmaydi.
function btFromBank(ctx, key, bank, extra = {}) {
  const want = next(ctx, `btbal:${key}`, [true, false]);
  const part = bank.filter(x => x[1] === want);
  const it = next(ctx, `bt:${key}:${want}`, part.length ? part : bank);
  return { ...buildBT(it[0], it[1], it[2] || ""), _key: `${key}:${it[0]}`, ...extra };
}

// ─── Statik savol banklari (kichik ma'lumot to'plamli mavzular uchun) ───
const QUIZ_BANKS = {
  oceans: [
    ["Dunyodagi eng katta okean qaysi?","Tinch okean",["Atlantika okeani","Hind okeani","Shimoliy Muz okeani"]],
    ["Dunyodagi eng kichik okean qaysi?","Shimoliy Muz okeani",["Hind okeani","Janubiy okean","Atlantika okeani"]],
    ["Maydoni bo'yicha ikkinchi o'rindagi okean?","Atlantika okeani",["Hind okeani","Tinch okean","Janubiy okean"]],
    ["Maydoni bo'yicha uchinchi o'rindagi okean?","Hind okeani",["Atlantika okeani","Shimoliy Muz okeani","Janubiy okean"]],
    ["Okeandagi eng chuqur joy qaysi?","Mariana botig'i",["Tonga botig'i","Filippin botig'i","Yava botig'i"]],
    ["Mariana botig'i qaysi okeanda joylashgan?","Tinch okean",["Atlantika okeani","Hind okeani","Shimoliy Muz okeani"]],
    ["Antarktida atrofini o'rab turgan okean?","Janubiy okean",["Hind okeani","Tinch okean","Shimoliy Muz okeani"]],
    ["Eng sovuq okean qaysi?","Shimoliy Muz okeani",["Janubiy okean","Atlantika okeani","Hind okeani"]],
    ["Yevropa va Amerikani ajratib turadigan okean?","Atlantika okeani",["Tinch okean","Hind okeani","Janubiy okean"]],
    ["Gulfstrim iliq oqimi qaysi okeanda?","Atlantika okeani",["Tinch okean","Hind okeani","Shimoliy Muz okeani"]],
    ["Hind okeani qaysi materiklar orasida joylashgan?","Afrika, Osiyo va Avstraliya",["Yevropa va Amerika","Amerika va Osiyo","Afrika va Amerika"]],
    ["Okeanlar Yer yuzasining necha foizini egallaydi?","Taxminan 71%",["Taxminan 30%","Taxminan 50%","Taxminan 90%"]],
    ["Bering bo'g'ozi qaysi okeanlarni bog'laydi?","Tinch va Shimoliy Muz okeanlarini",["Atlantika va Hind okeanlarini","Hind va Tinch okeanlarini","Atlantika va Tinch okeanlarini"]],
    ["Qizil dengiz qaysi okean havzasiga kiradi?","Hind okeani",["Atlantika okeani","Tinch okean","Shimoliy Muz okeani"]],
    ["Karib dengizi qaysi okean havzasiga kiradi?","Atlantika okeani",["Tinch okean","Hind okeani","Janubiy okean"]],
    ["Suvaysh kanali qaysi ikki suv havzasini bog'laydi?","O'rta yer dengizi va Qizil dengizni",["Qora dengiz va Kaspiyni","Boltiq va Shimoliy dengizni","Tinch va Atlantika okeanlarini"]],
  ],
  continents: [
    ["Eng katta materik qaysi?","Osiyo",["Afrika","Shimoliy Amerika","Antarktida"]],
    ["Eng kichik materik qaysi?","Avstraliya",["Yevropa","Antarktida","Janubiy Amerika"]],
    ["Aholisi eng ko'p materik qaysi?","Osiyo",["Afrika","Yevropa","Shimoliy Amerika"]],
    ["Doimiy aholisi bo'lmagan materik qaysi?","Antarktida",["Avstraliya","Janubiy Amerika","Afrika"]],
    ["Eng issiq materik qaysi?","Afrika",["Avstraliya","Janubiy Amerika","Osiyo"]],
    ["Ekvator o'rtasidan kesib o'tadigan materik?","Afrika",["Yevropa","Avstraliya","Shimoliy Amerika"]],
    ["Eng ko'p davlat joylashgan materik qaysi?","Afrika",["Osiyo","Yevropa","Janubiy Amerika"]],
    ["Sahroyi Kabir qaysi materikda?","Afrika",["Osiyo","Avstraliya","Janubiy Amerika"]],
    ["Amazonka o'rmonlari qaysi materikda?","Janubiy Amerika",["Afrika","Osiyo","Shimoliy Amerika"]],
    ["Himolay tog'lari qaysi materikda?","Osiyo",["Yevropa","Afrika","Shimoliy Amerika"]],
    ["Antarktidada qaysi qutb joylashgan?","Janubiy qutb",["Shimoliy qutb","Ikkala qutb ham","Hech qaysi qutb"]],
    ["Yevropa va Osiyo birgalikda qanday nomlanadi?","Yevrosiyo",["Yevrafrika","Osiyo-Okeaniya","Katta Osiyo"]],
    ["Bir vaqtning o'zida ham materik, ham davlat bo'lgan hudud?","Avstraliya",["Antarktida","Grenlandiya","Madagaskar"]],
    ["Muzliklar bilan qoplangan materik?","Antarktida",["Yevropa","Shimoliy Amerika","Osiyo"]],
    ["Nil daryosi qaysi materikda oqadi?","Afrika",["Osiyo","Yevropa","Janubiy Amerika"]],
  ],
  climate_bt: [
    ["Ekvator yaqinidagi iqlim qanday bo'ladi?","Issiq va nam",["Sovuq va quruq","Mo'tadil va salqin","Qutbiy"]],
    ["Eng sovuq iqlim mintaqasi qaysi?","Qutbiy",["Tropik","Subtropik","Mo'tadil"]],
    ["Musson shamollari qaysi mintaqaga xos?","Janubiy va Janubi-Sharqiy Osiyo",["Shimoliy Yevropa","Antarktida","Shimoliy Amerika"]],
    ["Tundra qaysi mintaqada uchraydi?","Qutbga yaqin hududlarda",["Tropikda","Ekvatorda","Subtropikda"]],
    ["Tayga nima?","Igna bargli o'rmonlar mintaqasi",["Cho'l mintaqasi","Savanna","Botqoqlik"]],
    ["Savanna asosan qayerda tarqalgan?","Afrika va Janubiy Amerikada",["Yevropada","Antarktidada","Shimoliy Osiyoda"]],
    ["Iqlimga eng kuchli ta'sir qiluvchi omil?","Geografik kenglik",["Vaqt mintaqasi","Aholi soni","Davlat maydoni"]],
    ["Yog'ingarchilik eng ko'p bo'ladigan mintaqa?","Ekvatorial",["Qutbiy","Cho'l","Subtropik"]],
    ["O'zbekiston iqlimi qanday?","Keskin kontinental",["Dengiz iqlimi","Ekvatorial","Musson iqlimi"]],
    ["Ob-havo hodisalari atmosferaning qaysi qatlamida sodir bo'ladi?","Troposfera",["Stratosfera","Mezosfera","Ionosfera"]],
    ["Balandlik ortgan sari havo harorati qanday o'zgaradi?","Pasayadi",["Ko'tariladi","O'zgarmaydi","Ikki barobar oshadi"]],
    ["Dunyodagi eng quruq cho'l qaysi?","Atakama",["Gobi","Qoraqum","Kalaxari"]],
    ["Passat shamollari qaysi mintaqada esadi?","Tropik mintaqada",["Qutbda","Mo'tadil mintaqada","Faqat tog'larda"]],
    ["Global isishning asosiy sababi nima?","Atmosferada karbonat angidrid ko'payishi",["Yer aylanishining sekinlashuvi","Vulqonlar sonining kamayishi","Okean sathining pasayishi"]],
    ["Havo namligi qaysi asbob bilan o'lchanadi?","Gigrometr",["Termometr","Barometr","Anemometr"]],
    ["Atmosfera bosimi qaysi asbob bilan o'lchanadi?","Barometr",["Gigrometr","Termometr","Kompas"]],
  ],
  peninsulas_bt: [
    ["Apennin yarim orolida qaysi davlat joylashgan?","Italiya",["Ispaniya","Gretsiya","Turkiya"]],
    ["Pireney yarim orolida qaysi davlatlar joylashgan?","Ispaniya va Portugaliya",["Italiya va Fransiya","Gretsiya va Albaniya","Norvegiya va Shvetsiya"]],
    ["Skandinaviya yarim orolida qaysi davlatlar joylashgan?","Norvegiya va Shvetsiya",["Daniya va Germaniya","Finlyandiya va Estoniya","Islandiya va Irlandiya"]],
    ["Kamchatka yarim oroli qaysi davlatda?","Rossiya",["Yaponiya","Xitoy","Kanada"]],
    ["Arabiston yarim oroli qaysi materikda?","Osiyo",["Afrika","Yevropa","Avstraliya"]],
    ["Florida yarim oroli qaysi davlatda?","AQSh",["Meksika","Kuba","Kanada"]],
    ["Bolqon yarim oroli qayerda joylashgan?","Janubi-Sharqiy Yevropada",["Janubiy Amerikada","Shimoliy Afrikada","Markaziy Osiyoda"]],
    ["Hindiston yarim orolidagi eng katta davlat?","Hindiston",["Xitoy","Eron","Indoneziya"]],
    ["Koreya yarim orolida nechta davlat bor?","2 ta",["1 ta","3 ta","4 ta"]],
    ["Malakka yarim oroli qaysi mintaqada?","Janubi-Sharqiy Osiyoda",["Janubiy Amerikada","G'arbiy Afrikada","Shimoliy Yevropada"]],
    ["Yutlandiya yarim oroli asosan qaysi davlatga tegishli?","Daniya",["Germaniya","Niderlandiya","Norvegiya"]],
    ["Kichik Osiyo (Anatoliya) yarim oroli qaysi davlat hududida?","Turkiya",["Gretsiya","Suriya","Eron"]],
    ["Dunyodagi eng katta yarim orol qaysi?","Arabiston",["Hindiston","Skandinaviya","Labrador"]],
    ["Krim yarim oroli qaysi dengizda joylashgan?","Qora dengiz",["Boltiq dengizi","Kaspiy dengizi","O'rta yer dengizi"]],
    ["Somali yarim oroli qaysi materikda?","Afrika",["Osiyo","Avstraliya","Janubiy Amerika"]],
    ["Labrador yarim oroli qaysi davlatda?","Kanada",["AQSh","Rossiya","Norvegiya"]],
  ],
  population_bt: [
    ["Aholisi eng ko'p davlat qaysi?","Hindiston",["Xitoy","AQSh","Indoneziya"]],
    ["Aholisi bo'yicha ikkinchi o'rindagi davlat?","Xitoy",["AQSh","Indoneziya","Pokiston"]],
    ["Dunyodagi eng kichik davlat qaysi?","Vatikan",["Monako","San-Marino","Malta"]],
    ["O'zbekiston aholisi taxminan qancha?","36 mln atrofida",["10 mln atrofida","60 mln atrofida","100 mln atrofida"]],
    ["Aholisi eng ko'p materik qaysi?","Osiyo",["Afrika","Yevropa","Shimoliy Amerika"]],
    ["Dunyodagi eng yirik shahar aglomeratsiyasi?","Tokio",["Nyu-York","London","Moskva"]],
    ["Afrikadagi eng ko'p aholili davlat?","Nigeriya",["Misr","Efiopiya","Janubiy Afrika"]],
    ["Yevropadagi eng ko'p aholili davlat?","Rossiya",["Germaniya","Fransiya","Buyuk Britaniya"]],
    ["Dunyo aholisi hozirda taxminan qancha?","8 mlrd",["4 mlrd","6 mlrd","12 mlrd"]],
    ["Aholi zichligi eng yuqori davlatlardan biri?","Singapur",["Rossiya","Kanada","Avstraliya"]],
    ["Markaziy Osiyodagi eng ko'p aholili davlat?","O'zbekiston",["Qozog'iston","Tojikiston","Turkmaniston"]],
    ["Janubiy Amerikadagi eng ko'p aholili davlat?","Braziliya",["Argentina","Kolumbiya","Peru"]],
    ["Maydoni eng katta davlat qaysi?","Rossiya",["Kanada","Xitoy","AQSh"]],
    ["Aholi zichligi eng past materik (Antarktidadan tashqari)?","Avstraliya",["Osiyo","Yevropa","Afrika"]],
    ["Shimoliy Amerikadagi eng ko'p aholili davlat?","AQSh",["Meksika","Kanada","Kuba"]],
    ["Aholining shaharlarda yashash jarayoni qanday ataladi?","Urbanizatsiya",["Migratsiya","Emigratsiya","Integratsiya"]],
  ],
  stars_bt: [
    ["Quyosh tizimida nechta sayyora bor?","8 ta",["7 ta","9 ta","12 ta"]],
    ["Yerning tabiiy yo'ldoshi qaysi?","Oy",["Mars","Venera","Fobos"]],
    ["Yer Quyosh atrofini necha kunda aylanib chiqadi?","365 kun",["30 kun","24 kun","100 kun"]],
    ["Yer o'z o'qi atrofida necha soatda aylanadi?","24 soat",["12 soat","48 soat","72 soat"]],
    ["Shimoliy yarim sharda yo'nalish topishga yordam beruvchi yulduz?","Qutb yulduzi",["Sirius","Vega","Venera"]],
    ["Quyosh — bu nima?","Yulduz",["Sayyora","Yo'ldosh","Kometa"]],
    ["Yerga eng yaqin sayyora qaysi?","Venera",["Mars","Yupiter","Saturn"]],
    ["Quyosh tizimidagi eng katta sayyora?","Yupiter",["Saturn","Yer","Neptun"]],
    ["Quyoshga eng yaqin sayyora qaysi?","Merkuriy",["Venera","Yer","Mars"]],
    ["Qaysi sayyora 'Qizil sayyora' deb ataladi?","Mars",["Venera","Saturn","Uran"]],
    ["Yer o'qining og'ishi nimaga sabab bo'ladi?","Fasllar almashinuviga",["Kunduz va tunga","Oy tutilishiga","Zilzilaga"]],
    ["Grinvich meridiani necha gradus hisoblanadi?","0°",["90°","180°","45°"]],
    ["Ekvator necha gradus kenglikda joylashgan?","0°",["23,5°","45°","90°"]],
    ["Yerning shakli qanday?","Geoid — qutblarda biroz siqilgan shar",["Ideal shar","Kub","Yassi disk"]],
    ["Yer bir sutkada necha gradusga aylanadi?","360°",["180°","90°","24°"]],
    ["Quyosh tutilishi qachon sodir bo'ladi?","Oy Yer bilan Quyosh orasiga tushganda",["Yer Oy bilan Quyosh orasiga tushganda","Har kecha","Faqat qishda"]],
    ["Yer sirtidagi shartli chiziqlar — parallellar nimani ko'rsatadi?","Geografik kenglikni",["Geografik uzunlikni","Balandlikni","Chuqurlikni"]],
    ["Meridianlar nimani ko'rsatadi?","Geografik uzunlikni",["Geografik kenglikni","Haroratni","Bosimni"]],
  ],
  geo_bt: [
    ["Yevropa va Osiyo chegarasi qaysi tog'lardan o'tadi?","Ural tog'lari",["Alp tog'lari","Himolay","Karpat tog'lari"]],
    ["Afrika va Osiyo qaysi kanal bilan ajratilgan?","Suvaysh kanali",["Panama kanali","La-Mansh","Kil kanali"]],
    ["Shimoliy va Janubiy Amerika qayerda tutashadi?","Panama bo'ynida",["Suvaysh bo'ynida","Bosfor bo'g'ozida","Gibraltarda"]],
    ["Yevropa va Afrikani ajratuvchi bo'g'oz qaysi?","Gibraltar bo'g'ozi",["Bosfor","Bering bo'g'ozi","La-Mansh"]],
    ["Osiyo va Shimoliy Amerikani ajratuvchi bo'g'oz?","Bering bo'g'ozi",["Gibraltar","Bosfor","Magellan bo'g'ozi"]],
    ["Qaysi davlat bir vaqtda ham Yevropa, ham Osiyoda joylashgan?","Turkiya",["Italiya","Eron","Misr"]],
    ["Misr qaysi ikki materikda joylashgan?","Afrika va Osiyoda",["Yevropa va Afrikada","Osiyo va Yevropada","Faqat Yevropada"]],
    ["Bosfor bo'g'ozi qaysi shaharni ikkiga bo'ladi?","Istanbulni",["Anqarani","Afinani","Bokuni"]],
    ["Eng uzun quruqlik chegarasi qaysi ikki davlat orasida?","Kanada va AQSh",["Rossiya va Xitoy","Hindiston va Xitoy","Braziliya va Argentina"]],
    ["O'zbekiston nechta davlat bilan chegaradosh?","5 ta",["3 ta","4 ta","7 ta"]],
    ["Dengizga chiqishi yo'q davlatga misol?","Mo'g'uliston",["Vetnam","Yaponiya","Norvegiya"]],
    ["Yevrosiyo nimani anglatadi?","Yevropa va Osiyoning birgalikdagi nomini",["Yevropa va Afrikani","Osiyo va Avstraliyani","Yevropa Ittifoqini"]],
    ["Panama kanali qaysi ikki okeanni bog'laydi?","Tinch va Atlantika okeanlarini",["Hind va Tinch okeanlarini","Atlantika va Shimoliy Muz okeanlarini","Hind va Atlantika okeanlarini"]],
    ["Kavkaz tog'lari qaysi ikki materik chegarasida joylashgan?","Yevropa va Osiyo",["Osiyo va Afrika","Yevropa va Afrika","Osiyo va Avstraliya"]],
    ["Geografik xarita masshtabi nimani ko'rsatadi?","Kichraytirish darajasini",["Balandlikni","Haroratni","Aholi sonini"]],
    ["Xaritada ko'k rang odatda nimani bildiradi?","Suv havzalarini",["Tog'larni","Cho'llarni","O'rmonlarni"]],
    ["Xaritada jigarrang rang nimani bildiradi?","Tog'lar va balandliklarni",["Dengizlarni","Tekisliklarni","Muzliklarni"]],
    ["Kompas strelkasi qaysi tomonni ko'rsatadi?","Shimolni",["Janubni","Sharqni","G'arbni"]],
  ],
  uzbekistan: [
    ["O'zbekistonning poytaxti qaysi shahar?","Toshkent",["Samarqand","Buxoro","Andijon"]],
    ["O'zbekistondagi eng katta cho'l qaysi?","Qizilqum",["Qoraqum","Mojave","Sahroyi Kabir"]],
    ["O'zbekistonning eng baland cho'qqisi qaysi?","Hazrati Sulton",["Everest","Elbrus","Pobeda"]],
    ["O'zbekistonda nechta viloyat bor?","12 ta",["10 ta","14 ta","9 ta"]],
    ["O'zbekistonning eng uzun daryosi qaysi?","Amudaryo",["Sirdaryo","Zarafshon","Volga"]],
    ["Aydarko'l asosan qaysi viloyatda joylashgan?","Jizzax",["Buxoro","Toshkent","Surxondaryo"]],
    ["Qoraqalpog'iston Respublikasining poytaxti?","Nukus",["Urganch","Xiva","Buxoro"]],
    ["O'zbekiston qaysi mintaqada joylashgan?","Markaziy Osiyo",["Janubiy Osiyo","Sharqiy Yevropa","Yaqin Sharq"]],
    ["O'zbekiston nechta davlat bilan chegaradosh?","5 ta",["3 ta","6 ta","7 ta"]],
    ["Amudaryo va Sirdaryo qaysi havzaga quyilgan?","Orol dengizi",["Kaspiy dengizi","Qora dengiz","Boltiq dengizi"]],
    ["Registon maydoni qaysi shaharda joylashgan?","Samarqand",["Buxoro","Xiva","Toshkent"]],
    ["Ichan qal'a qaysi shaharda joylashgan?","Xiva",["Buxoro","Shahrisabz","Termiz"]],
    ["O'zbekistonning eng janubiy viloyati qaysi?","Surxondaryo",["Xorazm","Namangan","Sirdaryo"]],
    ["Farg'ona vodiysida nechta viloyat joylashgan?","3 ta",["2 ta","4 ta","5 ta"]],
    ["Chorvoq suv ombori qaysi viloyatda?","Toshkent",["Jizzax","Navoiy","Andijon"]],
    ["O'zbekistonning pul birligi qaysi?","So'm",["Tenge","Somoni","Manat"]],
    ["Zarafshon daryosi qaysi shaharlar yonidan o'tadi?","Samarqand va Navoiy",["Toshkent va Andijon","Nukus va Urganch","Termiz va Qarshi"]],
    ["O'zbekiston maydoni taxminan qancha?","448 900 km²",["100 000 km²","1 000 000 km²","250 000 km²"]],
    ["Qoraqalpog'iston qanday maqomga ega?","Respublika",["Viloyat","Tuman","Shahar"]],
    ["O'zbekistonning dengizga chiqishi bormi?","Yo'q, u quruqlik bilan o'ralgan",["Ha, Kaspiy orqali","Ha, Orol orqali","Ha, Qora dengiz orqali"]],
  ],
  geo_records: [
    ["Dunyodagi eng baland tog' cho'qqisi qaysi?","Everest",["K2","Elbrus","Akonkagua"]],
    ["Dunyodagi eng uzun daryo qaysi?","Nil",["Amazonka","Yantszi","Volga"]],
    ["Dunyodagi eng katta okean qaysi?","Tinch okean",["Atlantika","Hind okeani","Shimoliy Muz okeani"]],
    ["Dunyodagi eng katta cho'l qaysi?","Sahroyi Kabir",["Gobi","Atakama","Arab cho'li"]],
    ["Dunyodagi eng chuqur ko'l qaysi?","Baykal",["Tanganika","Kaspiy","Viktoriya"]],
    ["Dunyodagi eng katta orol qaysi?","Grenlandiya",["Yangi Gvineya","Madagaskar","Kalimantan"]],
    ["Aholisi eng ko'p davlat qaysi?","Hindiston",["Xitoy","AQSh","Indoneziya"]],
    ["Maydoni eng katta davlat qaysi?","Rossiya",["Kanada","Xitoy","AQSh"]],
    ["Dunyodagi eng baland sharshara qaysi?","Anxel",["Niagara","Viktoriya","Iguasu"]],
    ["Dunyodagi eng katta yarim orol qaysi?","Arabiston",["Hindiston","Skandinaviya","Labrador"]],
    ["Okeandagi eng chuqur nuqta qaysi?","Mariana botig'i",["Tonga botig'i","Yava botig'i","Filippin botig'i"]],
    ["Dunyodagi eng katta tropik o'rmon qaysi?","Amazonka o'rmonlari",["Kongo o'rmonlari","Tayga","Borneo o'rmonlari"]],
    ["Quruqlikdagi eng uzun tog' tizmasi qaysi?","And tog'lari",["Himolay","Ural","Alp tog'lari"]],
    ["Eng ko'p oroldan iborat davlat qaysi?","Indoneziya",["Filippin","Yaponiya","Malayziya"]],
    ["Dunyodagi eng baland joylashgan poytaxt qaysi?","La-Pas",["Kito","Mexiko","Katmandu"]],
    ["Eng past harorat qayd etilgan hudud qayer?","Antarktida",["Sibir","Grenlandiya","Alyaska"]],
    ["Maydoni bo'yicha eng katta ko'l qaysi?","Kaspiy",["Baykal","Viktoriya","Yuqori ko'l"]],
    ["Dunyodagi eng kichik davlat qaysi?","Vatikan",["Monako","San-Marino","Nauru"]],
    ["Eng baland faol vulqonlardan biri qaysi materikda?","Janubiy Amerika",["Antarktida","Avstraliya","Yevropa"]],
    ["Eng uzun tog' tizmasi (okean tubidagi) qaysi?","O'rta Atlantika tizmasi",["Ural","And","Himolay"]],
  ],
  flag_colors: [
    ["Qaysi davlat bayrog'ida chinor bargi tasvirlangan?","Kanada",["AQSh","Avstraliya","Irlandiya"]],
    ["Qaysi davlat bayrog'i kvadrat shaklida?","Shveysariya",["Avstriya","Belgiya","Polsha"]],
    ["Qaysi davlat bayrog'i to'rtburchak shaklida emas?","Nepal",["Butan","Shri-Lanka","Mo'g'uliston"]],
    ["Yaponiya bayrog'ida nima tasvirlangan?","Oq fonda qizil doira",["Yashil fonda qizil doira","Qizil fonda oq yulduz","Ko'k fonda quyosh"]],
    ["Bangladesh bayrog'i qanday ko'rinishda?","Yashil fonda qizil doira",["Oq fonda qizil doira","Qizil fonda sariq yulduz","Ko'k fonda oq xoch"]],
    ["Qaysi davlat bayrog'ida 50 ta yulduz bor?","AQSh",["Braziliya","Xitoy","Avstraliya"]],
    ["Xitoy bayrog'ida nechta yulduz bor?","5 ta",["1 ta","4 ta","7 ta"]],
    ["Turkiya bayrog'ida qanday belgilar bor?","Yarim oy va yulduz",["Xoch","Quyosh","Burgut"]],
    ["Janubiy Koreya bayrog'i markazidagi belgi nima deyiladi?","In-Yan",["Yulduz","Yarim oy","Quyosh diski"]],
    ["Qaysi ikki davlat bayrog'i faqat ranglar tartibi bilan farq qiladi?","Indoneziya va Polsha",["Italiya va Irlandiya","Rossiya va Fransiya","Chad va Kolumbiya"]],
    ["Skandinaviya davlatlari bayroqlarining umumiy belgisi nima?","Yon tomonga siljigan xoch",["Yulduz","Yarim oy","Uchburchak"]],
    ["Buyuk Britaniya bayrog'i nechta xochning birlashmasi?","3 ta",["1 ta","2 ta","4 ta"]],
    ["Argentina va Urugvay bayroqlarida qanday umumiy tasvir bor?","Quyosh",["Yarim oy","Xoch","Burgut"]],
    ["Italiya bayrog'i qaysi ranglardan iborat?","Yashil, oq, qizil",["Ko'k, oq, qizil","Qizil, sariq, yashil","Oq, ko'k, sariq"]],
    ["Rossiya bayrog'idagi ranglar tartibi qanday (yuqoridan pastga)?","Oq, ko'k, qizil",["Qizil, oq, ko'k","Ko'k, oq, qizil","Oq, qizil, ko'k"]],
    ["O'zbekiston bayrog'ida nechta yulduz bor?","12 ta",["5 ta","8 ta","14 ta"]],
    ["O'zbekiston bayrog'idagi yarim oy nimani anglatadi?","Yangi mustaqil davlatning tug'ilishini",["Dengizni","Tog'larni","Qishloq xo'jaligini"]],
    ["Braziliya bayrog'idagi yozuv qaysi tilda?","Portugal tilida",["Ispan tilida","Ingliz tilida","Fransuz tilida"]],
    ["Qaysi davlatlar bayroqlari deyarli bir xil — faqat nisbati bilan farq qiladi?","Ruminiya va Chad",["Yaponiya va Xitoy","Italiya va Fransiya","Turkiya va Tunis"]],
    ["Vetnam bayrog'ida nima tasvirlangan?","Qizil fonda sariq yulduz",["Oq fonda qizil doira","Yashil fonda yarim oy","Ko'k fonda oq xoch"]],
  ],
};

// mixed_bt uchun — hamma banklardan aralash
QUIZ_BANKS.mixed_bt = [
  ...QUIZ_BANKS.geo_records,
  ...QUIZ_BANKS.geo_bt,
  ...QUIZ_BANKS.continents,
  ...QUIZ_BANKS.stars_bt,
  ...QUIZ_BANKS.climate_bt,
];

// ─── per-kind quiz generatorlari ───────────────────────────
function genQuizForKind(kind, pool, ctx) {
  switch (kind) {
    case "flag_to_country": {
      const c = next(ctx, "country", pool);
      const sims = similarDistractors(c, 3, pool.length >= 8 ? pool : COUNTRIES);
      const opts = shuffle([c[0], ...sims.map(x => x[0])]);
      return {
        questionText: `Bu qaysi davlatning bayrog'i?`,
        options: opts,
        correctIndex: opts.indexOf(c[0]),
        imageUrl: flagUrl(c[1]),
        _key: `flag:${c[1]}`,
      };
    }
    case "country_to_flag": {
      const c = next(ctx, "country", pool);
      const sims = similarDistractors(c, 3, pool.length >= 8 ? pool : COUNTRIES);
      const all = shuffle([c, ...sims]);
      return {
        questionText: `${c[0]} bayrog'i qaysi?`,
        options: all.map(x => x[0]),
        optionImages: all.map(x => flagUrl(x[1])),
        correctIndex: all.findIndex(x => x[1] === c[1]),
        layout: "flag-grid",
        _key: `flag2:${c[1]}`,
      };
    }
    case "country_to_capital": {
      const c = next(ctx, "country", pool);
      const distractors = COUNTRIES.map(x => x[2]).filter(x => x !== c[2]);
      return buildQuiz(`${c[0]} davlatining poytaxti qaysi?`, c[2], distractors, { _key: `cap:${c[1]}` });
    }
    case "capital_to_country": {
      const c = next(ctx, "country", pool);
      const distractors = COUNTRIES.map(x => x[0]).filter(x => x !== c[0]);
      return buildQuiz(`${c[2]} qaysi davlatning poytaxti?`, c[0], distractors, { _key: `cap2:${c[1]}` });
    }
    case "country_to_continent": {
      const c = next(ctx, "country", pool);
      const distractors = Object.values(CONTINENT_NAMES);
      return buildQuiz(`${c[0]} qaysi materikda joylashgan?`, CONTINENT_NAMES[c[3]], distractors, { _key: `cont:${c[1]}` });
    }
    case "rivers": {
      const t = nextTpl(ctx, kind, 2);
      if (t === 0) {
        const r = next(ctx, "river", pool);
        return buildQuiz(`${r[0]} daryosi qaysi materikda oqadi?`, CONTINENT_NAMES[r[2]],
          Object.values(CONTINENT_NAMES), { _key: `river-cont:${r[0]}` });
      }
      const r = next(ctx, "river", pool);
      const distractors = pool.map(x => `${x[1]} km`).filter(x => x !== `${r[1]} km`);
      return buildQuiz(`${r[0]} daryosining uzunligi qancha?`, `${r[1]} km`, distractors, { _key: `river-len:${r[0]}` });
    }
    case "rivers_longest": {
      const t = nextTpl(ctx, kind, 3);
      if (t === 0) {
        const r = next(ctx, "river", pool);
        const distractors = pool.map(x => `${x[1]} km`).filter(x => x !== `${r[1]} km`);
        return buildQuiz(`${r[0]} daryosining uzunligi qancha?`, `${r[1]} km`, distractors, { _key: `river-len:${r[0]}` });
      }
      if (t === 1) {
        const four = pickN(pool, 4);
        const names = four.map(x => x[0]);
        const longest = four.reduce((x, y) => (y[1] > x[1] ? y : x));
        return buildQuiz(`${names.join(", ")} — qaysi biri eng uzun?`, longest[0], names,
          { _key: `river-cmp:${[...names].sort().join("-")}` });
      }
      const sorted = [...pool].sort((x, y) => y[1] - x[1]);
      const i = next(ctx, "river-rank", [0, 1, 2, 3, 4]);
      const r = sorted[i];
      return buildQuiz(`Uzunligi bo'yicha ${RANK_LABELS[i]} o'rindagi daryo qaysi?`, r[0],
        sorted.map(x => x[0]).filter(n => n !== r[0]), { _key: `river-rank:${i}` });
    }
    case "mountains": {
      const t = nextTpl(ctx, kind, 2);
      const m = next(ctx, "mount", pool);
      if (t === 0) {
        const distractors = pool.map(x => x[2]).filter(x => x !== m[2]);
        return buildQuiz(`${m[0]} cho'qqisi qaysi davlatda joylashgan?`, m[2], distractors, { _key: `mount-c:${m[0]}` });
      }
      const distractors = pool.map(x => `${x[1]} m`).filter(x => x !== `${m[1]} m`);
      return buildQuiz(`${m[0]} cho'qqisining balandligi qancha?`, `${m[1]} m`, distractors, { _key: `mount-h:${m[0]}` });
    }
    case "mountains_highest": {
      const t = nextTpl(ctx, kind, 3);
      if (t === 0) {
        const m = next(ctx, "mount", pool);
        const distractors = pool.map(x => `${x[1]} m`).filter(x => x !== `${m[1]} m`);
        return buildQuiz(`${m[0]} cho'qqisining balandligi qancha?`, `${m[1]} m`, distractors, { _key: `mount-h:${m[0]}` });
      }
      if (t === 1) {
        const four = pickN(pool, 4);
        const names = four.map(x => x[0]);
        const highest = four.reduce((x, y) => (y[1] > x[1] ? y : x));
        return buildQuiz(`${names.join(", ")} — qaysi biri eng baland?`, highest[0], names,
          { _key: `mount-cmp:${[...names].sort().join("-")}` });
      }
      const sorted = [...pool].sort((x, y) => y[1] - x[1]);
      const i = next(ctx, "mount-rank", [0, 1, 2, 3, 4]);
      const m = sorted[i];
      return buildQuiz(`Balandligi bo'yicha ${RANK_LABELS[i]} o'rindagi cho'qqi qaysi?`, m[0],
        sorted.map(x => x[0]).filter(n => n !== m[0]), { _key: `mount-rank:${i}` });
    }
    case "seas": {
      const t = nextTpl(ctx, kind, 2);
      const s = next(ctx, "sea", pool);
      if (t === 0) {
        const distractors = pool.map(x => x[1]).filter(x => x !== s[1]);
        return buildQuiz(`${s[0]} qaysi okean havzasiga kiradi?`, s[1], distractors, { _key: `sea:${s[0]}` });
      }
      const same = pool.filter(x => x[1] === s[1]).map(x => x[0]);
      const other = pool.filter(x => x[1] !== s[1]).map(x => x[0]);
      return buildQuiz(`Quyidagi dengizlardan qaysi biri ${s[1]} havzasiga kiradi?`, s[0], other,
        { _key: `sea-basin:${s[0]}` , _sameHint: same.length });
    }
    case "lakes": {
      const t = nextTpl(ctx, kind, 3);
      if (t === 0) {
        const l = next(ctx, "lake", pool);
        const distractors = pool.map(x => x[2]).filter(x => x !== l[2]);
        return buildQuiz(`${l[0]} ko'li qayerda joylashgan?`, l[2], distractors, { _key: `lake-loc:${l[0]}` });
      }
      if (t === 1) {
        const l = next(ctx, "lake", pool);
        const distractors = pool.map(x => `${x[1].toLocaleString()} km²`).filter(x => x !== `${l[1].toLocaleString()} km²`);
        return buildQuiz(`${l[0]} ko'lining maydoni qancha?`, `${l[1].toLocaleString()} km²`, distractors, { _key: `lake-area:${l[0]}` });
      }
      const four = pickN(pool, 4);
      const names = four.map(x => x[0]);
      const biggest = four.reduce((x, y) => (y[1] > x[1] ? y : x));
      return buildQuiz(`${names.join(", ")} — qaysi ko'l eng katta?`, biggest[0], names,
        { _key: `lake-cmp:${[...names].sort().join("-")}` });
    }
    case "deserts": {
      const t = nextTpl(ctx, kind, 2);
      const d = next(ctx, "desert", pool);
      if (t === 0) {
        const distractors = pool.map(x => x[2]).filter(x => x !== d[2]);
        return buildQuiz(`${d[0]} cho'li qayerda joylashgan?`, d[2], distractors, { _key: `desert-loc:${d[0]}` });
      }
      return buildQuiz(`${d[0]} cho'li qaysi materikda?`, CONTINENT_NAMES[d[1]] || "Osiyo",
        Object.values(CONTINENT_NAMES), { _key: `desert-cont:${d[0]}` });
    }
    case "oceans":
      return fromBank(ctx, "oceans", QUIZ_BANKS.oceans);
    case "continents": {
      const t = nextTpl(ctx, kind, 2);
      if (t === 0) return fromBank(ctx, "continents", QUIZ_BANKS.continents);
      const c = next(ctx, "continent", pool);
      const distractors = pool.map(x => `${x[1].toLocaleString()} km²`).filter(x => x !== `${c[1].toLocaleString()} km²`);
      return buildQuiz(`${c[0]} materigining maydoni qancha?`, `${c[1].toLocaleString()} km²`, distractors, { _key: `cont-area:${c[0]}` });
    }
    case "continents_size": {
      const sorted = [...pool].sort((a, b) => b[1] - a[1]);
      const t = nextTpl(ctx, kind, 3);
      if (t === 0) {
        const i = next(ctx, "cs-big", [0, 1, 2, 3, 4]);
        const c = sorted[i];
        return buildQuiz(`Maydoni bo'yicha ${superLabel(i, "katta")} materik qaysi?`, c[0],
          sorted.map(x => x[0]).filter(n => n !== c[0]), { _key: `cs-big:${i}` });
      }
      if (t === 1) {
        const i = next(ctx, "cs-small", [0, 1, 2]);
        const c = sorted[sorted.length - 1 - i];
        return buildQuiz(`Maydoni bo'yicha ${superLabel(i, "kichik")} materik qaysi?`, c[0],
          sorted.map(x => x[0]).filter(n => n !== c[0]), { _key: `cs-small:${i}` });
      }
      const four = pickN(pool, 4);
      const names = four.map(x => x[0]);
      const biggest = four.reduce((x, y) => (y[1] > x[1] ? y : x));
      return buildQuiz(`${names.join(", ")} — qaysi materik eng katta?`, biggest[0], names,
        { _key: `cs-cmp:${[...names].sort().join("-")}` });
    }
    case "volcanoes": {
      const t = nextTpl(ctx, kind, 2);
      const v = next(ctx, "volcano", pool);
      if (t === 0) {
        const distractors = pool.map(x => x[1]).filter(x => x !== v[1]);
        return buildQuiz(`${v[0]} vulqoni qaysi davlatda joylashgan?`, v[1], distractors, { _key: `volc:${v[0]}` });
      }
      const other = pool.filter(x => x[1] !== v[1]).map(x => x[0]);
      return buildQuiz(`Quyidagi vulqonlardan qaysi biri ${v[1]}da joylashgan?`, v[0], other, { _key: `volc-c:${v[0]}` });
    }
    case "islands": {
      const t = nextTpl(ctx, kind, 3);
      if (t === 0) {
        const i = next(ctx, "island", pool);
        const distractors = pool.map(x => `${x[1].toLocaleString()} km²`).filter(x => x !== `${i[1].toLocaleString()} km²`);
        return buildQuiz(`${i[0]} orolining maydoni qancha?`, `${i[1].toLocaleString()} km²`, distractors, { _key: `isl-area:${i[0]}` });
      }
      if (t === 1) {
        const four = pickN(pool, 4);
        const names = four.map(x => x[0]);
        const biggest = four.reduce((x, y) => (y[1] > x[1] ? y : x));
        return buildQuiz(`${names.join(", ")} — qaysi orol eng katta?`, biggest[0], names,
          { _key: `isl-cmp:${[...names].sort().join("-")}` });
      }
      const sorted = [...pool].sort((x, y) => y[1] - x[1]);
      const i = next(ctx, "isl-rank", [0, 1, 2, 3, 4]);
      const it = sorted[i];
      return buildQuiz(`Maydoni bo'yicha ${superLabel(i, "katta")} orol qaysi?`, it[0],
        sorted.map(x => x[0]).filter(n => n !== it[0]), { _key: `isl-rank:${i}` });
    }
    case "currencies": {
      const t = nextTpl(ctx, kind, 2);
      const c = next(ctx, "currency", pool);
      if (t === 0) {
        const distractors = pool.map(x => x[1]).filter(x => x !== c[1]);
        return buildQuiz(`${c[0]} qaysi davlatning pul birligi?`, c[1], distractors, { _key: `cur:${c[0]}` });
      }
      const distractors = pool.map(x => x[0]).filter(x => x !== c[0]);
      return buildQuiz(`${c[1]} davlatining pul birligi qaysi?`, c[0], distractors, { _key: `cur2:${c[1]}` });
    }
    case "uzbekistan":
      return fromBank(ctx, "uzbekistan", QUIZ_BANKS.uzbekistan);
    case "geo_records":
      return fromBank(ctx, "geo_records", QUIZ_BANKS.geo_records);
    case "flag_colors":
      return fromBank(ctx, "flag_colors", QUIZ_BANKS.flag_colors);
    case "climate_bt":
      return fromBank(ctx, "climate_bt", QUIZ_BANKS.climate_bt);
    case "peninsulas_bt":
      return fromBank(ctx, "peninsulas_bt", QUIZ_BANKS.peninsulas_bt);
    case "population_bt":
      return fromBank(ctx, "population_bt", QUIZ_BANKS.population_bt);
    case "stars_bt":
      return fromBank(ctx, "stars_bt", QUIZ_BANKS.stars_bt);
    case "geo_bt":
      return fromBank(ctx, "geo_bt", QUIZ_BANKS.geo_bt);
    default:
      return fromBank(ctx, "mixed_bt", QUIZ_BANKS.mixed_bt);
  }
}

// Emoji + yozuvli SVG rasm (haqiqiy foto bo'lmagan mavzular uchun)
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

// ─── Bosh qotirma (to'g'ri/noto'g'ri) banklari ───────────────
const BT_BANKS = {
  uzbekistan: [
    ["O'zbekiston poytaxti — Toshkent.", true],
    ["O'zbekistonda 14 ta viloyat bor.", false, "Aslida 12 ta viloyat va Qoraqalpog'iston Respublikasi."],
    ["Amudaryo Orol dengiziga quyiladi.", true],
    ["Qoraqalpog'iston poytaxti — Xiva.", false, "Aslida Nukus."],
    ["O'zbekiston Markaziy Osiyodagi davlatdir.", true],
    ["O'zbekiston dengiz bilan chegaradosh.", false, "O'zbekiston quruqlik bilan o'ralgan davlat."],
    ["Buxoro tarixiy shahar hisoblanadi.", true],
    ["O'zbekistondagi eng baland cho'qqi — Hazrati Sulton.", true],
    ["Zarafshon daryosi Sirdaryoga quyiladi.", false, "U Amudaryo havzasiga oqib boradi."],
    ["Toshkent — Markaziy Osiyodagi eng katta shahar.", true],
    ["Qizilqum cho'li Tojikistonda joylashgan.", false, "Asosiy qismi O'zbekistonda."],
    ["Surxondaryo viloyati mamlakatning janubida joylashgan.", true],
    ["O'zbekiston 5 ta davlat bilan chegaradosh.", true],
    ["Registon maydoni Buxoroda joylashgan.", false, "Registon — Samarqandda."],
    ["Ichan qal'a Xiva shahrida joylashgan.", true],
    ["Farg'ona vodiysida 3 ta viloyat bor.", true],
    ["O'zbekiston pul birligi — tenge.", false, "O'zbekiston pul birligi — so'm."],
    ["Aydarko'l — sun'iy paydo bo'lgan yirik ko'l.", true],
    ["Chorvoq suv ombori Toshkent viloyatida.", true],
    ["O'zbekiston maydoni 1 mln km² dan katta.", false, "Maydoni taxminan 448 900 km²."],
  ],
  geo_records: [
    ["Everest — dunyodagi eng baland tog'.", true],
    ["Amazonka — dunyodagi eng uzun daryo.", false, "Nil daryosi (6650 km) eng uzun hisoblanadi."],
    ["Sahroyi Kabir — Afrikadagi eng katta cho'l.", true],
    ["Baykal — dunyodagi eng chuqur ko'l.", true],
    ["Avstraliya — eng katta materik.", false, "Eng katta materik — Osiyo."],
    ["Grenlandiya — dunyodagi eng katta orol.", true],
    ["Atlantika — eng katta okean.", false, "Eng katta — Tinch okean."],
    ["Mariana botig'i — okeandagi eng chuqur joy.", true],
    ["Antarktida — eng sovuq materik.", true],
    ["Kaspiy — dunyodagi eng katta yopiq suv havzasi.", true],
    ["Niagara — dunyodagi eng baland sharshara.", false, "Eng balandi — Anxel sharsharasi (Venesuela)."],
    ["Vatikan — aholisi eng oz davlat.", true],
    ["And tog'lari — quruqlikdagi eng uzun tog' tizmasi.", true],
    ["Rossiya — maydoni eng katta davlat.", true],
    ["Xitoy — aholisi eng ko'p davlat.", false, "Bugungi kunda Hindiston birinchi o'rinda."],
    ["Amazonka o'rmonlari — dunyodagi eng katta tropik o'rmon.", true],
    ["Indoneziya — eng ko'p oroldan iborat davlat.", true],
    ["La-Pas — dunyodagi eng baland joylashgan poytaxt.", true],
    ["Arabiston — dunyodagi eng katta yarim orol.", true],
    ["Gobi — dunyodagi eng quruq cho'l.", false, "Eng quruq cho'l — Atakama."],
  ],
  climate_bt: [
    ["Ekvator yaqinida iqlim issiq va nam.", true],
    ["Antarktidada doimiy tropik iqlim mavjud.", false, "Antarktida — eng sovuq materik."],
    ["Sahroyi Kabirda kunduz juda issiq, kechasi sovuq bo'ladi.", true],
    ["Tundra iqlimi qutbga yaqin hududlarda uchraydi.", true],
    ["Yamayka qutb iqlim mintaqasida joylashgan.", false, "U tropik iqlim mintaqasida."],
    ["Musson shamollari Janubiy Osiyoga xos.", true],
    ["Tayga — igna bargli o'rmonlar mintaqasi.", true],
    ["Savanna iqlimi Yevropada keng tarqalgan.", false, "Savanna asosan Afrika va Janubiy Amerikada."],
    ["Balandlik ortgan sari havo harorati pasayadi.", true],
    ["O'zbekiston iqlimi keskin kontinental.", true],
    ["Ob-havo hodisalari stratosferada sodir bo'ladi.", false, "Ob-havo troposferada shakllanadi."],
    ["Atmosfera bosimi barometr bilan o'lchanadi.", true],
    ["Havo namligini termometr o'lchaydi.", false, "Namlikni gigrometr o'lchaydi."],
    ["Ekvatorial mintaqada yog'ingarchilik eng ko'p bo'ladi.", true],
    ["Global isishga karbonat angidrid ko'payishi sabab bo'lmoqda.", true],
    ["Passat shamollari faqat qutblarda esadi.", false, "Passatlar tropik mintaqada esadi."],
  ],
  peninsulas_bt: [
    ["Arabiston yarim oroli Osiyoda joylashgan.", true],
    ["Apennin yarim oroli — Italiya.", true],
    ["Kamchatka yarim oroli Afrikada.", false, "U Rossiyaning Uzoq Sharqida."],
    ["Pireney yarim orolida Ispaniya va Portugaliya joylashgan.", true],
    ["Skandinaviya yarim orolida Shvetsiya va Norvegiya bor.", true],
    ["Hindiston yarim oroli Janubiy Osiyoda.", true],
    ["Florida yarim oroli AQShda joylashgan.", true],
    ["Bolqon yarim oroli Janubiy Amerikada.", false, "Bolqon — Janubi-Sharqiy Yevropada."],
    ["Koreya yarim orolida ikkita davlat joylashgan.", true],
    ["Yutlandiya yarim oroli asosan Daniyaga tegishli.", true],
    ["Krim yarim oroli Qora dengizda joylashgan.", true],
    ["Malakka yarim oroli Yevropada.", false, "U Janubi-Sharqiy Osiyoda."],
    ["Labrador yarim oroli Kanadada.", true],
    ["Somali yarim oroli Osiyoda joylashgan.", false, "U Afrikaning sharqida."],
    ["Anatoliya yarim oroli Turkiya hududida.", true],
  ],
  population_bt: [
    ["Hindiston aholisi 1 mlrd dan ortiq.", true],
    ["O'zbekiston aholisi 36 mln atrofida.", true],
    ["Vatikan dunyodagi eng kichik davlat.", true],
    ["Monako Afrikada joylashgan.", false, "U Yevropada — Fransiya yaqinida."],
    ["Xitoy va Hindiston dunyodagi eng ko'p aholili davlatlar.", true],
    ["Tokio — dunyodagi eng yirik aglomeratsiya.", true],
    ["AQSh aholisi 50 mln atrofida.", false, "Aslida 330 mln dan ortiq."],
    ["Nigeriya — Afrikadagi eng ko'p aholili davlat.", true],
    ["Rossiya — Yevropadagi eng ko'p aholili davlat.", true],
    ["Braziliya — Janubiy Amerikadagi eng ko'p aholili davlat.", true],
    ["Dunyo aholisi 8 mlrd dan oshdi.", true],
    ["Kanadada aholi zichligi juda yuqori.", false, "Kanada — aholi zichligi eng past davlatlardan biri."],
    ["Singapurda aholi zichligi juda yuqori.", true],
    ["O'zbekiston — Markaziy Osiyodagi eng ko'p aholili davlat.", true],
    ["Urbanizatsiya — aholining qishloqqa ko'chishi.", false, "Urbanizatsiya — shaharlarda yashovchilar ulushining ortishi."],
  ],
  continents: [
    ["Osiyo eng katta materik.", true],
    ["Antarktida eng kichik materik.", false, "Eng kichik — Avstraliya."],
    ["Yevropa va Osiyo birgalikda Yevrosiyoni tashkil etadi.", true],
    ["Afrika ekvator chizig'ini kesib o'tadi.", true],
    ["Janubiy va Shimoliy Amerika Panama bo'yni bilan tutashgan.", true],
    ["Avstraliya bir vaqtning o'zida ham materik, ham davlat.", true],
    ["Yevropa Osiyodan kattaroq.", false, "Osiyo Yevropadan deyarli 4,5 marta katta."],
    ["Antarktidada doimiy aholi yashamaydi.", true],
    ["Afrikada eng ko'p davlat joylashgan.", true],
    ["Suvaysh kanali Afrika va Osiyoni ajratadi.", true],
    ["Ural tog'lari Yevropa va Osiyo chegarasidan o'tadi.", true],
    ["Aholisi eng ko'p materik — Afrika.", false, "Aholisi eng ko'p materik — Osiyo."],
    ["Antarktidada Janubiy qutb joylashgan.", true],
    ["Himolay tog'lari Yevropada.", false, "Himolay — Osiyoda."],
  ],
  oceans: [
    ["Tinch okean dunyodagi eng katta okean.", true],
    ["Kaspiy — eng katta yopiq suv havzasi.", true],
    ["Qora dengiz Atlantika havzasiga kiradi.", true],
    ["Orol dengizi Yevropada joylashgan.", false, "U Markaziy Osiyoda."],
    ["O'rta yer dengizi Afrika va Yevropa o'rtasida joylashgan.", true],
    ["Shimoliy Muz okeani eng issiq okean.", false, "Aksincha — eng sovuq okean."],
    ["Mariana botig'i Tinch okeanda joylashgan.", true],
    ["Janubiy okean Antarktida atrofini o'rab turadi.", true],
    ["Qizil dengiz Hind okeani havzasiga kiradi.", true],
    ["Panama kanali Tinch va Atlantika okeanlarini bog'laydi.", true],
    ["Bering bo'g'ozi Osiyo va Amerikani ajratib turadi.", true],
    ["Okeanlar Yer yuzasining 30% ini egallaydi.", false, "Aslida taxminan 71% ini."],
    ["Gulfstrim — Atlantika okeanidagi iliq oqim.", true],
    ["Karib dengizi Tinch okean havzasiga kiradi.", false, "U Atlantika havzasiga kiradi."],
  ],
  lakes: [
    ["Baykal — dunyodagi eng chuqur ko'l.", true],
    ["Viktoriya ko'li — Afrikadagi eng katta ko'l.", true],
    ["Orol dengizi aslida ko'l hisoblanadi.", true],
    ["Titikaka ko'li Afrikada joylashgan.", false, "U Janubiy Amerikada (Peru va Boliviya)."],
    ["Issiqko'l Qirg'izistonda joylashgan.", true],
    ["Kaspiy — maydoni bo'yicha eng katta ko'l.", true],
    ["Balxash ko'li Qozog'istonda.", true],
    ["Yuqori ko'l (Superior) Yevropada joylashgan.", false, "U Shimoliy Amerikada — AQSh va Kanada chegarasida."],
    ["Aydarko'l O'zbekistonda joylashgan.", true],
    ["Ladoga ko'li Rossiyada.", true],
    ["Tanganika — Afrikadagi chuqur ko'llardan biri.", true],
    ["Michigan ko'li Avstraliyada.", false, "U AQShda joylashgan."],
    ["Orol dengizi suvi keskin kamayib ketgan.", true],
    ["Baykal ko'li chuchuk suvli.", true],
  ],
  deserts: [
    ["Sahroyi Kabir — Afrikadagi eng katta cho'l.", true],
    ["Atakama — dunyodagi eng quruq cho'l.", true],
    ["Qoraqum cho'li Turkmanistonda.", true],
    ["Gobi cho'li Janubiy Amerikada.", false, "Aslida Mo'g'uliston va Xitoyda."],
    ["Qizilqum O'zbekiston va Qozog'iston hududida.", true],
    ["Namib cho'li Afrikada joylashgan.", true],
    ["Mojave cho'li AQShda.", true],
    ["Taklamakan cho'li Yevropada.", false, "U Xitoyda joylashgan."],
    ["Kalaxari cho'li Janubiy Afrikada.", true],
    ["Buyuk Viktoriya cho'li Avstraliyada.", true],
    ["Patagoniya cho'li Argentinada.", true],
    ["Cho'llarda kunduz va kecha harorati keskin farq qiladi.", true],
    ["Arab cho'li Yevropada joylashgan.", false, "U Arabiston yarim orolida — Osiyoda."],
    ["Tor cho'li Hindiston va Pokiston hududida.", true],
  ],
  volcanoes: [
    ["Fudziyama — Yaponiyadagi vulqon.", true],
    ["Vezuviy Italiyada joylashgan.", true],
    ["Etna — Yevropadagi eng faol vulqonlardan biri.", true],
    ["Kilimanjaro Janubiy Amerikada.", false, "U Afrikada (Tanzaniya)."],
    ["Krakatau Indoneziyada joylashgan.", true],
    ["Popokatepetl Meksikada.", true],
    ["Mauna-Loa AQShda (Gavayi) joylashgan.", true],
    ["Yelloustoun — Rossiyadagi vulqon.", false, "Yelloustoun AQShda joylashgan."],
    ["Tambora Indoneziyada joylashgan.", true],
    ["Klyuchevskaya sopkasi Kamchatkada.", true],
    ["Sent-Xelens AQShda joylashgan.", true],
    ["Vezuviy Pompey shahrini ko'mib yuborgan.", true],
    ["Vulqonlar faqat okean tubida bo'ladi.", false, "Vulqonlar quruqlikda ham, okean tubida ham uchraydi."],
    ["Etna Sitsiliya orolida joylashgan.", true],
  ],
  islands: [
    ["Grenlandiya — dunyodagi eng katta orol.", true],
    ["Madagaskar Hind okeanida joylashgan.", true],
    ["Yangi Gvineya — ikkinchi eng katta orol.", true],
    ["Islandiya Tinch okeanida.", false, "U Atlantika okeanida."],
    ["Kalimantan oroli bir necha davlatga tegishli.", true],
    ["Xonsyu — Yaponiyaning eng katta oroli.", true],
    ["Kuba Karib dengizida joylashgan.", true],
    ["Saxalin oroli Rossiyaga tegishli.", true],
    ["Sumatra Indoneziyaning oroli.", true],
    ["Buyuk Britaniya oroli Yevropada joylashgan.", true],
    ["Yava oroli aholisi juda zich orollardan biri.", true],
    ["Baffin oroli Avstraliyada.", false, "U Kanadada joylashgan."],
    ["Irlandiya oroli Atlantika okeanida.", true],
    ["Hokkaydo — Yaponiyaning shimoliy oroli.", true],
  ],
  currencies: [
    ["Yaponiyaning pul birligi — iyena.", true],
    ["AQSh pul birligi — dollar.", true],
    ["O'zbekiston pul birligi — so'm.", true],
    ["Germaniya pul birligi — frank.", false, "Aslida — yevro."],
    ["Buyuk Britaniya pul birligi — funt sterling.", true],
    ["Hindiston pul birligi — yuan.", false, "Aslida — rupiya (yuan — Xitoy pul birligi)."],
    ["Qozog'iston pul birligi — tenge.", true],
    ["Tojikiston pul birligi — somoni.", true],
    ["Rossiya pul birligi — rubl.", true],
    ["Turkiya pul birligi — dinor.", false, "Turkiya pul birligi — lira."],
    ["Shveysariya pul birligi — frank.", true],
    ["Braziliya pul birligi — real.", true],
    ["Polsha pul birligi — yevro.", false, "Polsha pul birligi — zloti."],
    ["Gruziya pul birligi — lari.", true],
  ],
  flag_colors: [
    ["Yaponiya bayrog'ida faqat qizil va oq ranglar bor.", true],
    ["Italiya bayrog'i — yashil, oq, qizil vertikal yo'llardan iborat.", true],
    ["Rossiya bayrog'i tartibi — qizil, oq, ko'k (yuqoridan pastga).", false, "Aslida: oq–ko'k–qizil."],
    ["Turkiya bayrog'ida yarim oy va yulduz bor.", true],
    ["Kanada bayrog'ida palma bargi tasvirlangan.", false, "Aslida — chinor (klyon) bargi."],
    ["Indoneziya va Polsha bayroqlari bir xil ikkita rangdan iborat, faqat tartibi teskari.", true],
    ["Ruminiya va Chad bayroqlarini farqlash juda qiyin.", true],
    ["Niderlandiya bayrog'i — qizil, oq, ko'k gorizontal yo'llar.", true],
    ["Lyuksemburg va Niderlandiya bayroqlari deyarli bir xil ko'rinadi.", true],
    ["Sloveniya, Slovakiya va Rossiya bayroqlarida bir xil 3 rang bor.", true],
    ["Vetnam bayrog'ida qizil fonda sariq yulduz bor.", true],
    ["Xitoy bayrog'ida 1 ta katta va 4 ta kichik yulduz bor.", true],
    ["Yaponiya va Bangladesh bayroqlarining ikkalasida ham fon yashil.", false, "Yaponiya — oq fonda, Bangladesh — yashil fonda."],
    ["Avstraliya va Yangi Zelandiya bayroqlarida Buyuk Britaniya bayrog'i tasviri bor.", true],
    ["AQSh bayrog'idagi yulduzlar soni shtatlar soniga teng — 50 ta.", true],
    ["AQSh bayrog'idagi yo'llar soni — 13 ta.", true],
    ["Shveysariya bayrog'i to'rtburchak shaklida.", false, "Shveysariya va Vatikan bayroqlari kvadrat shaklida."],
    ["Nepal bayrog'i to'rtburchak emas.", true],
    ["Senegal, Mali va Gvineya bayroqlarida yashil, sariq, qizil ranglar bor.", true],
    ["Pokiston bayrog'ida yarim oy oq fon ustida.", false, "Yashil fon ustida, chap tomonda oq yo'l bor."],
    ["Janubiy Koreya bayrog'ida In-Yan belgisi bor.", true],
    ["Buyuk Britaniya bayrog'i 3 ta xochning birlashmasi.", true],
    ["Argentina va Urugvay bayroqlarida Quyosh tasviri bor.", true],
    ["Skandinaviya davlatlari bayroqlarida yon tomonga siljigan xoch bor.", true],
    ["O'zbekiston bayrog'ida 12 ta yulduz bor.", true],
    ["O'zbekiston bayrog'ida burgut tasvirlangan.", false, "Bayroqda yarim oy va 12 ta yulduz bor."],
  ],
  stars_bt: [
    ["Quyosh tizimida 8 ta sayyora bor.", true],
    ["Quyosh g'arbdan chiqadi.", false, "Quyosh sharqdan chiqadi."],
    ["Oy — Yerning tabiiy yo'ldoshi.", true],
    ["Yer Quyosh atrofini 365 kunda aylanib chiqadi.", true],
    ["Yer o'z o'qi atrofida 12 soatda aylanadi.", false, "Aslida taxminan 24 soatda."],
    ["Quyosh — yulduz.", true],
    ["Mars 'Qizil sayyora' deb ataladi.", true],
    ["Yupiter — Quyosh tizimidagi eng katta sayyora.", true],
    ["Merkuriy Quyoshga eng yaqin sayyora.", true],
    ["Grinvich meridiani 0° geografik uzunlik hisoblanadi.", true],
    ["Ekvator 0° kenglikda joylashgan.", true],
    ["Yer o'qining og'ishi fasllar almashinuviga sabab bo'ladi.", true],
    ["Yerning shakli ideal shar.", false, "Yer — geoid: qutblarda biroz siqilgan."],
    ["Qutb yulduzi shimolni topishga yordam beradi.", true],
    ["Parallellar geografik uzunlikni ko'rsatadi.", false, "Parallellar kenglikni, meridianlar uzunlikni ko'rsatadi."],
  ],
  geo_bt: [
    ["Ural tog'lari Yevropa va Osiyo chegarasidan o'tadi.", true],
    ["Suvaysh kanali Afrika va Osiyoni ajratadi.", true],
    ["Panama bo'yni Shimoliy va Janubiy Amerikani tutashtiradi.", true],
    ["Gibraltar bo'g'ozi Yevropa va Afrikani ajratadi.", true],
    ["Bering bo'g'ozi Osiyo va Shimoliy Amerika o'rtasida.", true],
    ["Turkiya bir vaqtda ham Yevropa, ham Osiyoda joylashgan.", true],
    ["Misr faqat Yevropada joylashgan.", false, "Misr — Afrika va Osiyoda (Sinay yarim oroli)."],
    ["Bosfor bo'g'ozi Istanbulni ikkiga bo'ladi.", true],
    ["Kanada va AQSh o'rtasidagi chegara dunyodagi eng uzun quruqlik chegarasi.", true],
    ["O'zbekiston 5 ta davlat bilan chegaradosh.", true],
    ["Mo'g'ulistonning dengizga chiqishi bor.", false, "Mo'g'uliston quruqlik bilan o'ralgan davlat."],
    ["Xaritada ko'k rang suv havzalarini bildiradi.", true],
    ["Kompas strelkasi janubni ko'rsatadi.", false, "Kompas strelkasi shimolni ko'rsatadi."],
    ["Masshtab xaritaning kichraytirish darajasini bildiradi.", true],
    ["Xaritada jigarrang rang tog'larni bildiradi.", true],
  ],
};

BT_BANKS.mixed_bt = [
  ...BT_BANKS.geo_records,
  ...BT_BANKS.geo_bt,
  ...BT_BANKS.continents,
  ...BT_BANKS.stars_bt,
  ...BT_BANKS.climate_bt,
  ...BT_BANKS.oceans,
];

// ─── per-kind bosh_qotirma generatorlari ──────────────────
function genBTForKind(kind, pool, ctx) {
  const emoji = KIND_EMOJI[kind] || "🌍";
  switch (kind) {
    case "flag_to_country":
    case "country_to_flag": {
      // QIYIN rejim: yolg'on holatda — rasmdagi bayroqqa juda o'xshash
      // boshqa davlatning nomi beriladi.
      const shown = next(ctx, "country", pool);
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
        _key: `bt-flag:${shown[1]}`,
      };
    }
    case "country_to_capital":
    case "capital_to_country": {
      const a = next(ctx, "country", pool);
      const isTrue = Math.random() < 0.5;
      const others = pool.filter(x => x[2] !== a[2]);
      const b = isTrue ? a : (others.length ? pick(others) : a);
      return {
        ...buildBT(`Quyidagi bayroqdagi davlatning poytaxti — ${b[2]}.`, isTrue,
          isTrue ? `To'g'ri.` : `Noto'g'ri. Aslida ${a[0]} poytaxti — ${a[2]}.`),
        imageUrl: flagUrl(a[1]),
        _key: `bt-cap:${a[1]}`,
      };
    }
    case "country_to_continent": {
      const a = next(ctx, "country", pool);
      const isTrue = Math.random() < 0.5;
      const cont = isTrue ? a[3] : pick(Object.keys(CONTINENT_NAMES).filter(k => k !== a[3]));
      return {
        ...buildBT(`Bu bayroqdagi davlat ${CONTINENT_NAMES[cont]} materigida joylashgan.`, isTrue,
          isTrue ? `To'g'ri.` : `Noto'g'ri. Aslida ${CONTINENT_NAMES[a[3]]} materigida.`),
        imageUrl: flagUrl(a[1]),
        _key: `bt-cont:${a[1]}`,
      };
    }
    case "rivers":
    case "rivers_longest": {
      const t = nextTpl(ctx, `bt:${kind}`, 2);
      if (t === 0) {
        const r = next(ctx, "river", pool);
        const isTrue = Math.random() < 0.5;
        const delta = Math.floor(r[1] * (0.2 + Math.random() * 0.25)) * (Math.random() < 0.5 ? -1 : 1);
        const val = isTrue ? r[1] : Math.max(200, r[1] + delta);
        return { ...buildBT(`${r[0]} daryosining uzunligi ${val} km.`, isTrue,
          isTrue ? `To'g'ri.` : `Yo'q, aslida ${r[1]} km.`),
          imageUrl: emojiVisual(emoji, r[0]), _key: `bt-river:${r[0]}` };
      }
      const r = next(ctx, "river", pool);
      const isTrue = Math.random() < 0.5;
      const cont = isTrue ? r[2] : pick(Object.keys(CONTINENT_NAMES).filter(k => k !== r[2]));
      return { ...buildBT(`${r[0]} daryosi ${CONTINENT_NAMES[cont]} materigida oqadi.`, isTrue,
        isTrue ? `To'g'ri.` : `Yo'q, aslida ${CONTINENT_NAMES[r[2]]} materigida oqadi.`),
        imageUrl: emojiVisual(emoji, r[0]), _key: `bt-river-c:${r[0]}` };
    }
    case "mountains":
    case "mountains_highest": {
      const t = nextTpl(ctx, `bt:${kind}`, 2);
      const m = next(ctx, "mount", pool);
      const isTrue = Math.random() < 0.5;
      if (t === 0) {
        const delta = Math.floor(m[1] * (0.1 + Math.random() * 0.15)) * (Math.random() < 0.5 ? -1 : 1);
        const val = isTrue ? m[1] : Math.max(500, m[1] + delta);
        return { ...buildBT(`${m[0]} cho'qqisining balandligi ${val} m.`, isTrue,
          isTrue ? `To'g'ri.` : `Yo'q, aslida ${m[1]} m.`),
          imageUrl: emojiVisual(emoji, m[0]), _key: `bt-mount:${m[0]}` };
      }
      const others = pool.filter(x => x[2] !== m[2]);
      const country = isTrue ? m[2] : (others.length ? pick(others)[2] : m[2]);
      return { ...buildBT(`${m[0]} cho'qqisi ${country} hududida joylashgan.`, isTrue,
        isTrue ? `To'g'ri.` : `Yo'q, aslida ${m[2]} hududida.`),
        imageUrl: emojiVisual(emoji, m[0]), _key: `bt-mount-c:${m[0]}` };
    }
    case "seas": {
      const s = next(ctx, "sea", pool);
      const isTrue = Math.random() < 0.5;
      const others = pool.filter(x => x[1] !== s[1]);
      const basin = isTrue ? s[1] : (others.length ? pick(others)[1] : s[1]);
      return { ...buildBT(`${s[0]} ${basin} havzasiga kiradi.`, isTrue,
        isTrue ? `To'g'ri.` : `Yo'q, aslida ${s[1]} havzasiga kiradi.`),
        imageUrl: emojiVisual(emoji, s[0]), _key: `bt-sea:${s[0]}` };
    }
    default: {
      const bank = BT_BANKS[kind] || BT_BANKS.mixed_bt;
      const label = {
        uzbekistan: "O'zbekiston", geo_records: "Geografik rekordlar",
        climate_bt: "Iqlim", peninsulas_bt: "Yarim orollar",
        population_bt: "Aholi", continents: "Materiklar", continents_size: "Materiklar",
        oceans: "Okean / dengiz", lakes: "Ko'llar", deserts: "Cho'llar",
        volcanoes: "Vulqonlar", islands: "Orollar", currencies: "Pul birliklari",
        flag_colors: "Bayroq jumboqlari", stars_bt: "Yulduzli geografiya",
        geo_bt: "Qit'a chegaralari",
      }[kind] || "Geografiya";
      const img = kind === "uzbekistan" ? flagUrl("uz") : emojiVisual(emoji, label);
      return btFromBank(ctx, kind, bank, { imageUrl: img });
    }
  }
}

// continents_size uchun BT — materiklar banki
BT_BANKS.continents_size = BT_BANKS.continents;

// ─── Zaxira mavzular: asosiy mavzudan yetarli savol chiqmasa ────
const COUNTRY_KINDS = new Set([
  "flag_to_country", "country_to_flag", "country_to_capital",
  "capital_to_country", "country_to_continent",
]);

const QUIZ_FALLBACK = [
  ["geo_records", null], ["country_to_capital", COUNTRIES], ["capital_to_country", COUNTRIES],
  ["country_to_continent", COUNTRIES], ["flag_to_country", COUNTRIES],
  ["rivers", RIVERS], ["mountains", MOUNTAINS], ["currencies", CURRENCIES],
  ["geo_bt", null], ["stars_bt", null], ["climate_bt", null], ["population_bt", null],
];

const BT_FALLBACK = [
  ["geo_records", null], ["geo_bt", null], ["stars_bt", null], ["climate_bt", null],
  ["population_bt", null], ["peninsulas_bt", null], ["uzbekistan", null],
  ["flag_to_country", COUNTRIES], ["rivers", RIVERS], ["mountains", MOUNTAINS],
];

/** Savolni takrorlanishdan saqlash uchun taqqoslash kaliti. */
function dedupKey(q) {
  if (q._key) return q._key;
  const opts = Array.isArray(q.options) ? [...q.options].sort().join("~") : "";
  return `${q.questionText}|${q.imageUrl || ""}|${opts}`;
}

export function generateQuestions({ topicId, gameType, count = 10 }) {
  const topic = getTopicById(topicId);
  if (!topic) throw new Error("Mavzu topilmadi");

  const isBT = gameType === "bosh_qotirma";
  const gen = isBT ? genBTForKind : genQuizForKind;
  // Mavzu "tugab qolganda" avval xuddi shu turdagi savollarni kengroq
  // ro'yxatdan olamiz (masalan Skandinaviya bayroqlari → jahon bayroqlari),
  // shundagina boshqa mavzularga o'tamiz.
  const wide = COUNTRY_KINDS.has(topic.kind) && topic.pool !== COUNTRIES
    ? [[topic.kind, COUNTRIES]]
    : [];
  const fallbacks = [...wide, ...(isBT ? BT_FALLBACK : QUIZ_FALLBACK)];
  const ctx = makeCtx();

  const seen = new Set();
  const seenText = new Set();
  const out = [];

  const add = (q) => {
    const key = dedupKey(q);
    // Savol matni (+ rasmi) ham takrorlanmasin: bir xil ko'rinishdagi
    // savol o'yin ichida ikki marta chiqmasligi kerak.
    const textKey = `${q.questionText}|${q.imageUrl || ""}`;
    if (seen.has(key) || seenText.has(textKey)) return false;
    seen.add(key);
    seenText.add(textKey);
    const { _key, _sameHint, ...clean } = q;
    out.push({ id: out.length + 1, ...clean });
    return true;
  };

  // 1) Asosiy mavzudan — faqat takrorlanmaydigan savollar
  let tries = 0;
  while (out.length < count && tries < count * 25) {
    tries++;
    try { add(gen(topic.kind, topic.pool, ctx)); } catch { /* keyingi urinish */ }
  }

  // 2) Mavzu "tugab qolsa" — bir xil savolni takrorlash o'rniga
  //    yaqin mavzulardan qo'shamiz (savollar baribir har xil bo'ladi).
  let fi = 0;
  let fTries = 0;
  while (out.length < count && fTries < count * 40) {
    fTries++;
    const [kind, pool] = fallbacks[fi++ % fallbacks.length];
    try { add(gen(kind, pool, ctx)); } catch { /* keyingi mavzu */ }
  }

  // 3) Juda kam holatda (barcha banklar tugasa) — qolganini to'ldiramiz
  while (out.length < count) {
    const q = gen("mixed_bt", null, ctx);
    const { _key, _sameHint, ...clean } = q;
    out.push({ id: out.length + 1, ...clean });
  }

  return out;
}
