import { Router } from "express";
import { getGames, getGameByCode, createGame, updateGame, write } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { randomBytes } from "crypto";
import { listTopicsPublic, getTopicById, generateQuestions } from "../lib/topics.js";

const router = Router();
const genCode = () => randomBytes(3).toString("hex").toUpperCase();

// ── Topics ──────────────────────────────────────
router.get("/topics", requireAuth, (req, res) => {
  res.json(listTopicsPublic());
});

// ── Games ───────────────────────────────────────
router.get("/games", requireAuth, (req, res) => {
  res.json(getGames());
});

router.post("/games", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const { title, gameType, questionsCount, topicId } = req.body;
  if (!title) return res.status(400).json({ error: "Sarlavha kerak" });
  if (!topicId) return res.status(400).json({ error: "Mavzuni tanlang" });
  const topic = getTopicById(Number(topicId));
  if (!topic) return res.status(400).json({ error: "Mavzu topilmadi" });

  const count = Math.min(Math.max(Number(questionsCount) || 10, 3), 30);
  const type = gameType === "bosh_qotirma" ? "bosh_qotirma" : "quiz";

  let questions = [];
  try {
    questions = generateQuestions({ topicId: topic.id, gameType: type, count });
  } catch (e) {
    return res.status(500).json({ error: "Savollar yaratilmadi: " + e.message });
  }

  let code = genCode();
  while (getGameByCode(code)) code = genCode();

  const game = createGame({
    title, gameType: type, questionsCount: count, gameCode: code,
    teacherId: req.user.id, topicId: topic.id, topicName: topic.name, topicIcon: topic.icon,
    questions, status: "waiting", players: [], currentQuestion: 0,
  });
  res.status(201).json(game);
});

router.get("/games/:code", requireAuth, (req, res) => {
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  res.json(game);
});

router.get("/games/:code/players", requireAuth, (req, res) => {
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  res.json(game.players ?? []);
});

router.post("/games/:code/join", requireAuth, (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Faqat o'quvchilar" });
  const game = getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });
  if (game.status === "finished") return res.status(400).json({ error: "O'yin tugagan" });
  const players = game.players ?? [];
  if (!players.find(p => p.userId === req.user.id)) {
    players.push({ userId: req.user.id, name: req.user.name, score: 0, answers: [] });
    updateGame(req.params.code, { players });
  }
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
  write("games", getGames().filter(g => g.gameCode !== req.params.code));
  res.json({ success: true });
});

export default router;
