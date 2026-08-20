import { createRouter, createWebHistory } from "vue-router";
import { createRoleGuard } from "@shared/router/guard";

// O'quvchi sayti — faqat "student" roli
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/login",    component: () => import("@shared/views/Login.vue"),    meta: { guest: true } },
    { path: "/register", component: () => import("@shared/views/Register.vue"), meta: { guest: true } },
    {
      path: "/",
      component: () => import("./views/Layout.vue"),
      meta: { requiresAuth: true },
      children: [
        { path: "dashboard",           component: () => import("./views/Dashboard.vue") },
        { path: "lessons",             component: () => import("./views/Lessons.vue") },
        { path: "lessons/:id/topics",  component: () => import("./views/LessonTopics.vue") },
        { path: "topics/:id/read",     component: () => import("./views/TopicRead.vue") },
        { path: "topics/:id/test",     component: () => import("./views/Test.vue") },
        { path: "games",               component: () => import("./views/Games.vue") },
        { path: "ratings",             component: () => import("./views/Ratings.vue") },
        { path: "videos",              component: () => import("./views/Videos.vue") },
        { path: "ai",                  component: () => import("./views/AI.vue") },
        { path: "settings",            component: () => import("./views/Settings.vue") },
      ],
    },
    { path: "/:pathMatch(.*)*", component: () => import("@shared/views/NotFound.vue") },
  ],
});

router.beforeEach(createRoleGuard("student"));

export default router;
