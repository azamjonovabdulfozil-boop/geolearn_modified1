// ── So'kinish uchun ogohlantirishlar va avtomatik blok ────────────────────
// O'quvchi AI yordamchida yoki do'stlar chatida so'kinib yozsa — ogohlantirish
// oladi. Uchinchi ogohlantirishda AI ham, chat ham avtomatik yopiladi; blokni
// faqat o'qituvchi ochadi (admin → AI nazorati), shunda sanoq ham nolga tushadi.
import { read, write, getUserById, updateUser } from "./db.js";

export const MAX_WARNINGS = 3;

/** Yana bitta ogohlantirish qo'shadi. @returns {{ warnings: number, blocked: boolean }} */
export function addStrike(userId) {
  const warnings = (getUserById(userId)?.aiWarnings ?? 0) + 1;
  const blocked = warnings >= MAX_WARNINGS;
  updateUser(userId, {
    aiWarnings: warnings,
    ...(blocked ? { aiBlocked: true, chatBlocked: true, aiBlockedAt: new Date().toISOString(), blockedAuto: true } : {}),
  });
  return { warnings, blocked };
}

/** O'qituvchi blokni ochdi — sanoq ham tozalanadi. */
export function clearStrikes(userId) {
  updateUser(userId, { aiBlocked: false, chatBlocked: false, aiBlockedAt: null, blockedAuto: false, aiWarnings: 0 });
}

export function warningText(n, language = "uz", blocked = false) {
  const left = Math.max(0, MAX_WARNINGS - n);
  if (language === "ru") {
    if (blocked) return `🚫 **Предупреждение №${n} — вы заблокированы.** Из-за повторных оскорблений AI-помощник и чат с друзьями для вас закрыты. Разблокировать может только учитель.`;
    return `⚠️ **Предупреждение ${n} из ${MAX_WARNINGS}.** Пожалуйста, пишите вежливо — оскорбления и нецензурные слова запрещены. Учителю отправлено уведомление. Ещё ${left} — и вы будете заблокированы автоматически.`;
  }
  if (blocked) return `🚫 **${n}-ogohlantirish — siz bloklandingiz.** Takroran haqoratli so'z ishlatganingiz uchun AI yordamchi va do'stlar chati siz uchun yopildi. Blokni faqat o'qituvchi ochishi mumkin.`;
  return `⚠️ **Ogohlantirish ${n} / ${MAX_WARNINGS}.** Iltimos, odob bilan yozing — haqoratli va so'kinish so'zlarini ishlatish taqiqlanadi. Bu haqda o'qituvchingizga xabar yuborildi. Yana ${left} marta takrorlansa, avtomatik bloklanasiz.`;
}

/** O'qituvchi uchun yozuv: admin paneldagi "AI nazorati" bo'limida darhol ko'rinadi. */
export function logFlag(entry) {
  const logs = read("ai_logs");
  const item = {
    id: logs.length === 0 ? 1 : Math.max(...logs.map(l => l.id)) + 1,
    createdAt: new Date().toISOString(),
    success: false, provider: "moderation", flagged: true, reviewed: false,
    ...entry,
  };
  write("ai_logs", [...logs, item]);
  return item;
}
