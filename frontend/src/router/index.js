import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

// __APP_ROLE__ is injected by vite.teacher.config.js or vite.student.config.js
// Falls back to "both" for the default vite.config.js (original behavior)
const APP_ROLE = typeof __APP_ROLE__ !== "undefined" ? __APP_ROLE__ : "both";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      redirect: () => {
        const auth = useAuthStore();
        if (!auth.isLoggedIn) return "/login";
        if (APP_ROLE === "teacher") return "/teacher/dashboard";
        if (APP_ROLE === "student") return "/student/dashboard";
        return auth.isTeacher ? "/teacher/dashboard" : "/student/dashboard";
      },
    },
    { path: "/login", component: () => import("@/views/Login.vue"), meta: { guest: true } },
    { path: "/register", component: () => import("@/views/Register.vue"), meta: { guest: true } },
    {
      path: "/teacher",
      component: () => import("@/views/teacher/Layout.vue"),
      meta: { requiresAuth: true, role: "teacher" },
      children: [
        { path: "dashboard", component: () => import("@/views/teacher/Dashboard.vue") },
        { path: "lessons", component: () => import("@/views/teacher/Lessons.vue") },
        { path: "lessons/:id/topics", component: () => import("@/views/teacher/Topics.vue") },
        { path: "games", component: () => import("@/views/teacher/Games.vue") },
        { path: "ratings", component: () => import("@/views/teacher/Ratings.vue") },
        { path: "videos", component: () => import("@/views/teacher/Videos.vue") },
        { path: "ai", component: () => import("@/views/teacher/AI.vue") },
        { path: "ai-logs", component: () => import("@/views/teacher/AILogs.vue") },
        { path: "settings", component: () => import("@/views/teacher/Settings.vue") },
      ],
    },
    {
      path: "/student",
      component: () => import("@/views/student/Layout.vue"),
      meta: { requiresAuth: true, role: "student" },
      children: [
        { path: "dashboard", component: () => import("@/views/student/Dashboard.vue") },
        { path: "lessons", component: () => import("@/views/student/Lessons.vue") },
        { path: "lessons/:id/topics", component: () => import("@/views/student/LessonTopics.vue") },
        { path: "topics/:id/read", component: () => import("@/views/student/TopicRead.vue") },
        { path: "topics/:id/test", component: () => import("@/views/student/Test.vue") },
        { path: "games", component: () => import("@/views/student/Games.vue") },
        { path: "ratings", component: () => import("@/views/student/Ratings.vue") },
        { path: "videos", component: () => import("@/views/student/Videos.vue") },
        { path: "ai", component: () => import("@/views/student/AI.vue") },
        { path: "settings", component: () => import("@/views/student/Settings.vue") },
      ],
    },
    { path: "/:pathMatch(.*)*", component: () => import("@/views/NotFound.vue") },
  ],
});

// Har bir sayt faqat o'z roliga xizmat qiladi:
//   teacher sayti (5173) → faqat o'qituvchi,  student sayti (5174) → faqat o'quvchi
const SITE_ROLE = APP_ROLE === "teacher" || APP_ROLE === "student" ? APP_ROLE : null;

function homeFor(role) {
  return role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
}

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.user && auth.token) await auth.fetchMe();

  // Bu saytga to'g'ri kelmaydigan rol bilan kirilgan bo'lsa — sessiyani tozalaymiz.
  // (Aks holda /login ↔ /dashboard orasida cheksiz redirect yuzaga keladi.)
  if (SITE_ROLE && auth.isLoggedIn && auth.user.role !== SITE_ROLE) {
    auth.logout();
    return { path: "/login", query: { wrongRole: "1" } };
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) return "/login";

  if (to.meta.guest && auth.isLoggedIn) {
    return homeFor(SITE_ROLE ?? auth.user.role);
  }

  // Ro'yxatdan o'tish faqat o'quvchi saytida mavjud
  if (to.path === "/register" && SITE_ROLE === "teacher") return "/login";

  // Sayt roliga tegishli bo'lmagan bo'limlarni bloklaymiz
  if (SITE_ROLE && to.meta.role && to.meta.role !== SITE_ROLE) {
    return auth.isLoggedIn ? homeFor(SITE_ROLE) : "/login";
  }

  // Birlashgan rejim (vite.config.js) — foydalanuvchi roliga qarab
  if (!SITE_ROLE && auth.isLoggedIn) {
    if (to.meta.role && to.meta.role !== auth.user.role) return homeFor(auth.user.role);
  }
});

export default router;
