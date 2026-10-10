// 1 ga 1 o'yinlar ro'yxati: nomi, ta'rifi va kartadagi ko'rinishi.
// `id` lar backenddagi DUEL_GAMES (backend/src/lib/duels.js) bilan bir xil.
export const GAMES = [
  {
    id: "penalty", title: "Penalti", emoji: "⚽", tag: "Sport",
    desc: "Navbat bilan zarba: biri tepadi, ikkinchisi darvozada turadi. 5 tadan zarba.",
    rules: "Darvozaning 6 qismidan birini tanlang. Darvozabon o'sha tomonga sakrasa — to'pni qaytaradi.",
    colors: ["#0f9d58", "#066b3a"], solo: false,
  },
  {
    id: "tank", title: "Tank jangi", emoji: "🪖", tag: "Jang",
    desc: "90 soniya ichida kim ko'proq dushman tankini yo'q qilsa — o'sha g'olib.",
    rules: "Strelkalar yoki WASD — yurish, Probel — o'q otish. Telefonda ekrandagi tugmalar.",
    colors: ["#8d6e3a", "#4a3a1c"], solo: true,
  },
  {
    id: "snake", title: "Ilon", emoji: "🐍", tag: "Klassika",
    desc: "Ikkalangiz bir xil maydonda o'ynaysiz. Kim ko'proq olma yesa — yutadi.",
    rules: "Strelkalar yoki barmoq bilan surish. Devorga va o'z dumingizga urilmang.",
    colors: ["#2e7d32", "#1b4d1f"], solo: true,
  },
  {
    id: "quiz", title: "Bilimlar jangi", emoji: "🧠", tag: "Mavzu bo'yicha",
    desc: "Tanlangan mavzudan 8 ta savol. To'g'ri va tez javob — ko'proq ball.",
    rules: "Har bir savolga 15 soniya. Qancha tez javob bersangiz, shuncha ko'p ball.",
    colors: ["#5e35b1", "#311b72"], solo: false,
  },
  {
    id: "truefalse", title: "Bosh qotirma", emoji: "🤔", tag: "To'g'ri / Noto'g'ri",
    desc: "Gap to'g'rimi yoki noto'g'ri? Mavzuni tanlang va do'stingizdan o'zib keting.",
    rules: "Har bir gapga 15 soniya. To'g'ri javob — 10 ball va tezlik uchun qo'shimcha.",
    colors: ["#d8651c", "#8a3a0b"], solo: false,
  },
  {
    id: "memory", title: "Xotira: bayroqlar", emoji: "🎴", tag: "Bosh qotirma",
    desc: "Bir xil bayroqlar juftini toping. Kim birinchi hammasini ochsa — g'olib.",
    rules: "Ikkita kartani oching: bir xil bo'lsa ochiq qoladi, aks holda yopiladi.",
    colors: ["#1976d2", "#0d3c75"], solo: true,
  },
  {
    id: "tictactoe", title: "X-O", emoji: "❌", tag: "Strategiya",
    desc: "Klassik X-O. Uchta belgini bir qatorga qo'ying. 2 ta g'alabagacha o'ynaladi.",
    rules: "Navbat bilan yurasiz, har bir yurishga 20 soniya.",
    colors: ["#c2185b", "#6d0f34"], solo: false,
  },
];

export const gameById = id => GAMES.find(g => g.id === id) ?? { id, title: id, emoji: "🎮", colors: ["#00897b", "#00574b"] };
