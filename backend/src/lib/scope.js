// So'rov doirasidagi "bo'lim" (o'zbek / rus sinflar) filtri.
//
// Admin sozlamalarda bo'limni tanlaydi va har bir so'rovda `X-Section`
// sarlavhasi yuboriladi. requireAuth shu qiymatni AsyncLocalStorage ga
// yozadi, db.js dagi get*() funksiyalari esa ma'lumotni avtomatik
// filtrlaydi — shu tufayli butun admin panel bitta joydan boshqariladi.
import { AsyncLocalStorage } from "async_hooks";

export const SECTIONS = ["uz", "ru"];
export const SECTION_LABELS = { uz: "O'zbek sinflar", ru: "Rus sinflar", all: "Barcha sinflar" };

const store = new AsyncLocalStorage();

/** { role, section, userId } yoki null (so'rovdan tashqarida). */
export function currentScope() {
  return store.getStore() ?? null;
}

export function runInScope(scope, fn) {
  return store.run(scope, fn);
}

/** "uz" | "ru" | null — noto'g'ri qiymat null ga aylanadi. */
export function parseSection(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return SECTIONS.includes(s) ? s : null;
}

/**
 * Yangi kontent uchun bo'lim: admin tanlagani, tanlamagan bo'lsa —
 * hozirgi filtr, u ham bo'lmasa "all" (barcha sinflarga).
 */
export function pickSection(v) {
  if (String(v ?? "").toLowerCase() === "all") return "all";
  return parseSection(v) ?? currentScope()?.section ?? "all";
}

/** Kontent (dars, video, o'yin, uy ishi) shu bo'limga tegishlimi? */
export function contentInSection(item, section) {
  if (!section) return true;
  const s = item?.section;
  return !s || s === "all" || s === section;
}
