import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { randomBytes } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { currentScope, contentInSection, parseSection } from "./scope.js";
import { GRADES } from "./constants.js";
import { notifyChange } from "./events.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function filePath(name) { return join(DATA_DIR, `${name}.json`); }

export function read(name) {
  const p = filePath(name);
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return []; }
}

export function write(name, data, { silent = false } = {}) {
  writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf8");
  // Real vaqt: ochiq sahifalarga "shu ma'lumot o'zgardi" deb xabar beramiz
  if (!silent) notifyChange(name);
}

function nextId(list) {
  return list.length === 0 ? 1 : Math.max(...list.map(i => i.id ?? 0)) + 1;
}

// ── Bloklangan sinflar ──
// Admin sozlamalarda sinfni (1–11) bloklasa — shu sinfdagi darslar, videolar,
// uy ishlari, sinflar va o'quvchilar hech qayerda ko'rinmaydi.
export function getBlockedGrades() {
  const s = read("settings");
  const list = Array.isArray(s?.blockedGrades) ? s.blockedGrades : [];
  return list.map(Number).filter(g => GRADES.includes(g));
}
export function setBlockedGrades(grades) {
  const s = read("settings");
  const blocked = [...new Set((grades ?? []).map(Number))].filter(g => GRADES.includes(g)).sort((a, b) => a - b);
  write("settings", { ...(Array.isArray(s) ? {} : s), blockedGrades: blocked });
  return blocked;
}
/** Sinf ochiqmi? (grade yo'q bo'lsa — ha) */
export function isGradeOpen(g) {
  if (g == null || g === "") return true;
  return !getBlockedGrades().includes(Number(g));
}
/** Bloklanmagan sinflar ro'yxati. */
export function openGrades() {
  const blocked = getBlockedGrades();
  return GRADES.filter(g => !blocked.includes(g));
}
function openOnly(list) {
  const blocked = getBlockedGrades();
  return blocked.length ? list.filter(x => x.grade == null || !blocked.includes(Number(x.grade))) : list;
}

// ── Bo'lim (o'zbek / rus sinflar) bo'yicha filtr ──
// Admin tanlagan bo'lim faqat o'qituvchi so'rovlarida o'quvchilarni
// filtrlaydi; kontent (dars, video, o'yin, uy ishi) esa ham o'qituvchi,
// ham o'quvchi uchun o'z bo'limiga qarab ko'rsatiladi.
function teacherSection() {
  const s = currentScope();
  return s?.role === "teacher" ? s.section : null;
}
function contentSection() {
  return currentScope()?.section ?? null;
}
function scopeContent(list) {
  const section = contentSection();
  return section ? list.filter(x => contentInSection(x, section)) : list;
}
/** Bo'limdagi o'quvchilar id'lari (filtr yo'q bo'lsa — null). */
function sectionStudentIds() {
  const section = teacherSection();
  if (!section) return null;
  const classes = read("classes");
  return new Set(read("users")
    .filter(u => u.role === "student" && userSection(u, classes) === section)
    .map(u => u.id));
}
function scopeByUser(list, field = "userId") {
  const ids = sectionStudentIds();
  return ids ? list.filter(x => ids.has(x[field])) : list;
}

// ── Users ──────────────────────────────────────
export function getUsers() {
  const blocked = getBlockedGrades();
  const list = read("users").filter(u => u.role !== "student" || !blocked.includes(Number(u.grade)));
  const section = teacherSection();
  if (!section) return list;
  const classes = read("classes");
  return list.filter(u => u.role !== "student" || userSection(u, classes) === section);
}
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
export function getLessons()       { return openOnly(scopeContent(read("lessons"))); }
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

/** Mavzular darslikdagi ketma-ketlikda qaytariladi (order → id). */
export function getTopicsByLesson(lessonId) {
  return read("topics")
    .filter(t => t.lessonId === lessonId)
    .sort((a, b) => (a.order ?? a.id ?? 0) - (b.order ?? b.id ?? 0) || (a.id ?? 0) - (b.id ?? 0));
}
export function getTopicById(id)             { return read("topics").find(t => t.id === id) ?? null; }

