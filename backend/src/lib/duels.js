// ── 1 ga 1 o'yinlar (duel) ────────────────────────────────────────────────
// O'quvchi do'stini o'yinga chaqiradi → do'sti tasdiqlasa, ikkalasi bir
// vaqtda o'ynaydi. O'yin holati xotirada turadi (bir necha daqiqalik narsa,
// faylga yozilmaydi) va har bir o'zgarishda ikkala o'yinchiga shaxsiy
// hodisa (events.js → sendToUser) yuboriladi.
//
// O'yin turlari (kind):
//   quiz    — ikkalasiga bir xil savollar, kim ko'p va tez topsa
//   penalty — navbat bilan penalti: biri tepadi, ikkinchisi darvozada
//   ttt     — X-O, navbat bilan (2 ta g'alabagacha)
//   grid    — katakli taxta: To'rt qator (tosh pastga tushadi), Besh qator
//   rps     — tosh-qaychi-qog'oz, 3 ta g'alabagacha
//   race    — har kim o'z maydonida o'ynaydi (ilon, tank, tez hisob ...), ochko solishtiriladi
import { randomBytes, randomInt } from "crypto";
import { sendToUser } from "./events.js";
import { getUserById, updateUser, userClassName } from "./db.js";
import { getTopicById, generateQuestions } from "./topics.js";
import { RACE_GAMES } from "./gameCatalog.js";

export const DUEL_GAMES = {
  quiz:      { kind: "quiz", title: "Bilimlar jangi", needsTopic: true, questionType: "quiz" },
  truefalse: { kind: "quiz", title: "Bosh qotirma: To'g'ri / Noto'g'ri", needsTopic: true, questionType: "bosh_qotirma" },
  penalty:   { kind: "penalty", title: "Penalti" },
  tictactoe: { kind: "ttt", title: "X-O" },
  connect4:  { kind: "grid", title: "To'rt qator", cols: 7, rows: 6, k: 4, gravity: true },
  gomoku:    { kind: "grid", title: "Besh qator", cols: 10, rows: 10, k: 5, gravity: false },
  rps:       { kind: "rps", title: "Tosh-qaychi-qog'oz" },
  ...RACE_GAMES,
};

const INVITE_TTL_MS = 45_000;     // taklif shuncha vaqt kutadi
const COUNTDOWN_MS = 4_000;       // "3, 2, 1" sanog'i
const ABSENT_MS = 25_000;         // o'yinchi shuncha vaqt ko'rinmasa — mag'lub
const KEEP_FINISHED_MS = 10 * 60_000;

const QUIZ_COUNT = 8;
const QUIZ_SEC = 15;
const QUIZ_FEEDBACK_MS = 1500;    // javobdan keyin natija ko'rsatiladigan pauza

const PENALTY_KICKS = 5;          // har bir o'yinchiga
const PENALTY_MAX_ROUNDS = 20;
const PENALTY_CHOOSE_MS = 12_000;
const PENALTY_REVEAL_MS = 4_500;

const TTT_TURN_MS = 20_000;
const TTT_BETWEEN_MS = 3_000;
const TTT_WINS = 2;
const TTT_MAX_ROUNDS = 5;
const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

const GRID_TURN_MS = 25_000;
const GRID_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

const RPS_WINS = 3;
const RPS_MAX_ROUNDS = 9;
const RPS_CHOOSE_MS = 8_000;
const RPS_REVEAL_MS = 2_800;

const REWARD_WIN = 10;
const REWARD_DRAW = 3;
const REWARD_DAILY_CAP = 10;      // bir kunda shuncha o'yin uchun ball beriladi

const duels = new Map();
const rewarded = new Map();       // "2026-10-10|userId" → nechta o'yin uchun ball olgan

const now = () => Date.now();
const other = i => (i === 0 ? 1 : 0);

function playerOf(user) {
  return { userId: user.id, name: user.name, className: userClassName(user), avatarUrl: user.avatarUrl ?? null };
}
function idxOf(duel, userId) {
  return duel.players.findIndex(p => p.userId === userId);
}

