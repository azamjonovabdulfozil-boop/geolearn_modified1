<template>
  <div class="reg-shell">
    <div class="reg-box">
      <div class="reg-icon">
        <GraduationCap :size="28" style="color:white" />
      </div>
      <h1 class="reg-title">O'quvchi sifatida<br>ro'yxatdan o'tish</h1>
      <p class="reg-sub">GeoLearn platformasiga qo'shiling</p>

      <div class="geo-card form-card">
        <div class="form-stack">
          <div class="form-field">
            <label>Ism va familiya</label>
            <div class="input-wrap">
              <UserIcon :size="15" class="iico" />
              <input v-model="form.name" class="geo-input pipad" placeholder="Abdullayev Ali" />
            </div>
          </div>

          <div class="form-field">
            <label>Foydalanuvchi nomi</label>
            <div class="input-wrap">
              <AtSign :size="15" class="iico" />
              <input v-model="form.username" class="geo-input pipad"
                placeholder="ali123" autocomplete="username" />
            </div>
          </div>

          <div class="form-field">
            <label>Parol</label>
            <div class="input-wrap">
              <Lock :size="15" class="iico" />
              <input v-model="form.password" :type="showPw ? 'text' : 'password'"
                class="geo-input pipad pipad-r"
                placeholder="••••••••" autocomplete="new-password" />
              <button type="button" @click="showPw = !showPw" class="eye-btn">
                <Eye v-if="!showPw" :size="15" /><EyeOff v-else :size="15" />
              </button>
            </div>
          </div>

          <div class="form-field">
            <label>Sinfingiz</label>
            <div class="input-wrap">
              <School :size="15" class="iico" />
              <input v-model="form.className" class="geo-input pipad"
                placeholder="Masalan: 7-A yoki 7-B" maxlength="12" />
            </div>
            <p v-if="form.className && !classOk" class="grade-hint grade-hint--err">
              Sinfni raqam va harf bilan yozing, masalan: 7-A
            </p>
            <p v-else-if="classOk" class="grade-hint">{{ normalizedClass }} sinf</p>
          </div>

          <p v-if="error" class="error-msg">{{ error }}</p>

          <button @click="handleRegister"
            :disabled="!form.name || !form.username || !form.password || !classOk || loading"
            class="geo-btn-primary submit-btn">
            <Loader2 v-if="loading" :size="15" class="animate-spin" />
            <UserPlus v-else :size="15" />
            {{ loading ? "Ro'yxatdan o'tilmoqda..." : "Ro'yxatdan o'tish" }}
          </button>
        </div>
      </div>

      <p class="auth-link">
        Akkauntingiz bormi?
        <RouterLink to="/login">Kirish</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { School, GraduationCap, User as UserIcon, AtSign, Lock, Eye, EyeOff, UserPlus, Loader2 } from "lucide-vue-next";
import { useAuthStore } from "@shared/stores/auth";

const router = useRouter();
const auth = useAuthStore();

const showPw = ref(false);
const loading = ref(false);
const error = ref("");
const form = ref({ name: "", username: "", password: "", className: "" });

// "7a", "7 - a", "7-A" → "7-A" (backend ham xuddi shunday tekshiradi)
const classMatch = computed(() =>
  form.value.className.trim().match(/^(\d{1,2})\s*[-–—_./ ]?\s*["'«]?(\p{L})["'»]?$/u));
const classOk = computed(() => Boolean(classMatch.value));
const normalizedClass = computed(() =>
  classMatch.value ? `${Number(classMatch.value[1])}-${classMatch.value[2].toLocaleUpperCase()}` : "");

async function handleRegister() {
  loading.value = true;
  error.value = "";
  try {
    const user = await auth.register({
      name: form.value.name,
      username: form.value.username,
      password: form.value.password,
      role: "student",
      className: normalizedClass.value,
    });
    router.push("/dashboard");
  } catch (e) {
    error.value = e.data?.error || "Xatolik yuz berdi";
  }
  loading.value = false;
}
</script>

<style scoped>
.reg-shell {
  min-height: 100vh;
  background: hsl(var(--bg));
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 20px 40px;
}
.reg-box { width: 100%; max-width: 440px; }


.reg-icon {
  width: 60px; height: 60px;
  border-radius: 18px;
  background: hsl(var(--primary));
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 6px 20px hsl(var(--primary)/.35);
}
.reg-title { font-size: 1.6rem; font-weight: 800; letter-spacing: -.02em; line-height: 1.2; margin-bottom: 6px; }
.reg-sub { font-size: 13.5px; color: hsl(var(--muted-fg)); margin-bottom: 20px; }

.form-card { padding: 20px; margin-bottom: 16px; }
.form-stack { display: flex; flex-direction: column; gap: 14px; }
.form-field { display: flex; flex-direction: column; gap: 7px; }
.form-field label { font-size: 13px; font-weight: 600; }

.input-wrap { position: relative; }
.iico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: hsl(var(--muted-fg)); pointer-events: none; }
.pipad { padding-left: 38px; }
.pipad-r { padding-right: 40px; }
.eye-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: hsl(var(--muted-fg)); padding: 2px; }
.eye-btn:hover { color: hsl(var(--fg)); }

.grade-hint { font-size: 12px; color: hsl(var(--primary)); font-weight: 600; }
.grade-hint--err { color: hsl(0 60% 46%); font-weight: 500; }

.error-msg { font-size: 13px; padding: 10px 13px; border-radius: 10px; background: hsl(0 70% 50%/0.1); color: hsl(0 60% 44%); }
.submit-btn { width: 100%; padding: .7rem; font-size: 14.5px; }

.auth-link { text-align: center; font-size: 13.5px; color: hsl(var(--muted-fg)); }
.auth-link a { color: hsl(var(--primary)); font-weight: 600; text-decoration: none; }
.auth-link a:hover { text-decoration: underline; }
</style>
