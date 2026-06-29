import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { getUserById } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "geo_jwt_secret_2024";
const SALT = "geo_salt_2024";

export function hashPassword(password) {
  return createHash("sha256").update(password + SALT).digest("hex");
}

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token kerak" });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const user = getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: "Foydalanuvchi topilmadi" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Token muddati tugagan" });
  }
}

export function userToJson(u) {
  return {
    id: u.id, name: u.name, username: u.username,
    role: u.role, grade: u.grade ?? null,
    totalScore: u.totalScore ?? 0,
    avatarUrl: u.avatarUrl ?? null,
    createdAt: u.createdAt,
  };
}
