// ── "Ochko yig'ish" o'yinlari ro'yxati ────────────────────────────────────
// Har bir o'yinchi o'z maydonida o'ynaydi, ochkolar solishtiriladi. Shu
// o'yinlar 1 ga 1 da ham (lib/duels.js), jamoaviy bellashuvda ham
// (lib/teams.js) ishlatiladi. O'yinning o'zi brauzerda ishlaydi
// (user/src/components/games), bu yerda faqat nomi, vaqti va chegarasi.
// `id` lar frontenddagi user/src/lib/games.js bilan bir xil bo'lishi shart.
const race = (title, duration = 60, extra = {}) => ({ kind: "race", title, duration, maxScore: 100000, ...extra });

export const RACE_GAMES = {
  // Otishma
  tank:      race("Tank jangi", 90),
  shooter:   race("Kosmik otishma", 75),
  target:    race("Nishonga otish", 60),
  balloon:   race("Sharlarni yorish", 45),
  // Sport va arkada
  basket:    race("Basketbol", 60),
  snake:     race("Ilon", 90),
  breakout:  race("G'isht sindirish", 90),
  flappy:    race("Uchar qush", 60),
  runner:    race("To'siqlardan sakrash", 60),
  catcher:   race("Mevalarni tutish", 60),
  racer:     race("Poyga", 60),
  whack:     race("Ko'rsichqon", 45),
  // Bosh qotirma
  memory:    race("Xotira: bayroqlar", 120, { maxScore: 8, fastestWins: true }),
  simon:     race("Ketma-ketlikni esla", 75),
  schulte:   race("Raqamlar tartibi", 60),
  g2048:     race("2048", 120),
  slide:     race("Sirpanchiq boshqotirma", 120),
  maze:      race("Labirint", 90),
  reaction:  race("Reaksiya tezligi", 45),
  typing:    race("Tez yozish", 60),
  // Bilim
  math:      race("Tez hisob", 60),
  mathtf:    race("To'g'rimi-noto'g'rimi: hisob", 60),
  compare:   race("Qaysi biri katta?", 60),
  sequence:  race("Ketma-ketlikni davom ettir", 60),
  stroop:    race("Rang va so'z", 45),
  anagram:   race("Harflarni tartibla", 75),
  continent: race("Davlat qaysi qit'ada?", 60),
  oddone:    race("Ortiqchasini top", 60),
};
