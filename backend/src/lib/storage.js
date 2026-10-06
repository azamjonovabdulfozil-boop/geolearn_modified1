// ── Doimiy saqlash (Postgres) ─────────────────────────────────────────────
// Render'ning bepul rejasida disk vaqtinchalik: server uxlab-uyg'onganda yoki
// har deploy'da backend/data/*.json o'chib ketadi — o'quvchilar ro'yxatdan
// o'tgan bo'lsa ham keyin kira olmaydi.
//
// DATABASE_URL berilgan bo'lsa (Neon / Supabase — bepul Postgres), har bir
// to'plam (users, activity, ...) bitta qatorda JSON sifatida saqlanadi:
//   • ishga tushganda — bazadagi ma'lumot data/*.json ga yoziladi;
//   • har o'zgarishda — 300 ms ichida bazaga ham yoziladi;
//   • server to'xtaganda (SIGTERM) — kutilayotganlar darhol yoziladi.
// DATABASE_URL bo'lmasa — avvalgidek faqat fayllar (lokal ishlash uchun).
import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "fs";
import { join } from "path";

const URL = process.env.DATABASE_URL || "";
let pool = null;
const pending = new Map();   // name -> json (hali bazaga yozilmagan)
let timer = null;
let flushing = null;

export const persistent = Boolean(URL);

/** Faylni xavfsiz yozadi: avval vaqtinchalik faylga, keyin almashtiradi (yarim yozilgan fayl qolmaydi). */
export function atomicWrite(path, text) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path);
}

/**
 * SSL sozlamasi pastda aniq beriladi — Neon qatoridagi sslmode/channel_binding
 * parametrlari olib tashlanadi (aks holda pg har ishga tushishda ogohlantiradi).
 */
function cleanUrl(raw) {
  try {
    const u = new globalThis.URL(raw);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch { return raw; }
}

async function connect() {
  const { default: pg } = await import("pg");
  pool = new pg.Pool({
    connectionString: cleanUrl(URL),
    ssl: /localhost|127\.0\.0\.1/.test(URL) ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
  });
  pool.on("error", e => console.error("⚠️  Postgres:", e.message));
  await pool.query(`CREATE TABLE IF NOT EXISTS geo_store (
    name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS geo_files (
    name TEXT PRIMARY KEY, mime TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
}

/**
 * Ishga tushganda chaqiriladi. Bazadagi to'plamlarni data/ ga yozadi;
 * bazada hali yo'q (masalan, repo'dagi boshlang'ich darslar) to'plamlarni bazaga yuklaydi.
 */
export async function initStorage(dataDir) {
  if (!URL) {
    console.log("💾 Ma'lumotlar: faqat fayllar (DATABASE_URL berilmagan)");
    return;
  }
  // Bazaga ulanib bo'lmasa — eski fayllar bilan ishlab, keyin bazadagi to'g'ri
  // ma'lumotni ustidan yozib yubormaslik uchun serverni to'xtatamiz.
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try { await connect(); lastErr = null; break; }
    catch (e) { lastErr = e; console.error(`⚠️  Postgres'ga ulanib bo'lmadi (${i + 1}/5): ${e.message}`); await new Promise(r => setTimeout(r, 2000 * (i + 1))); }
  }
  if (lastErr) {
    console.error("❌ DATABASE_URL bilan ulanib bo'lmadi — server to'xtatildi.");
    process.exit(1);
  }

  const { rows } = await pool.query("SELECT name, data FROM geo_store");
  const inDb = new Set();
  for (const r of rows) {
    inDb.add(r.name);
    atomicWrite(join(dataDir, `${r.name}.json`), r.data);
  }
  const local = readdirSync(dataDir).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5));
  for (const name of local) {
    if (!inDb.has(name)) await upsert(name, readFileSync(join(dataDir, `${name}.json`), "utf8"));
  }
  console.log(`💾 Ma'lumotlar: Postgres (${rows.length} ta to'plam yuklandi)`);

  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.once(sig, async () => {
      try { await flush(); } finally { process.exit(0); }
    });
  }
}

async function upsert(name, data) {
  await pool.query(
    `INSERT INTO geo_store (name, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [name, data],
  );
}

/** To'plam o'zgardi — bazaga yozishni rejalashtiradi. */
export function persist(name, json) {
  if (!pool) return;
  pending.set(name, json);
  if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 300);
}

export async function flush() {
  if (!pool) return;
  if (flushing) await flushing;
  if (!pending.size) return;
  const batch = [...pending.entries()];
  pending.clear();
  flushing = (async () => {
    for (const [name, data] of batch) {
      try { await upsert(name, data); }
      catch (e) {
        console.error(`⚠️  ${name} bazaga yozilmadi: ${e.message}`);
        if (!pending.has(name)) pending.set(name, data);   // keyingi safar qayta urinamiz
        if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 3000);
      }
    }
  })();
  await flushing;
  flushing = null;
}

// ── Fayllar (AI chatidagi rasmlar) ────────────────────────────────────────

export async function saveFile(name, mime, buf) {
  if (!pool) return;
  try {
    await pool.query(
      "INSERT INTO geo_files (name, mime, data) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING",
      [name, mime, buf],
    );
  } catch (e) { console.error(`⚠️  ${name} bazaga yozilmadi: ${e.message}`); }
}

/** Diskda yo'q bo'lsa — bazadan oladi va diskka qaytaradi. */
export async function loadFile(name, path) {
  if (existsSync(path)) return true;
  if (!pool) return false;
  try {
    const { rows } = await pool.query("SELECT data FROM geo_files WHERE name = $1", [name]);
    if (!rows.length) return false;
    writeFileSync(path, rows[0].data);
    return true;
  } catch { return false; }
}
