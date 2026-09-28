import { Router } from "express";
import { getGames, getGameByCode, createGame, updateGame, write, read, userClassName } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { randomBytes } from "crypto";
import { listTopicsPublic, getTopicById, generateQuestions } from "../lib/topics.js";
import { lessonGameQuestions } from "../lib/lessonGame.js";
import { pickSection } from "../lib/scope.js";

const router = Router();
const genCode = () => randomBytes(3).toString("hex").toUpperCase();

// O'quvchi shuncha ms davomida "tirik" signal yubormasa — chiqib ketgan deb hisoblanadi.
// (Frontend har 5 soniyada heartbeat yuboradi, ya'ni 2 marta o'tkazib yuborishga joy bor.)
const PLAYER_TIMEOUT_MS = 15_000;
const MAX_EVENTS = 50;

/** O'yinga hodisa qo'shadi (o'qituvchi paneli shu ro'yxatdan xabar ko'rsatadi). */
function pushEvent(game, event) {
  const events = [...(game.events ?? []), {
    id: (game.events?.at(-1)?.id ?? 0) + 1,
    at: new Date().toISOString(),
    ...event,
  }];
  return events.slice(-MAX_EVENTS);
}

/**
 * Signal yubormay qo'ygan o'yinchilarni "chiqib ketgan" deb belgilaydi
 * va har biri uchun hodisa yozadi. O'zgarish bo'lsa — bazaga saqlaydi.
 */
function reapAbsentPlayers(game) {
  if (!game || game.status === "finished") return game;
  const now = Date.now();
  let events = game.events ?? [];
  let changed = false;

  const players = (game.players ?? []).map(p => {
    if (p.leftAt) return p;
    const lastSeen = new Date(p.lastSeenAt ?? p.joinedAt ?? 0).getTime();
    if (!lastSeen || now - lastSeen <= PLAYER_TIMEOUT_MS) return p;
    changed = true;
    events = pushEvent({ ...game, events }, {
      type: "leave",
      userId: p.userId,
      name: p.name,
      grade: p.grade ?? null,
      reason: "timeout",
      message: `"${p.name}" o'quvchi chiqib ketdi`,
    });
    return { ...p, leftAt: new Date().toISOString() };
  });

  if (!changed) return game;
  return updateGame(game.gameCode, { players, events });
}

// ── Topics ──────────────────────────────────────
router.get("/topics", requireAuth, (req, res) => {
  res.json(listTopicsPublic());
});

// ── Games ───────────────────────────────────────
router.get("/games", requireAuth, (req, res) => {
  res.json(getGames().map(g => {
    const players = g.players ?? [];
    return { ...g, playersOnline: players.filter(p => !p.leftAt).length, playersTotal: players.length };
  }));
});

router.post("/games", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const { title, gameType, questionsCount, topicId, source, lessonId, lessonTopicId, section } = req.body;
  if (!title) return res.status(400).json({ error: "Sarlavha kerak" });

  const count = Math.min(Math.max(Number(questionsCount) || 10, 3), 30);
  const type = gameType === "bosh_qotirma" ? "bosh_qotirma" : "quiz";

  // Manba: tayyor geografiya mavzusi yoki yuklangan darslik
  let meta;
  let questions = [];
  if (source === "lesson") {
    if (!lessonId) return res.status(400).json({ error: "Darslikni tanlang" });
    try {
      const r = lessonGameQuestions({ lessonId, topicId: lessonTopicId || null, gameType: type, count });
      questions = r.questions;
      meta = {
        source: "lesson",
        lessonId: r.lesson.id,
        lessonTopicId: r.topic?.id ?? null,
        topicName: r.topic ? r.topic.title : r.lesson.title,
        lessonTitle: r.lesson.title,
        topicIcon: "📘",
      };
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  } else {
    if (!topicId) return res.status(400).json({ error: "Mavzuni tanlang" });
    const topic = getTopicById(Number(topicId));
    if (!topic) return res.status(400).json({ error: "Mavzu topilmadi" });
    try {
      questions = generateQuestions({ topicId: topic.id, gameType: type, count });
    } catch (e) {
      return res.status(500).json({ error: "Savollar yaratilmadi: " + e.message });
    }
    meta = { source: "topic", topicId: topic.id, topicName: topic.name, topicIcon: topic.icon };
  }

  let code = genCode();
  while (getGameByCode(code)) code = genCode();

  const game = createGame({
    title, gameType: type, questionsCount: questions.length, gameCode: code,
    teacherId: req.user.id, ...meta,
    section: pickSection(section),
    questions, status: "waiting", players: [], events: [], currentQuestion: 0,
  });
  res.status(201).json(game);
});

router.get("/games/:code", requireAuth, (req, res) => {
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  res.json(game);
});

// O'qituvchi paneli shu yo'lni har necha soniyada so'raydi: o'yinchilar ro'yxati,
// nechtasi hozir onlayn va chiqib ketganlar haqidagi hodisalar.
router.get("/games/:code/players", requireAuth, (req, res) => {
  let game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  game = reapAbsentPlayers(game) ?? game;

  const players = (game.players ?? []).map(p => ({ ...p, online: !p.leftAt }));
  res.json({
    players,
    online: players.filter(p => p.online).length,
    total: players.length,
    events: game.events ?? [],
  });
});

