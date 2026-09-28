import { useAuthStore } from "@shared/stores/auth";

/**
 * Har bir sayt faqat o'z roliga xizmat qiladi:
 *   admin/ → "teacher",  user/ → "student"
 *
 * @param {"teacher"|"student"} siteRole
 * @returns vue-router beforeEach hookiga beriladigan funksiya
 */
export function createRoleGuard(siteRole) {
  const home = siteRole === "teacher" ? "/dashboard" : "/dashboard";

  return async function roleGuard(to) {
    const auth = useAuthStore();
    if (!auth.user && auth.token) await auth.fetchMe();

    // Bu saytga to'g'ri kelmaydigan rol bilan kirilgan bo'lsa — sessiyani tozalaymiz.
    // (Aks holda /login ↔ /dashboard orasida cheksiz redirect yuzaga keladi.)
    if (auth.isLoggedIn && auth.user.role !== siteRole) {
      auth.logout();
      return { path: "/login", query: { wrongRole: "1" } };
    }

    if (to.meta.requiresAuth && !auth.isLoggedIn) return "/login";
    if (to.meta.guest && auth.isLoggedIn) return home;

    // Ro'yxatdan o'tish faqat o'quvchi saytida mavjud
    if (to.path === "/register" && siteRole === "teacher") return "/login";
  };
}
