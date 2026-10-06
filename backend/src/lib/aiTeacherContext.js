// ── Admin (o'qituvchi) uchun AI konteksti ─────────────────────────────────
// O'qituvchi AI'dan "qaysi o'quvchilar yaxshi o'qiyapti?", "reytingda kim
// nechanchi?" kabi savollarni so'rashi mumkin. Buning uchun platformadagi
// joriy ma'lumotlar qisqa matn ko'rinishida system promptga qo'shiladi.
// FAQAT teacher roli uchun chaqiriladi — o'quvchilar bu ma'lumotni ko'rmaydi.
// Barcha ma'lumotlar o'qituvchi tanlagan bo'lim (uz/ru) bo'yicha filtrlangan.
import {
  getUsers, getActivity, getHomeworks, getSubmissions, getVideos,
  getVideoViews, getClasses, getLessons, getOnlineUsers, userClassName, read,
} from "./db.js";
import { buildRatings, avgOf } from "./stats.js";

const MAX_STUDENTS = 200;

const pct = n => `${Math.round(n || 0)}%`;
const date = iso => (iso ? String(iso).slice(0, 10) : "—");

export function buildTeacherContext() {
  const students = getUsers().filter(u => u.role === "student");
  const ratings = buildRatings();
  const activity = getActivity();
  const homeworks = getHomeworks();
  const submissions = getSubmissions();
  const videos = getVideos();
  const views = getVideoViews();
  const classes = getClasses();
  const online = new Set(getOnlineUsers().map(u => u.id));
  const aiLogs = read("ai_logs");

  const lines = [];
  lines.push(`Bugungi sana: ${date(new Date().toISOString())}`);
  lines.push(`O'quvchilar soni: ${students.length}. Hozir onlayn: ${students.filter(s => online.has(s.id)).length}.`);
  lines.push(`Darslar: ${getLessons().length}, uy vazifalari: ${homeworks.length}, videolar: ${videos.length}, yechilgan testlar: ${activity.length}.`);

  // ── Reyting va har bir o'quvchi bo'yicha ko'rsatkichlar ──
  lines.push("\n## REYTING (o'rin | ism | sinf | ball | testlar soni | o'rtacha test natijasi | uy vazifasi: topshirgan/o'rtacha baho | ko'rgan videolar | AI ogohlantirishlari | oxirgi faollik)");
  const subsByUser = groupBy(submissions, s => s.userId);
  const viewsByUser = groupBy(views, v => v.userId);
  const usersById = new Map(students.map(u => [u.id, u]));
  for (const r of ratings.slice(0, MAX_STUDENTS)) {
    const u = usersById.get(r.userId);
    const subs = subsByUser.get(r.userId) ?? [];
    const graded = subs.filter(s => s.grade != null);
    const hw = `${subs.length}/${graded.length ? Math.round(avgOf(graded, s => Number(s.grade))) : "—"}`;
    const watched = (viewsByUser.get(r.userId) ?? []).length;
    const warns = u?.aiWarnings ?? 0;
    const last = [r.lastActiveAt, u?.lastSeenAt].filter(Boolean).sort().at(-1);
    lines.push(`${r.rank} | ${r.name} | ${r.className || "—"} | ${r.totalScore} | ${r.testsCompleted} | ${r.testsCompleted ? pct(r.avgPercentage) : "—"} | ${hw} | ${watched} | ${warns}${u?.aiBlocked ? " (AI bloklangan)" : ""} | ${date(last)}${online.has(r.userId) ? " (onlayn)" : ""}`);
  }
  if (ratings.length > MAX_STUDENTS) lines.push(`… yana ${ratings.length - MAX_STUDENTS} ta o'quvchi (eng past o'rinlarda)`);

  // ── Sinflar ──
  if (classes.length) {
    lines.push("\n## SINFLAR (sinf | ro'yxatdagi o'quvchilar | saytda ro'yxatdan o'tganlar | o'rtacha ball)");
    for (const c of classes) {
      const inClass = students.filter(s => userClassName(s) === c.name);
      const avgScore = inClass.length ? Math.round(avgOf(inClass, s => s.totalScore || 0)) : 0;
      lines.push(`${c.name} | ${(c.students ?? []).length} | ${inClass.length} | ${avgScore}`);
    }
  }

  // ── Mavzular bo'yicha test natijalari (qiyin mavzular) ──
  const byTopic = groupBy(activity, a => a.topicTitle || `#${a.topicId}`);
  if (byTopic.size) {
    lines.push("\n## MAVZULAR BO'YICHA TESTLAR (mavzu | urinishlar | o'rtacha natija)");
    [...byTopic.entries()]
      .map(([t, list]) => ({ t, n: list.length, avg: avgOf(list, a => a.percentage) }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 40)
      .forEach(x => lines.push(`${x.t} | ${x.n} | ${pct(x.avg)}`));
  }

  // ── Oxirgi test natijalari ──
  const recent = [...activity].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 30);
  if (recent.length) {
    lines.push("\n## OXIRGI TESTLAR (sana | o'quvchi | mavzu | to'g'ri/jami | natija)");
    for (const a of recent) {
      const name = usersById.get(a.userId)?.name || a.studentName || "—";
      lines.push(`${date(a.createdAt)} | ${name} | ${a.topicTitle || "—"} | ${a.correct}/${a.total} | ${pct(a.percentage)}`);
    }
  }

  // ── Uy vazifalari ──
  if (homeworks.length) {
    lines.push("\n## UY VAZIFALARI (vazifa | sinf | muddat | topshirganlar | baholanganlar | o'rtacha baho)");
    const subsByHw = groupBy(submissions, s => s.homeworkId);
    for (const h of homeworks.slice(-30)) {
      const subs = subsByHw.get(h.id) ?? [];
      const graded = subs.filter(s => s.grade != null);
      lines.push(`${h.title} | ${h.className || (h.grade ? `${h.grade}-sinf` : "—")} | ${date(h.dueDate)} | ${subs.length} | ${graded.length} | ${graded.length ? Math.round(avgOf(graded, s => Number(s.grade))) : "—"}`);
    }
  }

  // ── Videolar ──
  if (videos.length) {
    lines.push("\n## VIDEOLAR (video | ko'rganlar | oxirigacha ko'rganlar)");
    const viewsByVideo = groupBy(views, v => v.videoId);
    for (const v of videos.slice(-30)) {
      const list = viewsByVideo.get(v.id) ?? [];
      lines.push(`${v.title} | ${list.length} | ${list.filter(x => x.completed).length}`);
    }
  }

  // ── AI'da so'kingan o'quvchilar ──
  const flagged = aiLogs.filter(l => l.flagged && usersById.has(l.userId));
  if (flagged.length) {
    lines.push(`\n## AI MODERATSIYA: ${flagged.length} ta haqoratli xabar (${flagged.filter(l => !l.reviewed).length} tasi ko'rilmagan).`);
  }

  return lines.join("\n");
}

