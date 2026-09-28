import { Router } from "express";
import {
  getUsers, getUserById, updateUser,
  getHomeworks, getHomeworkById, createHomework, updateHomework, deleteHomework,
  getSubmissionsByHomework, getSubmissionOfStudent, getSubmissionById,
  createSubmission, updateSubmission,
  getLessons, read, parseClassName, userClassName, userSection,
} from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { parseSection, pickSection } from "../lib/scope.js";
import { isValidGrade } from "../lib/constants.js";

const router = Router();

const MAX_TEXT = 20000;

function onlyTeacher(req, res) {
  if (req.user.role !== "teacher") {
    res.status(403).json({ error: "Faqat o'qituvchilar" });
    return false;
  }
  return true;
}

/**
 * O'quvchi shu bo'limga (o'zbek/rus) to'g'ri keladimi? Bo'limi noma'lum
 * o'quvchi (sinfi hali admin ro'yxatida yo'q) chetda qolib ketmasin.
 */
function sectionFits(user, section, classes) {
  if (!section || section === "all") return true;
  const own = userSection(user, classes);
  return !own || own === section;
}

/** Uy ishi shu o'quvchiga tegishlimi? (aniq ro'yxat bo'lsa — o'sha, aks holda sinf bo'yicha) */
function isAssignedTo(hw, user, classes = read("classes")) {
  if (Array.isArray(hw.studentIds) && hw.studentIds.length) {
    return hw.studentIds.includes(user.id);
  }
  if (!sectionFits(user, hw.section, classes)) return false;
  if (hw.className) return userClassName(user) === hw.className;
  if (hw.grade == null) return true;              // sinf ko'rsatilmagan — hammaga
  return Number(user.grade) === Number(hw.grade);
}

/**
 * Uy ishi berilishi mumkin bo'lgan o'quvchilar, har biri guruhi bilan.
 * Har bir sinf alifbo tartibida ikkiga bo'linadi: birinchi yarmi —
 * 1-guruh, qolgani — 2-guruh (toq bo'lsa 1-guruhda bittaga ko'p).
 */
function candidates({ grade, className, section }) {
  const classes = read("classes");
  const list = getUsers()
    .filter(u => u.role === "student")
    .filter(u => className ? userClassName(u) === className : Number(u.grade) === Number(grade))
    .filter(u => sectionFits(u, section, classes))
    .sort((a, b) => a.name.localeCompare(b.name, "uz"));

  const byClass = new Map();
  for (const u of list) {
    const key = userClassName(u) ?? `${u.grade}`;
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key).push(u);
  }
  const groupOf = new Map();
  for (const members of byClass.values()) {
    const half = Math.ceil(members.length / 2);
    members.forEach((u, i) => groupOf.set(u.id, i < half ? 1 : 2));
  }
  return list.map(u => ({
    id: u.id, name: u.name, username: u.username, grade: u.grade ?? null,
    className: userClassName(u), group: groupOf.get(u.id),
  }));
}

function parseGroup(v) {
  const n = Number(v);
  return n === 1 || n === 2 ? n : null;
}

/** Uy ishi berilgan o'quvchilar ro'yxati. */
function assignedStudents(hw) {
  const classes = read("classes");
  return getUsers().filter(u => u.role === "student" && isAssignedTo(hw, u, classes));
}

function isOverdue(hw) {
  return Boolean(hw.dueDate) && new Date(hw.dueDate).getTime() < Date.now();
}

/** O'quvchi ko'radigan holat: yangi / topshirilgan / baholangan / muddati o'tgan. */
function studentStatus(hw, submission) {
  if (submission?.grade != null) return "graded";
  if (submission) return "submitted";
  return isOverdue(hw) ? "overdue" : "pending";
}

function normalizeText(v) {
  return String(v ?? "").trim().slice(0, MAX_TEXT);
}

/** Sana matnini ISO ga aylantiradi; noto'g'ri bo'lsa null. */
function parseDueDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function withLessonTitle(hw) {
  if (!hw.lessonId) return { ...hw, lessonTitle: null };
  const lesson = getLessons().find(l => l.id === Number(hw.lessonId));
  return { ...hw, lessonTitle: lesson?.title ?? null };
}

// ── O'qituvchi: uy ishi berish uchun o'quvchilar ro'yxati ─────────────────
// GET /api/homework/students?grade=7&className=7-A&section=uz
// Har bir o'quvchi bilan uning guruhi (1 yoki 2) qaytadi.
router.get("/homework/students", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const cls = parseClassName(req.query.className);
  const grade = cls?.grade ?? Number(req.query.grade);
  res.json(candidates({
    grade: isValidGrade(grade) ? grade : null,
    className: cls?.letter ? cls.name : null,
    section: parseSection(req.query.section),
  }));
});

