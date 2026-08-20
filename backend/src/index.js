import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { createUser, getUserByUsername } from "./lib/db.js";
import { hashPassword } from "./lib/auth.js";

import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes    from "./routes/auth.js";
import lessonRoutes  from "./routes/lessons.js";
import videoRoutes   from "./routes/videos.js";
import gameRoutes    from "./routes/games.js";
import ratingRoutes  from "./routes/ratings.js";
import aiRoutes      from "./routes/ai.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");

// ── Saytlar ───────────────────────────────────────────────────────────────
// SITE=both     → ikkala sayt alohida portlarda (default, lokal ish uchun)
// SITE=teacher  → faqat o'qituvchi (admin) sayti, PORT portida
// SITE=student  → faqat o'quvchi sayti, PORT portida
// SITE=api      → faqat API (statik fayllarsiz) — Render/Vercel uchun
const siteArg = process.argv.find(a => a.startsWith("--site="))?.slice(7);
const SITE = (siteArg || process.env.SITE || "both").toLowerCase();
const TEACHER_PORT = Number(process.env.PORT) || 3001;
const STUDENT_PORT = Number(process.env.STUDENT_PORT) || TEACHER_PORT + 1;

const SITES = {
  teacher: { label: "Admin (o'qituvchi) sayti", dist: join(REPO_ROOT, "admin", "dist"), buildCmd: "npm run build:admin" },
  student: { label: "User (o'quvchi) sayti",    dist: join(REPO_ROOT, "user", "dist"),  buildCmd: "npm run build:user" },
  api:     { label: "API",                      dist: null,                             buildCmd: null },
};

// ── CORS ──────────────────────────────────────────────────────────────────
// FRONTEND_URL env orqali ruxsat etilgan manzillar (vergul bilan bir nechta):
// masalan https://geolearn-admin.vercel.app,https://geolearn.vercel.app
// Bo'sh qoldirilsa — hamma originlarga ruxsat (lokal ishlab chiqish uchun).
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

/** Bitta sayt uchun to'liq Express ilovasi: API + statik fayllar + SPA fallback. */
function createApp(siteKey) {
  const site = SITES[siteKey];
  const app = express();

  app.use(cors({
    origin: allowedOrigins.length === 0 ? true : allowedOrigins,
    credentials: true,
  }));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Har bir sayt qaysi roldaligini bilish uchun (frontend ixtiyoriy ishlatadi)
  app.get("/api/site", (req, res) => res.json({ site: siteKey, label: site.label }));

  app.use("/api", authRoutes);
  app.use("/api", lessonRoutes);
  app.use("/api", videoRoutes);
  app.use("/api", gameRoutes);
  app.use("/api", ratingRoutes);
  app.use("/api", aiRoutes);

  // Noma'lum /api yo'llari SPA fallback'ga tushib qolmasligi kerak
  app.use("/api", (req, res) => res.status(404).json({ error: "API yo'li topilmadi" }));

  const hasBuild = Boolean(site.dist) && existsSync(join(site.dist, "index.html"));
  if (hasBuild) {
    app.use(express.static(site.dist));
    app.get("*", (req, res) => res.sendFile(join(site.dist, "index.html")));
  } else {
    app.get("*", (req, res) => res.status(200).json({
      status: "GeoLearn API ishlayapti",
      site: siteKey,
      ...(site.buildCmd ? { hint: `Sayt hali qurilmagan. Repo ildizida: ${site.buildCmd}` } : {}),
    }));
  }

  return { app, hasBuild };
}

function start(siteKey, port) {
  const site = SITES[siteKey];
  const { app, hasBuild } = createApp(siteKey);

  const server = app.listen(port, () => {
    console.log(`${hasBuild ? "🌐" : "🔌"} ${site.label.padEnd(26)} → http://localhost:${port}${hasBuild ? "" : "  (faqat API)"}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ ${port} porti band (${site.label}).`);
      console.error(`   Boshqa port bilan: PORT=4000 STUDENT_PORT=4001 npm start`);
      process.exit(1);
    }
    throw err;
  });

  return server;
}

// ── Seed admin teacher if not exists ──────────────────────────────────────
if (!getUserByUsername("admin")) {
  createUser({
    name: "Administrator",
    username: "admin",
    passwordHash: hashPassword("admin123"),
    role: "teacher",
    grade: null,
    theme: "light",
    language: "uz",
    fontSize: "medium",
  });
  console.log("✅ Admin yaratildi: admin / admin123");
}

// ── Ishga tushirish ───────────────────────────────────────────────────────
console.log("🌍 GeoLearn ishga tushmoqda...\n");

if (SITE === "teacher" || SITE === "student" || SITE === "api") {
  start(SITE, TEACHER_PORT);
} else {
  start("teacher", TEACHER_PORT);
  start("student", STUDENT_PORT);
}

console.log("");
