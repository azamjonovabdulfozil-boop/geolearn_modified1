import { Router } from "express";
import { getBlockedGrades, setBlockedGrades } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { GRADES } from "../lib/constants.js";

const router = Router();

const payload = () => {
  const blocked = getBlockedGrades();
  return { grades: GRADES, blocked, open: GRADES.filter(g => !blocked.includes(g)) };
};

// GET /api/grades → barcha sinflar, bloklanganlari va ochiqlari
router.get("/grades", (req, res) => res.json(payload()));

// PUT /api/grades/blocked  { blocked: [3, 11] } — faqat o'qituvchi
router.put("/grades/blocked", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  if (!Array.isArray(req.body?.blocked)) return res.status(400).json({ error: "blocked ro'yxati kerak" });
  setBlockedGrades(req.body.blocked);
  res.json(payload());
});

export default router;