/** Foydalanuvchi hozir band bo'lgan (kutilayotgan yoki davom etayotgan) o'yin. */
export function currentDuelOf(userId) {
  for (const d of duels.values()) {
    if (d.status === "active" && idxOf(d, userId) !== -1) return d;
    if (d.status === "pending" && d.players[0].userId === userId) return d;
  }
  return null;
}
export function isBusy(userId) {
  return Boolean(currentDuelOf(userId));
}
/** Menga kelgan, hali javob berilmagan takliflar. */
export function incomingInvites(userId) {
  return [...duels.values()].filter(d => d.status === "pending" && d.players[1].userId === userId);
}
export function getDuel(id) {
  return duels.get(String(id)) ?? null;
}

// ── Yaratish va taklif ────────────────────────────────────────────────────

export function createDuel({ from, to, game, topicId }) {
  const def = DUEL_GAMES[game];
  if (!def) throw new Error("Bunday o'yin yo'q");
  if (from.id === to.id) throw new Error("O'zingizni chaqira olmaysiz");
  if (isBusy(from.id)) throw new Error("Sizda tugallanmagan o'yin bor");
  if (currentDuelOf(to.id)?.status === "active") throw new Error(`${to.name} hozir boshqa o'yinda`);

  let topic = null;
  if (def.needsTopic) {
    const t = getTopicById(Number(topicId));
    if (!t) throw new Error("Mavzuni tanlang");
    topic = { id: t.id, name: t.name, icon: t.icon };
  }

  const duel = {
    id: randomBytes(6).toString("hex"),
    game, kind: def.kind, title: def.title, topic,
    status: "pending",
    players: [playerOf(from), playerOf(to)],
    createdAt: now(), expiresAt: now() + INVITE_TTL_MS,
    startsAt: null, finishedAt: null,
    seen: { [from.id]: now(), [to.id]: now() },
    state: null, result: null,
  };
  duels.set(duel.id, duel);
  notify(duel);
  return duel;
}

export function acceptDuel(duel, userId) {
  if (duel.status !== "pending") throw new Error("Taklif endi amal qilmaydi");
  if (duel.players[1].userId !== userId) throw new Error("Bu taklif sizga emas");
  if (currentDuelOf(userId)?.status === "active") throw new Error("Siz hozir boshqa o'yindasiz");

  // Qabul qilgan o'yinchining boshqa takliflari bekor bo'ladi
  for (const d of incomingInvites(userId)) if (d !== duel) close(d, "declined");
  const own = currentDuelOf(userId);
  if (own?.status === "pending") close(own, "cancelled");

  const t = now();
  duel.status = "active";
  duel.startsAt = t + COUNTDOWN_MS;
  duel.seen = { [duel.players[0].userId]: t, [duel.players[1].userId]: t };
  duel.state = initState(duel);
  notify(duel);
  return duel;
}

/** Taklifni yopadi: rad etildi / bekor qilindi / vaqti o'tdi. */
function close(duel, status) {
  duel.status = status;
  duel.finishedAt = now();
  notify(duel);
}
export function declineDuel(duel, userId) {
  if (duel.status !== "pending") return duel;
  if (duel.players[1].userId !== userId) throw new Error("Bu taklif sizga emas");
  close(duel, "declined");
  return duel;
}
export function cancelDuel(duel, userId) {
  if (duel.status !== "pending") return duel;
  if (duel.players[0].userId !== userId) throw new Error("Bu taklif sizniki emas");
  close(duel, "cancelled");
  return duel;
}

/** O'yinchi o'yinni tashlab chiqdi — raqibi g'olib. */
export function leaveDuel(duel, userId) {
  const i = idxOf(duel, userId);
  if (i === -1) throw new Error("Siz bu o'yinda emassiz");
  if (duel.status === "pending") return i === 0 ? cancelDuel(duel, userId) : declineDuel(duel, userId);
  if (duel.status === "active") finish(duel, other(i), "left");
  return duel;
}

// ── Boshlang'ich holat ────────────────────────────────────────────────────

