import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function filePath(name) { return join(DATA_DIR, `${name}.json`); }

export function read(name) {
  const p = filePath(name);
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return []; }
}

export function write(name, data) {
  writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf8");
}

function nextId(list) {
  return list.length === 0 ? 1 : Math.max(...list.map(i => i.id ?? 0)) + 1;
}

// ── Users ──────────────────────────────────────
export function getUsers()         { return read("users"); }
export function getUserById(id)    { return read("users").find(u => u.id === id) ?? null; }
export function getUserByUsername(username) { return read("users").find(u => u.username === username) ?? null; }

export function createUser(data) {
  const list = read("users");
  const user = { id: nextId(list), createdAt: new Date().toISOString(), totalScore: 0, avatarUrl: null, ...data };
  write("users", [...list, user]);
  return user;
}

export function updateUser(id, patch) {
  const list = read("users");
  const idx = list.findIndex(u => u.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  write("users", list);
  return list[idx];
}

export function deleteUser(id) {
  write("users", read("users").filter(u => u.id !== id));
}

// ── Lessons ────────────────────────────────────
export function getLessons()       { return read("lessons"); }
export function getLessonById(id)  { return read("lessons").find(l => l.id === id) ?? null; }

export function createLesson(data) {
  const list = read("lessons");
  const lesson = { id: nextId(list), createdAt: new Date().toISOString(), topics: [], ...data };
  write("lessons", [...list, lesson]);
  return lesson;
}

export function updateLesson(id, patch) {
  const list = read("lessons");
  const idx = list.findIndex(l => l.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  write("lessons", list);
  return list[idx];
}

export function deleteLesson(id) {
  write("lessons", read("lessons").filter(l => l.id !== id));
  write("topics", read("topics").filter(t => t.lessonId !== id));
}

// ── Topics ─────────────────────────────────────
export function getTopics()                  { return read("topics"); }
export function getTopicsByLesson(lessonId)  { return read("topics").filter(t => t.lessonId === lessonId); }
export function getTopicById(id)             { return read("topics").find(t => t.id === id) ?? null; }

export function createTopic(data) {
  const list = read("topics");
  const topic = { id: nextId(list), createdAt: new Date().toISOString(), tests: [], ...data };
  write("topics", [...list, topic]);
  return topic;
}

export function updateTopic(id, patch) {
  const list = read("topics");
  const idx = list.findIndex(t => t.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  write("topics", list);
  return list[idx];
}

export function deleteTopic(id) {
  write("topics", read("topics").filter(t => t.id !== id));
}

// ── Videos ─────────────────────────────────────
export function getVideos()       { return read("videos"); }
export function getVideoById(id)  { return read("videos").find(v => v.id === id) ?? null; }

export function createVideo(data) {
  const list = read("videos");
  const video = { id: nextId(list), createdAt: new Date().toISOString(), ...data };
  write("videos", [...list, video]);
  return video;
}

export function deleteVideo(id) {
  write("videos", read("videos").filter(v => v.id !== id));
}

// ── Games ──────────────────────────────────────
export function getGames()             { return read("games"); }
export function getGameByCode(code)    { return read("games").find(g => g.gameCode === code) ?? null; }

export function createGame(data) {
  const list = read("games");
  const game = { id: nextId(list), createdAt: new Date().toISOString(), status: "waiting", players: [], ...data };
  write("games", [...list, game]);
  return game;
}

export function updateGame(code, patch) {
  const list = read("games");
  const idx = list.findIndex(g => g.gameCode === code);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  write("games", list);
  return list[idx];
}

// ── Activity ───────────────────────────────────
export function getActivity()               { return read("activity"); }
export function getActivityByUser(userId)   { return read("activity").filter(a => a.userId === userId); }

export function createActivity(data) {
  const list = read("activity");
  const item = { id: nextId(list), createdAt: new Date().toISOString(), ...data };
  write("activity", [...list, item]);
  return item;
}
