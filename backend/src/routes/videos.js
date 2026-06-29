import { Router } from "express";
import { getVideos, getVideoById, createVideo, deleteVideo } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/videos", requireAuth, (req, res) => {
  res.json(getVideos());
});

router.post("/videos", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const { title, youtubeUrl, grade } = req.body;
  if (!title || !youtubeUrl) return res.status(400).json({ error: "Sarlavha va URL kerak" });
  const video = createVideo({ title, youtubeUrl, grade: Number(grade) || 7, teacherId: req.user.id });
  res.status(201).json(video);
});

router.delete("/videos/:id", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  deleteVideo(Number(req.params.id));
  res.json({ success: true });
});

export default router;
