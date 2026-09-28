import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "@shared/composables/api";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(null);
  const token = ref(localStorage.getItem("geo_token"));
  const loading = ref(false);

  const isLoggedIn = computed(() => !!token.value && !!user.value);
  const isTeacher = computed(() => user.value?.role === "teacher");

  async function fetchMe() {
    if (!token.value) return;
    try {
      const data = await api("/api/auth/me");
      user.value = data;
    } catch {
      token.value = null;
      user.value = null;
      localStorage.removeItem("geo_token");
    }
  }

  /** Jim yangilash: tarmoq xatosida chiqarib yubormaydi, faqat 401 da. */
  async function refreshMe() {
    if (!token.value) return;
    try { user.value = await api("/api/auth/me"); }
    catch (e) { if (e?.status === 401) { token.value = null; user.value = null; localStorage.removeItem("geo_token"); } }
  }

  async function login(username, password) {
    loading.value = true;
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      token.value = data.token;
      user.value = data.user;
      localStorage.setItem("geo_token", data.token);
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
      token.value = data.token;
      user.value = data.user;
      localStorage.setItem("geo_token", data.token);
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
    user.value = data;
    return data;
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem("geo_token");
  }

  return { user, token, loading, isLoggedIn, isTeacher, fetchMe, refreshMe, login, register, updateProfile, logout };
});
