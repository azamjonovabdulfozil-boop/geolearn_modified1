// ── Jamoaviy o'yinlar ─────────────────────────────────────────────────────
// Bir o'quvchi xona ochadi va raqib sardorni chaqiradi. Ikkala sardor o'z
// jamoasiga o'yinchilarni qidirib qo'shadi (har biriga taklif boradi).
// O'yin boshlanganda hamma bir vaqtda bitta o'yinni o'z maydonida o'ynaydi;
// jamoa ochkosi — eng yaxshi N ta natija yig'indisi (N — kichik jamoadagi
// o'yinchilar soni), shunda 2 ga 3 bo'lsa ham adolatli.
// Holat xotirada turadi, har o'zgarishda a'zolarga "team" hodisasi boradi.
import { randomBytes, randomInt } from "crypto";
import { sendToUser } from "./events.js";
import { getUserById, updateUser, userClassName } from "./db.js";
import { RACE_GAMES } from "./gameCatalog.js";

export const TEAM_GAMES = RACE_GAMES;
export const MAX_TEAM = 5;

const INVITE_TTL_MS = 60_000;
const COUNTDOWN_MS = 5_000;
const LOBBY_TTL_MS = 20 * 60_000;      // boshlanmagan xona shuncha turadi
const KEEP_FINISHED_MS = 10 * 60_000;
const REWARD_WIN = 8;
const REWARD_DRAW = 2;

const rooms = new Map();
const now = () => Date.now();
const member = (user, extra = {}) => ({
  userId: user.id, name: user.name, className: userClassName(user), avatarUrl: user.avatarUrl ?? null, ...extra,
});

export function getRoom(id) {
  return rooms.get(String(id)) ?? null;
}
const teamOf = (room, userId) => room.teams.findIndex(t => t.some(m => m.userId === userId));
const isMember = (room, userId) => teamOf(room, userId) !== -1;
const open = room => room.status === "lobby" || room.status === "active";

/** O'quvchi hozir a'zo bo'lgan (yopilmagan yoki hozirgina tugagan) xona. */
export function roomOf(userId) {
  let latest = null;
  for (const r of rooms.values()) {
    if (!isMember(r, userId)) continue;
    if (open(r)) return r;
    if (r.status === "finished" && (!latest || r.finishedAt > latest.finishedAt)) latest = r;
  }
  return latest;
}
export function isInTeamGame(userId) {
  const r = roomOf(userId);
  return Boolean(r && open(r));
}
/** Menga kelgan, hali javob berilmagan takliflar. */
export function invitesFor(userId) {
  const out = [];
  for (const r of rooms.values()) {
    if (r.status !== "lobby") continue;
    for (const inv of r.invites) if (inv.userId === userId) out.push(viewInvite(r, inv));
  }
  return out;
}

// ── Xona ──────────────────────────────────────────────────────────────────

export function createRoom(user, game) {
  const def = TEAM_GAMES[game];
  if (!def) throw new Error("Bunday jamoaviy o'yin yo'q");
  if (isInTeamGame(user.id)) throw new Error("Siz allaqachon jamoaviy o'yindasiz");
  const room = {
    id: randomBytes(6).toString("hex"),
    game, title: def.title, duration: def.duration,
    status: "lobby", ownerId: user.id,
    teams: [[member(user, { leader: true })], []],
    invites: [],
    createdAt: now(), startsAt: null, endsAt: null, finishedAt: null,
    seed: null, progress: {}, result: null,
  };
  rooms.set(room.id, room);
  notify(room);
  return room;
}

/**
 * Taklif: xona egasi raqib sardorni (role = "leader") chaqiradi,
 * sardorlar esa o'z jamoasiga o'yinchi chaqiradi.
 */
export function invite(room, from, to, role) {
  if (room.status !== "lobby") throw new Error("O'yin allaqachon boshlangan");
  const team = teamOf(room, from.id);
  const me = team === -1 ? null : room.teams[team].find(m => m.userId === from.id);
  if (!me?.leader) throw new Error("Faqat sardor o'yinchi chaqira oladi");
  if (from.id === to.id) throw new Error("O'zingizni chaqira olmaysiz");
  if (isMember(room, to.id)) throw new Error(`${to.name} allaqachon xonada`);
  if (isInTeamGame(to.id)) throw new Error(`${to.name} hozir boshqa jamoaviy o'yinda`);
  if (room.invites.some(i => i.userId === to.id)) throw new Error(`${to.name} ga taklif yuborilgan`);

  const asLeader = role === "leader";
  if (asLeader) {
    if (room.ownerId !== from.id) throw new Error("Raqib sardorni xona egasi chaqiradi");
    if (room.teams[1].length) throw new Error("Raqib jamoaning sardori bor");
    if (room.invites.some(i => i.leader)) throw new Error("Raqib sardorga taklif yuborilgan — javobini kuting");
  }
  const target = asLeader ? 1 : team;
  const pending = room.invites.filter(i => i.team === target).length;
  if (room.teams[target].length + pending >= MAX_TEAM) throw new Error(`Jamoada eng ko'pi ${MAX_TEAM} o'yinchi bo'ladi`);

  const inv = {
    id: randomBytes(5).toString("hex"), userId: to.id, name: to.name, team: target, leader: asLeader,
    fromId: from.id, fromName: from.name, expiresAt: now() + INVITE_TTL_MS, createdAt: now(),
  };
  room.invites.push(inv);
  notify(room);
  sendToUser(to.id, "team", { invite: viewInvite(room, inv) });
  return inv;
}

