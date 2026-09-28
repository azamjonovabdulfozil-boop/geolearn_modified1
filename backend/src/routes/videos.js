import { Router } from "express";
import {
  getVideos, getVideoById, createVideo, deleteVideo,
  getVideoViews, getViewsByVideo, recordVideoView, updateVideoProgress,
  watchPercent, watchStatus, getUsers, userClassName,
} from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { pickSection } from "../lib/scope.js";

const router = Router();

/** Sekundni "12:34" ko'rinishiga keltiradi. */
function hhmm(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}:${String(r).padStart(2, "0")}`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

const STATUS_LABEL = {
  completed: "Oxirigacha ko'rdi",
  half: "Yarmidan oshdi",
  started: "Boshladi",
  opened: "Faqat ochdi",
};

/** Ko'rishlar ro'yxatiga o'quvchi ma'lumoti va progressni qo'shadi. */
function withStudents(views) {
  const usersById = new Map(getUsers().map(u => [u.id, u]));
  return views
    .map(v => {
      const u = usersById.get(v.userId);
      const percent = watchPercent(v);
      const status = watchStatus(v);
      return {
        userId: v.userId,
        name: u?.name || "Noma'lum o'quvchi",
        username: u?.username || null,
        grade: u?.grade ?? null,
        className: u ? userClassName(u) : null,
        views: v.views || 1,
        percent,
        status,
        statusLabel: STATUS_LABEL[status],
        completed: status === "completed",
        positionSec: v.positionSec || 0,
        durationSec: v.durationSec || 0,
        positionLabel: hhmm(v.positionSec),
        durationLabel: v.durationSec ? hhmm(v.durationSec) : null,
        watchedSec: v.watchedSec || 0,
        watchedLabel: hhmm(v.watchedSec),
        firstViewedAt: v.firstViewedAt,
        lastViewedAt: v.lastViewedAt,
      };
    })
    .sort((a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt));
}

/** Bitta video bo'yicha jamlangan ko'rsatkichlar. */
function videoStats(videoId, views) {
  const own = views.filter(x => x.videoId === videoId);
  const percents = own.map(watchPercent);
  return {
    viewersCount: own.length,
    viewsCount: own.reduce((s, x) => s + (x.views || 1), 0),
    completedCount: own.filter(x => watchStatus(x) === "completed").length,
    halfCount: own.filter(x => ["half", "completed"].includes(watchStatus(x))).length,
    avgPercent: percents.length ? Math.round(percents.reduce((s, p) => s + p, 0) / percents.length) : 0,
    lastViewedAt: own.length ? own.map(x => x.lastViewedAt).sort().at(-1) : null,
  };
}

/** YouTube havolasidan video ID (barcha ko'rinishlar uchun). */
function ytId(url = "") {
  const patterns = [
    /[?&]v=([\w-]{6,})/, /youtu\.be\/([\w-]{6,})/,
    /\/embed\/([\w-]{6,})/, /\/shorts\/([\w-]{6,})/, /\/live\/([\w-]{6,})/,
  ];
  for (const re of patterns) {
    const m = String(url).match(re);
    if (m) return m[1];
  }
  const bare = String(url).trim();
  return /^[\w-]{11}$/.test(bare) ? bare : "";
}

// Muqova rasmi backend orqali beriladi — brauzerda manba ko'rinmaydi.
const thumbCache = new Map();
const THUMB_TTL = 6 * 60 * 60 * 1000;

router.get("/videos/:id/thumb", async (req, res) => {
  const video = getVideoById(Number(req.params.id));
  if (!video) return res.status(404).end();
  const id = ytId(video.youtubeUrl);
  if (!id) return res.status(404).end();

  const cached = thumbCache.get(video.id);
  if (cached && Date.now() - cached.at < THUMB_TTL) {
    res.set("Content-Type", cached.type);
    res.set("Cache-Control", "public, max-age=21600");
    return res.end(cached.buf);
  }

  // Sifati bo'yicha ketma-ket sinaymiz
  for (const name of ["maxresdefault", "sddefault", "hqdefault", "mqdefault"]) {
    try {
      const r = await fetch(`https://i.ytimg.com/vi/${id}/${name}.jpg`);
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 2000) continue;          // "rasm yo'q" zaglushkasi
      const type = r.headers.get("content-type") || "image/jpeg";
      thumbCache.set(video.id, { buf, type, at: Date.now() });
      res.set("Content-Type", type);
      res.set("Cache-Control", "public, max-age=21600");
      return res.end(buf);
    } catch {}
  }
  res.status(404).end();
});

