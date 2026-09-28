import { Router } from "express";
import { getUsers, getActivity, userClassName, openGrades } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { buildRatings, parseGrade, avgOf } from "../lib/stats.js";

const router = Router();

// GET /api/ratings          → umumiy reyting
// GET /api/ratings?grade=7  → 7-sinf reytingi
router.get("/ratings", requireAuth, (req, res) => {
  res.json(buildRatings(parseGrade(req)));
});

// GET /api/ratings/grades → mavjud sinflar va har birida nechta o'quvchi bor
router.get("/ratings/grades", requireAuth, (req, res) => {
  const students = getUsers().filter(u => u.role === "student");
  res.json({
    total: students.length,
    grades: openGrades().map(g => ({
      grade: g,
      count: students.filter(u => Number(u.grade) === g).length,
    })),
  });
});

router.get("/ratings/me", requireAuth, (req, res) => {
  const overall = buildRatings();
  const me = overall.find(r => r.userId === req.user.id);
  const inGrade = buildRatings(req.user.grade).find(r => r.userId === req.user.id);
  res.json({
    ...(me ?? {
      userId: req.user.id, name: req.user.name, grade: req.user.grade,
      totalScore: 0, testsCompleted: 0, avgPercentage: 0, rank: overall.length + 1,
    }),
    // O'z sinfi ichidagi o'rni
    gradeRank: inGrade?.rank ?? null,
  });
});

// ── Test natijalari (faqat o'qituvchi uchun) ──────────────────────────────
// GET /api/results?grade=7&search=ali
// O'quvchilar yechgan barcha testlar — eng yangisi birinchi.
router.get("/results", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });

  const usersById = new Map(getUsers().map(u => [u.id, u]));
  const grade = parseGrade(req);
  const search = String(req.query.search || "").trim().toLowerCase();

  let items = getActivity().map(a => {
    const u = usersById.get(a.userId);
    return {
      id: a.id,
      userId: a.userId,
      studentName: u?.name || a.studentName || "Noma'lum",
      grade: u?.grade ?? null,
      className: u ? userClassName(u) : null,
      topicId: a.topicId,
      topicTitle: a.topicTitle,
      correct: a.correct,
      total: a.total,
      percentage: Math.round(a.percentage || 0),
      pointsEarned: a.pointsEarned,
      timeTaken: a.timeTaken || 0,
      createdAt: a.createdAt,
    };
  });

  if (grade) items = items.filter(r => Number(r.grade) === grade);
  if (search) {
    items = items.filter(r =>
      r.studentName.toLowerCase().includes(search) ||
      String(r.topicTitle || "").toLowerCase().includes(search)
    );
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    summary: {
      totalResults: items.length,
      students: new Set(items.map(r => r.userId)).size,
      avgPercentage: avgOf(items, r => r.percentage),
      passed: items.filter(r => r.percentage >= 60).length,
    },
    results: items,
  });
});

export default router;