function findInvite(inviteId, userId) {
  for (const room of rooms.values()) {
    const inv = room.invites.find(i => i.id === inviteId && i.userId === userId);
    if (inv) return { room, inv };
  }
  return null;
}
function dropInvite(room, inv, state) {
  room.invites = room.invites.filter(i => i !== inv);
  sendToUser(inv.userId, "team", { inviteClosed: inv.id, state });
}

export function acceptInvite(inviteId, user) {
  const found = findInvite(inviteId, user.id);
  if (!found || found.room.status !== "lobby") throw new Error("Taklif endi amal qilmaydi");
  const { room, inv } = found;
  if (isInTeamGame(user.id)) throw new Error("Siz allaqachon jamoaviy o'yindasiz");
  if (room.teams[inv.team].length >= MAX_TEAM) throw new Error("Jamoa to'lib qoldi");
  dropInvite(room, inv, "accepted");
  room.teams[inv.team].push(member(user, { leader: inv.leader }));
  notify(room);
  return room;
}
export function declineInvite(inviteId, user) {
  const found = findInvite(inviteId, user.id);
  if (!found) return;
  dropInvite(found.room, found.inv, "declined");
  sendToUser(found.inv.fromId, "team", { note: `${user.name} taklifni rad etdi` });
  notify(found.room);
}

/** Sardor o'yinchini chiqaradi yoki yuborilgan taklifni bekor qiladi. */
export function kick(room, leader, targetId) {
  if (room.status !== "lobby") throw new Error("O'yin boshlangan");
  const team = teamOf(room, leader.id);
  if (team === -1 || !room.teams[team].find(m => m.userId === leader.id)?.leader) throw new Error("Faqat sardor chiqara oladi");
  const inv = room.invites.find(i => i.userId === targetId && (i.team === team || (i.leader && room.ownerId === leader.id)));
  if (inv) { dropInvite(room, inv, "cancelled"); notify(room); return; }
  const m = room.teams[team].find(x => x.userId === targetId);
  if (!m || m.leader) throw new Error("O'yinchi topilmadi");
  room.teams[team] = room.teams[team].filter(x => x.userId !== targetId);
  sendToUser(targetId, "team", { room: null, note: "Sardor sizni jamoadan chiqardi" });
  notify(room);
}

/** O'yinchi xonadan chiqadi. Xona egasi chiqsa — xona yopiladi. */
export function leave(room, userId) {
  const team = teamOf(room, userId);
  if (team === -1) return;
  if (room.status === "lobby") {
    const me = room.teams[team].find(m => m.userId === userId);
    if (room.ownerId === userId) return closeRoom(room, "Xona egasi xonani yopdi");
    room.teams[team] = room.teams[team].filter(m => m.userId !== userId);
    if (me.leader) {
      // Raqib sardor chiqdi — uning jamoasi tarqaladi
      for (const m of room.teams[team]) sendToUser(m.userId, "team", { room: null, note: "Sardoringiz xonadan chiqdi" });
      for (const inv of room.invites.filter(i => i.team === team)) dropInvite(room, inv, "cancelled");
      room.teams[team] = [];
    }
    sendToUser(userId, "team", { room: null });
    notify(room);
    return;
  }
  if (room.status === "active") {
    // O'yin paytida chiqqan o'yinchi — shu paytgacha to'plagan ochkosi qoladi
    const p = room.progress[userId];
    if (p && !p.done) { p.done = true; p.left = true; }
    checkEnd(room);
    notify(room);
  }
}

function closeRoom(room, note) {
  room.status = "closed";
  room.finishedAt = now();
  for (const inv of room.invites) sendToUser(inv.userId, "team", { inviteClosed: inv.id, state: "cancelled" });
  room.invites = [];
  for (const m of room.teams.flat()) sendToUser(m.userId, "team", { room: null, note: m.userId === room.ownerId ? null : note });
  rooms.delete(room.id);
}