// So'nggi ko'rishlar lentasi (faqat o'qituvchi)
router.get("/videos/views/recent", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const videosById = new Map(getVideos().map(v => [v.id, v]));
  const usersById = new Map(getUsers().map(u => [u.id, u]));

  const items = [...getVideoViews()]
    .sort((a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt))
    .slice(0, limit)
    .map(v => {
      const u = usersById.get(v.userId);
      const vid = videosById.get(v.videoId);
      const status = watchStatus(v);
      return {
        videoId: v.videoId,
        videoTitle: vid?.title || "O'chirilgan video",
        videoGrade: vid?.grade ?? null,
        userId: v.userId,
        studentName: u?.name || "Noma'lum o'quvchi",
        username: u?.username || null,
        grade: u?.grade ?? null,
        className: u ? userClassName(u) : null,
        views: v.views || 1,
        percent: watchPercent(v),
        status,
        statusLabel: STATUS_LABEL[status],
        positionLabel: hhmm(v.positionSec),
        durationLabel: v.durationSec ? hhmm(v.durationSec) : null,
        firstViewedAt: v.firstViewedAt,
        lastViewedAt: v.lastViewedAt,
      };
    });

  res.json(items);
});

router.get("/videos", requireAuth, (req, res) => {
  const videos = getVideos();
  const views = getVideoViews();

  // O'quvchiga o'zining shu videodagi progressi qo'shib beriladi.
  // Diqqat: youtubeUrl yuborilmaydi — manba bilinmasligi kerak.
  if (req.user.role !== "teacher") {
    return res.json(videos.map(v => {
      const mine = views.find(x => x.videoId === v.id && x.userId === req.user.id);
      const { youtubeUrl, teacherId, teacherName, ...safe } = v;
      return {
        ...safe,
        mediaId: ytId(youtubeUrl),          // pleyer uchun (ekranda ko'rinmaydi)
        thumbUrl: `/api/videos/${v.id}/thumb`,
        myPercent: watchPercent(mine),
        myPositionSec: mine?.positionSec || 0,
        myCompleted: mine ? watchStatus(mine) === "completed" : false,
        myLastViewedAt: mine?.lastViewedAt || null,
      };
    }));
  }

  // O'qituvchiga — kim ko'rgani va qanchasini ko'rgani
  res.json(videos.map(v => ({ ...v, ...videoStats(v.id, views) })));
});

// Bitta video bo'yicha uni ko'rgan o'quvchilar (faqat o'qituvchi)
router.get("/videos/:id/views", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const video = getVideoById(Number(req.params.id));
  if (!video) return res.status(404).json({ error: "Video topilmadi" });

  const students = withStudents(getViewsByVideo(video.id));
  const stats = videoStats(video.id, getVideoViews());
  const allStudents = getUsers().filter(u => u.role === "student" && Number(u.grade) === Number(video.grade));
  const watchedIds = new Set(students.map(s => s.userId));

  res.json({
    video: { id: video.id, title: video.title, grade: video.grade },
    summary: {
      viewers: students.length,
      totalViews: students.reduce((s, x) => s + x.views, 0),
      completed: stats.completedCount,
      half: stats.halfCount,
      avgPercent: stats.avgPercent,
      classSize: allStudents.length,
      coverage: allStudents.length ? Math.round((students.length / allStudents.length) * 100) : 0,
    },
    students,
    // Shu sinfda videoni umuman ochmagan o'quvchilar
    notWatched: allStudents
      .filter(u => !watchedIds.has(u.id))
      .map(u => ({ userId: u.id, name: u.name, grade: u.grade })),
  });
});

// O'quvchi videoni ochdi
router.post("/videos/:id/view", requireAuth, (req, res) => {
  const video = getVideoById(Number(req.params.id));
  if (!video) return res.status(404).json({ error: "Video topilmadi" });
  if (req.user.role === "teacher") return res.json({ ok: true, skipped: true });
  const item = recordVideoView({ videoId: video.id, userId: req.user.id });
  res.json({ ok: true, percent: watchPercent(item), positionSec: item.positionSec || 0 });
});

// Pleyer jarayoni: qayerga yetgani (har necha soniyada yuboriladi)
router.post("/videos/:id/progress", requireAuth, (req, res) => {
  const video = getVideoById(Number(req.params.id));
  if (!video) return res.status(404).json({ error: "Video topilmadi" });
  if (req.user.role === "teacher") return res.json({ ok: true, skipped: true });

  const { positionSec, durationSec, watchedDelta, ended } = req.body || {};
  const item = updateVideoProgress({
    videoId: video.id,
    userId: req.user.id,
    positionSec: Number(positionSec) || 0,
    durationSec: Number(durationSec) || 0,
    watchedDelta: Number(watchedDelta) || 0,
    ended: Boolean(ended),
  });
  res.json({ ok: true, percent: watchPercent(item), completed: item.completed });
});

router.post("/videos", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  const { title, youtubeUrl, grade, description, section } = req.body;
  if (!title || !youtubeUrl) return res.status(400).json({ error: "Sarlavha va URL kerak" });
  const video = createVideo({
    title,
    description: description || "",
    youtubeUrl,
    grade: Number(grade) || 7,
    section: pickSection(section),
    teacherId: req.user.id,
    teacherName: req.user.name,
  });
  res.status(201).json({ ...video, viewersCount: 0, viewsCount: 0, completedCount: 0, halfCount: 0, avgPercent: 0 });
});

router.delete("/videos/:id", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Faqat o'qituvchilar" });
  deleteVideo(Number(req.params.id));
  res.json({ success: true });
});

export default router;
