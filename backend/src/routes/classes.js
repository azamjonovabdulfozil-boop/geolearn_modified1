import { Router } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import {
  read, getUsers, getActivity,
  getClasses, getClassById, createClass, updateClass, deleteClass,
  parseClassName, classKey, findClassByName, userSection, userClassName,
} from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { parseSection, currentScope } from "../lib/scope.js";
import { parseRosterFile, textToStudents, namesMatch } from "../lib/rosterParse.js";
import { isValidGrade, MIN_GRADE, MAX_GRADE } from "../lib/constants.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const ONLINE_MS = 5 * 60 * 1000;
const MAX_ROSTER = 200;

function onlyTeacher(req, res) {
  if (req.user.role !== "teacher") {
    res.status(403).json({ error: "Faqat o'qituvchilar" });
    return false;
  }
  return true;
}

const rosterId = () => randomBytes(5).toString("hex");
const isOnline = (u) => Boolean(u?.lastSeenAt) && Date.now() - new Date(u.lastSeenAt).getTime() < ONLINE_MS;

/**
 * Ro'yxatdagi F.I.Sh ga mos ro'yxatdan o'tgan o'quvchini topadi.
 * Avval shu sinfdagilar orasidan, keyin sinfi yozilmaganlar orasidan.
 */
function matchStudent(fullName, className, students, taken = new Set()) {
  const key = classKey(className);
  const free = students.filter(u => !taken.has(u.id) && namesMatch(fullName, u.name));
  return free.find(u => key && userClassName(u) === key)
    ?? free.find(u => !userClassName(u))
    ?? (key ? null : free[0])
    ?? null;
}

function studentInfo(u) {
  return {
    userId: u.id,
    username: u.username,
    registered: true,
    registeredAt: u.createdAt ?? null,
    lastSeenAt: u.lastSeenAt ?? null,
    online: isOnline(u),
    totalScore: u.totalScore || 0,
  };
}

/** Sinf + ro'yxatdagi har bir o'quvchining "saytga kirganmi" holati. */
function classWithStatus(cls, students) {
  const key = classKey(cls.name);
  const taken = new Set();
  const roster = (cls.students ?? []).map(st => {
    const u = matchStudent(st.fullName, cls.name, students, taken);
    if (u) taken.add(u.id);
    return {
      id: st.id,
      fullName: st.fullName,
      className: cls.name,
      inRoster: true,
      ...(u ? { ...studentInfo(u), name: u.name } : { userId: null, registered: false, online: false, lastSeenAt: null }),
    };
  });

  // Sinfini yozib ro'yxatdan o'tgan, lekin yuklangan ro'yxatda yo'qlar
  const extra = students
    .filter(u => !taken.has(u.id) && userClassName(u) === key)
    .map(u => ({
      id: `u${u.id}`, fullName: u.name, className: cls.name, inRoster: false, name: u.name, ...studentInfo(u),
    }));

  const all = [...roster, ...extra]
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "uz"));
  return {
    id: cls.id,
    name: cls.name,
    grade: cls.grade,
    section: cls.section,
    createdAt: cls.createdAt,
    students: all,
    total: all.length,
    registered: all.filter(s => s.registered).length,
    online: all.filter(s => s.online).length,
  };
}

const allStudents = () => read("users").filter(u => u.role === "student");

// ── Sinflar ro'yxati ─────────────────────────────────────────────────────
router.get("/classes", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const students = allStudents();
  const list = getClasses()
    .map(c => classWithStatus(c, students))
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, "uz"));

  // O'quvchilar yozgan, lekin admin hali yaratmagan sinflar
  const known = new Set(read("classes").map(c => classKey(c.name)));
  const unlinked = new Map();
  for (const u of getUsers().filter(u => u.role === "student")) {
    const name = userClassName(u);
    if (!name || known.has(name)) continue;
    unlinked.set(name, (unlinked.get(name) || 0) + 1);
  }
  res.json({
    classes: list,
    unlinked: [...unlinked.entries()].map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, "uz", { numeric: true })),
  });
});

