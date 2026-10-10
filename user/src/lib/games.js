// O'yinlar ro'yxati: nomi, ta'rifi, ikonkasi va kartadagi ranglari.
// `id` lar backend bilan bir xil (backend/src/lib/duels.js va gameCatalog.js).
//   race: true  — har kim o'z maydonida ochko yig'adi: 1 ga 1, jamoaviy va yolg'iz mashqda ishlaydi
//   topic: true — o'yindan oldin mavzu tanlanadi
import {
  Goal, Shield, Rocket, Crosshair, PartyPopper, Dribbble, Worm, Blocks, Bird, Footprints, Apple, Car, Hammer,
  Layers, Sparkles, ListOrdered, Grid2x2, Puzzle, Route, Zap, Keyboard, Calculator, Scale, Equal, Hash, Palette,
  Shuffle, Globe, Shapes, Brain, CircleHelp, X, CircleDot, Grid3x3, Scissors, Gamepad2,
} from "lucide-vue-next";

export const CATEGORIES = [
  { id: "shooter", label: "Otishma" },
  { id: "sport", label: "Sport va arkada" },
  { id: "brain", label: "Bosh qotirma" },
  { id: "know", label: "Bilim" },
  { id: "board", label: "Stol o'yinlari" },
];

const C = {
  shooter: [["#c62828", "#6a1010"], ["#4527a0", "#1a0f52"], ["#5d4037", "#2e1c16"], ["#0277bd", "#01426b"]],
  sport: [["#0f9d58", "#066b3a"], ["#ef6c00", "#8a3a0b"], ["#2e7d32", "#1b4d1f"], ["#1565c0", "#0b3a75"], ["#00838f", "#004d54"], ["#c98a45", "#7a4e1e"], ["#558b2f", "#2f5417"], ["#455a64", "#1f2d33"], ["#6d4c41", "#3b2620"]],
  brain: [["#1976d2", "#0d3c75"], ["#283593", "#141b52"], ["#00897b", "#004d43"], ["#b8860b", "#6b4d05"], ["#37474f", "#172026"], ["#1c4466", "#0b2238"], ["#d32f2f", "#7a1414"], ["#6a1b9a", "#3a0d57"]],
  know: [["#5e35b1", "#311b72"], ["#d8651c", "#8a3a0b"], ["#00796b", "#00433b"], ["#3949ab", "#1b2466"], ["#7b1fa2", "#430d5c"], ["#ad1457", "#600a30"], ["#f57c00", "#8a4300"], ["#0288d1", "#014a73"], ["#2e7d32", "#17431a"], ["#5d4037", "#2e1c16"]],
  board: [["#c2185b", "#6d0f34"], ["#1e5bd8", "#123a94"], ["#b07a35", "#6b4517"], ["#00838f", "#00474e"]],
};
let seen = {};
const g = (id, title, cat, icon, desc, rules, extra = {}) => {
  const n = (seen[cat] = (seen[cat] ?? -1) + 1);
  return { id, title, cat, icon, desc, rules, colors: C[cat][n % C[cat].length], race: false, ...extra };
};
const race = { race: true };

