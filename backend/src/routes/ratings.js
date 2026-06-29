import { Router } from "express";
import { getUsers, getActivity, getTopics, getLessons, getGames } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

function buildRatings() {
  const users = getUsers().filter(u => u.role === "student");
  const activity = getActivity();
  return users
    .map(u => {
      const acts = activity.filter(a => a.userId === u.id);
      return {
        userId: u.id,
        name: u.name,
        grade: u.grade,
        totalScore: u.totalScore || 0,
        testsCompleted: acts.length,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((u, i) => ({ ...u, rank: i + 1 }));
}

router.get("/ratings", requireAuth, (req, res) => {
  res.json(buildRatings());
});

router.get("/ratings/me", requireAuth, (req, res) => {
  const all = buildRatings();
  const me = all.find(r => r.userId === req.user.id);
  res.json(me ?? {
    userId: req.user.id, name: req.user.name,
    grade: req.user.grade, totalScore: 0, testsCompleted: 0, rank: all.length + 1,
  });
});

router.get("/analytics/dashboard", requireAuth, (req, res) => {
  const users = getUsers();
  const topics = getTopics();
  const top = buildRatings().slice(0, 10);
  res.json({
    totalStudents: users.filter(u => u.role === "student").length,
    totalLessons: getLessons().length,
    totalTests: topics.reduce((s, t) => s + (t.tests?.length || 0), 0),
    activeGames: getGames().filter(g => g.status === "active").length,
    topStudents: top,
  });
});

router.get("/analytics/activity", requireAuth, (req, res) => {
  const activity = getActivity();
  const items = req.user.role === "student"
    ? activity.filter(a => a.userId === req.user.id)
    : activity;
  res.json([...items].reverse().slice(0, 20));
});

export default router;
