<template>
  <div class="fade-in settings-wrap">
    <div class="page-header">
      <h1 class="geo-page-title">{{ settings.t('settings_title') }}</h1>
      <p class="geo-page-sub">{{ settings.t('settings_sub') }}</p>
    </div>

    <div class="settings-grid">
      <!-- Profile -->
      <div class="geo-card section-card span-2">
        <div class="section-head">
          <div class="section-icon" style="background:hsl(var(--primary)/0.1)">
            <UserCircle :size="16" style="color:hsl(var(--primary))" />
          </div>
          <h2>{{ settings.t('profile') }}</h2>
        </div>

        <div class="avatar-row">
          <div class="avatar-box">
            <img v-if="avatarPreview || auth.user?.avatarUrl" :src="avatarPreview || auth.user?.avatarUrl" class="avatar-img" />
            <span v-else class="avatar-letter">{{ auth.user?.name?.charAt(0)?.toUpperCase() }}</span>
          </div>
          <div class="avatar-info">
            <p class="avatar-name">{{ auth.user?.name }}</p>
            <p class="avatar-role">{{ settings.t('student_role_grade', { grade: auth.user?.grade }) }}</p>
            <div class="avatar-actions">
              <label class="geo-btn-outline btn-sm cursor-pointer">
                <ImageIcon :size="13" /> {{ settings.t('upload_image') }}
                <input type="file" accept="image/*" class="hidden" @change="onAvatarChange" />
              </label>
              <button v-if="avatarPreview || auth.user?.avatarUrl" @click="removeAvatar" class="geo-btn-ghost btn-sm" style="color:hsl(var(--destructive))">
                <Trash2 :size="13" />
              </button>
            </div>
            <p class="avatar-hint">{{ settings.t('image_hint') }}</p>
          </div>
        </div>

        <div class="field-row">
          <label>{{ settings.t('name') }}</label>
          <input v-model="profileForm.name" class="geo-input" :placeholder="settings.t('name')" />
        </div>

        <p v-if="profileMsg" class="status-msg" :class="profileOk ? 'ok' : 'err'">{{ profileMsg }}</p>
        <button @click="saveProfile" :disabled="profileSaving" class="geo-btn-primary w-full">
          <Loader2 v-if="profileSaving" :size="15" class="animate-spin" />
          <Save v-else :size="15" />
          {{ profileSaving ? settings.t('saving') : settings.t('save_profile') }}
        </button>
      </div>

      <!-- Theme -->
      <div class="geo-card section-card">
        <div class="section-head">
          <div class="section-icon" style="background:hsl(280 60% 50%/0.1)">
            <Palette :size="16" style="color:hsl(280 60% 45%)" />
          </div>
          <h2>{{ settings.t('theme') }}</h2>
        </div>
        <div class="option-grid">
          <button v-for="[val, key, Icon] in themeOptions" :key="val"
            @click="settings.setTheme(val)"
            class="option-btn" :class="{ 'option-btn--on': settings.theme === val }">
            <component :is="Icon" :size="18" />
            <span>{{ settings.t(key) }}</span>
            <div v-if="settings.theme === val" class="check-dot"></div>
          </button>
        </div>
      </div>

      <!-- Language -->
      <div class="geo-card section-card">
        <div class="section-head">
          <div class="section-icon" style="background:hsl(220 70% 50%/0.1)">
            <Languages :size="16" style="color:hsl(220 70% 45%)" />
          </div>
          <h2>{{ settings.t('language') }}</h2>
        </div>
        <div class="option-grid">
          <button v-for="lang in langs" :key="lang.code"
            @click="settings.setLanguage(lang.code)"
            class="option-btn" :class="{ 'option-btn--on': settings.language === lang.code }">
            <span class="flag">{{ lang.flag }}</span>
            <span>{{ lang.label }}</span>
            <div v-if="settings.language === lang.code" class="check-dot"></div>
          </button>
        </div>
      </div>

      <!-- Font size -->
      <div class="geo-card section-card">

        <div class="section-head">
          <div class="section-icon" style="background:hsl(38 90% 48%/0.1)">
            <Type :size="16" style="color:hsl(38 80% 40%)" />
          </div>
          <h2>{{ settings.t('font_size') }}</h2>
        </div>
        <div class="font-grid">
          <button v-for="[val, key, sz] in fontOptions" :key="val"
            @click="settings.setFontSize(val)"
            class="font-btn" :class="{ 'font-btn--on': settings.fontSize === val }">
            <span :style="`font-size:${sz};font-weight:700`">A</span>
            <span class="font-label">{{ settings.t(key) }}</span>
          </button>
        </div>
      </div>

      <!-- Password -->
      <div class="geo-card section-card">
        <div class="section-head">
          <div class="section-icon" style="background:hsl(0 70% 50%/0.08)">
            <Lock :size="16" style="color:hsl(0 60% 46%)" />
          </div>
          <h2>{{ settings.t('change_password') }}</h2>
        </div>
        <div class="form-stack">
          <input v-model="pwForm.current" type="password" class="geo-input" :placeholder="settings.t('current_password')" autocomplete="current-password" />
          <input v-model="pwForm.next" type="password" class="geo-input" :placeholder="settings.t('new_password')" autocomplete="new-password" />
          <p v-if="pwMsg" class="status-msg" :class="pwOk ? 'ok' : 'err'">{{ pwMsg }}</p>
          <button @click="changePassword" :disabled="!pwForm.current || !pwForm.next || pwSaving" class="geo-btn-primary w-full">
            <Loader2 v-if="pwSaving" :size="15" class="animate-spin" />
            {{ pwSaving ? '...' : settings.t('change_password') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { Sun, Moon, Lock, Loader2, Save, Palette, Languages, UserCircle, Type, ImageIcon, Trash2 } from "lucide-vue-next";
import { useAuthStore } from "@shared/stores/auth";
import { useSettingsStore } from "@shared/stores/settings";
import { api } from "@shared/composables/api";

const auth = useAuthStore();
const settings = useSettingsStore();

const themeOptions = [['light', 'light', Sun], ['dark', 'dark', Moon]];
const fontOptions  = [['small', 'small', '13px'], ['medium', 'medium', '15px'], ['large', 'large', '18px']];
const langs = [
  { code: "uz", label: "O'zbek", flag: "🇺🇿" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
];

const avatarPreview = ref(null);
const avatarFile = ref(null);
const profileForm = ref({ name: auth.user?.name ?? "" });
const profileSaving = ref(false);
const profileMsg = ref("");
const profileOk = ref(false);
const pwForm = ref({ current: "", next: "" });
const pwSaving = ref(false);
const pwMsg = ref("");
const pwOk = ref(false);

function onAvatarChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  avatarFile.value = file;
  const reader = new FileReader();
  reader.onload = (ev) => { avatarPreview.value = ev.target?.result; };
  reader.readAsDataURL(file);
}
function removeAvatar() { avatarPreview.value = null; avatarFile.value = null; }

async function saveProfile() {
  profileSaving.value = true;
  profileMsg.value = "";
  try {
    const avatarUrl = avatarFile.value ? avatarPreview.value : (!avatarPreview.value ? null : auth.user?.avatarUrl ?? null);
    await auth.updateProfile({ name: profileForm.value.name, avatarUrl: avatarUrl ?? undefined });
    profileMsg.value = settings.t('saved_ok'); profileOk.value = true;
    avatarFile.value = null;
  } catch (e) { profileMsg.value = e.message || "Xatolik"; profileOk.value = false; }
  profileSaving.value = false;
}

async function changePassword() {
  pwSaving.value = true; pwMsg.value = "";
  try {
    await api("/api/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword: pwForm.value.current, newPassword: pwForm.value.next }) });
    pwMsg.value = settings.t('password_changed_ok'); pwOk.value = true;
    pwForm.value = { current: "", next: "" };
  } catch (e) { pwMsg.value = e.message; pwOk.value = false; }
  pwSaving.value = false;
}
</script>

<style scoped>
.settings-wrap { max-width: 1100px; }
.page-header {
  margin-bottom: 16px; padding: 14px 18px; border-radius: 18px;
  background: linear-gradient(135deg, hsl(var(--primary)/.14), hsl(var(--card)) 55%, hsl(38 90% 48%/.10));
  border: 1px solid hsl(var(--border));
  box-shadow: 0 10px 24px hsl(var(--primary)/.06);
}

.settings-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }
.span-2 { grid-column: span 2; }
@media (max-width: 980px) {
  .settings-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .span-2 { grid-column: 1 / -1; }
}
@media (max-width: 600px) {
  .settings-grid { grid-template-columns: 1fr; }
  .span-2 { grid-column: auto; }
}

.section-card { padding: 14px; display: flex; flex-direction: column; gap: 10px; border-radius: 16px; }
.section-card:hover { border-color: hsl(var(--primary)/.28); box-shadow: 0 10px 22px hsl(var(--primary)/.06); }
.section-head { display: flex; align-items: center; gap: 8px; }
.section-icon { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.section-head h2 { font-size: 13.5px; font-weight: 700; }

.avatar-row { display: flex; align-items: center; gap: 12px; }
.avatar-box { width: 54px; height: 54px; border-radius: 16px; background: linear-gradient(135deg, hsl(var(--primary)), hsl(190 80% 42%)); color: white; font-size: 20px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; box-shadow: 0 8px 18px hsl(var(--primary)/.22); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-info { min-width: 0; flex: 1; }
.avatar-name { font-size: 13.5px; font-weight: 700; margin-bottom: 1px; }
.avatar-role { font-size: 11.5px; color: hsl(var(--muted-fg)); margin-bottom: 6px; }
.avatar-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.avatar-hint { display: none; }
.btn-sm { padding: .3rem .6rem; font-size: 11.5px; border-radius: .55rem; }
.cursor-pointer { cursor: pointer; }
.hidden { display: none; }

.field-row { display: flex; flex-direction: column; gap: 5px; }
.field-row label { font-size: 12px; font-weight: 600; }

.status-msg { font-size: 12px; padding: 6px 10px; border-radius: 8px; }
.status-msg.ok { background: hsl(142 60% 36%/0.1); color: hsl(142 55% 28%); }
.status-msg.err { background: hsl(0 70% 50%/0.1); color: hsl(0 60% 44%); }

.option-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.option-btn { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 11px; border: 1.5px solid hsl(var(--border)); background: hsl(var(--bg)); font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .15s; color: hsl(var(--muted-fg)); }
.option-btn:hover { border-color: hsl(var(--primary)/.4); color: hsl(var(--primary)); }
.option-btn--on { border-color: hsl(var(--primary)); background: hsl(var(--primary)/0.06); color: hsl(var(--fg)); }
.check-dot { width: 12px; height: 12px; border-radius: 50%; background: hsl(var(--primary)); margin-left: auto; display: flex; align-items: center; justify-content: center; }
.check-dot::after { content: ''; width: 4px; height: 4px; border-radius: 50%; background: white; }
.flag { font-size: 15px; }

.font-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
.font-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 9px 6px; border-radius: 11px; border: 1.5px solid hsl(var(--border)); background: hsl(var(--bg)); cursor: pointer; font-family: inherit; transition: all .15s; color: hsl(var(--muted-fg)); }
.font-btn:hover { border-color: hsl(var(--primary)/.4); }
.font-btn--on { border-color: hsl(var(--primary)); background: hsl(var(--primary)/0.06); color: hsl(var(--fg)); }
.font-label { font-size: 11px; font-weight: 500; }

.form-stack { display: flex; flex-direction: column; gap: 8px; }
.w-full { width: 100%; }
</style>
