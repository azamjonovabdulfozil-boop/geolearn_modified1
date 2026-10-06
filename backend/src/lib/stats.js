// ── Statistika yordamchilari ──────────────────────────────────────────────
// Reyting va analitika uchun umumiy hisob-kitoblar shu yerda: bir joyda
// turgani uchun o'qituvchi paneli va o'quvchi paneli bir xil raqamlarni
// ko'rsatadi.

import { getUsers, getActivity, userClassName, openGrades } from "./db.js";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Kun boshlanishi (mahalliy vaqt). */
export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** ISO sana berilgan vaqtdan keyinmi? */
export function isAfter(iso, ts) {
  return iso ? new Date(iso).getTime() >= ts : false;
}

/** O'rtacha qiymat (butun songa yaxlitlangan). */
export function avgOf(list, pick = x => x) {
  if (!list?.length) return 0;
  return Math.round(list.reduce((s, x) => s + (Number(pick(x)) || 0), 0) / list.length);
}

/** "2026-08-24" ko'rinishidagi kalit. */
export function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/**
 * Oxirgi `days` kun uchun kunlik qator yasaydi.
 * @param {number} days
 * @param {(from:number,to:number,date:Date)=>object} build
 */
export function dailySeries(days, build) {
  const out = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * DAY_MS);
    const from = startOfDay(date);
    const to = from + DAY_MS;
    out.push({ date: new Date(from).toISOString(), ...build(from, to, date) });
  }
  return out;
}

/** Ro'yxatni sana bo'yicha [from, to) oralig'ida filtrlaydi. */
export function inRange(list, from, to, field = "createdAt") {
  return list.filter(x => {
    const t = new Date(x[field]).getTime();
    return t >= from && t < to;
  });
}

/**
 * Reyting jadvali. `grade` berilsa — faqat o'sha sinf va o'rinlar shu
 * sinf ichida qayta hisoblanadi.
 */
export function buildRatings(grade = null) {
  let users = getUsers().filter(u => u.role === "student");
  if (grade) users = users.filter(u => Number(u.grade) === Number(grade));

  // Faoliyatni bir marta guruhlaymiz (har o'quvchi uchun butun ro'yxatni aylanmaslik uchun)
  const byUser = new Map();
  for (const a of getActivity()) {
    if (!byUser.has(a.userId)) byUser.set(a.userId, []);
    byUser.get(a.userId).push(a);
  }

  return users
    .map(u => {
      const acts = byUser.get(u.id) ?? [];
      return {
        userId: u.id,
        name: u.name,
        grade: u.grade,
        className: userClassName(u),
        avatarUrl: u.avatarUrl ?? null,
        totalScore: u.totalScore || 0,
        testsCompleted: acts.length,
        avgPercentage: avgOf(acts, a => a.percentage),
        lastActiveAt: acts.length ? acts.map(a => a.createdAt).sort().at(-1) : null,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore || b.testsCompleted - a.testsCompleted)
    .map((u, i) => ({ ...u, rank: i + 1 }));
}

/** So'rovdagi ?grade= ni tekshiradi (noto'g'ri bo'lsa — null). */
export function parseGrade(req) {
  const g = Number(req.query.grade);
  return openGrades().includes(g) ? g : null;
}

/** Ketma-ket faol kunlar soni (bugundan orqaga). */
export function streakDays(items, field = "createdAt") {
  const days = new Set(items.map(x => dayKey(x[field])));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const key = dayKey(new Date(Date.now() - i * DAY_MS));
    if (days.has(key)) streak++;
    else if (i > 0) break;          // bugun bo'sh bo'lsa ham kechagidan sanaymiz
  }
  return streak;
}

/** Natijalarni 5 ta guruhga bo'ladi (grafik uchun). */
export function scoreBuckets(activity) {
  const ranges = [
    { label: "0–20%", min: 0,  max: 20 },
    { label: "21–40%", min: 21, max: 40 },
    { label: "41–60%", min: 41, max: 60 },
    { label: "61–80%", min: 61, max: 80 },
    { label: "81–100%", min: 81, max: 100 },
  ];
  return ranges.map(r => ({
    label: r.label,
    count: activity.filter(a => {
      const p = Math.round(a.percentage || 0);
      return p >= r.min && p <= r.max;
    }).length,
  }));
}
