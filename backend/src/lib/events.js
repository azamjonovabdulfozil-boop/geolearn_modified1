// ── Real vaqt hodisalari (Server-Sent Events) ─────────────────────────────
// db.js dagi har bir write() shu yerga "qaysi to'plam o'zgardi" deb xabar
// beradi. Ochiq sahifalar /api/events orqali ulanib turadi va kerakli
// ma'lumotni qayta yuklaydi — saytni yangilash (refresh) shart emas.
// Hodisada ma'lumotning o'zi yo'q, faqat to'plam nomi bo'ladi: har bir
// mijoz uni o'z huquqlari bilan qayta so'raydi.

const clients = new Set();
const pending = new Set();
let flushTimer = null;

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
  const ping = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
  req.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
  });
}
