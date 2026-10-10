<template>
  <div class="fade-in">
    <!-- 1v1 o'yin xonasi -->
    <DuelRoom v-if="inRoom" :key="duel.current.id" :duel="duel.current" @close="duel.clear()" />

    <!-- Yolg'iz mashq -->
    <SoloRoom v-else-if="soloId" :game-id="soloId" @close="soloId = null" @invite="inviteFromSolo" />

    <!-- O'yinlar bosh sahifasi (o'qituvchi o'yini uzilib qolmasligi uchun yashiriladi, o'chirilmaydi) -->
    <div v-show="!inRoom && !soloId">
      <section class="hero">
        <div class="hero-glow"></div>
        <div class="hero-text">
          <p class="hero-kicker">GeoLearn Arena</p>
          <h1 class="hero-title">O'yinlar</h1>
          <p class="hero-sub">Do'stingizni chaqiring va 1 ga 1 bellashing — g'alaba uchun reytingga ball qo'shiladi.</p>
        </div>
        <div class="hero-stats">
          <div class="hero-stat"><span class="hero-stat-val">{{ stats.played }}</span><span class="hero-stat-lbl">o'yin</span></div>
          <div class="hero-stat"><span class="hero-stat-val">{{ stats.won }}</span><span class="hero-stat-lbl">g'alaba</span></div>
          <div class="hero-stat"><span class="hero-stat-val">{{ winRate }}%</span><span class="hero-stat-lbl">yutuq</span></div>
        </div>
        <span class="hero-art hero-art--1">⚽</span>
        <span class="hero-art hero-art--2">🎮</span>
        <span class="hero-art hero-art--3">🏆</span>
      </section>

      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'duel' }" @click="tab = 'duel'"><Swords :size="15" /> Do'st bilan 1 ga 1</button>
        <button class="tab" :class="{ active: tab === 'class' }" @click="tab = 'class'"><Users :size="15" /> O'qituvchi o'yini</button>
      </div>

      <div v-show="tab === 'duel'">
        <div v-if="preset" class="preset">
          <span>Do'st tanlandi: <strong>{{ preset.name }}</strong> — endi o'yinni tanlang</span>
          <button class="preset-x" @click="clearPreset" aria-label="Bekor qilish"><X :size="14" /></button>
        </div>

        <div class="grid">
          <article v-for="g in GAMES" :key="g.id" class="game" :style="{ '--c1': g.colors[0], '--c2': g.colors[1] }">
            <button class="game-cover" @click="openInvite(g)">
              <span class="game-shine"></span>
              <span class="game-emoji">{{ g.emoji }}</span>
              <span class="game-pill">1 ga 1</span>
              <span class="game-tag">{{ g.tag }}</span>
            </button>
            <div class="game-body">
              <h3 class="game-title">{{ g.title }}</h3>
              <p class="game-desc">{{ g.desc }}</p>
              <div class="game-actions">
                <button class="game-btn game-btn--main" @click="openInvite(g)"><Swords :size="14" /> Do'stni chaqirish</button>
                <button v-if="g.solo" class="game-btn" @click="soloId = g.id" title="Yolg'iz mashq qilish"><Play :size="14" /> Mashq</button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div v-show="tab === 'class'" class="class-tab">
        <TeacherGame />
      </div>
    </div>

    <!-- Do'stni chaqirish oynasi -->
    <Transition name="modal">
      <div v-if="picked" class="modal-backdrop" @click.self="closeInvite">
        <div class="modal" :style="{ '--c1': picked.colors[0], '--c2': picked.colors[1] }">
          <header class="modal-head">
            <span class="modal-emoji">{{ picked.emoji }}</span>
            <div class="modal-head-text">
              <p class="modal-title">{{ picked.title }}</p>
              <p class="modal-rules">{{ picked.rules }}</p>
            </div>
            <button class="modal-x" @click="closeInvite" aria-label="Yopish"><X :size="18" /></button>
          </header>

          <!-- Kutish: taklif yuborildi -->
          <div v-if="waiting" class="wait">
            <div class="wait-ring"><span class="wait-av">{{ initial(waiting.players[1].name) }}</span></div>
            <p class="wait-title"><strong>{{ waiting.players[1].name }}</strong> javobini kutyapmiz...</p>
            <p class="wait-sub">Unga "do'stingiz sizni o'yinga chaqiryapti" degan xabar bordi</p>
            <div class="wait-bar"><div class="wait-bar-fill" :style="{ width: waitPct + '%' }"></div></div>
            <button class="geo-btn-outline" @click="duel.cancel()"><X :size="14" /> Taklifni bekor qilish</button>
          </div>

          <!-- Javob: rad etildi / vaqt o'tdi -->
          <div v-else-if="closedNote" class="wait">
            <span class="wait-emoji">{{ closedNote.emoji }}</span>
            <p class="wait-title">{{ closedNote.text }}</p>
            <button class="geo-btn-primary" @click="duel.clear()">Boshqa do'stni chaqirish</button>
          </div>

          <div v-else class="modal-body">
            <!-- 1. Mavzu (faqat savol-javob o'yinlarida) -->
            <section v-if="needsTopic" class="step">
              <p class="step-title"><span class="step-num">1</span> Mavzuni tanlang</p>
              <input v-model="topicQuery" class="geo-input" placeholder="Mavzu qidirish: bayroqlar, poytaxtlar, daryolar..." />
              <div class="topics">
                <button v-for="t in shownTopics" :key="t.id" class="topic" :class="{ active: topicId === t.id }" @click="topicId = t.id">
                  <span>{{ t.icon }}</span>{{ t.name }}
                </button>
                <p v-if="!shownTopics.length" class="empty">Bunday mavzu topilmadi</p>
              </div>
            </section>

            <!-- 2. Do'st -->
            <section class="step">
              <p class="step-title"><span class="step-num">{{ needsTopic ? 2 : 1 }}</span> Do'stingizni toping</p>
              <div v-if="preset" class="friend friend--preset">
                <span class="friend-av">{{ initial(preset.name) }}</span>
                <span class="friend-text"><span class="friend-name">{{ preset.name }}</span><span class="friend-class">Tanlangan do'st</span></span>
                <button class="friend-btn" :disabled="!canInvite || inviting" @click="invite(preset)">
                  <Swords :size="14" /> Chaqirish
                </button>
              </div>
              <template v-else>
                <div class="search-row">
                  <div class="search-field">
                    <Search :size="15" class="search-icon" />
                    <input v-model="friendName" class="geo-input search-input" placeholder="Do'stingizning ismi" @input="searchSoon" />
                  </div>
                  <input v-model="friendClass" class="geo-input class-input" placeholder="Sinfi: 7-A" maxlength="8" @input="searchSoon" />
                </div>
                <div class="friends">
                  <div v-for="f in friends" :key="f.id" class="friend">
                    <span class="friend-av" :class="{ online: f.online }">
                      <img v-if="f.avatarUrl" :src="f.avatarUrl" alt="" /><template v-else>{{ initial(f.name) }}</template>
                    </span>
                    <span class="friend-text">
                      <span class="friend-name">{{ f.name }}</span>
                      <span class="friend-class">{{ f.className || '—' }} · {{ f.busy ? "o'yinda" : f.online ? "saytda" : "hozir saytda emas" }}</span>
                    </span>
                    <button class="friend-btn" :disabled="!canInvite || inviting || f.busy || !f.online" @click="invite(f)"
                      :title="!f.online ? 'Do\'stingiz saytga kirganda chaqirishingiz mumkin' : ''">
                      <Swords :size="14" /> Chaqirish
                    </button>
                  </div>
                  <p v-if="searching && !friends.length" class="empty">Qidirilmoqda...</p>
                  <p v-else-if="!friends.length" class="empty">
                    {{ friendName || friendClass ? "Bunday o'quvchi topilmadi. Ism yoki sinfni tekshiring." : "Do'stingizning ismini va sinfini yozing" }}
                  </p>
                </div>
              </template>
              <p v-if="needsTopic && !topicId" class="hint">Avval mavzuni tanlang</p>
              <p v-if="inviteError" class="error">{{ inviteError }}</p>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Swords, Users, Play, X, Search } from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useAuthStore } from "@shared/stores/auth";