export function createTopic(data) {
  const list = read("topics");
  const sameLesson = list.filter(t => t.lessonId === data.lessonId);
  const topic = {
    id: nextId(list),
    createdAt: new Date().toISOString(),
    tests: [],
    order: sameLesson.length,   // darslikdagi tartib
    ...data,
  };
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
export function getVideos()       { return openOnly(scopeContent(read("videos"))); }
export function getVideoById(id)  { return read("videos").find(v => v.id === id) ?? null; }

export function createVideo(data) {
  const list = read("videos");
  const video = { id: nextId(list), createdAt: new Date().toISOString(), ...data };
  write("videos", [...list, video]);
  return video;
}

export function deleteVideo(id) {
  write("videos", read("videos").filter(v => v.id !== id));
  write("video_views", read("video_views").filter(v => v.videoId !== id));
}

// ── Video ko'rishlari (kim qaysi videoni ko'rgan) ──
export function getVideoViews()            { return scopeByUser(read("video_views")); }
export function getViewsByVideo(videoId)   { return getVideoViews().filter(v => v.videoId === videoId); }

/**
 * O'quvchi videoni ochganini yozib qo'yadi. Bir o'quvchi + bir video
 * uchun bitta yozuv saqlanadi: qayta ko'rsa hisoblagich oshadi.
 */
export function recordVideoView({ videoId, userId }) {
  const list = read("video_views");
  const now = new Date().toISOString();
  const idx = list.findIndex(v => v.videoId === videoId && v.userId === userId);
  if (idx === -1) {
    const item = {
      id: nextId(list), videoId, userId, views: 1,
      firstViewedAt: now, lastViewedAt: now,
      positionSec: 0, durationSec: 0, percent: 0,
      watchedSec: 0, completed: false, completedAt: null,
    };
    write("video_views", [...list, item]);
    return item;
  }
  list[idx] = { ...list[idx], views: (list[idx].views || 1) + 1, lastViewedAt: now };
  write("video_views", list);
  return list[idx];
}

/** Videoni qanchasi ko'rilgani — 0..100 oralig'ida. */
export function watchPercent(view) {
  if (!view) return 0;
  if (view.percent != null) return Math.max(0, Math.min(100, Math.round(view.percent)));
  if (view.durationSec > 0) return Math.min(100, Math.round((view.positionSec / view.durationSec) * 100));
  return 0;
}

/**
 * Videoni ko'rish jarayonini yangilaydi (pleyer har bir necha soniyada
 * yuboradi). `percent` faqat o'sadi — o'quvchi orqaga qaytarsa ham
 * "eng ko'p qayergacha ko'rgani" saqlanib qoladi.
 */
export function updateVideoProgress({ videoId, userId, positionSec = 0, durationSec = 0, watchedDelta = 0, ended = false }) {
  const list = read("video_views");
  const now = new Date().toISOString();
  const idx = list.findIndex(v => v.videoId === videoId && v.userId === userId);
  const base = idx === -1
    ? { id: nextId(list), videoId, userId, views: 1, firstViewedAt: now, watchedSec: 0, percent: 0, completed: false, completedAt: null }
    : list[idx];

  const duration = durationSec > 0 ? Math.round(durationSec) : (base.durationSec || 0);
  const position = Math.max(0, Math.round(positionSec));
  const rawPercent = duration > 0 ? (position / duration) * 100 : 0;
  const percent = Math.min(100, Math.max(base.percent || 0, ended ? 100 : rawPercent));
  const completed = percent >= COMPLETE_PERCENT || ended;

  const item = {
    ...base,
    durationSec: duration,
    positionSec: position,
    percent: Math.round(percent),
    watchedSec: Math.round((base.watchedSec || 0) + Math.max(0, watchedDelta)),
    completed,
    completedAt: completed ? (base.completedAt || now) : null,
    lastViewedAt: now,
  };

  if (idx === -1) write("video_views", [...list, item]);
  else { list[idx] = item; write("video_views", list); }
  return item;
}

/** Video "oxirigacha ko'rildi" deb hisoblanadigan chegara. */
export const COMPLETE_PERCENT = 90;
/** "Yarmini ko'rdi" chegarasi. */
export const HALF_PERCENT = 45;

/** Ko'rish holati: ochgan / boshlagan / yarmini / tugatgan. */
export function watchStatus(view) {
  const p = watchPercent(view);
  if (view?.completed || p >= COMPLETE_PERCENT) return "completed";
  if (p >= HALF_PERCENT) return "half";
  if (p > 0) return "started";
  return "opened";
}

// ── Games ──────────────────────────────────────
export function getGames()             { return scopeContent(read("games")); }
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

// ── Test variantlari (har bir urinish uchun) ───
// Har bir o'quvchi testni boshlaganda savollar tasodifiy tanlanadi va
// javoblar shu yerda saqlanadi. Shu tufayli to'g'ri javoblar brauzerga
// yuborilmaydi va har safar yangi variant tushadi.
const MAX_VARIANTS = 800;
const VARIANT_TTL_MS = 24 * 60 * 60 * 1000;

export function getVariant(id) {
  return read("test_variants").find(v => v.id === id) ?? null;
}

export function createVariant(data) {
  const now = Date.now();
  const list = read("test_variants")
    .filter(v => now - new Date(v.createdAt).getTime() < VARIANT_TTL_MS)
    .slice(-MAX_VARIANTS + 1);
  const variant = {
    id: randomBytes(9).toString("hex"),
    createdAt: new Date().toISOString(),
    answers: {},
    finished: false,
    ...data,
  };
  write("test_variants", [...list, variant]);
  return variant;
}

export function updateVariant(id, patch) {
  const list = read("test_variants");
  const idx = list.findIndex(v => v.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  write("test_variants", list);
  return list[idx];
}

// ── Activity ───────────────────────────────────
export function getActivity()               { return scopeByUser(read("activity")); }
export function getActivityByUser(userId)   { return read("activity").filter(a => a.userId === userId); }

export function createActivity(data) {
  const list = read("activity");
  const item = { id: nextId(list), createdAt: new Date().toISOString(), ...data };
  write("activity", [...list, item]);
  return item;
}

// ── Homework (uy ishi) ─────────────────────────
export function getHomeworks()      { return openOnly(scopeContent(read("homework"))); }
export function getHomeworkById(id) { return read("homework").find(h => h.id === id) ?? null; }

export function createHomework(data) {
  const list = read("homework");
  const hw = { id: nextId(list), createdAt: new Date().toISOString(), studentIds: [], ...data };
  write("homework", [...list, hw]);
  return hw;
}

export function updateHomework(id, patch) {
  const list = read("homework");
  const idx = list.findIndex(h => h.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  write("homework", list);
  return list[idx];
}

export function deleteHomework(id) {
  write("homework", read("homework").filter(h => h.id !== id));
  write("homework_submissions", read("homework_submissions").filter(s => s.homeworkId !== id));
}

// ── Homework submissions (o'quvchi javoblari) ──
export function getSubmissions()                 { return scopeByUser(read("homework_submissions")); }
export function getSubmissionById(id)            { return read("homework_submissions").find(s => s.id === id) ?? null; }
export function getSubmissionsByHomework(hwId)   { return getSubmissions().filter(s => s.homeworkId === hwId); }
export function getSubmissionOfStudent(hwId, userId) {
  return read("homework_submissions").find(s => s.homeworkId === hwId && s.userId === userId) ?? null;
}

export function createSubmission(data) {
  const list = read("homework_submissions");
  const item = { id: nextId(list), createdAt: new Date().toISOString(), grade: null, feedback: "", ...data };
  write("homework_submissions", [...list, item]);
  return item;
}

export function updateSubmission(id, patch) {
  const list = read("homework_submissions");
  const idx = list.findIndex(s => s.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  write("homework_submissions", list);
  return list[idx];
}

// ── Onlayn holat ("hozir kim saytda") ──────────────────────────────
// Har bir so'rovda users.json ni qayta yozmaslik uchun foydalanuvchi
// vaqti xotirada saqlanadi va faylga eng ko'pi bilan 30 soniyada bir
// marta tushiriladi.
const SEEN_WRITE_MS = 30 * 1000;
const lastWrittenSeen = new Map();

export function touchUserSeen(id) {
  const now = Date.now();
  if (now - (lastWrittenSeen.get(id) || 0) < SEEN_WRITE_MS) return;
  lastWrittenSeen.set(id, now);
  const list = read("users");
  const idx = list.findIndex(u => u.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], lastSeenAt: new Date(now).toISOString() };
  // Faqat "oxirgi ko'rilgan" vaqt — har bir so'rovda hamma sahifalarni
  // qayta yuklatmaslik uchun hodisa yubormaymiz (onlayn ro'yxatlar o'zi yangilanadi)
  write("users", list, { silent: true });
}

/** Oxirgi `minutes` daqiqada faol bo'lgan foydalanuvchilar. */
export function getOnlineUsers(minutes = 5) {
  const cutoff = Date.now() - minutes * 60 * 1000;
  return getUsers().filter(u => u.lastSeenAt && new Date(u.lastSeenAt).getTime() >= cutoff);
}

// ── Sinflar (7-A, 7-B ...) ─────────────────────
// Har bir sinf: { id, name, grade, section: "uz"|"ru", students: [{ id, fullName }] }
// `students` — admin yuklagan ro'yxat (Excel/Word). O'quvchi ro'yxatdan
// o'tganda sinfini qo'lda yozadi va shu nom orqali sinfga bog'lanadi.

/** "7a", "7 - a", "7-A sinf" → { name: "7-A", grade: 7, letter: "A" }; noto'g'ri bo'lsa null. */
export function parseClassName(raw) {
  const m = String(raw ?? "").trim()
    .match(/^(\d{1,2})\s*[-–—_./ ]?\s*["'«]?(\p{L})?["'»]?\s*(?:-?\s*(?:sinf|класс))?$/iu);
  if (!m) return null;
  const grade = Number(m[1]);
  if (!grade) return null;
  const letter = m[2] ? m[2].toLocaleUpperCase() : "";
  return { name: letter ? `${grade}-${letter}` : String(grade), grade, letter };
}

/** Sinf nomini taqqoslash kaliti ("7-a" == "7-A"). */
export function classKey(name) {
  return parseClassName(name)?.name ?? null;
}

// Kirill va lotin harflari bir xil ko'rinadi (7-А / 7-A). Aniq moslik
// topilmasa — shu jadval orqali qidiramiz (faqat bitta sinf mos kelsa).
const LOOKALIKE = { "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X" };
function looseKey(name) {
  const k = classKey(name);
  return k ? k.replace(/./g, ch => LOOKALIKE[ch] ?? ch) : null;
}

/** Sinf nomi bo'yicha sinf yozuvini topadi (bo'limdan qat'i nazar). */
export function findClassByName(name, classes = read("classes")) {
  const key = classKey(name);
  if (!key) return null;
  const exact = classes.find(c => classKey(c.name) === key);
  if (exact) return exact;
  const loose = looseKey(name);
  const similar = classes.filter(c => looseKey(c.name) === loose);
  return similar.length === 1 ? similar[0] : null;
}

/** O'quvchi qaysi bo'limda: sinf yozuvidan, bo'lmasa o'zidagi qiymatdan. */
export function userSection(user, classes = read("classes")) {
  if (user?.role !== "student") return null;
  return findClassByName(user.className, classes)?.section ?? parseSection(user.section);
}

/** O'quvchining sinf nomi (eski yozuvlarda faqat grade bo'ladi). */
export function userClassName(user) {
  return classKey(user?.className) ?? null;
}

export function getClasses() {
  const list = openOnly(read("classes"));
  const section = teacherSection();
  return section ? list.filter(c => c.section === section) : list;
}
export function getClassById(id) { return read("classes").find(c => c.id === id) ?? null; }

export function createClass(data) {
  const list = read("classes");
  const item = { id: nextId(list), createdAt: new Date().toISOString(), students: [], ...data };
  write("classes", [...list, item]);
  return item;
}

export function updateClass(id, patch) {
  const list = read("classes");
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  write("classes", list);
  return list[idx];
}

export function deleteClass(id) {
  write("classes", read("classes").filter(c => c.id !== id));
}
