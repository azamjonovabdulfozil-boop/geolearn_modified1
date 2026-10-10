// ── Real vaqt hodisalari (Server-Sent Events) ─────────────────────────────
// db.js dagi har bir write() shu yerga "qaysi to'plam o'zgardi" deb xabar
// beradi. Ochiq sahifalar /api/events orqali ulanib turadi va kerakli
// ma'lumotni qayta yuklaydi — saytni yangilash (refresh) shart emas.
// Hodisada ma'lumotning o'zi yo'q, faqat to'plam nomi bo'ladi: har bir
// mijoz uni o'z huquqlari bilan qayta so'raydi.
//
// Bundan tashqari, mijoz ulanishda tokenini bersa (/api/events?token=...),
// unga shaxsiy hodisalar ham yuboriladi: do'stining xabari, o'yinga taklif,
// 1v1 o'yindagi yurish. Bular faqat o'sha foydalanuvchiga boradi.

const clients = new Set();
const byUser = new Map();   // userId → Set<res>
const pending = new Set();
let flushTimer = null;
let resolveUser = null;

const FLUSH_MS = 400;       // bir nechta yozuvni bitta hodisaga jamlaymiz (ko'p foydalanuvchida kamroq to'lqin)
const HEARTBEAT_MS = 25000; // proksi/hosting ulanishni uzib qo'ymasligi uchun

function flush() {
  flushTimer = null;
  if (!pending.size) return;
  const msg = `event: change\ndata: ${JSON.stringify({ c: [...pending] })}\n\n`;
  pending.clear();
  for (const res of clients) res.write(msg);
}

/** To'plam o'zgarganini barcha ulangan mijozlarga bildiradi. */
export function notifyChange(collection) {
  pending.add(collection);
  flushTimer ??= setTimeout(flush, FLUSH_MS);
}

/** Tokendan foydalanuvchi id'sini aniqlaydigan funksiya (auth.js o'rnatadi). */
export function setUserResolver(fn) {
  resolveUser = fn;
}

/** Bitta foydalanuvchining barcha ochiq sahifalariga shaxsiy hodisa yuboradi. */
export function sendToUser(userId, event, data) {
  const set = byUser.get(userId);
  if (!set?.size) return false;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
  for (const res of set) res.write(msg);
  return true;
}

/** Foydalanuvchi hozir saytda (ulanib turibdi)mi? */
export function isUserConnected(userId) {
  return (byUser.get(userId)?.size ?? 0) > 0;
}

/** GET /api/events — SSE oqimi. */
export function eventsHandler(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  clients.add(res);

  let userId = null;
  try { userId = resolveUser?.(req.query?.token) ?? null; } catch {}
  if (userId != null) {
    if (!byUser.has(userId)) byUser.set(userId, new Set());
    byUser.get(userId).add(res);
  }

  const ping = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
  req.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
    if (userId != null) {
      const set = byUser.get(userId);
      set?.delete(res);
      if (set && !set.size) byUser.delete(userId);
    }
  });
}