import { useDuelStore } from "../stores/duel";
import { GAMES, gameById } from "../lib/games";
import DuelRoom from "../components/games/DuelRoom.vue";
import SoloRoom from "../components/games/SoloRoom.vue";
import TeacherGame from "../components/games/TeacherGame.vue";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const duel = useDuelStore();

const tab = ref("duel");
const soloId = ref(null);
const stats = ref({ played: 0, won: 0 });
const topics = ref([]);
const serverGames = ref([]);

const inRoom = computed(() => ["active", "finished"].includes(duel.current?.status));
const winRate = computed(() => (stats.value.played ? Math.round((stats.value.won / stats.value.played) * 100) : 0));
const initial = name => (name || "?").charAt(0).toUpperCase();

async function loadMeta() {
  try {
    const data = await api("/api/duels/games");
    stats.value = data.stats ?? stats.value;
    topics.value = data.topics ?? [];
    serverGames.value = data.games ?? [];
  } catch {}
}
// O'yin tugagach statistika yangilanadi
watch(() => duel.current?.status, (s) => { if (s === "finished") loadMeta(); });

// ── Do'stni chaqirish ──
const picked = ref(null);           // tanlangan o'yin
const topicId = ref(null);
const topicQuery = ref("");
const friendName = ref("");
const friendClass = ref("");
const friends = ref([]);
const searching = ref(false);
const inviting = ref(false);
const inviteError = ref("");
const preset = ref(null);           // chatdan kelgan: do'st allaqachon tanlangan
const tick = ref(0);
let searchTimer = null;
let tickTimer = null;

