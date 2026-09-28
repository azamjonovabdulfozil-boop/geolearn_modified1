// ── Analitika ─────────────────────────────────────────────────────────────
// Bosh sahifalar (o'qituvchi va o'quvchi) uchun barcha ko'rsatkichlar va
// grafik qatorlari shu yerdan beriladi. Frontend bu javobni bir necha
// soniyada qayta so'raydi, shuning uchun hisob-kitob yengil bo'lishi kerak.

import { Router } from "express";
import {
  getUsers, getActivity, getTopics, getLessons, getGames,
  getVideos, getVideoViews, getHomeworks, getSubmissions,
  getOnlineUsers, getUserById, read, userClassName,
  watchPercent, watchStatus, openGrades,
} from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import {
  DAY_MS, startOfDay, isAfter, avgOf, dayKey, dailySeries, inRange,
  buildRatings, streakDays, scoreBuckets,
} from "../lib/stats.js";

const router = Router();
const ONLINE_MINUTES = 5;

const WATCH_LABEL = {
  completed: "Oxirigacha ko'rdi",
  half: "Yarmidan oshdi",
  started: "Boshladi",
  opened: "Faqat ochdi",
};

// ── O'qituvchi paneli ─────────────────────────────────────────────────────

function teacherDashboard() {
  const now = Date.now();
  const todayStart = startOfDay();
  const weekStart = now - 7 * DAY_MS;
  const prevWeekStart = now - 14 * DAY_MS;

  const users = getUsers();
  const students = users.filter(u => u.role === "student");
  const studentsById = new Map(users.map(u => [u.id, u]));
  const lessons = getLessons();
  const lessonIds = new Set(lessons.map(l => l.id));
  const topics = getTopics().filter(t => lessonIds.has(t.lessonId));
  const activity = getActivity();
  const videos = getVideos();
  const views = getVideoViews();
  const homeworks = getHomeworks();
  const submissions = getSubmissions();
  const aiLogs = read("ai_logs");

  const online = getOnlineUsers(ONLINE_MINUTES).filter(u => u.role === "student");
  const todayTests = activity.filter(a => isAfter(a.createdAt, todayStart));
  const weekTests = activity.filter(a => isAfter(a.createdAt, weekStart));
  const prevWeekTests = activity.filter(a =>
    isAfter(a.createdAt, prevWeekStart) && !isAfter(a.createdAt, weekStart));

  const weekViews = views.filter(v => isAfter(v.lastViewedAt, weekStart));
  const prevWeekViews = views.filter(v =>
    isAfter(v.lastViewedAt, prevWeekStart) && !isAfter(v.lastViewedAt, weekStart));

  /** O'sish foizi: oldingi hafta bilan taqqoslash. */
  const delta = (cur, prev) => {
    if (!prev) return cur ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  };

  // ── Grafik qatorlari ──
  const daily30 = dailySeries(30, (from, to) => {
    const acts = inRange(activity, from, to);
    return {
      tests: acts.length,
      students: new Set(acts.map(a => a.userId)).size,
      avgPercentage: avgOf(acts, a => a.percentage),
      points: acts.reduce((s, a) => s + (a.pointsEarned || 0), 0),
      videoViews: inRange(views, from, to, "lastViewedAt").length,
      submissions: inRange(submissions, from, to).length,
      aiQuestions: inRange(aiLogs, from, to).length,
    };
  });
  const daily7 = daily30.slice(-7);

  // Soatlar kesimi (oxirgi 7 kun) — qachon ko'proq ishlashadi
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    tests: weekTests.filter(a => new Date(a.createdAt).getHours() === h).length,
    views: weekViews.filter(v => new Date(v.lastViewedAt).getHours() === h).length,
  }));

  // Hafta kunlari kesimi (oxirgi 30 kun)
  const WD = ["Yak", "Du", "Se", "Cho", "Pay", "Jum", "Sha"];
  const monthActivity = activity.filter(a => isAfter(a.createdAt, now - 30 * DAY_MS));
  const weekday = WD.map((label, i) => ({
    label,
    tests: monthActivity.filter(a => new Date(a.createdAt).getDay() === i).length,
    avgPercentage: avgOf(monthActivity.filter(a => new Date(a.createdAt).getDay() === i), a => a.percentage),
  }));

  // Sinflar kesimi
  const gradeStats = openGrades().map(g => {
    const inGrade = students.filter(u => Number(u.grade) === g);
    const ids = new Set(inGrade.map(u => u.id));
    const acts = activity.filter(a => ids.has(a.userId));
    const gViews = views.filter(v => ids.has(v.userId));
    return {
      grade: g,
      students: inGrade.length,
      online: online.filter(u => Number(u.grade) === g).length,
      tests: acts.length,
      avgPercentage: avgOf(acts, a => a.percentage),
      videoViews: gViews.length,
      avgWatch: avgOf(gViews, watchPercent),
      score: inGrade.reduce((s, u) => s + (u.totalScore || 0), 0),
    };
  });

  // Mavzular bo'yicha natijalar — eng qiyinlari yuqorida
  const topicsById = new Map(topics.map(t => [t.id, t]));
  const byTopic = new Map();
  for (const a of activity) {
    const key = a.topicId ?? a.topicTitle;
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(a);
  }
  const topicPerformance = [...byTopic.entries()]
    .map(([key, acts]) => ({
      topicId: typeof key === "number" ? key : null,
      title: topicsById.get(key)?.title || acts[0]?.topicTitle || "Mavzu",
      attempts: acts.length,
      students: new Set(acts.map(a => a.userId)).size,
      avgPercentage: avgOf(acts, a => a.percentage),
      passRate: Math.round((acts.filter(a => (a.percentage || 0) >= 60).length / acts.length) * 100),
    }))
    .sort((a, b) => a.avgPercentage - b.avgPercentage);

  // Videolar bo'yicha jalb qilinganlik
  const videoEngagement = videos
    .map(v => {
      const own = views.filter(x => x.videoId === v.id);
      const percents = own.map(watchPercent);
      return {
        id: v.id,
        title: v.title,
        grade: v.grade,
        viewers: own.length,
        totalViews: own.reduce((s, x) => s + (x.views || 1), 0),
        completed: own.filter(x => watchStatus(x) === "completed").length,
        half: own.filter(x => ["half", "completed"].includes(watchStatus(x))).length,
        avgPercent: avgOf(percents),
        lastViewedAt: own.length ? own.map(x => x.lastViewedAt).sort().at(-1) : null,
      };
    })
    .sort((a, b) => b.viewers - a.viewers || b.avgPercent - a.avgPercent);

  // Ko'rish holatlari taqsimoti (donut uchun)
  const watchBreakdown = ["completed", "half", "started", "opened"].map(key => ({
    key,
    label: WATCH_LABEL[key],
    count: views.filter(v => watchStatus(v) === key).length,
  }));

  // So'nggi ko'rishlar — kim, qaysi videoni, qanchasini ko'rdi
  const videosById = new Map(videos.map(v => [v.id, v]));
  const recentVideoViews = [...views]
    .sort((a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt))
    .slice(0, 15)
    .map(v => {
      const u = studentsById.get(v.userId);
      const vid = videosById.get(v.videoId);
      const status = watchStatus(v);
      return {
        videoId: v.videoId,
        videoTitle: vid?.title || "O'chirilgan video",
        videoGrade: vid?.grade ?? null,
        userId: v.userId,
        studentName: u?.name || "Noma'lum o'quvchi",
        grade: u?.grade ?? null,
        views: v.views || 1,
        percent: watchPercent(v),
        status,
        statusLabel: WATCH_LABEL[status],
        positionSec: v.positionSec || 0,
        durationSec: v.durationSec || 0,
        lastViewedAt: v.lastViewedAt,
      };
    });

  // E'tibor talab qiladigan o'quvchilar
  const ratings = buildRatings();
  const atRisk = ratings
    .filter(r => (r.testsCompleted === 0) || r.avgPercentage < 50)
    .map(r => ({
      ...r,
      reason: r.testsCompleted === 0
        ? "Hali test ishlamagan"
        : `O'rtacha ${r.avgPercentage}%`,
      daysInactive: r.lastActiveAt
        ? Math.floor((now - new Date(r.lastActiveAt).getTime()) / DAY_MS)
        : null,
    }))
    .slice(0, 8);

  const allPercents = views.map(watchPercent);

  return {
    serverTime: new Date(now).toISOString(),

    // Eski kalitlar (mos kelishi uchun)
    totalStudents: students.length,
    totalLessons: lessons.length,
    totalTests: topics.reduce((s, t) => s + (t.tests?.length || 0), 0),
    activeGames: getGames().filter(g => g.status === "active").length,
    completedTests: activity.length,
    topStudents: ratings.slice(0, 10),

    kpi: {
      students: {
        total: students.length,
        online: online.length,
        newWeek: students.filter(u => isAfter(u.createdAt, weekStart)).length,
        activeToday: new Set(todayTests.map(a => a.userId)).size,
        activeWeek: new Set(weekTests.map(a => a.userId)).size,
        delta: delta(
          students.filter(u => isAfter(u.createdAt, weekStart)).length,
          students.filter(u => isAfter(u.createdAt, prevWeekStart) && !isAfter(u.createdAt, weekStart)).length,
        ),
      },
      tests: {
        total: activity.length,
        today: todayTests.length,
        week: weekTests.length,
        avgPercentage: avgOf(activity, a => a.percentage),
        avgToday: avgOf(todayTests, a => a.percentage),
        avgWeek: avgOf(weekTests, a => a.percentage),
        passRate: activity.length
          ? Math.round((activity.filter(a => (a.percentage || 0) >= 60).length / activity.length) * 100)
          : 0,
        delta: delta(weekTests.length, prevWeekTests.length),
      },
      videos: {
        total: videos.length,
        viewers: new Set(views.map(v => v.userId)).size,
        totalViews: views.reduce((s, v) => s + (v.views || 1), 0),
        today: views.filter(v => isAfter(v.lastViewedAt, todayStart)).length,
        week: weekViews.length,
        completed: views.filter(v => watchStatus(v) === "completed").length,
        avgCompletion: avgOf(allPercents),
        notWatched: videos.filter(v => !views.some(x => x.videoId === v.id)).length,
        delta: delta(weekViews.length, prevWeekViews.length),
      },
      homework: {
        total: homeworks.length,
        submissions: submissions.length,
        ungraded: submissions.filter(s => s.grade === null || s.grade === undefined).length,
        today: submissions.filter(s => isAfter(s.createdAt, todayStart)).length,
        avgGrade: avgOf(submissions.filter(s => s.grade != null), s => s.grade),
      },
      ai: {
        questions: aiLogs.length,
        today: aiLogs.filter(l => isAfter(l.createdAt, todayStart)).length,
        week: aiLogs.filter(l => isAfter(l.createdAt, weekStart)).length,
      },
      content: {
        lessons: lessons.length,
        topics: topics.length,
        questions: topics.reduce((s, t) => s + (t.tests?.length || 0), 0),
        videos: videos.length,
        homeworks: homeworks.length,
      },
    },

    series: {
      daily30,
      daily7,
      hourly,
      weekday,
      grades: gradeStats,
      scoreBuckets: scoreBuckets(activity),
      topicPerformance: topicPerformance.slice(0, 8),
      topicBest: [...topicPerformance].reverse().slice(0, 5),
      videoEngagement: videoEngagement.slice(0, 8),
      watchBreakdown,
    },

    lists: {
      onlineStudents: online
        .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt))
        .slice(0, 12)
        .map(u => ({ id: u.id, name: u.name, grade: u.grade ?? null, className: userClassName(u), lastSeenAt: u.lastSeenAt })),
      recentVideoViews,
      atRisk,
      recentSubmissions: [...submissions]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6)
        .map(s => ({
          id: s.id,
          studentName: studentsById.get(s.userId)?.name || s.studentName || "Noma'lum",
          homeworkTitle: homeworks.find(h => h.id === s.homeworkId)?.title || "Uy ishi",
          grade: s.grade ?? null,
          createdAt: s.createdAt,
        })),
    },
  };
}

