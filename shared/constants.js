// Platformada mavjud sinflar. Bitta joydan boshqariladi —
// yangi sinf qo'shish/olib tashlash uchun faqat shu ro'yxatni o'zgartiring.
// (Backend nusxasi: backend/src/lib/constants.js)
// Maktabdagi barcha sinflar (1–11). Admin istalgan sinfni (masalan 11-V) qo'lda yarata oladi.
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const MIN_GRADE = GRADES[0];
export const MAX_GRADE = GRADES[GRADES.length - 1];

/** Sinf raqami ro'yxatda bormi? */
export function isValidGrade(g) {
  return GRADES.includes(Number(g));
}
