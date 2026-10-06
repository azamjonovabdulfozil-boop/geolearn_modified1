import { useAuthStore } from "@shared/stores/auth";

/**
 * Har bir sayt faqat o'z roliga xizmat qiladi:
 *   admin/ → "teacher",  user/ → "student"
 *
 * @param {"teacher"|"student"} siteRole
 * @returns vue-router beforeEach hookiga beriladigan funksiya
 */
export function createRoleGuard(siteRole) {
  const home = "/dashboard";
  let synced = false;

  return async function roleGuard(to) {
    const auth = useAuthStore();

    // Sahifa ochilganda profil bir marta serverdan yangilanadi. Saqlangan
    // profil bo'lsa — kutmaymiz (foydalanuvchi turgan sahifasida qoladi),
    // bo'lmasa — javobni kutamiz.
    if (!synced && auth.token) {
      synced = true;
      if (auth.user) {
        // Token bekor bo'lgan bo'lsa (401) — login sahifasiga
        auth.fetchMe().then(() => {
          if (!auth.isLoggedIn) window.location.replace(`${import.meta.env.BASE_URL}login`);
        });
      } else {
        await auth.fetchMe();
      }
    }

    // Bu saytga to'g'ri kelmaydigan rol bilan kirilgan bo'lsa — sessiyani tozalaymiz.
    // (Aks holda /login ↔ /dashboard orasida cheksiz redirect yuzaga keladi.)
    if (auth.isLoggedIn && auth.user.role !== siteRole) {
      auth.logout();
      return { path: "/login", query: { wrongRole: "1" } };
    }

    // Kirilmagan bo'lsa — login'dan keyin shu sahifaga qaytamiz
    if (to.meta.requiresAuth && !auth.isLoggedIn) {
      return { path: "/login", query: to.fullPath !== home ? { redirect: to.fullPath } : {} };
    }
    if (to.meta.guest && auth.isLoggedIn) return safeRedirect(to.query.redirect) || home;

    // Ro'yxatdan o'tish faqat o'quvchi saytida mavjud
    if (to.path === "/register" && siteRole === "teacher") return "/login";
  };
}

/** Faqat sayt ichidagi yo'llarga qaytaramiz (tashqi manzilga emas). */
export function safeRedirect(r) {
  return typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : null;
}
