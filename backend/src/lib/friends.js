// ── Do'stni qidirish (chat va 1v1 o'yinga chaqirish uchun) ────────────────
import { getUsers, userClassName, classKey, parseClassName } from "./db.js";
import { isUserConnected } from "./events.js";

const ONLINE_MS = 2 * 60 * 1000;

/** Foydalanuvchi hozir saytdami? (ochiq ulanish yoki so'nggi daqiqalardagi so'rov) */
export function isOnline(user) {
  if (!user) return false;
  if (isUserConnected(user.id)) return true;
  return Boolean(user.lastSeenAt) && Date.now() - new Date(user.lastSeenAt).getTime() < ONLINE_MS;
}

/** Boshqa o'quvchilarga ko'rinadigan qisqa ma'lumot (login va parol xeshi chiqmaydi). */
export function publicUser(u) {
  return {
    id: u.id, name: u.name,
    className: userClassName(u), grade: u.grade ?? null,
    avatarUrl: u.avatarUrl ?? null,
    online: isOnline(u),
    lastSeenAt: u.lastSeenAt ?? null,
  };
}

const norm = s => String(s ?? "").toLocaleLowerCase().replace(/[ʻʼ’‘`']/g, "'").replace(/\s+/g, " ").trim();

/**
 * Ism va sinf bo'yicha o'quvchilarni qidiradi.
 * `className` "7-A" bo'lsa — aynan shu sinf, "7" bo'lsa — barcha 7-sinflar.
 */
export function searchStudents({ q = "", className = "", exceptId = null, limit = 30 } = {}) {
  const words = norm(q).split(" ").filter(Boolean);
  const cls = parseClassName(className);
  return getUsers()
    .filter(u => u.role === "student" && u.id !== exceptId)
    .filter(u => {
      if (!cls) return true;
      return cls.letter ? classKey(u.className) === cls.name : Number(u.grade) === cls.grade;
    })
    .filter(u => {
      const name = norm(u.name);
      return words.every(w => name.includes(w));
    })
    .map(publicUser)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "uz"))
    .slice(0, limit);
}