// Sinf nomlari (uy ishi, filtrlar uchun) — yaratilgan sinflar + o'quvchilar yozganlari
router.get("/classes/names", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const names = new Map();
  for (const c of getClasses()) names.set(classKey(c.name), { name: c.name, grade: c.grade, section: c.section });
  for (const u of getUsers().filter(u => u.role === "student")) {
    const name = userClassName(u);
    if (name && !names.has(name)) {
      names.set(name, { name, grade: parseClassName(name).grade, section: userSection(u) });
    }
  }
  res.json([...names.values()].sort((a, b) => a.name.localeCompare(b.name, "uz", { numeric: true })));
});

// ── Fayl / matndan ro'yxatni o'qish (saqlamasdan, ko'rib chiqish uchun) ──
// multipart: file + className   yoki   JSON: { text, className }
router.post("/classes/parse", requireAuth, upload.single("file"), async (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const defaultClass = parseClassName(req.body?.className)?.letter ? parseClassName(req.body.className).name : null;
  try {
    let rows;
    if (req.file) {
      rows = await parseRosterFile(req.file, defaultClass);
    } else if (typeof req.body?.text === "string") {
      rows = textToStudents(req.body.text, defaultClass);
    } else {
      return res.status(400).json({ error: "Fayl yoki ro'yxat matni kerak" });
    }
    if (!rows.length) {
      return res.status(400).json({
        error: req.file
          ? "Faylda o'quvchilar ismi topilmadi. F.I.Sh ustuni borligini tekshiring."
          : "Ro'yxatda ism topilmadi. Har bir qatorga bitta o'quvchining ismini yozing.",
      });
    }

    const students = allStudents();
    const taken = new Set();
    res.json({
      students: rows.slice(0, MAX_ROSTER).map(r => {
        const u = matchStudent(r.fullName, r.className, students, taken);
        if (u) taken.add(u.id);
        return {
          fullName: r.fullName,
          className: r.className,
          ...(u ? { ...studentInfo(u), name: u.name } : { userId: null, registered: false, online: false, lastSeenAt: null }),
        };
      }),
      truncated: rows.length > MAX_ROSTER,
    });
  } catch (e) {
    res.status(400).json({ error: e.message || "Faylni o'qib bo'lmadi" });
  }
});

/** Ro'yxatga yangi ismlarni qo'shadi (takrorlarsiz). */
function mergeRoster(existing, names) {
  const out = [...(existing ?? [])];
  for (const fullName of names) {
    const clean = String(fullName ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!clean) continue;
    if (out.some(s => namesMatch(s.fullName, clean) && s.fullName.split(" ").length === clean.split(" ").length)) continue;
    out.push({ id: rosterId(), fullName: clean });
  }
  return out.slice(0, MAX_ROSTER);
}

// ── Sinf qo'shish ────────────────────────────────────────────────────────
// { name: "7-A", section: "uz", students: [{ fullName, className? }] }
// Ro'yxatda boshqa sinf ko'rsatilgan qatorlar o'sha sinfga tushadi
// (bir faylda bir nechta sinf bo'lishi mumkin).
router.post("/classes", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const main = parseClassName(req.body?.name);
  if (!main?.letter) return res.status(400).json({ error: "Sinf nomini raqam va harf bilan yozing, masalan: 7-A yoki 11-V" });
  const section = parseSection(req.body?.section) ?? currentScope()?.section;
  if (!section) return res.status(400).json({ error: "Sinf turini tanlang: o'zbek yoki rus" });

  const rows = Array.isArray(req.body?.students) ? req.body.students : [];
  if (!rows.length && read("classes").some(c => classKey(c.name) === main.name)) {
    return res.status(400).json({ error: `${main.name} sinfi allaqachon bor` });
  }
  const groups = new Map([[main.name, []]]);
  for (const r of rows) {
    const cls = parseClassName(r?.className);
    const name = cls?.letter ? cls.name : main.name;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(r?.fullName);
  }

  const bad = [...groups.keys()].map(parseClassName).find(c => !isValidGrade(c.grade));
  if (bad) return res.status(400).json({ error: `${bad.name}: sinf raqami ${MIN_GRADE} dan ${MAX_GRADE} gacha bo'lsin` });

  const saved = [];
  for (const [name, names] of groups) {
    const cls = parseClassName(name);
    const existing = read("classes").find(c => classKey(c.name) === cls.name);
    if (existing) {
      saved.push(updateClass(existing.id, { section, students: mergeRoster(existing.students, names) }));
    } else {
      saved.push(createClass({ name: cls.name, grade: cls.grade, section, students: mergeRoster([], names), teacherId: req.user.id }));
    }
  }
  const students = allStudents();
  res.status(201).json(saved.map(c => classWithStatus(c, students)));
});

