import { Router } from "express";
import multer from "multer";
import { dirname, join, extname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import { randomBytes } from "crypto";
import { requireAuth } from "../lib/auth.js";
import { read, write, getUserById, isGradeOpen } from "../lib/db.js";
import { saveFile, loadFile } from "../lib/storage.js";
import { sendToUser } from "../lib/events.js";
import { findProfanity, maskWord } from "../lib/profanity.js";
import { addStrike, warningText, logFlag } from "../lib/moderation.js";
import { searchStudents, publicUser } from "../lib/friends.js";

// ── O'quvchilar o'rtasidagi chat ──────────────────────────────────────────
// Ikki o'quvchi bir-biriga matn, rasm, ovozli xabar, video va istalgan fayl
// yubora oladi. Xabarlar "chat_messages" to'plamida, fayllar uploads/chat
// papkasida (Postgres bo'lsa — bazada ham) saqlanadi. Yangi xabar haqida
// faqat suhbatdoshga shaxsiy hodisa boradi (events.js → sendToUser).
const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAT_DIR = join(__dirname, "../../uploads/chat");
const FILE_PREFIX = "/api/chat/files/";

const MAX_FILE_MB = 25;
const MAX_TEXT = 4000;
const MAX_PER_DIALOG = 500;       // bir suhbatda shuncha xabar saqlanadi (eskilari o'chadi)
const RATE_WINDOW_MS = 30_000;
const RATE_MAX = 40;              // 30 soniyada eng ko'pi shuncha xabar

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_MB * 1024 * 1024 } });