function initState(duel) {
  const def = DUEL_GAMES[duel.game];
  const ids = duel.players.map(p => p.userId);

  if (def.kind === "quiz") {
    const questions = generateQuestions({ topicId: duel.topic.id, gameType: def.questionType, count: QUIZ_COUNT });
    const fresh = () => ({ idx: 0, score: 0, correct: 0, done: false, qStartedAt: duel.startsAt, finishedAt: null });
    return { type: def.questionType, questions, perQuestionSec: QUIZ_SEC, progress: { [ids[0]]: fresh(), [ids[1]]: fresh() } };
  }
  if (def.kind === "penalty") {
    return {
      round: 0, kicksPerSide: PENALTY_KICKS, phase: "choose",
      phaseEndsAt: duel.startsAt + PENALTY_CHOOSE_MS,
      shooterIdx: 0, picks: {}, score: [0, 0], history: [], last: null,
    };
  }
  if (def.kind === "ttt") {
    return {
      board: Array(9).fill(null), turnIdx: 0, starterIdx: 0, round: 1,
      wins: [0, 0], draws: 0, phase: "play", line: null, roundWinner: null,
      turnEndsAt: duel.startsAt + TTT_TURN_MS, phaseEndsAt: null,
    };
  }
  if (def.kind === "grid") {
    return {
      cols: def.cols, rows: def.rows, k: def.k, gravity: def.gravity,
      board: Array(def.cols * def.rows).fill(null), turnIdx: 0, line: null, last: null,
      turnEndsAt: duel.startsAt + GRID_TURN_MS,
    };
  }
  if (def.kind === "rps") {
    return { round: 1, wins: [0, 0], target: RPS_WINS, phase: "choose", phaseEndsAt: duel.startsAt + RPS_CHOOSE_MS, picks: {}, last: null };
  }
  // race
  const fresh = () => ({ score: 0, done: false, finishedAt: null });
  return {
    seed: randomInt(1, 2 ** 31 - 1), duration: def.duration,
    endsAt: duel.startsAt + def.duration * 1000,
    progress: { [ids[0]]: fresh(), [ids[1]]: fresh() },
  };
}

// ── Yurishlar ─────────────────────────────────────────────────────────────

/** O'yinchining yurishi. Qaytgan qiymat faqat shu o'yinchiga javob sifatida boradi. */
export function moveDuel(duel, userId, body = {}) {
  const i = idxOf(duel, userId);
  if (i === -1) throw new Error("Siz bu o'yinda emassiz");
  if (duel.status !== "active") throw new Error("O'yin tugagan");
  duel.seen[userId] = now();
  if (now() < duel.startsAt) throw new Error("O'yin hali boshlanmadi");

  let reply = { ok: true };
  if (duel.kind === "quiz") reply = quizAnswer(duel, userId, body.answer);
  else if (duel.kind === "penalty") penaltyPick(duel, userId, body.zone);
  else if (duel.kind === "ttt") tttMove(duel, i, body.cell);
  else if (duel.kind === "grid") gridMove(duel, i, body.cell);
  else if (duel.kind === "rps") rpsPick(duel, userId, body.pick);
  else raceReport(duel, userId, body);

  notify(duel);
  return reply;
}

// quiz ─────────────────────────────────────────────

function quizAnswer(duel, userId, answer) {
  const s = duel.state;
  const p = s.progress[userId];
  if (p.done) throw new Error("Siz savollarni tugatgansiz");
  const q = s.questions[p.idx];
  const elapsed = Math.max(0, (now() - p.qStartedAt) / 1000);
  const inTime = elapsed <= s.perQuestionSec + 3;
  const isBt = s.type === "bosh_qotirma";
  const correct = inTime && answer != null && (isBt ? answer === q.isTrue : answer === q.correctIndex);
  // Tez javob — ko'proq ball: 10 dan 15 gacha
  const points = correct ? 10 + Math.max(0, Math.round((1 - elapsed / s.perQuestionSec) * 5)) : 0;

  p.score += points;
  if (correct) p.correct++;
  p.idx++;
  p.qStartedAt = now() + QUIZ_FEEDBACK_MS;
  if (p.idx >= s.questions.length) { p.done = true; p.finishedAt = now(); }
  quizCheckEnd(duel);

  return {
    ok: true, correct, points,
    correctIndex: isBt ? undefined : q.correctIndex,
    isTrue: isBt ? q.isTrue : undefined,
    explanation: q.explanation ?? null,
  };
}
function quizCheckEnd(duel) {
  const [a, b] = duel.players.map(p => duel.state.progress[p.userId]);
  if (!a.done || !b.done) return;
  finish(duel, a.score === b.score ? null : (a.score > b.score ? 0 : 1), "score");
}

// penalti ──────────────────────────────────────────

