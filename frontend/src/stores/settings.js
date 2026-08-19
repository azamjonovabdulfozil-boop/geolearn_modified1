import { defineStore } from "pinia";
import { ref, computed } from "vue";

const translations = {
  uz: {
    // auth
    login: "Kirish", register: "Ro'yxatdan o'tish", username: "Foydalanuvchi nomi",
    password: "Parol", name: "Ism va familiya", role: "Rol", teacher: "O'qituvchi",
    student: "O'quvchi", grade: "Sinf",

    // nav
    dashboard: "Bosh sahifa", lessons: "Darslar", games: "O'yinlar",
    ratings: "Reyting", videos: "Videolar", ai: "AI Yordamchi",
    settings: "Sozlamalar", logout: "Chiqish", students: "O'quvchilar",
    teacher_panel: "O'qituvchi paneli", student_panel: "O'quvchi paneli",
    student_of_grade: "{grade}-sinf",

    // dashboard
    dashboard_title: "Bosh sahifa",
    dashboard_sub: "Platforma statistikasi va so'nggi faoliyat",
    total_students: "Jami o'quvchilar", total_lessons: "Jami darslar",
    total_tests: "Jami testlar", active_games: "Faol o'yinlar",
    top_students: "Top o'quvchilar", recent_activity: "So'nggi faoliyat",
    no_students_yet: "Hali o'quvchilar yo'q", no_activity_yet: "Hali faoliyat yo'q",

    // lessons
    lessons_title: "Darslar", lessons_sub: "Darslarni boshqaring",
    create_lesson: "Dars yaratish", no_lessons: "Hali darslar yo'q",
    title: "Sarlavha", description: "Tavsif",

    // games
    games_title: "O'yinlar", games_sub: "Interaktiv o'yinlar",
    no_games: "Hali o'yinlar yo'q",

    // ratings
    ratings_title: "Reyting", ratings_sub: "Eng yaxshi o'quvchilar",

    // videos
    videos_title: "Videolar", videos_sub: "Ta'limiy videolar",
    add_video: "Video qo'shish", no_videos: "Hali videolar yo'q",

    // AI
    ai_title: "AI Yordamchi",
    ai_sub: "AI yozayotgan tilingizda javob beradi",
    auto_lang: "Avtomatik til",
    ai_welcome: "AI Yordamchi",
    ai_empty_sub: "Geografiya haqida har qanday savol bering!",
    ai_placeholder: "Geografiya haqida savol bering...",
    ai_error: "Xatolik. Qayta urinib ko'ring.",
    ai_history: "Chat tarixi",
    ai_new_chat: "Yangi suhbat",
    ai_no_chats: "Hali suhbatlar yo'q",
    ai_no_chats_sub: "Savol bering — suhbat shu yerda saqlanadi",
    ai_delete_chat: "Suhbatni o'chirish",
    ai_delete_chat_confirm: "Bu suhbat o'chirilsinmi?",
    ai_clear_all: "Barchasini o'chirish",
    ai_clear_all_confirm: "Barcha suhbatlar o'chirilsinmi?",
    ai_offline_note: "AI xizmatiga ulanib bo'lmadi — oflayn javob",
    ai_today: "Bugun",
    ai_yesterday: "Kecha",
    ai_earlier: "Oldinroq",
    ai_close: "Yopish",

    // settings
    settings_title: "Sozlamalar", settings_sub: "Profil va ilova sozlamalari",
    profile: "Profil",
    upload_image: "Rasm yuklash",
    image_hint: "PNG, JPG, GIF · max 2MB",
    save_profile: "Profilni saqlash",
    saving: "Saqlanmoqda...",
    saved_ok: "Saqlandi!",
    theme: "Mavzu", light: "Yorug'", dark: "Qorong'i",
    language: "Til", font_size: "Shrift o'lchami",
    small: "Kichik", medium: "O'rtacha", large: "Katta",
    current_password: "Joriy parol", new_password: "Yangi parol",
    change_password: "Parolni o'zgartirish",
    password_changed_ok: "Parol muvaffaqiyatli o'zgartirildi!",
    brand: "Platforma ko'rinishi",
    brand_name: "Platforma nomi",
    brand_logo: "Logo (rasm)",
    brand_reset: "Standartga qaytarish",
    brand_saved: "Platforma ko'rinishi yangilandi",

    // teacher role labels
    teacher_role: "O'qituvchi",
    student_role_grade: "{grade}-sinf o'quvchisi",
  },
  ru: {
    login: "Войти", register: "Регистрация", username: "Имя пользователя",
    password: "Пароль", name: "Имя и фамилия", role: "Роль", teacher: "Учитель",
    student: "Ученик", grade: "Класс",

    dashboard: "Главная", lessons: "Уроки", games: "Игры",
    ratings: "Рейтинг", videos: "Видео", ai: "AI Помощник",
    settings: "Настройки", logout: "Выйти", students: "Ученики",
    teacher_panel: "Панель учителя", student_panel: "Панель ученика",
    student_of_grade: "{grade} класс",

    dashboard_title: "Главная",
    dashboard_sub: "Статистика платформы и последняя активность",
    total_students: "Всего учеников", total_lessons: "Всего уроков",
    total_tests: "Всего тестов", active_games: "Активные игры",
    top_students: "Топ учеников", recent_activity: "Последняя активность",
    no_students_yet: "Пока нет учеников", no_activity_yet: "Пока нет активности",

    lessons_title: "Уроки", lessons_sub: "Управление уроками",
    create_lesson: "Создать урок", no_lessons: "Пока нет уроков",
    title: "Заголовок", description: "Описание",

    games_title: "Игры", games_sub: "Интерактивные игры",
    no_games: "Пока нет игр",

    ratings_title: "Рейтинг", ratings_sub: "Лучшие ученики",

    videos_title: "Видео", videos_sub: "Обучающие видео",
    add_video: "Добавить видео", no_videos: "Пока нет видео",

    ai_title: "AI Помощник",
    ai_sub: "AI отвечает на том языке, на котором вы пишете",
    auto_lang: "Авто-язык",
    ai_welcome: "AI Помощник",
    ai_empty_sub: "Задайте любой вопрос по географии!",
    ai_placeholder: "Задайте вопрос по географии...",
    ai_error: "Ошибка. Попробуйте снова.",
    ai_history: "История чата",
    ai_new_chat: "Новый чат",
    ai_no_chats: "Пока нет чатов",
    ai_no_chats_sub: "Задайте вопрос — диалог сохранится здесь",
    ai_delete_chat: "Удалить чат",
    ai_delete_chat_confirm: "Удалить этот чат?",
    ai_clear_all: "Удалить всё",
    ai_clear_all_confirm: "Удалить все чаты?",
    ai_offline_note: "Не удалось подключиться к AI — офлайн-ответ",
    ai_today: "Сегодня",
    ai_yesterday: "Вчера",
    ai_earlier: "Ранее",
    ai_close: "Закрыть",

    settings_title: "Настройки", settings_sub: "Профиль и настройки приложения",
    profile: "Профиль",
    upload_image: "Загрузить фото",
    image_hint: "PNG, JPG, GIF · макс 2MB",
    save_profile: "Сохранить профиль",
    saving: "Сохранение...",
    saved_ok: "Сохранено!",
    theme: "Тема", light: "Светлая", dark: "Тёмная",
    language: "Язык", font_size: "Размер шрифта",
    small: "Маленький", medium: "Средний", large: "Большой",
    current_password: "Текущий пароль", new_password: "Новый пароль",
    change_password: "Изменить пароль",
    password_changed_ok: "Пароль успешно изменён!",
    brand: "Вид платформы",
    brand_name: "Название платформы",
    brand_logo: "Логотип",
    brand_reset: "Сбросить",
    brand_saved: "Вид платформы обновлён",

    teacher_role: "Учитель",
    student_role_grade: "Ученик {grade} класса",
  },
};

