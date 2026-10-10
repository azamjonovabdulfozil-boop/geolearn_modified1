<template>
  <GeoLayout :navItems="navItems" />

  <!-- Do'stdan kelgan o'yin taklifi — qaysi sahifada bo'lsa ham chiqadi -->
  <Transition name="invite">
    <div v-if="invite" class="invite-backdrop">
      <div class="invite-card" :style="{ '--c1': inviteGame.colors[0], '--c2': inviteGame.colors[1] }">
        <div class="invite-art">
          <span class="invite-emoji">{{ inviteGame.emoji }}</span>
          <span class="invite-vs">1 ga 1</span>
        </div>
        <div class="invite-body">
          <p class="invite-kicker">O'yinga taklif</p>
          <p class="invite-title">
            Do'stingiz <strong>{{ invite.players[0].name }}</strong>
            <span v-if="invite.players[0].className" class="invite-class">{{ invite.players[0].className }}</span>
            sizni o'yinga chaqiryapti
          </p>
          <p class="invite-game">
            {{ inviteGame.title }}
            <span v-if="invite.topic"> · {{ invite.topic.icon }} {{ invite.topic.name }}</span>
          </p>
          <div class="invite-timer"><div class="invite-timer-fill" :style="{ width: inviteLeftPct + '%' }"></div></div>
          <p v-if="inviteError" class="invite-error">{{ inviteError }}</p>
          <div class="invite-actions">
            <button class="invite-btn invite-btn--no" :disabled="accepting" @click="duel.decline(invite.id)">
              <X :size="16" /> Rad etish
            </button>
            <button class="invite-btn invite-btn--yes" :disabled="accepting" @click="acceptInvite">
              <Swords :size="16" /> {{ accepting ? "Kutilmoqda..." : "Qabul qilish" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Yangi xabar bildirishnomalari (chat sahifasidan tashqarida) -->
  <TransitionGroup name="toast" tag="div" class="toasts">
    <button v-for="t in chat.toasts" :key="t.id" class="toast" @click="openChat(t)">
      <span class="toast-av">
        <img v-if="t.avatarUrl" :src="t.avatarUrl" alt="" />
        <template v-else>{{ t.name.charAt(0).toUpperCase() }}</template>
      </span>
      <span class="toast-text">
        <span class="toast-name">{{ t.name }}</span>
        <span class="toast-msg">{{ t.text }}</span>
      </span>
    </button>
  </TransitionGroup>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  LayoutDashboard, BookOpen, Gamepad2, Trophy, Video, Bot, Settings, ClipboardCheck,
  MessageCircle, Swords, X,
} from "lucide-vue-next";
import GeoLayout from "@shared/components/GeoLayout.vue";
import { useAuthStore } from "@shared/stores/auth";
import { useDuelStore } from "../stores/duel";
import { useChatStore } from "../stores/chat";
import { gameById } from "../lib/games";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const duel = useDuelStore();
const chat = useChatStore();

const navItems = computed(() => [
  { to: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { to: "/lessons",   icon: BookOpen,       labelKey: "lessons" },
  { to: "/homework",  icon: ClipboardCheck, labelKey: "homework" },
  { to: "/games",     icon: Gamepad2,       labelKey: "games", badge: duel.incoming.length || null, badgeTone: "danger" },
  { to: "/chat",      icon: MessageCircle,  labelKey: "chat", badge: chat.unread || null, badgeTone: "danger" },
  { to: "/ratings",   icon: Trophy,         labelKey: "ratings" },
  { to: "/videos",    icon: Video,          labelKey: "videos" },
  { to: "/ai",        icon: Bot,            labelKey: "ai" },
  { to: "/settings",  icon: Settings,       labelKey: "settings" },
]);

// ── O'yinga taklif ──
const invite = computed(() => duel.incoming[0] ?? null);
const inviteGame = computed(() => gameById(invite.value?.game));
const accepting = ref(false);
const inviteError = ref("");
const tick = ref(0);
let tickTimer = null;

const inviteLeftPct = computed(() => {
  tick.value;
  const d = invite.value;
  if (!d) return 0;
  const total = d.expiresAt - d.createdAt;
  return Math.max(0, Math.min(100, ((d.expiresAt - duel.now()) / total) * 100));
});

async function acceptInvite() {
  accepting.value = true;
  inviteError.value = "";
  try {
    await duel.accept(invite.value.id);
    if (route.path !== "/games") router.push("/games");
  } catch (e) {
    inviteError.value = e.message || "Qabul qilib bo'lmadi";
    duel.refresh();
  }
  accepting.value = false;
}
watch(invite, () => { inviteError.value = ""; });

function openChat(t) {
  chat.dismiss(t.id);
  router.push(`/chat/${t.peerId}`);
}

onMounted(() => {
  duel.start();
  chat.start(auth.user?.id);
  tickTimer = setInterval(() => { tick.value++; }, 250);
});
onUnmounted(() => {
  duel.stop();
  chat.stop();
  clearInterval(tickTimer);
});
</script>

<style scoped>
.invite-backdrop {
  position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(6, 12, 20, .62); backdrop-filter: blur(6px);
}
.invite-card {
  width: 100%; max-width: 400px; border-radius: 26px; overflow: hidden;
  background: hsl(var(--card)); color: hsl(var(--card-fg));
  box-shadow: 0 30px 80px rgba(0, 0, 0, .45);
}
.invite-art {
  position: relative; height: 150px; display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(circle at 50% 120%, rgba(255, 255, 255, .28), transparent 60%),
    linear-gradient(135deg, var(--c1), var(--c2));
}
.invite-emoji { font-size: 78px; filter: drop-shadow(0 10px 14px rgba(0, 0, 0, .35)); animation: invite-bob 1.4s ease-in-out infinite; }
.invite-vs {
  position: absolute; top: 14px; right: 14px; padding: 4px 12px; border-radius: 99px;
  background: rgba(0, 0, 0, .35); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .04em;
}
@keyframes invite-bob { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-9px) rotate(4deg); } }
.invite-body { padding: 20px 22px 22px; text-align: center; }
.invite-kicker { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: hsl(var(--primary)); }
.invite-title { margin-top: 6px; font-size: 17px; line-height: 1.45; }
.invite-class { display: inline-block; margin: 0 2px; padding: 0 8px; border-radius: 99px; background: hsl(var(--muted)); font-size: 12px; font-weight: 700; }
.invite-game { margin-top: 8px; font-size: 14px; font-weight: 700; color: hsl(var(--muted-fg)); }
.invite-timer { margin: 16px 0 0; height: 5px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
.invite-timer-fill { height: 100%; background: hsl(var(--primary)); transition: width .25s linear; }
.invite-error { margin-top: 10px; font-size: 13px; color: hsl(var(--destructive)); }
.invite-actions { display: grid; grid-template-columns: 1fr 1.35fr; gap: 10px; margin-top: 16px; }
.invite-btn {
  display: flex; align-items: center; justify-content: center; gap: 7px; height: 46px;
  border-radius: 14px; border: none; font-size: 14px; font-weight: 800; cursor: pointer; transition: transform .12s, filter .15s;
}
.invite-btn:active:not(:disabled) { transform: scale(.97); }
.invite-btn:disabled { opacity: .55; cursor: default; }
.invite-btn--no { background: hsl(var(--muted)); color: hsl(var(--fg)); }
.invite-btn--yes { background: linear-gradient(135deg, var(--c1), var(--c2)); color: #fff; box-shadow: 0 8px 20px rgba(0, 0, 0, .25); }
.invite-btn--yes:hover:not(:disabled) { filter: brightness(1.1); }

.invite-enter-active, .invite-leave-active { transition: opacity .2s; }
.invite-enter-active .invite-card, .invite-leave-active .invite-card { transition: transform .25s cubic-bezier(.2, 1.3, .4, 1); }
.invite-enter-from, .invite-leave-to { opacity: 0; }
.invite-enter-from .invite-card, .invite-leave-to .invite-card { transform: scale(.9) translateY(16px); }

.toasts { position: fixed; right: 16px; bottom: 16px; z-index: 150; display: flex; flex-direction: column; gap: 8px; width: min(340px, calc(100vw - 32px)); }
.toast {
  display: flex; align-items: center; gap: 11px; padding: 11px 14px; text-align: left; cursor: pointer;
  background: hsl(var(--card)); color: hsl(var(--card-fg)); border: 1px solid hsl(var(--border));
  border-radius: 16px; box-shadow: 0 12px 32px rgba(0, 0, 0, .18);
}
.toast-av {
  flex: none; width: 38px; height: 38px; border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: hsl(var(--primary)); color: #fff; font-weight: 800;
}
.toast-av img { width: 100%; height: 100%; object-fit: cover; }
.toast-text { min-width: 0; display: flex; flex-direction: column; }
.toast-name { font-size: 13px; font-weight: 800; }
.toast-msg { font-size: 13px; color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.toast-enter-active, .toast-leave-active { transition: all .25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(24px); }
</style>