const needsTopic = computed(() => serverGames.value.find(g => g.id === picked.value?.id)?.needsTopic ?? ["quiz", "truefalse"].includes(picked.value?.id));
const canInvite = computed(() => !needsTopic.value || topicId.value != null);
const shownTopics = computed(() => {
  const q = topicQuery.value.trim().toLocaleLowerCase();
  return q ? topics.value.filter(t => `${t.name} ${t.category}`.toLocaleLowerCase().includes(q)) : topics.value;
});

const waiting = computed(() => (duel.current?.status === "pending" ? duel.current : null));
const waitPct = computed(() => {
  tick.value;
  const d = waiting.value;
  if (!d) return 0;
  return Math.max(0, Math.min(100, ((d.expiresAt - duel.now()) / (d.expiresAt - d.createdAt)) * 100));
});
const closedNote = computed(() => {
  const d = duel.current;
  if (!d || d.me !== 0) return null;
  const name = d.players[1].name;
  if (d.status === "declined") return { emoji: "🙅", text: `${name} taklifni rad etdi` };
  if (d.status === "expired") return { emoji: "⌛", text: `${name} javob bermadi` };
  return null;
});

function openInvite(g) {
  picked.value = g;
  topicId.value = null;
  topicQuery.value = "";
  inviteError.value = "";
  if (!preset.value) {
    friendName.value = "";
    friendClass.value = auth.user?.className ?? "";
    search();
  }
}
function closeInvite() {
  if (waiting.value) duel.cancel();
  duel.clear();
  picked.value = null;
}
function inviteFromSolo() {
  const g = gameById(soloId.value);
  soloId.value = null;
  openInvite(g);
}

async function search() {
  searching.value = true;
  try {
    const q = new URLSearchParams({ q: friendName.value.trim(), className: friendClass.value.trim() });
    friends.value = await api(`/api/duels/players?${q}`);
  } catch { friends.value = []; }
  searching.value = false;
}
function searchSoon() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(search, 280);
}

async function invite(friend) {
  inviting.value = true;
  inviteError.value = "";
  try {
    await duel.invite({ opponentId: friend.id, game: picked.value.id, topicId: topicId.value });
  } catch (e) {
    inviteError.value = e.message || "Taklif yuborilmadi";
    if (!preset.value) search();
  }
  inviting.value = false;
}

function clearPreset() {
  preset.value = null;
  router.replace({ path: "/games" });
}