function penaltyPick(duel, userId, zone) {
  const s = duel.state;
  if (s.phase !== "choose") throw new Error("Hozir tanlab bo'lmaydi");
  const z = Number(zone);
  if (!Number.isInteger(z) || z < 0 || z > 5) throw new Error("Noto'g'ri tanlov");
  if (s.picks[userId] != null) return;
  s.picks[userId] = z;
  if (duel.players.every(p => s.picks[p.userId] != null)) penaltyResolve(duel);
}

/**
 * Darvoza 6 qismga bo'lingan: yuqori 0,1,2 va pastki 3,4,5.
 * Darvozabon aynan o'sha qismga sakrasa — to'pni ushlaydi; faqat tomoni
 * to'g'ri kelsa (balandligi boshqa) — yarim holatda qaytaradi.
 */
function penaltyResolve(duel) {
  const s = duel.state;
  const shooter = duel.players[s.shooterIdx].userId;
  const keeper = duel.players[other(s.shooterIdx)].userId;
  const shot = s.picks[shooter];
  const dive = s.picks[keeper];
  let goal = true;
  if (shot === dive) goal = false;
  else if (shot % 3 === dive % 3) goal = randomInt(0, 2) === 0;
  if (goal) s.score[s.shooterIdx]++;

  s.last = { round: s.round, shooterIdx: s.shooterIdx, shot, dive, goal };
  s.history.push({ shooterIdx: s.shooterIdx, goal });
  s.phase = "reveal";
  s.phaseEndsAt = now() + PENALTY_REVEAL_MS;
}

/** Tepilgan zarbalardan keyin g'olib aniqmi? (null — hali yo'q) */
function penaltyDecided(s) {
  const taken = [0, 1].map(i => s.history.filter(h => h.shooterIdx === i).length);
  const [a, b] = s.score;
  if (taken[0] <= s.kicksPerSide && taken[1] <= s.kicksPerSide && (taken[0] < s.kicksPerSide || taken[1] < s.kicksPerSide)) {
    // Asosiy seriya: qolgan zarbalar bilan ham yetib ololmasa — tugaydi
    if (a > b + (s.kicksPerSide - taken[1])) return 0;
    if (b > a + (s.kicksPerSide - taken[0])) return 1;
    return null;
  }
  if (taken[0] !== taken[1]) return null;       // juftlik tugashini kutamiz
  if (a !== b) return a > b ? 0 : 1;
  return s.history.length >= PENALTY_MAX_ROUNDS ? "draw" : null;
}

function penaltyAdvance(duel) {
  const s = duel.state;
  const decided = penaltyDecided(s);
  if (decided != null) return finish(duel, decided === "draw" ? null : decided, "score");
  s.round++;
  s.shooterIdx = other(s.shooterIdx);
  s.picks = {};
  s.phase = "choose";
  s.phaseEndsAt = now() + PENALTY_CHOOSE_MS;
}

// X-O ──────────────────────────────────────────────

function tttMove(duel, i, cell) {
  const s = duel.state;
  if (s.phase !== "play") throw new Error("Keyingi raund kutilmoqda");
  if (s.turnIdx !== i) throw new Error("Hozir sizning navbatingiz emas");
  const c = Number(cell);
  if (!Number.isInteger(c) || c < 0 || c > 8 || s.board[c] != null) throw new Error("Bu katak band");
  tttPlace(duel, i, c);
}
function tttPlace(duel, i, c) {
  const s = duel.state;
  s.board[c] = i;
  const line = TTT_LINES.find(l => l.every(k => s.board[k] === i));
  if (line) {
    s.line = line; s.roundWinner = i; s.wins[i]++;
  } else if (s.board.every(v => v != null)) {
    s.roundWinner = null; s.draws++;
  } else {
    s.turnIdx = other(i);
    s.turnEndsAt = now() + TTT_TURN_MS;
    return;
  }
  s.phase = "between";
  s.phaseEndsAt = now() + TTT_BETWEEN_MS;
}
function tttAdvance(duel) {
  const s = duel.state;
  const [a, b] = s.wins;
  if (a >= TTT_WINS || b >= TTT_WINS || s.round >= TTT_MAX_ROUNDS) {
    return finish(duel, a === b ? null : (a > b ? 0 : 1), "score");
  }
  s.round++;
  s.starterIdx = other(s.starterIdx);
  s.turnIdx = s.starterIdx;
  s.board = Array(9).fill(null);
  s.line = null; s.roundWinner = null;
  s.phase = "play";
  s.turnEndsAt = now() + TTT_TURN_MS;
}