export function start(room, userId) {
  if (room.status !== "lobby") throw new Error("O'yin allaqachon boshlangan");
  if (room.ownerId !== userId) throw new Error("O'yinni xona egasi boshlaydi");
  if (!room.teams[1].length) throw new Error("Avval raqib sardorni chaqiring");
  for (const inv of room.invites) sendToUser(inv.userId, "team", { inviteClosed: inv.id, state: "cancelled" });
  room.invites = [];
  room.status = "active";
  room.startsAt = now() + COUNTDOWN_MS;
  room.endsAt = room.startsAt + room.duration * 1000;
  room.seed = randomInt(1, 2 ** 31 - 1);
  room.progress = Object.fromEntries(room.teams.flat().map(m => [m.userId, { score: 0, done: false }]));
  notify(room);
}

/** O'yinchi ochkosini yuboradi. */
export function report(room, userId, { score, done }) {
  if (room.status !== "active") throw new Error("O'yin tugagan");
  const p = room.progress[userId];
  if (!p) throw new Error("Siz bu o'yinda emassiz");
  if (now() < room.startsAt || p.done) return;
  const def = TEAM_GAMES[room.game];
  const n = Math.floor(Number(score));
  if (Number.isFinite(n)) p.score = Math.max(p.score, Math.min(n, def.maxScore));
  if (done) p.done = true;
  checkEnd(room);
  notify(room);
}

/** Jamoa ochkosi: eng yaxshi `count` ta natija yig'indisi. */
function teamScore(room, i, count) {
  return room.teams[i].map(m => room.progress[m.userId]?.score ?? 0).sort((a, b) => b - a).slice(0, count).reduce((s, x) => s + x, 0);
}
function scores(room) {
  const count = Math.max(1, Math.min(room.teams[0].length, room.teams[1].length));
  return { count, totals: [teamScore(room, 0, count), teamScore(room, 1, count)] };
}

function checkEnd(room, force = false) {
  if (room.status !== "active") return;
  if (!force && !Object.values(room.progress).every(p => p.done)) return;
  const { totals } = scores(room);
  const winner = totals[0] === totals[1] ? null : (totals[0] > totals[1] ? 0 : 1);
  room.status = "finished";
  room.finishedAt = now();
  room.result = { winner, rewards: {} };
  room.teams.forEach((team, i) => {
    const points = winner == null ? REWARD_DRAW : (winner === i ? REWARD_WIN : 0);
    for (const m of team) {
      const user = getUserById(m.userId);
      if (!user) continue;
      room.result.rewards[m.userId] = points;
      updateUser(m.userId, {
        totalScore: (user.totalScore || 0) + points,
        teamGamesPlayed: (user.teamGamesPlayed || 0) + 1,
        teamGamesWon: (user.teamGamesWon || 0) + (winner === i ? 1 : 0),
      });
    }
  });
}

// Har soniyada: muddati o'tgan takliflar, vaqti tugagan o'yinlar, eski xonalar
function sweep() {
  const t = now();
  for (const room of [...rooms.values()]) {
    if (room.status === "lobby") {
      const expired = room.invites.filter(i => t > i.expiresAt);
      if (expired.length) {
        for (const inv of expired) dropInvite(room, inv, "expired");
        notify(room);
      }
      if (t - room.createdAt > LOBBY_TTL_MS) closeRoom(room, "Xona uzoq vaqt boshlanmagani uchun yopildi");
    } else if (room.status === "active") {
      if (t > room.endsAt + 4000) { checkEnd(room, true); notify(room); }
    } else if (t - (room.finishedAt ?? room.createdAt) > KEEP_FINISHED_MS) {
      rooms.delete(room.id);
    }
  }
}
setInterval(sweep, 1000).unref();

// ── Ko'rinish ─────────────────────────────────────────────────────────────

function viewInvite(room, inv) {
  return {
    id: inv.id, roomId: room.id, game: room.game, title: room.title, leader: inv.leader, team: inv.team,
    fromName: inv.fromName, expiresAt: inv.expiresAt, createdAt: inv.createdAt, serverNow: now(),
    sizes: room.teams.map(t => t.length),
  };
}

export function viewRoom(room, userId) {
  const { count, totals } = room.status === "lobby" ? { count: 0, totals: [0, 0] } : scores(room);
  return {
    id: room.id, game: room.game, title: room.title, duration: room.duration, status: room.status,
    ownerId: room.ownerId, myTeam: teamOf(room, userId), maxTeam: MAX_TEAM,
    teams: room.teams.map(team => team.map(m => ({
      ...m,
      score: room.progress[m.userId]?.score ?? 0,
      done: room.progress[m.userId]?.done ?? false,
    }))),
    invites: room.invites.map(i => ({ id: i.id, userId: i.userId, name: i.name, team: i.team, leader: i.leader, expiresAt: i.expiresAt })),
    startsAt: room.startsAt, endsAt: room.endsAt, seed: room.seed, finishedAt: room.finishedAt,
    counted: count, totals, result: room.result, serverNow: now(),
  };
}

function notify(room) {
  for (const m of room.teams.flat()) sendToUser(m.userId, "team", { room: viewRoom(room, m.userId) });
}