function groupBy(list, key) {
  const m = new Map();
  for (const x of list) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

/** O'qituvchi uchun system promptga qo'shiladigan qism. */
export function teacherSystemAddon(language) {
  const data = buildTeacherContext();
  if (language === "ru") {
    return `

РЕЖИМ АДМИНИСТРАТОРА: ты разговариваешь с УЧИТЕЛЕМ (администратором платформы GeoLearn).
- Ниже — актуальные данные платформы. На вопросы об учениках, рейтинге, тестах, домашних заданиях, видео, классах отвечай ТОЛЬКО по этим данным: фильтруй, сортируй, сравнивай, считай и делай выводы (кто учится хорошо, кто отстаёт, кому нужна помощь).
- Если чего-то нет в данных — так и скажи, ничего не выдумывай.
- Здесь можно использовать таблицы (markdown table) для списков учеников.
- На любые другие вопросы (не только география) тоже отвечай полно и полезно.

ДАННЫЕ ПЛАТФОРМЫ (место | имя | класс | баллы | ...; формат — как в заголовках):
${data}`;
  }
  return `

ADMIN REJIMI: sen O'QITUVCHI (GeoLearn platformasi administratori) bilan gaplashyapsan.
- Quyida platformaning joriy ma'lumotlari berilgan. O'quvchilar, reyting, testlar, uy vazifalari, videolar, sinflar haqidagi savollarga FAQAT shu ma'lumotlar asosida javob ber: filtrla, saralab ber, solishtir, hisobla va xulosa chiqar (kim yaxshi o'qiyapti, kim orqada qolyapti, kimga yordam kerak).
- Ma'lumotda yo'q narsani to'qima — "bu ma'lumot platformada yo'q" deb ayt.
- Bu rejimda o'quvchilar ro'yxati uchun jadval (markdown table) ishlatishing mumkin.
- Boshqa har qanday savolga ham (faqat geografiya emas) to'liq va foydali javob ber.

PLATFORMA MA'LUMOTLARI:
${data}`;
}
