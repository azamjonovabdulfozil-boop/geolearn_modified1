import { Router } from "express";
import { getBlockedGrades, setBlockedGrades, getBrand, setBrand } from "../lib/db.js";
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

// GET /api/brand → CRM nomi va logosi (login sahifasida ham kerak — ochiq)
router.get("/brand", (req, res) => res.json(getBrand()));

// PUT /api/brand { name, logo } — faqat o'qituvchi. logo: data:image/... yoki null
router.put("/brand", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const logo = req.body?.logo ?? null;
  if (logo !== null && !/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/.test(String(logo))) {
    return res.status(400).json({ error: "Logo rasm bo'lishi kerak" });
  }
  if (logo && logo.length > 2_000_000) return res.status(400).json({ error: "Logo juda katta (maks. ~1.5 MB)" });
  res.json(setBrand({ name: req.body?.name, logo }));
});

export default router;