export const GAMES = [
  // ── Otishma ──
  g("tank", "Tank jangi", "shooter", Shield, "Dushman tanklarini yo'q qiling. Kim ko'proq ursa — o'sha g'olib.", "Strelkalar yoki WASD — yurish, Probel — o'q otish. Telefonda ekrandagi tugmalar.", race),
  g("shooter", "Kosmik otishma", "shooter", Rocket, "Kosmik kemada dushman kemalari va asteroidlarni urib tushiring.", "Kemani sichqoncha yoki barmoq bilan suring. O'q o'zi otiladi. 3 ta jon.", race),
  g("target", "Nishonga otish", "shooter", Crosshair, "Tirdagi harakatlanuvchi nishonlarni aniq uring.", "Nishonni bosing: markaz — 10, cheti — 5 ochko. Bo'sh joyga otsangiz −2.", race),
  g("balloon", "Sharlarni yorish", "shooter", PartyPopper, "Uchib chiqayotgan sharlarni tez yoring.", "Rangli sharni bosing (+10). Qora sharga tegmang — u −20.", race),
  // ── Sport va arkada ──
  g("penalty", "Penalti", "sport", Goal, "Navbat bilan zarba: biri tepadi, ikkinchisi darvozada turadi. 5 tadan zarba.", "Darvozaning 6 qismidan birini tanlang. Darvozabon o'sha tomonga sakrasa — to'pni qaytaradi."),
  g("basket", "Basketbol", "sport", Dribbble, "To'pni savatga tashlang. Kuchni to'g'ri tanlash kerak.", "Kuch chizig'i yashil qismga kelganda bosing. Aniq o'rtasi — 30 ochko.", race),
  g("snake", "Ilon", "sport", Worm, "Olma yeb, ilonni o'stiring. Kim ko'proq olma yesa — yutadi.", "Strelkalar yoki barmoq bilan surish. Devorga va o'z dumingizga urilmang.", race),
  g("breakout", "G'isht sindirish", "sport", Blocks, "To'pni taxtacha bilan qaytarib, g'ishtlarni sindiring.", "Taxtachani sichqoncha yoki barmoq bilan suring. 3 ta to'p.", race),
  g("flappy", "Uchar qush", "sport", Bird, "Qushni ustunlar orasidan olib o'ting.", "Bosing yoki Probel — qush qanot qoqadi. Har ustun — 10 ochko. 3 ta jon.", race),
  g("runner", "To'siqlardan sakrash", "sport", Footprints, "Cho'lda yugurib, tosh va kaktuslardan sakrab o'ting.", "Bosing yoki Probel — sakrash, havoda yana bossangiz — ikkinchi sakrash.", race),
  g("catcher", "Mevalarni tutish", "sport", Apple, "Daraxtdan tushayotgan mevalarni savatga yig'ing.", "Savatni suring. Meva +10, tosh tushsa — jon ketadi.", race),
  g("racer", "Poyga", "sport", Car, "Uch yo'lakli yo'lda mashinalarni quvib o'ting.", "Ekranning chap yoki o'ng tomonini bosing (yoki ← →). 3 ta jon.", race),
  g("whack", "Ko'rsichqon", "sport", Hammer, "Teshikdan chiqqan ko'rsichqonni tez uring.", "Ko'rsichqon +10. Bombaga tegsangiz −15.", race),
  // ── Bosh qotirma ──
  g("memory", "Xotira: bayroqlar", "brain", Layers, "Bir xil bayroqlar juftini toping. Kim birinchi hammasini ochsa — g'olib.", "Ikkita kartani oching: bir xil bo'lsa ochiq qoladi, aks holda yopiladi.", race),
  g("simon", "Ketma-ketlikni esla", "brain", Sparkles, "Yongan ranglar tartibini eslab qoling va takrorlang.", "Har bosqichda bitta rang qo'shiladi. 3 ta xatoda o'yin tugaydi.", race),
  g("schulte", "Raqamlar tartibi", "brain", ListOrdered, "1 dan 16 gacha raqamlarni tartib bilan tez toping.", "Raqamlarni o'sish tartibida bosing. To'liq jadval — qo'shimcha 30 ochko.", race),
  g("g2048", "2048", "brain", Grid2x2, "Bir xil raqamlarni qo'shib, katta raqam yig'ing.", "Strelkalar yoki barmoq bilan suring. Ochko — qo'shilgan raqamlar yig'indisi.", race),
  g("slide", "Sirpanchiq boshqotirma", "brain", Puzzle, "Raqamlarni surib, 1 dan 8 gacha tartibga keltiring.", "Bo'sh katak yonidagi raqamni bosing. Har yechilgan jadval — 100 ochko.", race),
  g("maze", "Labirint", "brain", Route, "Labirintdan chiqish yo'lini toping.", "Strelkalar yoki surish. Bayroqchaga yetsangiz — 50 ochko va labirint kattalashadi.", race),
  g("reaction", "Reaksiya tezligi", "brain", Zap, "Maydon yashil bo'lishi bilan bosing — kim tezroq?", "Yashil bo'lmasdan bossangiz −10. Qancha tez — shuncha ko'p ochko.", race),
  g("typing", "Tez yozish", "brain", Keyboard, "Geografiyaga oid so'zlarni xatosiz va tez yozing.", "So'zni to'liq yozing — keyingisi chiqadi. Uzun so'z — ko'proq ochko.", race),
  // ── Bilim ──
  g("quiz", "Bilimlar jangi", "know", Brain, "Tanlangan mavzudan 8 ta savol. To'g'ri va tez javob — ko'proq ball.", "Har bir savolga 15 soniya. Qancha tez javob bersangiz, shuncha ko'p ball.", { topic: true }),
  g("truefalse", "Bosh qotirma: to'g'ri yoki noto'g'ri", "know", CircleHelp, "Gap to'g'rimi yoki noto'g'ri? Mavzuni tanlang va do'stingizdan o'zib keting.", "Har bir gapga 15 soniya. To'g'ri javob — 10 ball va tezlik uchun qo'shimcha.", { topic: true }),
  g("math", "Tez hisob", "know", Calculator, "Misollarni kim tezroq va ko'proq yechadi?", "To'g'ri javob +10 (ketma-ket bo'lsa qo'shimcha), xato −5.", race),
  g("mathtf", "Hisob: to'g'rimi?", "know", Equal, "Tenglik to'g'ri yozilganmi yoki yo'q — tez aniqlang.", "To'g'ri javob +10, xato −5.", race),
  g("compare", "Qaysi biri katta?", "know", Scale, "Ikki misoldan qiymati kattasini tanlang.", "To'g'ri javob +10, xato −5.", race),
  g("sequence", "Ketma-ketlikni davom ettir", "know", Hash, "Sonlar qonuniyatini toping va keyingisini ayting.", "To'g'ri javob +10, xato −5. Savollar asta-sekin qiyinlashadi.", race),
  g("stroop", "Rang va so'z", "know", Palette, "So'z qaysi rangda yozilgan? Diqqat sinovi.", "So'zning ma'nosiga emas, rangiga qarang. To'g'ri +10, xato −5.", race),
  g("anagram", "Harflarni tartibla", "know", Shuffle, "Aralashgan harflardan geografik so'zni toping.", "To'g'ri so'zni tanlang: +10, xato −5.", race),
  g("continent", "Davlat qaysi qit'ada?", "know", Globe, "Davlat nomi chiqadi — u joylashgan qit'ani toping.", "To'g'ri javob +10, xato −5.", race),
  g("oddone", "Ortiqchasini top", "know", Shapes, "To'rttadan biri boshqalariga o'xshamaydi: daryo, tog', cho'l...", "Ortiqchasini tanlang: +10, xato −5.", race),
  // ── Stol o'yinlari ──
  g("tictactoe", "X-O", "board", X, "Klassik X-O. Uchta belgini bir qatorga qo'ying. 2 ta g'alabagacha.", "Navbat bilan yurasiz, har bir yurishga 20 soniya."),
  g("connect4", "To'rt qator", "board", CircleDot, "Toshni ustunga tashlang. Birinchi bo'lib 4 tasini bir qatorga tering.", "Ustunni tanlang — tosh pastga tushadi. Yurishga 25 soniya."),
  g("gomoku", "Besh qator", "board", Grid3x3, "10×10 taxtada birinchi bo'lib 5 ta toshni bir qatorga tering.", "Navbat bilan istalgan bo'sh katakka tosh qo'ying. Yurishga 25 soniya."),
  g("rps", "Tosh-qaychi-qog'oz", "board", Scissors, "Kim raqibining tanlovini to'g'ri taxmin qiladi? 3 ta g'alabagacha.", "Ikkalangiz bir vaqtda tanlaysiz: tosh qaychini, qaychi qog'ozni, qog'oz toshni yengadi."),
];

export const TEAM_GAMES = GAMES.filter(x => x.race);
export const gameById = id => GAMES.find(x => x.id === id) ?? { id, title: id, icon: Gamepad2, cat: "sport", colors: ["#00897b", "#00574b"], rules: "", desc: "" };