// O'quvchi "tirikman" signali — har 5 soniyada yuboriladi.
router.post("/games/:code/heartbeat", requireAuth, (req, res) => {
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  const players = [...(game.players ?? [])];
  const idx = players.findIndex(p => p.userId === req.user.id);
  if (idx === -1) return res.status(400).json({ error: "O'yinga qo'shilmagansiz" });

  const wasGone = Boolean(players[idx].leftAt);
  players[idx] = { ...players[idx], lastSeenAt: new Date().toISOString(), leftAt: null };
  const events = wasGone
    ? pushEvent(game, {
        type: "rejoin", userId: req.user.id, name: players[idx].name,
        grade: players[idx].grade ?? null,
        message: `"${players[idx].name}" o'yinga qaytdi`,
      })
    : game.events ?? [];
  updateGame(req.params.code, { players, events });
  res.json({ ok: true });
});

// O'quvchi o'zi chiqib ketdi (tugmani bosdi yoki sahifani yopdi).
router.post("/games/:code/leave", requireAuth, (req, res) => {
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  const players = [...(game.players ?? [])];
  const idx = players.findIndex(p => p.userId === req.user.id);
  if (idx === -1) return res.json({ ok: true });
  if (players[idx].leftAt) return res.json({ ok: true });

  players[idx] = { ...players[idx], leftAt: new Date().toISOString() };
  const events = pushEvent(game, {
    type: "leave",
    userId: req.user.id,
    name: players[idx].name,
    grade: players[idx].grade ?? null,
    reason: "left",
    message: `"${players[idx].name}" o'quvchi chiqib ketdi`,
  });
  updateGame(req.params.code, { players, events });
  res.json({ ok: true });
});

router.post("/games/:code/join", requireAuth, (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Faqat o'quvchilar" });
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  if (game.status === "finished") return res.status(400).json({ error: "O'yin tugagan" });
  const now = new Date().toISOString();
  const players = [...(game.players ?? [])];
  const idx = players.findIndex(p => p.userId === req.user.id);
  let events = game.events ?? [];

  if (idx === -1) {
    players.push({
      userId: req.user.id,
      name: req.user.name,
      grade: req.user.grade ?? null,
      className: userClassName(req.user),
      score: 0,
      answers: [],
      joinedAt: now,
      lastSeenAt: now,
      leftAt: null,
    });
    events = pushEvent(game, {
      type: "join",
      userId: req.user.id,
      name: req.user.name,
      grade: req.user.grade ?? null,
      message: `"${req.user.name}" o'yinga qo'shildi`,
    });
  } else {
    const wasGone = Boolean(players[idx].leftAt);
    players[idx] = { ...players[idx], name: req.user.name, grade: req.user.grade ?? null, className: userClassName(req.user), lastSeenAt: now, leftAt: null };
    if (wasGone) {
      events = pushEvent(game, {
        type: "rejoin",
        userId: req.user.id,
        name: req.user.name,
        grade: req.user.grade ?? null,
        message: `"${req.user.name}" o'yinga qaytdi`,
      });
    }
  }
  updateGame(req.params.code, { players, events });
  res.json(getGameByCode(req.params.code));
});

router.post("/games/:code/start", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  updateGame(req.params.code, { status: "active", currentQuestion: 0 });
  res.json({ success: true });
});

router.post("/games/:code/answer", requireAuth, (req, res) => {
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  const { answer } = req.body;
  const players = [...(game.players ?? [])];
  const pi = players.findIndex(p => p.userId === req.user.id);
  if (pi === -1) return res.status(400).json({ error: "O'yinga qo'shilmagansiz" });

  const q = game.questions?.[game.currentQuestion];
  let correct = false;
  if (q) {
    if (game.gameType === "bosh_qotirma") correct = answer === q.isTrue;
    else correct = answer === q.correctIndex;
    if (correct) players[pi].score = (players[pi].score || 0) + 10;
    players[pi].answers = [...(players[pi].answers || []), { q: game.currentQuestion, answer, correct }];
  }
  // Javob berish ham faollik belgisi — chiqib ketgan deb belgilanmasin
  players[pi] = { ...players[pi], lastSeenAt: new Date().toISOString(), leftAt: null };
  updateGame(req.params.code, { players });
  res.json({ correct, currentScore: players[pi].score });
});

router.post("/games/:code/next", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  const next = (game.currentQuestion || 0) + 1;
  const total = (game.questions || []).length;
  if (next >= total) updateGame(req.params.code, { status: "finished" });
  else updateGame(req.params.code, { currentQuestion: next });
  res.json(getGameByCode(req.params.code));
});

router.delete("/games/:code", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  write("games", read("games").filter(g => g.gameCode !== req.params.code));
  res.json({ success: true });
});

export default router;
