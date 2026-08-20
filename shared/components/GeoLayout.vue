<template>
  <div class="shell">

    <!-- SIDEBAR -->
    <aside class="sidebar" :class="{ 'sidebar--open': mobileOpen }">
      <!-- Logo -->
      <div class="sidebar__logo">
        <div class="sidebar__logo-icon">
          <img v-if="settings.brandLogo" :src="settings.brandLogo" class="sidebar__logo-img" />
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <div class="sidebar__logo-text">
          <span class="sidebar__logo-name">{{ settings.brandName }}</span>
          <span class="sidebar__logo-role">
            {{ auth.user?.role === 'teacher' ? settings.t('teacher_panel') : settings.t('student_panel') }}
          </span>
        </div>
      </div>

      <!-- Nav -->
      <nav class="sidebar__nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="sidebar__link"
          :class="{ 'sidebar__link--active': isActive(item.to) }"
          @click="mobileOpen = false"
        >
          <div class="sidebar__link-icon-wrap">
            <component :is="item.icon" :size="17" />
          </div>
          <span class="sidebar__link-label">{{ item.labelKey ? settings.t(item.labelKey) : item.label }}</span>
          <span v-if="item.badge" class="sidebar__badge">{{ item.badge }}</span>
        </RouterLink>
      </nav>

      <!-- User footer -->
      <div class="sidebar__footer">
        <div class="sidebar__user">
          <div class="sidebar__avatar">
            <img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" class="sidebar__avatar-img" />
            <span v-else>{{ auth.user?.name?.charAt(0)?.toUpperCase() }}</span>
          </div>
          <div class="sidebar__user-info">
            <p class="sidebar__user-name">{{ auth.user?.name }}</p>
            <p class="sidebar__user-sub">
              {{ auth.user?.role === 'teacher'
                  ? settings.t('teacher_role')
                  : settings.t('student_of_grade', { grade: auth.user?.grade }) }}
            </p>
          </div>
        </div>
        <button @click="handleLogout" class="sidebar__logout">
          <LogOut :size="15" />
          <span>{{ settings.t('logout') }}</span>
        </button>
      </div>
    </aside>

    <!-- MOBILE OVERLAY -->
    <Transition name="fade-overlay">
      <div v-if="mobileOpen" class="overlay" @click="mobileOpen = false" />
    </Transition>

    <!-- MAIN -->
    <div class="main-wrap">
      <!-- Mobile topbar -->
      <header class="topbar">
        <button class="topbar__menu" @click="mobileOpen = !mobileOpen">
          <Menu v-if="!mobileOpen" :size="20" />
          <X v-else :size="20" />
        </button>
        <div class="topbar__brand">
          <img v-if="settings.brandLogo" :src="settings.brandLogo" class="topbar__brand-img" />
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>{{ settings.brandName }}</span>
        </div>
        <div class="topbar__avatar">{{ auth.user?.name?.charAt(0)?.toUpperCase() }}</div>
      </header>

      <main class="main">
        <div class="main__inner">
          <RouterView />
        </div>
      </main>
    </div>

  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRoute, useRouter, RouterLink, RouterView } from "vue-router";
import { LogOut, Menu, X } from "lucide-vue-next";
import { useAuthStore } from "@shared/stores/auth";
import { useSettingsStore } from "@shared/stores/settings";

defineProps({ navItems: { type: Array, required: true } });

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();
const mobileOpen = ref(false);

function isActive(to) {
  if (route.path === to) return true;
  const base = to.split("/").slice(0, 3).join("/");
  return route.path.startsWith(base + "/") || route.path.startsWith(base + "?");
}

function handleLogout() {
  auth.logout();
  router.push("/login");
}
</script>

<style scoped>
/* ── Shell ── */
.shell { display: flex; min-height: 100vh; background: hsl(var(--bg)); }

/* ── Sidebar ── */
.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0; width: 260px; z-index: 50;
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, hsl(174 65% 13%) 0%, hsl(174 60% 10%) 100%);
  border-right: 1px solid hsl(174 40% 18%);
  overflow-y: auto;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar__logo { display: flex; align-items: center; gap: 12px; padding: 20px 18px 16px; border-bottom: 1px solid hsl(174 35% 18%); }
