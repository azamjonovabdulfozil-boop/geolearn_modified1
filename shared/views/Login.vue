<template>
  <div class="auth-shell">
    <div class="auth-left">
      <div class="auth-left-content">
        <div class="brand">
          <div class="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <span class="brand-name">GeoLearn</span>
        </div>
        <div v-if="APP_ROLE === 'teacher'" class="role-badge teacher-badge">🏫 O'qituvchi portali</div>
        <div v-else-if="APP_ROLE === 'student'" class="role-badge student-badge">🎓 O'quvchi portali</div>
        <h2 class="left-title">Bilimingizni oshiring</h2>
        <p class="left-desc">Interaktiv darslar, testlar va o'yinlar orqali geografiyani o'rganing</p>
        <div class="features">
          <div v-for="f in features" :key="f.text" class="feature">
            <div class="feature-icon"><component :is="f.icon" :size="16" /></div>
            <span>{{ f.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="auth-right">
      <div class="auth-box">
        <div class="auth-head">
          <div v-if="APP_ROLE === 'teacher'" class="role-tag teacher-tag">🏫 O'qituvchi kirishi</div>
          <div v-else-if="APP_ROLE === 'student'" class="role-tag student-tag">🎓 O'quvchi kirishi</div>
          <h1 class="auth-title">Xush kelibsiz! 👋</h1>
          <p class="auth-sub">Akkauntingizga kiring</p>
        </div>

        <div class="form-stack">
          <div class="form-field">
            <label>Foydalanuvchi nomi</label>
            <div class="input-wrap">
              <User :size="16" class="input-icon" />
              <input v-model="form.username" class="geo-input input-with-icon"
                placeholder="foydalanuvchi_nomi" autocomplete="username"
                @keydown.enter="handleLogin" />
            </div>
          </div>

          <div class="form-field">
            <label>Parol</label>
            <div class="input-wrap">
              <Lock :size="16" class="input-icon" />
              <input v-model="form.password" :type="showPw ? 'text' : 'password'"
                class="geo-input input-with-icon input-with-eye"
                placeholder="••••••••" autocomplete="current-password"
                @keydown.enter="handleLogin" />
              <button type="button" @click="showPw = !showPw" class="eye-btn">
                <Eye v-if="!showPw" :size="16" />
                <EyeOff v-else :size="16" />
              </button>
            </div>
          </div>

          <p v-if="error" class="error-msg">{{ error }}</p>
          <a v-if="showOtherPortal && OTHER_PORTAL_URL" :href="OTHER_PORTAL_URL" class="portal-link">
            {{ otherPortalLabel }} →
          </a>

          <button @click="handleLogin" :disabled="!form.username || !form.password || loading"
            class="geo-btn-primary submit-btn">
            <Loader2 v-if="loading" :size="16" class="animate-spin" />
            <LogIn v-else :size="16" />
            {{ loading ? 'Kirilmoqda...' : 'Kirish' }}
          </button>
        </div>

        <p v-if="APP_ROLE !== 'teacher'" class="auth-link">
          Akkauntingiz yo'qmi?
          <RouterLink to="/register">Ro'yxatdan o'tish</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter, useRoute, RouterLink } from "vue-router";
import { User, Lock, LogIn, Eye, EyeOff, Loader2, BookOpen, Gamepad2, Trophy } from "lucide-vue-next";
import { useAuthStore } from "@shared/stores/auth";

const APP_ROLE = typeof __APP_ROLE__ !== "undefined" ? __APP_ROLE__ : "both";
// Ikkinchi portalning manzili: build vaqtida VITE_TEACHER_URL / VITE_STUDENT_URL
// berilgan bo'lsa o'sha, aks holda joriy port bo'yicha avtomatik aniqlanadi.
const PORT_PAIRS = {
  "5173": "5174", "5174": "5173",   // dev
  "4173": "4174", "4174": "4173",   // vite preview
  "3001": "3002", "3002": "3001",   // node backend
};
const OTHER_PORTAL_URL = (() => {
  const fromEnv = typeof __OTHER_PORTAL_URL__ !== "undefined" ? __OTHER_PORTAL_URL__ : "";
  if (fromEnv) return fromEnv;
  const { protocol, hostname, port } = window.location;
  const other = PORT_PAIRS[port];
  return other ? `${protocol}//${hostname}:${other}` : "";
})();

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const form = ref({ username: "", password: "" });
const showPw = ref(false);
const loading = ref(false);
const error = ref("");
const showOtherPortal = ref(false);

// Router boshqa rol bilan kirilganini aniqlasa (?wrongRole=1) — xabar ko'rsatamiz
if (route.query.wrongRole) {
  error.value = APP_ROLE === "teacher"
    ? "Bu portal faqat o'qituvchilar uchun."
    : "Bu portal faqat o'quvchilar uchun.";
  showOtherPortal.value = true;
}

const otherPortalLabel = APP_ROLE === "teacher" ? "O'quvchi portaliga o'tish" : "O'qituvchi portaliga o'tish";

const features = [
  { icon: BookOpen, text: "Interaktiv geografiya darslari" },
  { icon: Gamepad2, text: "O'yinli testlar va musobaqalar" },
  { icon: Trophy,   text: "Reyting va yutuqlar tizimi" },
];

async function handleLogin() {
  if (!form.value.username || !form.value.password) return;
  loading.value = true;
  error.value = "";
  try {
    const user = await auth.login(form.value.username, form.value.password);

    // Har bir sayt faqat o'z rolini qabul qiladi
    if (APP_ROLE !== "both" && user.role !== APP_ROLE) {
      auth.logout();
      error.value = APP_ROLE === "teacher"
        ? "Bu portal faqat o'qituvchilar uchun."
        : "Bu portal faqat o'quvchilar uchun.";
      showOtherPortal.value = true;
      loading.value = false;
      return;
    }

    router.push("/dashboard");
  } catch (e) {
    error.value = e.data?.error || "Login yoki parol noto'g'ri";
  }
  loading.value = false;
}
</script>

<style scoped>
.auth-shell {
  min-height: 100vh;
  display: flex;
}
.portal-link {
  display: block; text-align: center;
  font-size: 13.5px; font-weight: 600;
  color: hsl(var(--primary)); text-decoration: none;
  padding: 4px 0;
}
.portal-link:hover { text-decoration: underline; }

/* Left panel */
.auth-left {
  display: none;
  width: 45%;
  background: linear-gradient(160deg, hsl(174 65% 16%) 0%, hsl(174 58% 10%) 100%);
  position: relative;
  overflow: hidden;
}
.auth-left::before {
  content: '';
  position: absolute;
  width: 300px; height: 300px;
  border-radius: 50%;
  background: hsl(174 60% 30%/0.2);
  top: -80px; right: -80px;
}
.auth-left::after {
  content: '';
  position: absolute;
  width: 200px; height: 200px;
  border-radius: 50%;
  background: hsl(174 55% 25%/0.15);
  bottom: 60px; left: -50px;
}
@media (min-width: 900px) { .auth-left { display: flex; align-items: center; justify-content: center; } }

.auth-left-content {
  padding: 48px;
  position: relative; z-index: 1;
}
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.brand-icon {
  width: 48px; height: 48px;
  border-radius: 14px;
  background: hsl(174 60% 30%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px hsl(174 60% 10%/0.6);
}
.brand-name { font-size: 22px; font-weight: 800; color: white; }
.left-title { font-size: 30px; font-weight: 800; color: white; line-height: 1.2; margin-bottom: 14px; }
.left-desc { font-size: 15px; color: hsl(174 25% 68%); line-height: 1.6; margin-bottom: 36px; }
.features { display: flex; flex-direction: column; gap: 14px; }
.feature { display: flex; align-items: center; gap: 12px; }
.feature-icon { width: 34px; height: 34px; border-radius: 10px; background: hsl(174 55% 22%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: hsl(174 60% 65%); }
.feature span { font-size: 14px; color: hsl(174 20% 72%); }

/* Role badges */
.role-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 20px;
}
.teacher-badge { background: hsl(220 80% 50%/0.25); color: hsl(220 80% 80%); border: 1px solid hsl(220 80% 50%/0.4); }
.student-badge { background: hsl(142 70% 35%/0.25); color: hsl(142 70% 75%); border: 1px solid hsl(142 70% 40%/0.4); }

/* Right panel */
.auth-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
}
.auth-box { width: 100%; max-width: 400px; }
.auth-head { margin-bottom: 28px; }
.auth-title { font-size: 1.9rem; font-weight: 800; letter-spacing: -.025em; margin-bottom: 6px; }
.auth-sub { font-size: 14px; color: hsl(var(--muted-fg)); }

/* Role tags in form */
.role-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 12px;
}
.teacher-tag { background: hsl(220 80% 95%); color: hsl(220 80% 40%); }
.student-tag { background: hsl(142 70% 93%); color: hsl(142 60% 30%); }

.form-stack { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
.form-field { display: flex; flex-direction: column; gap: 7px; }
.form-field label { font-size: 13px; font-weight: 600; }

.input-wrap { position: relative; }
.input-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: hsl(var(--muted-fg)); pointer-events: none; }
.input-with-icon { padding-left: 40px; }
.input-with-eye { padding-right: 40px; }
.eye-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: hsl(var(--muted-fg)); padding: 2px; }
.eye-btn:hover { color: hsl(var(--fg)); }

.error-msg { font-size: 13px; padding: 10px 13px; border-radius: 10px; background: hsl(0 70% 50%/0.1); color: hsl(0 60% 44%); }
.submit-btn { width: 100%; padding: .75rem; font-size: 15px; }

.auth-link { text-align: center; font-size: 13.5px; color: hsl(var(--muted-fg)); }
.auth-link a { color: hsl(var(--primary)); font-weight: 600; text-decoration: none; }
.auth-link a:hover { text-decoration: underline; }
</style>
