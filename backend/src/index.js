import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createUser, getUserByUsername } from './lib/db.js';
import { hashPassword } from './lib/auth.js';

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
const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ── CORS ────────────────────────────────────────────
// FRONTEND_URL env orqali Vercel manzili(lari) kiritiladi (vergul bilan
// bir nechtasi: masalan https://app.vercel.app,https://www.domen.uz).
// Agar FRONTEND_URL berilmagan bo'lsa, hamma originlarga ruxsat beriladi
// (lokal ishlab chiqish uchun qulay, lekin productionda FRONTEND_URL ni
// to'ldirish tavsiya etiladi).
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length === 0 ? true : allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Seed admin teacher if not exists ──────────────
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

// ── Routes ────────────────────────────────────────
app.use("/api", authRoutes);
app.use("/api", lessonRoutes);
app.use("/api", videoRoutes);
app.use("/api", gameRoutes);
app.use("/api", ratingRoutes);
app.use("/api", aiRoutes);

// ── Serve frontend (production) ───────────────────
const frontendDist = join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (req, res) => {
  res.sendFile(join(frontendDist, "index.html"), err => {
    if (err) res.status(200).json({ status: "GeoLearn API running", docs: "/api" });
  });
});

const server = app.listen(PORT, () => {
  console.log(`🌍 GeoLearn server ${PORT}-portda ishga tushdi`);
  console.log(`🔗 http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ ${PORT} porti band. Boshqa port bilan ishga tushiring:`);
    console.error(`   PORT=4000 npm start   (Linux/Mac)`);
    console.error(`   $env:PORT=4000; npm start   (Windows PowerShell)`);
    process.exit(1);
  }
  throw err;
});