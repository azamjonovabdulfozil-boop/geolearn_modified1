import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { getUserById, isGradeOpen } from "../lib/db.js";
import { searchStudents } from "../lib/friends.js";
import {
  TEAM_GAMES, MAX_TEAM, createRoom, getRoom, roomOf, invitesFor, invite, acceptInvite, declineInvite,
  kick, leave, start, report, viewRoom, isInTeamGame,
} from "../lib/teams.js";

// Jamoaviy o'yinlar: xona → ikki sardor → o'yinchilarni yig'ish → bellashuv (lib/teams.js)
const router = Router();

function onlyStudent(req, res, next) {
  if (req.user.role !== "student") return res.status(403).json({ error: "Faqat o'quvchilar uchun" });
  next();
}
function myRoom(req, res) {
  const room = getRoom(req.params.id);
  if (!room || !room.teams.flat().some(m => m.userId === req.user.id)) {
    res.status(404).json({ error: "Xona topilmadi" });
    return null;
  }
  return room;
}
const guard = fn => (req, res) => {
  try { fn(req, res); } catch (e) { res.status(400).json({ error: e.message }); }
};

router.get("/teams/games", requireAuth, (req, res) => {
  res.json({
    games: Object.entries(TEAM_GAMES).map(([id, g]) => ({ id, title: g.title, duration: g.duration })),
    maxTeam: MAX_TEAM,
    stats: { played: req.user.teamGamesPlayed || 0, won: req.user.teamGamesWon || 0 },
  });
});

// Mening holatim: xonam va menga kelgan takliflar
router.get("/teams/mine", requireAuth, (req, res) => {
  const room = roomOf(req.user.id);
  res.json({ room: room ? viewRoom(room, req.user.id) : null, invites: invitesFor(req.user.id) });
});

// O'yinchi qidirish (jamoaga chaqirish uchun)
router.get("/teams/players", requireAuth, onlyStudent, (req, res) => {
  const list = searchStudents({ q: req.query.q, className: req.query.className, exceptId: req.user.id });
  res.json(list.map(u => ({ ...u, busy: isInTeamGame(u.id) })));
});

router.post("/teams", requireAuth, onlyStudent, guard((req, res) => {
  const room = createRoom(req.user, String(req.body?.game ?? ""));
  res.status(201).json(viewRoom(room, req.user.id));
}));

// { userId, role: "leader" | "player" }
router.post("/teams/:id/invite", requireAuth, onlyStudent, guard((req, res) => {
  const room = myRoom(req, res);
  if (!room) return;
  const to = getUserById(Number(req.body?.userId));
  if (!to || to.role !== "student" || !isGradeOpen(to.grade)) return res.status(404).json({ error: "O'quvchi topilmadi" });
  invite(room, req.user, to, req.body?.role === "leader" ? "leader" : "player");
  res.json(viewRoom(room, req.user.id));
}));

router.post("/teams/invites/:inviteId/accept", requireAuth, onlyStudent, guard((req, res) => {
  const room = acceptInvite(req.params.inviteId, req.user);
  res.json(viewRoom(room, req.user.id));
}));
router.post("/teams/invites/:inviteId/decline", requireAuth, onlyStudent, guard((req, res) => {
  declineInvite(req.params.inviteId, req.user);
  res.json({ ok: true });
}));

router.post("/teams/:id/kick", requireAuth, guard((req, res) => {
  const room = myRoom(req, res);
  if (!room) return;
  kick(room, req.user, Number(req.body?.userId));
  res.json(viewRoom(room, req.user.id));
}));
router.post("/teams/:id/leave", requireAuth, guard((req, res) => {
  const room = myRoom(req, res);
  if (!room) return;
  leave(room, req.user.id);
  res.json({ ok: true });
}));
router.post("/teams/:id/start", requireAuth, guard((req, res) => {
  const room = myRoom(req, res);
  if (!room) return;
  start(room, req.user.id);
  res.json(viewRoom(room, req.user.id));
}));
// { score, done }
router.post("/teams/:id/move", requireAuth, guard((req, res) => {
  const room = myRoom(req, res);
  if (!room) return;
  report(room, req.user.id, req.body ?? {});
  res.json(viewRoom(room, req.user.id));
}));

export default router;