// Brauzerda to'g'ridan-to'g'ri ochiladigan turlar. Qolgan hamma narsa (shu
// jumladan html va svg) faqat yuklab olinadi — sahifada skript ishlab ketmasin.
const INLINE = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", weba: "audio/webm",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};
const EXT_BY_MIME = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/webm": "weba",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};
const BAD_NAME_CHARS = /[\\/:*?"<>|\x00-\x1f]/g;

const messages = () => read("chat_messages");
const save = list => write("chat_messages", list, { silent: true });
const nextId = list => (list.length ? Math.max(...list.map(m => m.id)) + 1 : 1);
const between = (m, a, b) => (m.from === a && m.to === b) || (m.from === b && m.to === a);

function peerOf(req, res) {
  const peer = getUserById(Number(req.params.userId));
  if (!peer || peer.role !== "student" || peer.id === req.user.id || !isGradeOpen(peer.grade)) {
    res.status(404).json({ error: "O'quvchi topilmadi" });
    return null;
  }
  return peer;
}
function onlyStudent(req, res, next) {
  if (req.user.role !== "student") return res.status(403).json({ error: "Faqat o'quvchilar uchun" });
  next();
}

const recent = new Map();   // userId → so'nggi xabar vaqtlari
function tooFast(userId) {
  const t = Date.now();
  const list = (recent.get(userId) ?? []).filter(x => t - x < RATE_WINDOW_MS);
  list.push(t);
  recent.set(userId, list);
  return list.length > RATE_MAX;
}

/** Faylni saqlaydi va xabarga qo'shiladigan tavsifni qaytaradi. */
function storeFile(file, { voice = false, duration = null } = {}) {
  if (!existsSync(CHAT_DIR)) mkdirSync(CHAT_DIR, { recursive: true });
  const mime = String(file.mimetype || "").split(";")[0].toLowerCase();
  // Brauzer yuborgan nom latin1 bo'lib keladi (multer) — utf8 ga qaytaramiz
  const original = Buffer.from(file.originalname || "fayl", "latin1").toString("utf8").replace(BAD_NAME_CHARS, "_").slice(0, 120);
  const fromName = extname(original).slice(1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const ext = EXT_BY_MIME[mime] ?? (fromName || "bin");
  const key = `${randomBytes(12).toString("hex")}.${ext}`;
  writeFileSync(join(CHAT_DIR, key), file.buffer);
  saveFile(key, mime || "application/octet-stream", file.buffer);

  const inline = INLINE[ext];
  let kind = "file";
  if (inline?.startsWith("image/")) kind = "image";
  else if (voice && (inline?.startsWith("audio/") || inline?.startsWith("video/"))) kind = "voice";
  else if (inline?.startsWith("audio/")) kind = "audio";
  else if (inline?.startsWith("video/")) kind = "video";
  return {
    kind,
    file: { url: FILE_PREFIX + key, key, name: original, size: file.size, mime: inline ?? "application/octet-stream", duration },
  };
}
function removeFiles(list) {
  for (const m of list) {
    if (!m.file?.key) continue;
    try { unlinkSync(join(CHAT_DIR, m.file.key)); } catch {}
  }
}

/** Javob berilgan xabarning qisqa ko'rinishi. */
function replyPreview(list, id) {
  const m = id ? list.find(x => x.id === id) : null;
  if (!m) return null;
  return { id: m.id, from: m.from, kind: m.kind, text: (m.text || "").slice(0, 120), fileName: m.file?.name ?? null };
}
function toJson(m, list) {
  return { ...m, reply: replyPreview(list, m.replyTo) };
}
const BLOCKED_TEXT = "Do'stlar chati siz uchun bloklangan (haqoratli so'zlar uchun 3 ta ogohlantirish). Blokni o'qituvchi ochadi.";

/** Bloklangan o'quvchi yoza olmaydi (o'qish mumkin). */
function notBlocked(req, res, next) {
  if (req.user.chatBlocked) return res.status(403).json({ error: BLOCKED_TEXT, blocked: true });
  next();
}

/**
 * Matnni tekshiradi. So'kinish bo'lsa — xabar yuborilmaydi, o'quvchi
 * ogohlantirish oladi (3-chisida avtomatik bloklanadi), o'qituvchiga yozuv tushadi.
 */
function checkText(text, req, res, peer) {
  if (text.length > MAX_TEXT) {
    res.status(400).json({ error: `Xabar ${MAX_TEXT} belgidan oshmasin` });
    return false;
  }
  const bad = text ? findProfanity(text) : [];
  if (!bad.length) return true;

  const { warnings, blocked } = addStrike(req.user.id);
  const answer = warningText(warnings, req.user.language === "ru" ? "ru" : "uz", blocked).replaceAll("**", "");
  logFlag({
    userId: req.user.id, userName: req.user.name, role: req.user.role,
    question: `[Do'stlar chati${peer ? " → " + peer.name : ""}] ${text}`, answer,
    badWords: bad.map(maskWord), warningNo: warnings, autoBlocked: blocked, detectedBy: "filter", source: "chat",
  });
  res.status(blocked ? 403 : 400).json({ error: answer, warning: true, warnings, blocked });
  return false;
}

// ── Qidiruv va suhbatlar ro'yxati ─────────────────────────────────────────

router.get("/chat/users", requireAuth, onlyStudent, (req, res) => {
  res.json(searchStudents({ q: req.query.q, className: req.query.className, exceptId: req.user.id }));
});

router.get("/chat/dialogs", requireAuth, onlyStudent, (req, res) => {
  const me = req.user.id;
  const byPeer = new Map();
  for (const m of messages()) {
    if (m.from !== me && m.to !== me) continue;
    const peerId = m.from === me ? m.to : m.from;
    const d = byPeer.get(peerId) ?? { peerId, last: null, unread: 0 };
    if (!d.last || m.id > d.last.id) d.last = m;
    if (m.to === me && !m.readAt) d.unread++;
    byPeer.set(peerId, d);
  }
  const dialogs = [...byPeer.values()]
    .map(d => {
      const peer = getUserById(d.peerId);
      if (!peer) return null;
      const m = d.last;
      return {
        peer: publicUser(peer),
        unread: d.unread,
        last: {
          id: m.id, from: m.from, kind: m.kind, text: (m.text || "").slice(0, 140),
          fileName: m.file?.name ?? null, createdAt: m.createdAt, readAt: m.readAt ?? null,
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.last.id - a.last.id);
  res.json({ dialogs, unread: dialogs.reduce((s, d) => s + d.unread, 0) });
});

router.get("/chat/unread", requireAuth, (req, res) => {
  const me = req.user.id;
  res.json({ unread: messages().filter(m => m.to === me && !m.readAt).length });
});

// ── Bitta suhbat ──────────────────────────────────────────────────────────

router.get("/chat/with/:userId", requireAuth, onlyStudent, (req, res) => {
  const peer = peerOf(req, res);
  if (!peer) return;
  const me = req.user.id;
  const all = messages();
  const limit = Math.min(Number(req.query.limit) || 60, 200);
  const before = Number(req.query.before) || Infinity;

  // Ochilgan suhbatdagi kelgan xabarlar "o'qildi" bo'ladi
  const now = new Date().toISOString();
  const readIds = [];
  for (const m of all) {
    if (m.from === peer.id && m.to === me && !m.readAt) { m.readAt = now; readIds.push(m.id); }
  }
  if (readIds.length) {
    save(all);
    sendToUser(peer.id, "chat", { type: "read", peerId: me, ids: readIds, readAt: now });
  }

  const dialog = all.filter(m => between(m, me, peer.id));
  const page = dialog.filter(m => m.id < before).slice(-limit);
  res.json({
    peer: publicUser(peer),
    messages: page.map(m => toJson(m, all)),
    hasMore: page.length > 0 && dialog[0].id < page[0].id,
  });
});

// Xabar yuborish: JSON { text, replyTo } yoki multipart (file + text + replyTo + voice + duration)
router.post("/chat/with/:userId", requireAuth, onlyStudent, notBlocked, upload.single("file"), (req, res) => {
  const peer = peerOf(req, res);
  if (!peer) return;
  const me = req.user.id;
  const text = String(req.body?.text ?? "").trim();
  if (!text && !req.file) return res.status(400).json({ error: "Xabar bo'sh" });
  if (!checkText(text, req, res, peer)) return;
  if (tooFast(me)) return res.status(429).json({ error: "Juda tez yozyapsiz, biroz kuting" });

  const all = messages();
  const replyTo = Number(req.body?.replyTo) || null;
  const duration = Math.min(Math.max(Number(req.body?.duration) || 0, 0), 3600) || null;
  const media = req.file
    ? storeFile(req.file, { voice: String(req.body?.voice) === "1", duration })
    : { kind: "text", file: null };

  const msg = {
    id: nextId(all), from: me, to: peer.id,
    kind: media.kind, text, file: media.file,
    replyTo: replyTo && all.some(m => m.id === replyTo && between(m, me, peer.id)) ? replyTo : null,
    createdAt: new Date().toISOString(), readAt: null, editedAt: null,
  };
  all.push(msg);

  // Suhbat juda uzun bo'lib ketsa — eng eski xabarlar (va ularning fayllari) o'chadi
  const dialog = all.filter(m => between(m, me, peer.id));
  let list = all;
  if (dialog.length > MAX_PER_DIALOG) {
    const drop = new Set(dialog.slice(0, dialog.length - MAX_PER_DIALOG).map(m => m.id));
    removeFiles(all.filter(m => drop.has(m.id)));
    list = all.filter(m => !drop.has(m.id));
  }
  save(list);

  const json = toJson(msg, list);
  sendToUser(peer.id, "chat", { type: "new", peerId: me, message: json, from: publicUser(req.user) });
  sendToUser(me, "chat", { type: "new", peerId: peer.id, message: json });
  res.status(201).json(json);
});

// O'z xabarini tahrirlash (faqat matn)
router.put("/chat/messages/:id", requireAuth, onlyStudent, notBlocked, (req, res) => {
  const all = messages();
  const m = all.find(x => x.id === Number(req.params.id));
  if (!m || m.from !== req.user.id) return res.status(404).json({ error: "Xabar topilmadi" });
  const text = String(req.body?.text ?? "").trim();
  if (!text && !m.file) return res.status(400).json({ error: "Xabar bo'sh" });
  if (!checkText(text, req, res, getUserById(m.to))) return;
  m.text = text;
  m.editedAt = new Date().toISOString();
  save(all);
  const json = toJson(m, all);
  sendToUser(m.to, "chat", { type: "edit", peerId: m.from, message: json });
  sendToUser(m.from, "chat", { type: "edit", peerId: m.to, message: json });
  res.json(json);
});

// O'z xabarini o'chirish (ikkala tomonda ham o'chadi)
router.delete("/chat/messages/:id", requireAuth, onlyStudent, (req, res) => {
  const all = messages();
  const m = all.find(x => x.id === Number(req.params.id));
  if (!m || m.from !== req.user.id) return res.status(404).json({ error: "Xabar topilmadi" });
  removeFiles([m]);
  save(all.filter(x => x.id !== m.id));
  sendToUser(m.to, "chat", { type: "delete", peerId: m.from, id: m.id });
  sendToUser(m.from, "chat", { type: "delete", peerId: m.to, id: m.id });
  res.json({ success: true });
});

// "yozmoqda..." belgisi
router.post("/chat/typing/:userId", requireAuth, onlyStudent, (req, res) => {
  const peer = peerOf(req, res);
  if (!peer) return;
  sendToUser(peer.id, "chat", { type: "typing", peerId: req.user.id });
  res.json({ ok: true });
});

// ── Fayllar ───────────────────────────────────────────────────────────────
// <img>/<audio> teglari token yubora olmaydi, shuning uchun ochiq; nomlar
// tasodifiy va taxmin qilib bo'lmaydi.
router.get("/chat/files/:name", async (req, res) => {
  const name = String(req.params.name);
  if (!/^[a-f0-9]{24}\.[a-z0-9]{1,8}$/.test(name)) return res.status(404).end();
  if (!existsSync(CHAT_DIR)) mkdirSync(CHAT_DIR, { recursive: true });
  const path = join(CHAT_DIR, name);
  if (!(await loadFile(name, path))) return res.status(404).end();

  const inline = INLINE[name.split(".").pop()];
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "private, max-age=31536000, immutable");
  if (inline && req.query.download == null) {
    res.type(inline);
  } else {
    const original = messages().find(m => m.file?.key === name)?.file?.name || name;
    res.type("application/octet-stream");
    res.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(original)}`);
  }
  res.sendFile(path, err => { if (err && !res.headersSent) res.status(404).end(); });
});

// Fayl juda katta bo'lsa — tushunarli xabar
router.use("/chat", (err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: `Fayl ${MAX_FILE_MB} MB dan oshmasin` });
  next(err);
});

export default router;