router.put("/classes/:id", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const cls = getClassById(Number(req.params.id));
  if (!cls) return res.status(404).json({ error: "Sinf topilmadi" });
  const patch = {};
  if (req.body?.section !== undefined) {
    const s = parseSection(req.body.section);
    if (!s) return res.status(400).json({ error: "Sinf turi: uz yoki ru" });
    patch.section = s;
  }
  if (req.body?.name !== undefined) {
    const p = parseClassName(req.body.name);
    if (!p?.letter || !isValidGrade(p.grade)) return res.status(400).json({ error: `Sinf nomi noto'g'ri — masalan: 11-V (sinf raqami ${MIN_GRADE}–${MAX_GRADE})` });
    const clash = findClassByName(p.name);
    if (clash && clash.id !== cls.id && classKey(clash.name) === p.name) {
      return res.status(400).json({ error: "Bu nomli sinf allaqachon bor" });
    }
    patch.name = p.name;
    patch.grade = p.grade;
  }
  if (Array.isArray(req.body?.students)) {
    patch.students = mergeRoster(cls.students, req.body.students.map(s => s?.fullName ?? s));
  }
  const updated = updateClass(cls.id, patch);
  res.json(classWithStatus(updated, allStudents()));
});

router.delete("/classes/:id/students/:sid", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const cls = getClassById(Number(req.params.id));
  if (!cls) return res.status(404).json({ error: "Sinf topilmadi" });
  const updated = updateClass(cls.id, { students: (cls.students ?? []).filter(s => s.id !== req.params.sid) });
  res.json(classWithStatus(updated, allStudents()));
});

router.delete("/classes/:id", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  if (!getClassById(Number(req.params.id))) return res.status(404).json({ error: "Sinf topilmadi" });
  deleteClass(Number(req.params.id));
  res.json({ success: true });
});

// ── Faol o'quvchilar ─────────────────────────────────────────────────────
// Kim hozir saytda, kim bugun kirgan, kim uzoq vaqt kirmagan.
router.get("/students/active", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const classes = read("classes");
  const activity = getActivity();

  const students = getUsers()
    .filter(u => u.role === "student")
    .map(u => {
      const seen = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
      const acts = activity.filter(a => a.userId === u.id);
      return {
        id: u.id,
        name: u.name,
        username: u.username,
        avatarUrl: u.avatarUrl ?? null,
        grade: u.grade ?? null,
        className: userClassName(u),
        section: userSection(u, classes),
        totalScore: u.totalScore || 0,
        lastSeenAt: u.lastSeenAt ?? null,
        createdAt: u.createdAt ?? null,
        online: seen > 0 && now - seen < ONLINE_MS,
        activeToday: seen >= todayStart.getTime(),
        activeWeek: seen >= weekAgo,
        testsToday: acts.filter(a => new Date(a.createdAt).getTime() >= todayStart.getTime()).length,
        testsTotal: acts.length,
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online)
      || new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));

  res.json({
    summary: {
      total: students.length,
      online: students.filter(s => s.online).length,
      today: students.filter(s => s.activeToday).length,
      week: students.filter(s => s.activeWeek).length,
      never: students.filter(s => !s.lastSeenAt).length,
    },
    students,
  });
});

export default router;
