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

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.user && auth.token) await auth.fetchMe();

  if (to.meta.requiresAuth && !auth.isLoggedIn) return "/login";

  if (to.meta.guest && auth.isLoggedIn) {
    if (APP_ROLE === "teacher") return "/teacher/dashboard";
    if (APP_ROLE === "student") return "/student/dashboard";
    return auth.isTeacher ? "/teacher/dashboard" : "/student/dashboard";
  }

  // Port-based role enforcement
  if (APP_ROLE === "teacher") {
    // Only teachers allowed on port 5173
    if (to.meta.requiresAuth && auth.user?.role !== "teacher") {
      return "/login";
    }
    // Block student routes on teacher port
    if (to.meta.role === "student") return "/teacher/dashboard";
  }

  if (APP_ROLE === "student") {
    // Only students allowed on port 5174
    if (to.meta.requiresAuth && auth.user?.role !== "student") {
      return "/login";
    }
    // Block teacher routes on student port
    if (to.meta.role === "teacher") return "/student/dashboard";
  }

  // Default behavior (original vite.config.js)
  if (APP_ROLE === "both") {
    if (to.meta.role === "teacher" && auth.user?.role !== "teacher") return "/student/dashboard";
    if (to.meta.role === "student" && auth.user?.role !== "student") return "/teacher/dashboard";
  }
});

export default router;