// ── Ro'yxat ──────────────────────────────────────────────────────────────
// O'qituvchi: hamma uy ishlari + topshirish statistikasi
// O'quvchi:   faqat unga berilganlari + o'z javobi
router.get("/homework", requireAuth, (req, res) => {
  const list = [...getHomeworks()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (req.user.role === "teacher") {
    const grade = Number(req.query.grade);
    const filtered = isValidGrade(grade) ? list.filter(h => Number(h.grade) === grade) : list;
    return res.json(filtered.map(hw => {
      const subs = getSubmissionsByHomework(hw.id);
      const graded = subs.filter(s => s.grade != null);
      return {
        ...withLessonTitle(hw),
        assignedCount: assignedStudents(hw).length,
        submittedCount: subs.length,
        gradedCount: graded.length,
        avgGrade: graded.length
          ? Math.round(graded.reduce((s, x) => s + x.grade, 0) / graded.length)
          : null,
        overdue: isOverdue(hw),
      };
    }));
  }

  const mine = list.filter(hw => isAssignedTo(hw, req.user));
  res.json(mine.map(hw => {
    const submission = getSubmissionOfStudent(hw.id, req.user.id);
    return {
      ...withLessonTitle(hw),
      studentIds: undefined,
      submission,
      status: studentStatus(hw, submission),
      overdue: isOverdue(hw),
    };
  }));
});

// ── O'qituvchi: yangi uy ishi ────────────────────────────────────────────
router.post("/homework", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const { title, description, grade, className, group, section, dueDate, lessonId, attachmentUrl, studentIds } = req.body;

  if (!String(title || "").trim()) {
    return res.status(400).json({ error: "Sarlavha kerak" });
  }
  const cls = parseClassName(className);
  const gradeNum = cls?.letter ? cls.grade : Number(grade);
  if (!isValidGrade(gradeNum)) {
    return res.status(400).json({ error: "Sinfni tanlang" });
  }
  const target = {
    grade: gradeNum,
    className: cls?.letter ? cls.name : null,
    section: pickSection(section),
  };
  const groupNum = parseGroup(group);

  // Aniq o'quvchilar tanlangan bo'lsa — faqat mavjud o'quvchilarni qoldiramiz.
  // Guruh tanlangan bo'lsa — o'sha guruhdagilar (sinfning 50%) ro'yxati saqlanadi.
  let ids = Array.isArray(studentIds)
    ? [...new Set(studentIds.map(Number))].filter(id => getUserById(id)?.role === "student")
    : [];
  if (!ids.length && groupNum) {
    ids = candidates(target).filter(s => s.group === groupNum).map(s => s.id);
    if (!ids.length) return res.status(400).json({ error: `${groupNum}-guruhda o'quvchi yo'q` });
  }

  const hw = createHomework({
    title: normalizeText(title).slice(0, 200),
    description: normalizeText(description),
    grade: gradeNum,
    className: target.className,
    section: target.section,
    group: ids.length && groupNum ? groupNum : null,
    dueDate: parseDueDate(dueDate),
    lessonId: lessonId ? Number(lessonId) : null,
    attachmentUrl: String(attachmentUrl || "").trim() || null,
    studentIds: ids,
    teacherId: req.user.id,
    teacherName: req.user.name,
  });
  res.status(201).json({ ...withLessonTitle(hw), assignedCount: assignedStudents(hw).length });
});

// ── Bitta uy ishi ────────────────────────────────────────────────────────
// O'qituvchi: barcha javoblar + topshirmaganlar ro'yxati
// O'quvchi:   o'z javobi
router.get("/homework/:id", requireAuth, (req, res) => {
  const hw = getHomeworkById(Number(req.params.id));
  if (!hw) return res.status(404).json({ error: "Topilmadi" });

  if (req.user.role === "teacher") {
    const subs = getSubmissionsByHomework(hw.id);
    const byUser = new Map(subs.map(s => [s.userId, s]));
    const students = assignedStudents(hw).map(u => {
      const s = byUser.get(u.id) ?? null;
      return {
        userId: u.id, name: u.name, grade: u.grade ?? null, className: userClassName(u),
        submissionId: s?.id ?? null,
        text: s?.text ?? "",
        attachmentUrl: s?.attachmentUrl ?? null,
        submittedAt: s?.createdAt ?? null,
        updatedAt: s?.updatedAt ?? null,
        late: Boolean(s?.late),
        gradeValue: s?.grade ?? null,
        feedback: s?.feedback ?? "",
        status: studentStatus(hw, s),
      };
    });
    return res.json({ ...withLessonTitle(hw), overdue: isOverdue(hw), students });
  }

  if (!isAssignedTo(hw, req.user)) {
    return res.status(403).json({ error: "Bu uy ishi sizga berilmagan" });
  }
  const submission = getSubmissionOfStudent(hw.id, req.user.id);
  res.json({
    ...withLessonTitle(hw), studentIds: undefined,
    submission, status: studentStatus(hw, submission), overdue: isOverdue(hw),
  });
});