// katakli taxta (To'rt qator, Besh qator) ──────────

function gridMove(duel, i, cell) {
  const s = duel.state;
  if (s.turnIdx !== i) throw new Error("Hozir sizning navbatingiz emas");
  let c = Number(cell);
  if (!Number.isInteger(c) || c < 0 || c >= s.board.length) throw new Error("Noto'g'ri katak");
  if (s.gravity) {
    // Tosh tanlangan ustunning eng pastki bo'sh katagiga tushadi
    const col = c % s.cols;
    c = -1;
    for (let row = s.rows - 1; row >= 0; row--) {
      if (s.board[row * s.cols + col] == null) { c = row * s.cols + col; break; }
    }
    if (c === -1) throw new Error("Bu ustun to'lgan");
  } else if (s.board[c] != null) {
    throw new Error("Bu katak band");
  }
  gridPlace(duel, i, c);
}
function gridPlace(duel, i, c) {
  const s = duel.state;
  s.board[c] = i;
  s.last = c;
  const x0 = c % s.cols, y0 = Math.floor(c / s.cols);
  const at = (x, y) => (x >= 0 && y >= 0 && x < s.cols && y < s.rows ? s.board[y * s.cols + x] : undefined);
  for (const [dx, dy] of GRID_DIRS) {
    const line = [c];
    for (const dir of [1, -1]) {
      for (let n = 1; at(x0 + dx * n * dir, y0 + dy * n * dir) === i; n++) line.push((y0 + dy * n * dir) * s.cols + x0 + dx * n * dir);
    }
    if (line.length >= s.k) { s.line = line; return finish(duel, i, "score"); }
  }
  if (s.board.every(v => v != null)) return finish(duel, null, "score");
  s.turnIdx = other(i);
  s.turnEndsAt = now() + GRID_TURN_MS;
}
function sweepGrid(duel, t) {
  const s = duel.state;
  if (t < s.turnEndsAt) return;
  // O'ylab qolgan o'yinchi uchun tasodifiy yurish
  const free = s.board.map((v, k) => (v == null ? k : -1)).filter(k => k !== -1);
  const pick = free[randomInt(0, free.length)];
  try { gridMove(duel, s.turnIdx, pick); } catch { gridPlace(duel, s.turnIdx, pick); }
}

// tosh-qaychi-qog'oz ───────────────────────────────

function rpsPick(duel, userId, pick) {
  const s = duel.state;
  if (s.phase !== "choose") throw new Error("Hozir tanlab bo'lmaydi");
  const p = Number(pick);
  if (![0, 1, 2].includes(p)) throw new Error("Noto'g'ri tanlov");
  if (s.picks[userId] != null) return;
  s.picks[userId] = p;
  if (duel.players.every(pl => s.picks[pl.userId] != null)) rpsResolve(duel);
}
/** 0 — tosh, 1 — qog'oz, 2 — qaychi: qog'oz toshni, qaychi qog'ozni, tosh qaychini yengadi. */
function rpsResolve(duel) {
  const s = duel.state;
  const [a, b] = duel.players.map(p => s.picks[p.userId]);
  const d = (a - b + 3) % 3;
  const winner = d === 0 ? null : d === 1 ? 0 : 1;
  if (winner != null) s.wins[winner]++;
  s.last = { round: s.round, picks: [a, b], winner };
  s.phase = "reveal";
  s.phaseEndsAt = now() + RPS_REVEAL_MS;
}
function sweepRps(duel, t) {
  const s = duel.state;
  if (t < s.phaseEndsAt) return;
  if (s.phase === "choose") {
    for (const p of duel.players) if (s.picks[p.userId] == null) s.picks[p.userId] = randomInt(0, 3);
    return rpsResolve(duel);
  }
  const [a, b] = s.wins;
  if (a >= s.target || b >= s.target || s.round >= RPS_MAX_ROUNDS) {
    return finish(duel, a === b ? null : (a > b ? 0 : 1), "score");
  }
  s.round++;
  s.picks = {};
  s.phase = "choose";
  s.phaseEndsAt = now() + RPS_CHOOSE_MS;
}

// race (ilon, tank, xotira ...) ────────────────────

