import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "@shared/composables/api";

// Foydalanuvchi ma'lumoti ham saqlanadi: sahifa yangilanganda backend hali
// uyg'onmagan (Render bepul rejasi) yoki tarmoq uzilgan bo'lsa ham sessiya
// yo'qolmaydi va foydalanuvchi turgan sahifasida qoladi.
const TOKEN_KEY = "geo_token";
const USER_KEY = "geo_user";

function readUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem(TOKEN_KEY));
  const user = ref(token.value ? readUser() : null);
  const loading = ref(false);

  const isLoggedIn = computed(() => !!token.value && !!user.value);
  const isTeacher = computed(() => user.value?.role === "teacher");

  function setSession(newToken, newUser) {
    token.value = newToken;
    user.value = newUser;
    try {
      if (newToken) localStorage.setItem(TOKEN_KEY, newToken); else localStorage.removeItem(TOKEN_KEY);
      if (newUser) localStorage.setItem(USER_KEY, JSON.stringify(newUser)); else localStorage.removeItem(USER_KEY);
    } catch {}
  }

  /**
   * Profilni serverdan oladi. Sessiya faqat server tokenni rad etsa (401)
   * tozalanadi — tarmoq xatosi yoki server qayta ishga tushayotganda emas.
   */
  async function fetchMe() {
    if (!token.value) return;
    try {
      setSession(token.value, await api("/api/auth/me"));
    } catch (e) {
      if (e?.status === 401) setSession(null, null);
    }
  }

  /** Jim yangilash: tarmoq xatosida chiqarib yubormaydi, faqat 401 da. */
  async function refreshMe() {
    return fetchMe();
  }

  async function login(username, password) {
    loading.value = true;
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setSession(data.token, data.user);
      return data.user;
    } finally {
      loading.value = false;
    }
  }

  async function register(payload) {
    loading.value = true;
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSession(data.token, data.user);
      return data.user;
    } finally {
      loading.value = false;
    }
  }

  async function updateProfile(payload) {
    const data = await api("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setSession(token.value, data);
    return data;
  }

  function logout() {
    setSession(null, null);
  }

  return { user, token, loading, isLoggedIn, isTeacher, fetchMe, refreshMe, login, register, updateProfile, logout };
});