// ── O'quvchi paneli ───────────────────────────────────────────────────────

function studentDashboard(user) {
  const now = Date.now();
  const todayStart = startOfDay();
  const weekStart = now - 7 * DAY_MS;

  const activity = getActivity().filter(a => a.userId === user.id);
  const views = getVideoViews().filter(v => v.userId === user.id);
  const videos = getVideos();
  const myVideos = videos.filter(v => Number(v.grade) === Number(user.grade));
  const submissions = getSubmissions().filter(s => s.userId === user.id);
  const homeworks = getHomeworks().filter(h => Number(h.grade) === Number(user.grade));
  const topics = getTopics();
  const lessons = getLessons().filter(l => Number(l.grade) === Number(user.grade));

  const overall = buildRatings();
  const inGrade = buildRatings(user.grade);
  const me = overall.find(r => r.userId === user.id);
  const myGradeRank = inGrade.find(r => r.userId === user.id);
  const classAvg = avgOf(inGrade, r => r.avgPercentage);

  const daily14 = dailySeries(14, (from, to) => {
    const acts = inRange(activity, from, to);
    return {
      tests: acts.length,
      avgPercentage: avgOf(acts, a => a.percentage),
      points: acts.reduce((s, a) => s + (a.pointsEarned || 0), 0),
      videoViews: inRange(views, from, to, "lastViewedAt").length,
    };
  });

  // Oxirgi urinishlar chizig'i (natija o'sishi ko'rinishi uchun)
  const scoreTrend = [...activity]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-12)
    .map(a => ({
      date: a.createdAt,
      percentage: Math.round(a.percentage || 0),
      title: a.topicTitle,
    }));

  // Mavzular bo'yicha kuchli/zaif tomonlar
  const byTopic = new Map();
  for (const a of activity) {
    const key = a.topicId ?? a.topicTitle;
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(a);
  }
  const topicPerformance = [...byTopic.values()].map(acts => ({
    title: acts[0]?.topicTitle || "Mavzu",
    attempts: acts.length,
    avgPercentage: avgOf(acts, a => a.percentage),
    best: Math.max(...acts.map(a => Math.round(a.percentage || 0))),
  })).sort((a, b) => b.avgPercentage - a.avgPercentage);

  const watched = myVideos.map(v => {
    const mine = views.find(x => x.videoId === v.id);
    return {
      id: v.id,
      title: v.title,
      grade: v.grade,
      percent: watchPercent(mine),
      status: mine ? watchStatus(mine) : null,
      statusLabel: mine ? WATCH_LABEL[watchStatus(mine)] : "Ko'rilmagan",
      lastViewedAt: mine?.lastViewedAt || null,
    };
  }).sort((a, b) => b.percent - a.percent);

  const pendingHomework = homeworks.filter(h => !submissions.some(s => s.homeworkId === h.id));
  const bestResult = activity.length ? Math.max(...activity.map(a => Math.round(a.percentage || 0))) : 0;
  const totalTopics = topics.filter(t => lessons.some(l => l.id === t.lessonId)).length;
  const solvedTopics = new Set(activity.map(a => a.topicId)).size;

  return {
    serverTime: new Date(now).toISOString(),
    me: {
      id: user.id,
      name: user.name,
      grade: user.grade,
      avatarUrl: user.avatarUrl ?? null,
      totalScore: user.totalScore || 0,
      rank: me?.rank ?? overall.length + 1,
      gradeRank: myGradeRank?.rank ?? null,
      gradeSize: inGrade.length,
      totalStudents: overall.length,
    },
    kpi: {
      tests: activity.length,
      testsToday: activity.filter(a => isAfter(a.createdAt, todayStart)).length,
      testsWeek: activity.filter(a => isAfter(a.createdAt, weekStart)).length,
      avgPercentage: avgOf(activity, a => a.percentage),
      bestResult,
      classAvg,
      streak: streakDays(activity),
      points: user.totalScore || 0,
      pointsWeek: activity
        .filter(a => isAfter(a.createdAt, weekStart))
        .reduce((s, a) => s + (a.pointsEarned || 0), 0),
      videosTotal: myVideos.length,
      videosStarted: watched.filter(v => v.percent > 0).length,
      videosCompleted: watched.filter(v => v.status === "completed").length,
      avgWatch: avgOf(watched.filter(v => v.percent > 0), v => v.percent),
      homeworkTotal: homeworks.length,
      homeworkDone: submissions.length,
      homeworkPending: pendingHomework.length,
      homeworkAvg: avgOf(submissions.filter(s => s.grade != null), s => s.grade),
      topicsTotal: totalTopics,
      topicsSolved: solvedTopics,
      progress: totalTopics ? Math.round((solvedTopics / totalTopics) * 100) : 0,
    },
    series: {
      daily14,
      scoreTrend,
      topicPerformance: topicPerformance.slice(0, 8),
      strengths: topicPerformance.slice(0, 3),
      weaknesses: [...topicPerformance].reverse().filter(t => t.avgPercentage < 70).slice(0, 3),
      scoreBuckets: scoreBuckets(activity),
      classCompare: [
        { label: "Siz", value: avgOf(activity, a => a.percentage) },
        { label: "Sinf o'rtachasi", value: classAvg },
      ],
    },
    lists: {
      recentActivity: [...activity].reverse().slice(0, 8),
      videos: watched.slice(0, 6),
      pendingHomework: pendingHomework.slice(0, 5).map(h => ({
        id: h.id, title: h.title, dueDate: h.dueDate ?? null,
      })),
      topStudents: inGrade.slice(0, 5),
    },
  };
}

