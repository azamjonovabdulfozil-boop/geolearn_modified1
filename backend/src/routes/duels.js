import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { getUserById, isGradeOpen } from "../lib/db.js";
import { listTopicsPublic } from "../lib/topics.js";
import { searchStudents } from "../lib/friends.js";
import {
  DUEL_GAMES, createDuel, getDuel, acceptDuel, declineDuel, cancelDuel, leaveDuel,
  moveDuel, viewDuel, touchDuel, currentDuelOf, incomingInvites, isBusy,
} from "../lib/duels.js";

// 1 ga 1 o'yinlar: do'stni chaqirish → tasdiqlash → o'yin (lib/duels.js)
const router = Router();

function onlyStudent(req, res) {
  if (req.user.role === "student") return true;
  res.status(403).json({ error: "Faqat o'quvchilar uchun" });
  return false;
}
function findDuel(req, res) {
  const duel = getDuel(req.params.id);
  if (!duel || !duel.players.some(p => p.userId === req.user.id)) {
    res.status(404).json({ error: "O'yin topilmadi" });
    return null;
  }
  return duel;
}
/** Xatoni 400 bilan qaytaradi (o'yin qoidasi buzilgan). */
const guard = fn => (req, res) => {
  try { fn(req, res); } catch (e) { res.status(400).json({ error: e.message }); }
};

// O'yinlar ro'yxati va mavzular
router.get("/duels/games", requireAuth, (req, res) => {
  res.json({
    games: Object.entries(DUEL_GAMES).map(([id, g]) => ({
      id, title: g.title, kind: g.kind, needsTopic: Boolean(g.needsTopic), duration: g.duration ?? null,
    })),
    topics: listTopicsPublic(),
    stats: { played: req.user.duelsPlayed || 0, won: req.user.duelsWon || 0 },
  });
});

// Do'stni ism va sinf bo'yicha qidirish
router.get("/duels/players", requireAuth, (req, res) => {
  if (!onlyStudent(req, res)) return;
  const list = searchStudents({ q: req.query.q, className: req.query.className, exceptId: req.user.id });
  res.json(list.map(u => ({ ...u, busy: isBusy(u.id) })));
});

// Mening holatim: kelgan takliflar va hozirgi o'yin
router.get("/duels/mine", requireAuth, (req, res) => {
  const current = currentDuelOf(req.user.id);
  if (current) touchDuel(current, req.user.id);
  res.json({
    incoming: incomingInvites(req.user.id).map(d => viewDuel(d, req.user.id)),
    current: current ? viewDuel(current, req.user.id) : null,
  });
});

// Do'stni o'yinga chaqirish
router.post("/duels", requireAuth, guard((req, res) => {
  if (!onlyStudent(req, res)) return;
  const to = getUserById(Number(req.body?.opponentId));
  if (!to || to.role !== "student" || !isGradeOpen(to.grade)) {
    return res.status(404).json({ error: "O'quvchi topilmadi" });
  }
  const duel = createDuel({ from: req.user, to, game: String(req.body?.game ?? ""), topicId: req.body?.topicId });
  res.status(201).json(viewDuel(duel, req.user.id));
}));

router.get("/duels/:id", requireAuth, (req, res) => {
  const duel = findDuel(req, res);
  if (!duel) return;
  touchDuel(duel, req.user.id);
  res.json(viewDuel(duel, req.user.id));
});

router.post("/duels/:id/accept", requireAuth, guard((req, res) => {
  const duel = findDuel(req, res);
  if (duel) res.json(viewDuel(acceptDuel(duel, req.user.id), req.user.id));
}));
router.post("/duels/:id/decline", requireAuth, guard((req, res) => {
  const duel = findDuel(req, res);
  if (duel) res.json(viewDuel(declineDuel(duel, req.user.id), req.user.id));
}));
router.post("/duels/:id/cancel", requireAuth, guard((req, res) => {
  const duel = findDuel(req, res);
  if (duel) res.json(viewDuel(cancelDuel(duel, req.user.id), req.user.id));
}));
router.post("/duels/:id/leave", requireAuth, guard((req, res) => {
  const duel = findDuel(req, res);
  if (duel) res.json(viewDuel(leaveDuel(duel, req.user.id), req.user.id));
}));

// Yurish: javob / tomon tanlash / katak / ochko
router.post("/duels/:id/move", requireAuth, guard((req, res) => {
  const duel = findDuel(req, res);
  if (!duel) return;
  const reply = moveDuel(duel, req.user.id, req.body ?? {});
  res.json({ ...reply, duel: viewDuel(duel, req.user.id) });
}));

export default router;
