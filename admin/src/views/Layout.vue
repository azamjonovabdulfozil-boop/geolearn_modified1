<template>
  <GeoLayout :navItems="navItems" />

  <!-- So'kinish haqida xabarlar — qaysi sahifada bo'lsangiz ham darhol chiqadi -->
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toasts" aria-live="assertive">
      <div v-for="a in alerts.fresh" :key="a.id" class="toast" role="alert">
        <div class="toast-icon"><ShieldAlert :size="18" /></div>
        <div class="toast-body">
          <p class="toast-title">{{ a.userName }} AI'ga so'kinib yozdi</p>
          <p class="toast-sub">
            {{ a.className ? `${a.className} sinf` : "O'quvchi" }} · {{ a.retro ? "oldinroq yozilgan" : `${a.warningNo || 1}-ogohlantirish` }}
            <template v-if="a.badWords?.length"> · «{{ a.badWords.join(', ') }}»</template>
          </p>
          <div class="toast-actions">
            <button class="toast-btn toast-btn--main" @click="open(a)">Ko'rish</button>
            <button class="toast-btn" @click="alerts.review(a.id)">Ko'rildi</button>
          </div>
        </div>
        <button class="toast-close" aria-label="Yopish" @click="alerts.dismiss(a.id)"><X :size="15" /></button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { computed, watch } from "vue";
import { useRouter } from "vue-router";
import { LayoutDashboard, BookOpen, Gamepad2, Trophy, Video, Bot, Activity, Settings, ClipboardList, ClipboardCheck, UserCheck, School, ShieldAlert, X } from "lucide-vue-next";
import GeoLayout from "@shared/components/GeoLayout.vue";
import { useAlertsStore } from "@shared/stores/alerts";

const router = useRouter();
const alerts = useAlertsStore();
alerts.start();

const navItems = computed(() => [
  { to: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { to: "/active-students", icon: UserCheck, labelKey: "active_students" },
  { to: "/classes",   icon: School,          labelKey: "classes" },
  { to: "/lessons",   icon: BookOpen,        labelKey: "lessons" },
  { to: "/homework",  icon: ClipboardCheck,  labelKey: "homework" },
  { to: "/games",     icon: Gamepad2,        labelKey: "games" },
  { to: "/results",   icon: ClipboardList,   labelKey: "results" },
  { to: "/ratings",   icon: Trophy,          labelKey: "ratings" },
  { to: "/videos",    icon: Video,           labelKey: "videos" },
  { to: "/ai",        icon: Bot,             labelKey: "ai" },
  { to: "/ai-logs",   icon: Activity,        label: "AI Logs", badge: alerts.unread.length || null, badgeTone: "danger" },
  { to: "/settings",  icon: Settings,        labelKey: "settings" },
]);

function open(a) {
  alerts.dismiss(a.id);
  router.push({ path: "/ai-logs", query: { alert: a.id } });
}

// Toast 12 soniyadan keyin o'zi yopiladi (xabar AI Logs'da qoladi)
const timed = new Set();
watch(() => alerts.fresh.map(a => a.id).join(), () => {
  for (const a of alerts.fresh) {
    if (timed.has(a.id)) continue;
    timed.add(a.id);
    setTimeout(() => alerts.dismiss(a.id), 12000);
  }
});
</script>

<style scoped>
.toasts { position: fixed; right: 16px; bottom: 16px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; width: min(380px, calc(100vw - 32px)); }
.toast {
  display: flex; gap: 12px; padding: 14px; border-radius: 14px;
  background: hsl(var(--card)); color: hsl(var(--fg));
  border: 1px solid hsl(var(--destructive)/.35); border-left: 4px solid hsl(var(--destructive));
  box-shadow: 0 16px 40px hsl(var(--fg)/.18);
}
.toast-icon { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: hsl(var(--destructive)/.12); color: hsl(var(--destructive)); }
.toast-body { flex: 1; min-width: 0; }
.toast-title { font-size: 13.5px; font-weight: 700; }
.toast-sub { font-size: 12px; color: hsl(var(--muted-fg)); margin-top: 2px; }
.toast-actions { display: flex; gap: 6px; margin-top: 10px; }
.toast-btn { border: 1px solid hsl(var(--border)); background: none; color: inherit; font-family: inherit; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 8px; cursor: pointer; }
.toast-btn:hover { background: hsl(var(--muted)); }
.toast-btn--main { background: hsl(var(--destructive)); border-color: hsl(var(--destructive)); color: #fff; }
.toast-btn--main:hover { background: hsl(var(--destructive)); filter: brightness(1.08); }
.toast-close { border: 0; background: none; color: hsl(var(--muted-fg)); cursor: pointer; align-self: flex-start; padding: 2px; border-radius: 6px; display: flex; }
.toast-close:hover { background: hsl(var(--muted)); }
.toast-enter-active, .toast-leave-active { transition: all .25s ease; }
.toast-enter-from { opacity: 0; transform: translateY(12px); }
.toast-leave-to { opacity: 0; transform: translateX(24px); }
</style>