.sidebar__logo-icon {
  width: 40px; height: 40px; border-radius: 12px;
  background: hsl(174 60% 30%);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
  box-shadow: 0 4px 12px hsl(174 60% 15%);
}
.sidebar__logo-img { width: 100%; height: 100%; object-fit: cover; }
.sidebar__logo-name { display: block; font-size: 16px; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
.sidebar__logo-role { display: block; font-size: 11px; color: hsl(174 30% 60%); margin-top: 1px; }

.sidebar__nav { flex: 1; padding: 10px 8px; display: flex; flex-direction: column; gap: 1px; }
.sidebar__link {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 10px; border-radius: 10px;
  font-size: 13.5px; font-weight: 500;
  color: hsl(174 20% 65%);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  position: relative;
}
.sidebar__link:hover { background: hsl(174 40% 18%); color: hsl(174 20% 88%); }
.sidebar__link--active { background: hsl(174 50% 22%); color: #fff; font-weight: 600; }
.sidebar__link--active::before {
  content: ''; position: absolute; left: 0; top: 25%; height: 50%; width: 3px;
  border-radius: 0 3px 3px 0; background: hsl(174 60% 48%);
}
.sidebar__link-icon-wrap {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; background: hsl(174 35% 17%);
  color: inherit; transition: background 0.15s;
}
.sidebar__link--active .sidebar__link-icon-wrap { background: hsl(174 55% 26%); color: hsl(174 70% 65%); }
.sidebar__link-label { flex: 1; }
.sidebar__badge { background: hsl(174 60% 36%); color: white; border-radius: 99px; font-size: 10px; font-weight: 700; padding: 2px 7px; }

.sidebar__footer { padding: 10px 8px; border-top: 1px solid hsl(174 35% 18%); }
.sidebar__user { display: flex; align-items: center; gap: 10px; padding: 8px 10px 4px; }
.sidebar__avatar {
  width: 36px; height: 36px; border-radius: 10px;
  background: hsl(174 50% 24%); color: hsl(174 60% 75%);
  font-weight: 700; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.sidebar__avatar-img { width: 100%; height: 100%; object-fit: cover; }
.sidebar__user-name { font-size: 13px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar__user-sub  { font-size: 11px; color: hsl(174 25% 55%); margin-top: 1px; }
.sidebar__logout {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 9px 10px; border-radius: 10px;
  background: transparent; border: none;
  color: hsl(174 20% 55%);
  font-size: 13px; font-weight: 500; cursor: pointer;
  font-family: inherit; transition: background 0.15s, color 0.15s; margin-top: 2px;
}
.sidebar__logout:hover { background: hsl(0 60% 20%); color: hsl(0 60% 75%); }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 45; backdrop-filter: blur(2px); }
.fade-overlay-enter-active, .fade-overlay-leave-active { transition: opacity 0.2s; }
.fade-overlay-enter-from, .fade-overlay-leave-to { opacity: 0; }

.main-wrap { flex: 1; min-width: 0; margin-left: 260px; display: flex; flex-direction: column; min-height: 100vh; }

.topbar {
  display: none; position: sticky; top: 0; z-index: 40;
  height: 56px; background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
  align-items: center; justify-content: space-between; padding: 0 16px;
}
.topbar__menu { width: 36px; height: 36px; border-radius: 10px; background: hsl(var(--muted)); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: hsl(var(--fg)); }
.topbar__brand { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800; color: hsl(var(--fg)); }
.topbar__brand-img { width: 20px; height: 20px; border-radius: 6px; object-fit: cover; }
.topbar__avatar { width: 34px; height: 34px; border-radius: 10px; background: hsl(var(--primary)); color: white; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }

.main { flex: 1; }
.main__inner {
  max-width: 1240px;
  margin: 0 auto;
  padding: 32px 28px;
  width: 100%;
}

@media (max-width: 1023px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar--open { transform: translateX(0); }
  .topbar { display: flex; }
  .main-wrap { margin-left: 0; }
  .main__inner { padding: 20px 14px; }
}
</style>