// O'yin boshlandi — oyna yopiladi. "Yana o'ynash" bosilganda esa kutish oynasi ochiladi.
watch(() => duel.current, (d) => {
  if (d?.status === "active") picked.value = null;
  else if (d?.status === "pending" && d.me === 0 && !picked.value) picked.value = gameById(d.game);
});

onMounted(() => {
  loadMeta();
  duel.refresh();
  // Chatdagi "O'yinga chaqirish" tugmasidan kelgan bo'lsa
  const id = Number(route.query.friend);
  if (id) preset.value = { id, name: String(route.query.name || "Do'stingiz") };
  const d = duel.current;
  if (d?.status === "pending" && d.me === 0) picked.value = gameById(d.game);
  tickTimer = setInterval(() => {
    tick.value++;
    // Kutish oynasi ochiq turganda ro'yxatdagi "saytda / o'yinda" holati yangilanib turadi
    if (picked.value && !waiting.value && !preset.value && tick.value % 20 === 0) search();
  }, 250);
});
onUnmounted(() => { clearInterval(tickTimer); clearTimeout(searchTimer); });
</script>

<style scoped>
/* ── Hero ── */
.hero {
  position: relative; overflow: hidden; display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap;
  padding: 30px 30px 26px; border-radius: 28px; color: #fff; margin-bottom: 20px;
  background: linear-gradient(125deg, #14122b 0%, #2a1458 45%, #0f3d5c 100%);
  box-shadow: 0 20px 50px rgba(20, 18, 43, .35);
}
.hero-glow {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(circle at 12% 110%, rgba(0, 229, 255, .35), transparent 42%),
    radial-gradient(circle at 88% -20%, rgba(255, 64, 129, .38), transparent 45%),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, .035) 0 1px, transparent 1px 28px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, .035) 0 1px, transparent 1px 28px);
}
.hero-text { position: relative; max-width: 520px; }
.hero-kicker { font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #7df9ff; }
.hero-title { margin-top: 4px; font-size: clamp(30px, 5vw, 42px); font-weight: 900; line-height: 1.05; letter-spacing: -.01em; }
.hero-sub { margin-top: 8px; font-size: 14.5px; opacity: .85; }
.hero-stats { position: relative; display: flex; gap: 10px; }
.hero-stat {
  min-width: 78px; padding: 10px 14px; border-radius: 16px; text-align: center;
  background: rgba(255, 255, 255, .1); border: 1px solid rgba(255, 255, 255, .16); backdrop-filter: blur(6px);
}
.hero-stat-val { display: block; font-size: 24px; font-weight: 900; line-height: 1.1; font-variant-numeric: tabular-nums; }
.hero-stat-lbl { font-size: 11px; opacity: .75; text-transform: uppercase; letter-spacing: .06em; }
.hero-art { position: absolute; font-size: 54px; opacity: .2; pointer-events: none; animation: float 6s ease-in-out infinite; }
.hero-art--1 { top: 12px; right: 34%; }
.hero-art--2 { top: 44%; right: 6%; font-size: 84px; animation-delay: -2s; opacity: .14; }
.hero-art--3 { bottom: -10px; left: 46%; animation-delay: -4s; }
@keyframes float { 50% { transform: translateY(-12px) rotate(8deg); } }

/* ── Tabs ── */
.tabs { display: inline-flex; gap: 4px; padding: 4px; margin-bottom: 18px; border-radius: 16px; background: hsl(var(--muted)); max-width: 100%; }
.tab {
  display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 12px; border: none; cursor: pointer;
  background: none; color: hsl(var(--muted-fg)); font-size: 14px; font-weight: 700; white-space: nowrap;
}
.tab.active { background: hsl(var(--card)); color: hsl(var(--fg)); box-shadow: 0 2px 8px rgba(0, 0, 0, .08); }

.preset {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; padding: 10px 14px;
  border-radius: 14px; background: hsl(var(--primary-light)); color: hsl(var(--primary)); font-size: 14px;
}
.preset-x { border: none; background: none; cursor: pointer; color: inherit; display: flex; }

/* ── O'yin kartalari ── */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 18px; }
.game {
  display: flex; flex-direction: column; overflow: hidden; border-radius: 22px;
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  box-shadow: 0 2px 8px rgba(0, 0, 0, .05); transition: transform .2s, box-shadow .2s;
}
.game:hover { transform: translateY(-5px); box-shadow: 0 18px 40px rgba(0, 0, 0, .16); }
.game-cover {
  position: relative; height: 150px; border: none; cursor: pointer; overflow: hidden; display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(circle at 50% 130%, rgba(255, 255, 255, .3), transparent 55%),
    radial-gradient(circle at 15% 10%, rgba(255, 255, 255, .16), transparent 35%),
    linear-gradient(135deg, var(--c1), var(--c2));
}
.game-shine {
  position: absolute; inset: 0;
  background:
    repeating-linear-gradient(115deg, rgba(255, 255, 255, .05) 0 14px, transparent 14px 28px);
}
.game-emoji { position: relative; font-size: 74px; line-height: 1; filter: drop-shadow(0 12px 14px rgba(0, 0, 0, .4)); transition: transform .3s cubic-bezier(.2, 1.6, .4, 1); }
.game:hover .game-emoji { transform: scale(1.16) rotate(-7deg); }
.game-pill, .game-tag { position: absolute; top: 12px; padding: 3px 11px; border-radius: 99px; font-size: 11px; font-weight: 800; color: #fff; }
.game-pill { right: 12px; background: rgba(0, 0, 0, .38); letter-spacing: .04em; }
.game-tag { left: 12px; background: rgba(255, 255, 255, .22); backdrop-filter: blur(4px); }
.game-body { flex: 1; display: flex; flex-direction: column; padding: 16px 18px 18px; }
.game-title { font-size: 18px; font-weight: 800; }
.game-desc { flex: 1; margin-top: 4px; font-size: 13.5px; line-height: 1.5; color: hsl(var(--muted-fg)); }
.game-actions { display: flex; gap: 8px; margin-top: 14px; }
.game-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; padding: 0 14px; border-radius: 12px; cursor: pointer;
  border: 1px solid hsl(var(--border)); background: hsl(var(--card)); color: hsl(var(--fg)); font-size: 13px; font-weight: 700; transition: filter .15s, transform .12s;
}
.game-btn:active { transform: scale(.97); }
.game-btn:hover { background: hsl(var(--muted)); }
.game-btn--main { flex: 1; border: none; color: #fff; background: linear-gradient(135deg, var(--c1), var(--c2)); box-shadow: 0 6px 16px rgba(0, 0, 0, .18); }
.game-btn--main:hover { filter: brightness(1.12); background: linear-gradient(135deg, var(--c1), var(--c2)); }
.class-tab { max-width: 760px; }

/* ── Chaqirish oynasi ── */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 120; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(6, 12, 20, .6); backdrop-filter: blur(5px);
}
.modal {
  width: 100%; max-width: 520px; max-height: min(92vh, 720px); display: flex; flex-direction: column; overflow: hidden;
  border-radius: 24px; background: hsl(var(--card)); color: hsl(var(--card-fg)); box-shadow: 0 30px 80px rgba(0, 0, 0, .4);
}
.modal-head {
  display: flex; align-items: center; gap: 14px; padding: 18px 20px; color: #fff;
  background: linear-gradient(135deg, var(--c1), var(--c2));
}
.modal-emoji { font-size: 44px; line-height: 1; filter: drop-shadow(0 6px 8px rgba(0, 0, 0, .35)); }
.modal-head-text { flex: 1; min-width: 0; }
.modal-title { font-size: 19px; font-weight: 900; }
.modal-rules { font-size: 12.5px; opacity: .88; line-height: 1.4; }
.modal-x { flex: none; width: 34px; height: 34px; border-radius: 10px; border: none; cursor: pointer; background: rgba(0, 0, 0, .25); color: #fff; display: flex; align-items: center; justify-content: center; }
.modal-body { padding: 18px 20px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; }
.step-title { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 14px; font-weight: 800; }
.step-num { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; background: hsl(var(--primary)); color: #fff; }
.topics { display: flex; flex-wrap: wrap; gap: 6px; max-height: 148px; overflow-y: auto; margin-top: 10px; padding: 2px; }
.topic {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid hsl(var(--border)); background: hsl(var(--card)); color: hsl(var(--fg)); font-size: 13px; font-weight: 600;
}
.topic:hover { border-color: hsl(var(--primary)); }
.topic.active { border-color: hsl(var(--primary)); background: hsl(var(--primary)); color: #fff; }
.search-row { display: flex; gap: 8px; }
.search-field { position: relative; flex: 1; }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: hsl(var(--muted-fg)); pointer-events: none; }
.search-input { padding-left: 36px; }
.class-input { width: 104px; flex: none; text-transform: uppercase; }
.class-input::placeholder { text-transform: none; }
.friends { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; max-height: 250px; overflow-y: auto; }
.friend { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 14px; border: 1px solid hsl(var(--border)); }
.friend--preset { background: hsl(var(--primary-light)); border-color: transparent; }
.friend-av {
  position: relative; flex: none; width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; background: hsl(var(--primary)); color: #fff; font-weight: 800;
}
.friend-av img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.friend-av.online::after { content: ""; position: absolute; right: 0; bottom: 0; width: 11px; height: 11px; border-radius: 50%; background: #2ecc71; border: 2px solid hsl(var(--card)); }
.friend-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.friend-name { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.friend-class { font-size: 12px; color: hsl(var(--muted-fg)); }
.friend-btn {
  flex: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 13px; border-radius: 11px; border: none; cursor: pointer;
  background: linear-gradient(135deg, var(--c1), var(--c2)); color: #fff; font-size: 13px; font-weight: 800;
}
.friend-btn:disabled { opacity: .4; cursor: not-allowed; }
.empty { padding: 18px 8px; text-align: center; font-size: 13.5px; color: hsl(var(--muted-fg)); }
.hint { margin-top: 8px; font-size: 12.5px; color: hsl(var(--warning)); }
.error { margin-top: 8px; font-size: 13px; color: hsl(var(--destructive)); }

.wait { padding: 30px 24px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.wait-ring { position: relative; width: 92px; height: 92px; display: flex; align-items: center; justify-content: center; }
.wait-ring::before, .wait-ring::after {
  content: ""; position: absolute; inset: 0; border-radius: 50%; border: 3px solid var(--c1); animation: ring 1.8s ease-out infinite;
}
.wait-ring::after { animation-delay: .9s; }
@keyframes ring { from { transform: scale(.7); opacity: .9; } to { transform: scale(1.35); opacity: 0; } }
.wait-av { width: 62px; height: 62px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; color: #fff; background: linear-gradient(135deg, var(--c1), var(--c2)); }
.wait-emoji { font-size: 54px; line-height: 1; }
.wait-title { font-size: 16px; }
.wait-sub { font-size: 13px; color: hsl(var(--muted-fg)); }
.wait-bar { width: 100%; max-width: 280px; height: 6px; margin: 6px 0 8px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
.wait-bar-fill { height: 100%; background: linear-gradient(90deg, var(--c1), var(--c2)); transition: width .25s linear; }

.modal-enter-active, .modal-leave-active { transition: opacity .2s; }
.modal-enter-active .modal, .modal-leave-active .modal { transition: transform .25s cubic-bezier(.2, 1.3, .4, 1); }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal, .modal-leave-to .modal { transform: translateY(20px) scale(.96); }

@media (max-width: 560px) {
  .hero { padding: 22px 18px; border-radius: 22px; }
  .hero-stats { width: 100%; }
  .hero-stat { flex: 1; min-width: 0; }
  .tabs { display: flex; }
  .tab { flex: 1; justify-content: center; padding: 9px 8px; font-size: 13px; }
  .grid { grid-template-columns: 1fr 1fr; gap: 12px; }
  .game-cover { height: 108px; }
  .game-emoji { font-size: 52px; }
  .game-body { padding: 12px; }
  .game-title { font-size: 15px; }
  .game-desc { display: none; }
  .game-actions { flex-direction: column; margin-top: 10px; }
  .game-btn { padding: 0 8px; font-size: 12.5px; white-space: nowrap; }
  .game-tag { display: none; }
}
</style>
