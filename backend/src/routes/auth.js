import { Router } from "express";
import {
  getUsers, getUserByUsername, getUserById,
  createUser, updateUser, deleteUser,
} from "../lib/db.js";
import { hashPassword, generateToken, requireAuth, userToJson } from "../lib/auth.js";

const router = Router();

// POST /api/auth/register
router.post("/auth/register", (req, res) => {
  const { name, username, password, grade } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldiring" });
  }
  const gradeNum = Number(grade);
  if (!grade || gradeNum < 6 || gradeNum > 11) {
    return res.status(400).json({ error: "Sinfni tanlang (6-11)" });
  }
  if (getUserByUsername(username)) {
    return res.status(400).json({ error: "Bu username band" });
  }
  const user = createUser({
    name, username,
    passwordHash: hashPassword(password),
    role: "student",
    grade: gradeNum,
    totalScore: 0,
    theme: "light",
    language: "uz",
    fontSize: "medium",
  });
  const token = generateToken(user.id);
  res.status(201).json({ token, user: userToJson(user) });
});

// POST /api/auth/login
router.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Login yoki parol kiritilmagan" });
  }
  const user = getUserByUsername(username);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
  }
  const token = generateToken(user.id);
  res.json({ token, user: userToJson(user) });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, (req, res) => {
  res.json(userToJson(req.user));
});

// PUT /api/auth/profile
router.put("/auth/profile", requireAuth, (req, res) => {
  const { name, avatarUrl } = req.body;
  const patch = {};
  if (name && typeof name === "string" && name.trim()) patch.name = name.trim();
  if (typeof avatarUrl === "string") patch.avatarUrl = avatarUrl || null;
  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: "Hech narsa o'zgarmadi" });
  }
  const updated = updateUser(req.user.id, patch);
  res.json(userToJson(updated));
});

// PUT /api/auth/password
router.put("/auth/password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldiring" });
  }
  if (req.user.passwordHash !== hashPassword(currentPassword)) {
    return res.status(400).json({ error: "Joriy parol noto'g'ri" });
  }
  updateUser(req.user.id, { passwordHash: hashPassword(newPassword) });
  res.json({ message: "Parol o'zgartirildi" });
});

// DELETE /api/users/:id
router.delete("/users/:id", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") {
    return res.status(403).json({ error: "Faqat o'qituvchilar uchun" });
  }
  const targetId = parseInt(req.params.id, 10);
  const target = getUserById(targetId);
  if (!target) return res.status(404).json({ error: "Topilmadi" });
  if (target.role === "teacher") return res.status(403).json({ error: "O'qituvchini o'chirib bo'lmaydi" });
  deleteUser(targetId);
  res.json({ success: true });
});

export default router;