// ── Yo'llar ───────────────────────────────────────────────────────────────

router.get("/analytics/dashboard", requireAuth, (req, res) => {
  if (req.user.role === "teacher") return res.json(teacherDashboard());

  // O'quvchiga shaxsiy ma'lumot ko'rinmaydigan qisqa javob
  const topics = getTopics();
  res.json({
    totalStudents: getUsers().filter(u => u.role === "student").length,
    totalLessons: getLessons().length,
    totalTests: topics.reduce((s, t) => s + (t.tests?.length || 0), 0),
    activeGames: getGames().filter(g => g.status === "active").length,
    completedTests: getActivity().length,
    topStudents: buildRatings().slice(0, 10),
  });
});

router.get("/analytics/student", requireAuth, (req, res) => {
  // O'qituvchi istalgan o'quvchi tahlilini ko'ra oladi (?userId=)
  const target = req.user.role === "teacher" && req.query.userId
    ? getUserById(Number(req.query.userId))
    : req.user;
  if (!target) return res.status(404).json({ error: "O'quvchi topilmadi" });
  res.json(studentDashboard(target));
});

router.get("/analytics/activity", requireAuth, (req, res) => {
  const activity = getActivity();
  const items = req.user.role === "student"
    ? activity.filter(a => a.userId === req.user.id)
    : activity;

  const usersById = new Map(getUsers().map(u => [u.id, u]));
  res.json([...items].reverse().slice(0, 25).map(a => ({
    ...a,
    studentName: usersById.get(a.userId)?.name || a.studentName || "Noma'lum",
    grade: usersById.get(a.userId)?.grade ?? null,
    percentage: Math.round(a.percentage || 0),
  })));
});

export default router;