// ── O'qituvchi: tahrirlash / o'chirish ───────────────────────────────────
router.put("/homework/:id", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const hw = getHomeworkById(Number(req.params.id));
  if (!hw) return res.status(404).json({ error: "Topilmadi" });

  const patch = {};
  if (req.body.title !== undefined) {
    const title = normalizeText(req.body.title).slice(0, 200);
    if (!title) return res.status(400).json({ error: "Sarlavha bo'sh bo'lmasin" });
    patch.title = title;
  }
  if (req.body.description !== undefined) patch.description = normalizeText(req.body.description);
  if (req.body.dueDate !== undefined) patch.dueDate = parseDueDate(req.body.dueDate);
  if (req.body.attachmentUrl !== undefined) patch.attachmentUrl = String(req.body.attachmentUrl || "").trim() || null;
  if (req.body.grade !== undefined) {
    const g = Number(req.body.grade);
    if (!isValidGrade(g)) return res.status(400).json({ error: "Sinfni tanlang" });
    patch.grade = g;
  }
  if (Array.isArray(req.body.studentIds)) {
    patch.studentIds = [...new Set(req.body.studentIds.map(Number))]
      .filter(id => getUserById(id)?.role === "student");
  }

  const updated = updateHomework(hw.id, patch);
  res.json({ ...withLessonTitle(updated), assignedCount: assignedStudents(updated).length });
});

router.delete("/homework/:id", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  if (!getHomeworkById(Number(req.params.id))) return res.status(404).json({ error: "Topilmadi" });
  deleteHomework(Number(req.params.id));
  res.json({ success: true });
});

// ── O'quvchi: javob topshirish (qayta yuborilsa — yangilanadi) ───────────
router.post("/homework/:id/submit", requireAuth, (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Faqat o'quvchilar" });
  const hw = getHomeworkById(Number(req.params.id));
  if (!hw) return res.status(404).json({ error: "Topilmadi" });
  if (!isAssignedTo(hw, req.user)) return res.status(403).json({ error: "Bu uy ishi sizga berilmagan" });

  const text = normalizeText(req.body?.text);
  const attachmentUrl = String(req.body?.attachmentUrl || "").trim() || null;
  if (!text && !attachmentUrl) return res.status(400).json({ error: "Javob matni yoki havola kerak" });

  const existing = getSubmissionOfStudent(hw.id, req.user.id);
  if (existing) {
    if (existing.grade != null) {
      return res.status(400).json({ error: "Baholangan ishni o'zgartirib bo'lmaydi" });
    }
    const updated = updateSubmission(existing.id, {
      text, attachmentUrl,
      late: isOverdue(hw),
      updatedAt: new Date().toISOString(),
    });
    return res.json(updated);
  }

  const submission = createSubmission({
    homeworkId: hw.id,
    userId: req.user.id,
    studentName: req.user.name,
    text, attachmentUrl,
    late: isOverdue(hw),
    updatedAt: null,
  });
  res.status(201).json(submission);
});

// ── O'qituvchi: baholash ─────────────────────────────────────────────────
// Ball o'quvchining umumiy reytingiga qo'shiladi (qayta baholansa — farqi bilan).
router.put("/homework/submissions/:id/grade", requireAuth, (req, res) => {
  if (!onlyTeacher(req, res)) return;
  const submission = getSubmissionById(Number(req.params.id));
  if (!submission) return res.status(404).json({ error: "Topilmadi" });

  const value = Number(req.body?.grade);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return res.status(400).json({ error: "Baho 0 dan 100 gacha bo'lsin" });
  }
  const grade = Math.round(value);
  const feedback = normalizeText(req.body?.feedback).slice(0, 2000);

  const updated = updateSubmission(submission.id, {
    grade, feedback,
    gradedAt: new Date().toISOString(),
    gradedBy: req.user.name,
  });

  // Reytingga ta'siri: eski baho bo'lsa faqat farqini qo'shamiz
  const student = getUserById(submission.userId);
  if (student) {
    const delta = grade - (submission.grade ?? 0);
    if (delta !== 0) {
      updateUser(student.id, { totalScore: Math.max(0, (student.totalScore || 0) + delta) });
    }
  }

  res.json(updated);
});

export default router;