function raceReport(duel, userId, { score, done }) {
  const def = DUEL_GAMES[duel.game];
  const p = duel.state.progress[userId];
  if (p.done) return;
  const n = Math.floor(Number(score));
  if (Number.isFinite(n)) p.score = Math.max(p.score, Math.min(n, def.maxScore));
  if (done || p.score >= def.maxScore && def.fastestWins) { p.done = true; p.finishedAt = now(); }
  raceCheckEnd(duel);
}
function raceCheckEnd(duel) {
  const def = DUEL_GAMES[duel.game];
  const [a, b] = duel.players.map(p => duel.state.progress[p.userId]);
  if (!a.done || !b.done) return;
  let winner = a.score === b.score ? null : (a.score > b.score ? 0 : 1);
  // Xotira o'yinida ochko teng bo'lsa — birinchi tugatgan yutadi
  if (winner == null && def.fastestWins && a.finishedAt !== b.finishedAt) winner = a.finishedAt < b.finishedAt ? 0 : 1;
  finish(duel, winner, "score");
}

// ── Tugatish va mukofot ───────────────────────────────────────────────────

function finish(duel, winnerIdx, reason) {
  if (duel.status === "finished") return;
  duel.status = "finished";
  duel.finishedAt = now();
  duel.result = { winnerId: winnerIdx == null ? null : duel.players[winnerIdx].userId, reason, rewards: {} };

  const day = new Date().toISOString().slice(0, 10);
  duel.players.forEach((p, i) => {
    const user = getUserById(p.userId);
    if (!user) return;
    const won = winnerIdx === i;
    const key = `${day}|${p.userId}`;
    const count = rewarded.get(key) ?? 0;
    let points = winnerIdx == null ? REWARD_DRAW : (won ? REWARD_WIN : 0);
    if (count >= REWARD_DAILY_CAP) points = 0;
    if (points) rewarded.set(key, count + 1);
    duel.result.rewards[p.userId] = points;
    updateUser(p.userId, {
      totalScore: (user.totalScore || 0) + points,
      duelsPlayed: (user.duelsPlayed || 0) + 1,
      duelsWon: (user.duelsWon || 0) + (won ? 1 : 0),
    });
  });
  notify(duel);
}

// ── Vaqt bo'yicha o'tishlar ───────────────────────────────────────────────
// Har soniyada: muddati o'tgan takliflar, o'ylab qolgan o'yinchilar,
// chiqib ketganlar va eski tugagan o'yinlar tekshiriladi.

function sweep() {
  const t = now();
  for (const duel of [...duels.values()]) {
    if (duel.status === "pending") {
      if (t > duel.expiresAt) close(duel, "expired");
      continue;
    }
    if (duel.status !== "active") {
      if (t - (duel.finishedAt ?? duel.createdAt) > KEEP_FINISHED_MS) duels.delete(duel.id);
      continue;
    }

    // Kim ko'rinmay qoldi? (sahifani yopgan yoki internet uzilgan)
    const gone = duel.players.map(p => t - (duel.seen[p.userId] ?? 0) > ABSENT_MS);
    if (gone[0] || gone[1]) {
      finish(duel, gone[0] && gone[1] ? null : (gone[0] ? 1 : 0), "absent");
      continue;
    }
    if (t < duel.startsAt) continue;

    const before = JSON.stringify(duel.state);
    if (duel.kind === "quiz") sweepQuiz(duel, t);
    else if (duel.kind === "penalty") sweepPenalty(duel, t);
    else if (duel.kind === "ttt") sweepTtt(duel, t);
    else if (duel.kind === "grid") sweepGrid(duel, t);
    else if (duel.kind === "rps") sweepRps(duel, t);
    else sweepRace(duel, t);
    if (duel.status === "active" && JSON.stringify(duel.state) !== before) notify(duel);
  }
}