const DEFAULT_BRAND_NAME = "GeoLearn";
const DEFAULT_BRAND_LOGO = null;

export const useSettingsStore = defineStore("settings", () => {
  const language = ref(localStorage.getItem("geo_language") || "uz");
  const theme    = ref(localStorage.getItem("geo_theme")    || "light");
  const fontSize = ref(localStorage.getItem("geo_fontsize") || "medium");
  const brandName = ref(localStorage.getItem("geo_brand_name") || DEFAULT_BRAND_NAME);
  const brandLogo = ref(localStorage.getItem("geo_brand_logo") || DEFAULT_BRAND_LOGO);

  function applyTheme(t) {
    if (t === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }
  function applyFontSize(f) {
    // Use CSS zoom so all px-based sizes scale uniformly
    const z = f === "small" ? "0.92" : f === "large" ? "1.12" : "1";
    document.documentElement.style.zoom = z;
    document.body.classList.remove("font-small", "font-medium", "font-large");
    document.body.classList.add(`font-${f}`);
  }
  function applyBrand(name) {
    document.title = name || DEFAULT_BRAND_NAME;
  }

  applyTheme(theme.value);
  applyFontSize(fontSize.value);
  applyBrand(brandName.value);

  function setLanguage(l) { language.value = l; localStorage.setItem("geo_language", l); }
  function setTheme(t)    { theme.value = t;    localStorage.setItem("geo_theme", t); applyTheme(t); }
  function setFontSize(f) { fontSize.value = f; localStorage.setItem("geo_fontsize", f); applyFontSize(f); }

  function setBrandName(n) {
    const v = (n || "").trim() || DEFAULT_BRAND_NAME;
    brandName.value = v;
    localStorage.setItem("geo_brand_name", v);
    applyBrand(v);
  }
  function setBrandLogo(dataUrl) {
    brandLogo.value = dataUrl || null;
    if (dataUrl) localStorage.setItem("geo_brand_logo", dataUrl);
    else localStorage.removeItem("geo_brand_logo");
  }
  function resetBrand() {
    setBrandName(DEFAULT_BRAND_NAME);
    setBrandLogo(null);
  }

  // Reactive translation function — components using {{ t('key') }} re-render on language change.
  const t = computed(() => (key, vars) => {
    const dict = translations[language.value] || translations.uz;
    let s = dict[key] ?? translations.uz[key] ?? key;
    if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
    return s;
  });

  return {
    language, theme, fontSize, brandName, brandLogo,
    setLanguage, setTheme, setFontSize,
    setBrandName, setBrandLogo, resetBrand,
    t,
  };
});
