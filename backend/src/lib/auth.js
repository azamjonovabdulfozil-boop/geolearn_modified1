import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { getUserById, touchUserSeen, userSection, userClassName } from "./db.js";
import { runInScope, parseSection } from "./scope.js";
import { setUserResolver } from "./events.js";

// Production'da JWT_SECRET majburiy: kodda yozilgan ochiq qiymat bilan
// istalgan odam token yasay olardi. Render'da u avtomatik yaratiladi
// (render.yaml → generateValue: true).
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);

if (IS_PRODUCTION && !process.env.JWT_SECRET) {
  console.error("\n❌ JWT_SECRET berilmagan — production'da ishga tushirib bo'lmaydi.");
  console.error("   Render → Dashboard → Environment da JWT_SECRET qo'shing.");
  console.error("   Yaratish:  openssl rand -hex 32\n");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || "geo_jwt_secret_dev_only";

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET berilmagan — dev uchun vaqtinchalik qiymat ishlatilyapti.");
}
const SALT = "geo_salt_2024";

export function hashPassword(password) {
  return createHash("sha256").update(password + SALT).digest("hex");
}

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

// /api/events?token=... — shaxsiy hodisalar (chat, o'yinga taklif) kimga borishini aniqlaydi
setUserResolver(token => {
  if (!token) return null;
  try { return getUserById(jwt.verify(String(token), JWT_SECRET).userId)?.id ?? null; } catch { return null; }
});

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token kerak" });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const user = getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: "Foydalanuvchi topilmadi" });
    // Kim hozir saytda ekanini bilish uchun (Bosh sahifadagi "onlayn")
    touchUserSeen(user.id);
    req.user = user;
  } catch {
    return res.status(401).json({ error: "Token muddati tugagan" });
  }
  // Bo'lim filtri: o'qituvchi — tanlagan bo'limi (X-Section), o'quvchi — o'z sinfining bo'limi
  const user = req.user;
  const section = user.role === "teacher"
    ? parseSection(req.headers["x-section"])
    : userSection(user);
  runInScope({ role: user.role, userId: user.id, section }, next);
}

export function userToJson(u) {
  return {
    id: u.id, name: u.name, username: u.username,
    role: u.role, grade: u.grade ?? null,
    className: userClassName(u),
    section: userSection(u),
    totalScore: u.totalScore ?? 0,
    avatarUrl: u.avatarUrl ?? null,
    aiBlocked: Boolean(u.aiBlocked),
    createdAt: u.createdAt,
  };
}