function sweepQuiz(duel, t) {
  const s = duel.state;
  for (const p of duel.players) {
    const pr = s.progress[p.userId];
    // Savolga vaqtida javob bermadi (masalan sahifa osilib qoldi) — o'tkazib yuboramiz
    while (!pr.done && t - pr.qStartedAt > (s.perQuestionSec + 6) * 1000) {
      pr.idx++;
      pr.qStartedAt += (s.perQuestionSec + 2) * 1000;
      if (pr.idx >= s.questions.length) { pr.done = true; pr.finishedAt = t; }
    }
  }
  quizCheckEnd(duel);
}
function sweepPenalty(duel, t) {
  const s = duel.state;
  if (t < s.phaseEndsAt) return;
  if (s.phase === "reveal") return penaltyAdvance(duel);
  // Tanlamagan o'yinchi uchun tasodifiy tomon
  for (const p of duel.players) if (s.picks[p.userId] == null) s.picks[p.userId] = randomInt(0, 6);
  penaltyResolve(duel);
}
function sweepTtt(duel, t) {
  const s = duel.state;
  if (s.phase === "between") { if (t >= s.phaseEndsAt) tttAdvance(duel); return; }
  if (t < s.turnEndsAt) return;
  const free = s.board.map((v, k) => (v == null ? k : -1)).filter(k => k !== -1);
  tttPlace(duel, s.turnIdx, free[randomInt(0, free.length)]);
}
function sweepRace(duel, t) {
  const s = duel.state;
  if (t < s.endsAt + 3000) return;
  for (const p of duel.players) {
    const pr = s.progress[p.userId];
    if (!pr.done) { pr.done = true; pr.finishedAt = t; }
  }
  raceCheckEnd(duel);
}

setInterval(sweep, 1000).unref();

// ── Ko'rinish (har bir o'yinchiga o'zi ko'rishi mumkin bo'lgan holat) ─────

function quizQuestion(q) {
  if (!q) return null;
  const { correctIndex, isTrue, explanation, ...safe } = q;
  return safe;
}

/** O'yin holati: raqibning yashirin tanlovi va to'g'ri javoblar chiqarilmaydi. */
export function viewDuel(duel, userId) {
  const me = idxOf(duel, userId);
  const base = {
    id: duel.id, game: duel.game, kind: duel.kind, title: duel.title, topic: duel.topic,
    status: duel.status, players: duel.players, me,
    createdAt: duel.createdAt, expiresAt: duel.expiresAt, startsAt: duel.startsAt,
    finishedAt: duel.finishedAt, result: duel.result, serverNow: now(),
  };
  const s = duel.state;
  if (!s || me === -1) return base;

  if (duel.kind === "quiz") {
    const mine = s.progress[userId];
    const theirs = s.progress[duel.players[other(me)].userId];
    const pub = p => ({ idx: p.idx, score: p.score, correct: p.correct, done: p.done });
    return {
      ...base,
      state: {
        type: s.type, total: s.questions.length, perQuestionSec: s.perQuestionSec,
        me: pub(mine), opp: pub(theirs),
        question: mine.done ? null : quizQuestion(s.questions[mine.idx]),
        qStartedAt: mine.qStartedAt,
      },
    };
  }
  if (duel.kind === "penalty") {
    const oppId = duel.players[other(me)].userId;
    return {
      ...base,
      state: {
        round: s.round, kicksPerSide: s.kicksPerSide, phase: s.phase, phaseEndsAt: s.phaseEndsAt,
        shooterIdx: s.shooterIdx, score: s.score, history: s.history,
        myPick: s.picks[userId] ?? null,
        oppPicked: s.picks[oppId] != null,
        last: s.phase === "reveal" || duel.status === "finished" ? s.last : null,
      },
    };
  }
  if (duel.kind === "ttt" || duel.kind === "grid") return { ...base, state: s };
  if (duel.kind === "rps") {
    const oppId = duel.players[other(me)].userId;
    return {
      ...base,
      state: {
        round: s.round, wins: s.wins, target: s.target, phase: s.phase, phaseEndsAt: s.phaseEndsAt,
        myPick: s.picks[userId] ?? null, oppPicked: s.picks[oppId] != null,
        last: s.phase === "reveal" || duel.status === "finished" ? s.last : null,
      },
    };
  }

  const mine = s.progress[userId];
  const theirs = s.progress[duel.players[other(me)].userId];
  return { ...base, state: { seed: s.seed, duration: s.duration, endsAt: s.endsAt, me: mine, opp: theirs } };
}

/** O'yinchi holatni so'radi — "shu yerdaman" belgisi ham. */
export function touchDuel(duel, userId) {
  if (duel.status === "active" && idxOf(duel, userId) !== -1) duel.seen[userId] = now();
}

function notify(duel) {
  for (const p of duel.players) sendToUser(p.userId, "duel", viewDuel(duel, p.userId));
}
