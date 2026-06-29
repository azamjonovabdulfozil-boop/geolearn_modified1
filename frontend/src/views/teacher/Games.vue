<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">O'yinlar</h1>
        <p class="geo-page-sub">Mavzu tanlang va o'quvchilar bilan o'ynang</p>
      </div>
      <button @click="openCreate" class="geo-btn-primary">
        <Plus :size="16" /> O'yin yaratish
      </button>
    </div>

    <!-- Create Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreate" class="modal-back" @click.self="closeCreate">
          <div class="modal-box geo-card">
            <div class="modal-head">
              <div>
                <h2>{{ step === 1 ? 'O\'yin turini tanlang' : step === 2 ? 'Mavzuni tanlang' : 'Sozlamalar' }}</h2>
                <p class="modal-sub">{{ step }}/3 — {{ form.gameType === 'bosh_qotirma' ? "Bosh qo'tirma" : 'Viktorina' }}</p>
              </div>
              <button @click="closeCreate" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </div>

            <!-- Step 1: type -->
            <div v-if="step === 1" class="form-stack">
              <div class="type-grid">
                <button type="button" @click="form.gameType = 'quiz'; step = 2"
                  class="type-btn" :class="{ 'type-btn--on': form.gameType === 'quiz' }">
                  <HelpCircle :size="26" />
                  <strong>Viktorina</strong>
                  <span>4 variantli savollar (rasmlar bilan)</span>
                </button>
                <button type="button" @click="form.gameType = 'bosh_qotirma'; step = 2"
                  class="type-btn" :class="{ 'type-btn--on': form.gameType === 'bosh_qotirma' }">
                  <Brain :size="26" />
                  <strong>Bosh qo'tirma</strong>
                  <span>Geografiyaga oid Ha / Yo'q</span>
                </button>
              </div>
            </div>

            <!-- Step 2: topic -->
            <div v-else-if="step === 2" class="form-stack">
              <input v-model="topicSearch" class="geo-input" placeholder="Mavzuni qidiring..." />
              <div class="cat-row">
                <button v-for="c in categories" :key="c" @click="activeCat = c"
                  class="cat-chip" :class="{ 'cat-chip--on': activeCat === c }">{{ c }}</button>
              </div>
              <div class="topic-grid">
                <button v-for="t in filteredTopics" :key="t.id" type="button"
                  @click="form.topicId = t.id"
                  class="topic-btn" :class="{ 'topic-btn--on': form.topicId === t.id }">
                  <span class="topic-icon">{{ t.icon }}</span>
                  <span class="topic-name">{{ t.name }}</span>
                  <span v-if="t.hasImages" class="topic-tag">rasm</span>
                </button>
              </div>
              <div v-if="!filteredTopics.length" class="empty-mini">Mavzu topilmadi</div>
              <div class="modal-actions">
                <button @click="step = 1" class="geo-btn-outline flex-1">← Orqaga</button>
                <button @click="step = 3" :disabled="!form.topicId" class="geo-btn-primary flex-1">Davom etish →</button>
              </div>
            </div>

            <!-- Step 3: settings -->
            <div v-else class="form-stack">
              <div class="picked-topic">
                <span class="topic-icon-big">{{ pickedTopic?.icon }}</span>
                <div>
                  <strong>{{ pickedTopic?.name }}</strong>
                  <p>{{ pickedTopic?.category }} · {{ form.gameType === 'bosh_qotirma' ? "Bosh qo'tirma" : 'Viktorina' }}</p>
                </div>
              </div>
              <div class="form-field">
                <label>Sarlavha</label>
                <input v-model="form.title" class="geo-input" placeholder="O'yin sarlavhasi" />
              </div>
              <div class="form-field">
                <label>Savollar soni: <strong>{{ form.questionsCount }}</strong></label>
                <input v-model.number="form.questionsCount" type="range" min="5" max="30" class="range-input" />
                <div class="range-labels"><span>5</span><span>30</span></div>
              </div>
              <div class="modal-actions">
                <button @click="step = 2" class="geo-btn-outline flex-1">← Orqaga</button>
                <button @click="createGame" :disabled="!form.title || creating" class="geo-btn-primary flex-1">
                  <Loader2 v-if="creating" :size="15" class="animate-spin" />
                  {{ creating ? 'Yaratilmoqda...' : 'Yaratish' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="geo-skeleton" style="height:160px"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="!games.length" class="geo-card empty-card">
      <div class="empty-icon-wrap">
        <Gamepad2 :size="30" style="color:hsl(var(--muted-fg));opacity:.6" />
      </div>
      <p class="empty-title">Hali o'yinlar yo'q</p>
      <p class="empty-sub">Birinchi o'yinni yarating!</p>
      <button @click="openCreate" class="geo-btn-primary" style="margin-top:14px">
        <Plus :size="15" /> Yaratish
      </button>
    </div>

    <!-- Games -->
    <div v-else class="game-list">
      <div v-for="game in games" :key="game.id" class="game-card geo-card">
        <div class="game-card__accent" :class="game.gameType === 'bosh_qotirma' ? 'accent-purple' : 'accent-teal'"></div>

        <div class="game-card__head">
          <div class="game-card__icon">
            <span style="font-size:22px">{{ game.topicIcon || (game.gameType === 'bosh_qotirma' ? '🧠' : '❓') }}</span>
          </div>
          <div class="game-card__title-wrap">
            <div class="game-card__title-row">
              <h3>{{ game.title }}</h3>
              <span class="geo-badge" :style="statusStyle(game.status)">
                <span v-if="game.status==='active'" class="pulse-dot"></span>
                {{ statusLabel(game.status) }}
              </span>
            </div>
            <div class="game-card__meta">
              <span class="meta-chip">
                <component :is="game.gameType === 'bosh_qotirma' ? Brain : HelpCircle" :size="12" />
                {{ game.gameType === 'bosh_qotirma' ? "Bosh qo'tirma" : 'Viktorina' }}
              </span>
              <span v-if="game.topicName" class="meta-chip meta-topic">{{ game.topicName }}</span>
              <span class="meta-chip">{{ game.questionsCount }} ta savol</span>
            </div>
          </div>
          <div class="game-card__actions">
            <button v-if="game.status === 'waiting'" @click="startGame(game.gameCode)"
              class="geo-btn-primary btn-start">
              <Play :size="14" /> Boshlash
            </button>
            <button @click="removeGame(game.gameCode)" class="geo-btn-ghost btn-icon" title="O'chirish">
              <Trash2 :size="15" />
            </button>
          </div>
        </div>

        <div class="game-card__bottom">
          <div class="game-code-row">
            <button @click="copyCode(game.gameCode)" class="code-pill" :title="copied===game.gameCode ? 'Nusxalandi' : 'Nusxa olish'">
              <span class="code-pill__code">{{ game.gameCode }}</span>
              <Copy v-if="copied!==game.gameCode" :size="13" />
              <Check v-else :size="13" style="color:hsl(142 60% 36%)" />
            </button>
            <span class="code-hint">Kodni o'quvchilarga bering</span>
          </div>

          <div v-if="players[game.gameCode]?.length" class="players-row">
            <Users :size="13" style="opacity:.6" />
            <span class="players-label">{{ players[game.gameCode].length }} o'quvchi:</span>
            <div class="players-list">
              <span v-for="p in players[game.gameCode]" :key="p.userId" class="player-chip">
                <span class="player-chip-av">{{ p.name?.charAt(0) || '?' }}</span>
                {{ p.name }}
                <span v-if="game.status === 'active'" class="player-score">{{ p.score }}</span>
              </span>
            </div>
          </div>
          <div v-else class="players-empty">
            <Users :size="13" style="opacity:.4" />
            <span>Hozircha qo'shilganlar yo'q</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Plus, Gamepad2, Brain, HelpCircle, Play, Copy, Check, Loader2, X, Trash2, Users } from "lucide-vue-next";
import { api } from "@/composables/api";

const games = ref([]);
const players = ref({});
const topics = ref([]);
const loading = ref(true);
const showCreate = ref(false);
const creating = ref(false);
const copied = ref(null);
const step = ref(1);
const topicSearch = ref("");
const activeCat = ref("Hammasi");
const form = ref({ title: "", gameType: "quiz", topicId: null, questionsCount: 10 });
let pollTimer = null;

const categories = computed(() => {
  const cats = new Set(["Hammasi"]);
  topics.value.forEach(t => cats.add(t.category));
  return [...cats];
});

const filteredTopics = computed(() => {
  let arr = topics.value;
  if (activeCat.value !== "Hammasi") arr = arr.filter(t => t.category === activeCat.value);
  const s = topicSearch.value.trim().toLowerCase();
  if (s) arr = arr.filter(t => t.name.toLowerCase().includes(s) || t.category.toLowerCase().includes(s));
  return arr;
});

const pickedTopic = computed(() => topics.value.find(t => t.id === form.value.topicId));

function statusLabel(s) {
  return s === 'waiting' ? 'Kutilmoqda' : s === 'active' ? 'Faol' : 'Tugagan';
}
function statusStyle(s) {
  if (s === 'active') return 'background:hsl(142 65% 40%/0.14);color:hsl(142 60% 30%)';
  if (s === 'waiting') return 'background:hsl(38 90% 50%/0.14);color:hsl(28 70% 32%)';
  return 'background:hsl(var(--muted));color:hsl(var(--muted-fg))';
}

async function load() {
  try {
    const gs = await api("/api/games");
    games.value = gs;
    for (const g of gs) {
      if (g.status !== "finished") {
        try { players.value[g.gameCode] = await api(`/api/games/${g.gameCode}/players`); } catch {}
      }
    }
  } catch {}
  loading.value = false;
}

async function openCreate() {
  showCreate.value = true;
  step.value = 1;
  form.value = { title: "", gameType: "quiz", topicId: null, questionsCount: 10 };
  if (!topics.value.length) {
    try { topics.value = await api("/api/topics"); } catch {}
  }
}
function closeCreate() { showCreate.value = false; }

async function createGame() {
  creating.value = true;
  try {
    await api("/api/games", { method: "POST", body: JSON.stringify({ ...form.value }) });
    showCreate.value = false;
    await load();
  } catch (e) { alert(e.message || "Xatolik"); }
  creating.value = false;
}
async function startGame(code) { try { await api(`/api/games/${code}/start`, { method: "POST" }); await load(); } catch {} }
async function removeGame(code) {
  if (!confirm("O'yinni o'chirishni xohlaysizmi?")) return;
  try { await api(`/api/games/${code}`, { method: "DELETE" }); await load(); } catch {}
}
async function copyCode(code) {
  try { await navigator.clipboard.writeText(code); } catch {}
  copied.value = code;
  setTimeout(() => { copied.value = null; }, 1800);
}

onMounted(() => { load(); pollTimer = setInterval(load, 4000); });
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<style scoped>
.page-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px; }

/* Modal */
.modal-back { position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55);backdrop-filter:blur(6px); }
.modal-box { width:100%; max-width:560px; padding:24px; max-height:90vh; overflow:auto; }
.modal-head { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;gap:12px; }
.modal-head h2 { font-size:17px;font-weight:700; }
.modal-sub { font-size:11.5px;color:hsl(var(--muted-fg));margin-top:2px; }
.form-stack { display:flex;flex-direction:column;gap:14px; }
.form-field { display:flex;flex-direction:column;gap:6px; }
.form-field label { font-size:13px;font-weight:600; }
.modal-actions { display:flex;gap:10px;padding-top:6px; }
.flex-1 { flex:1; }

/* Type grid */
.type-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
.type-btn { display:flex;flex-direction:column;align-items:center;gap:6px;padding:22px 12px;border-radius:14px;border:2px solid hsl(var(--border));background:transparent;cursor:pointer;font-family:inherit;transition:all .15s;color:hsl(var(--muted-fg)); }
.type-btn:hover { border-color:hsl(var(--primary)/.5);color:hsl(var(--primary));transform:translateY(-1px); }
.type-btn--on { border-color:hsl(var(--primary));background:hsl(var(--primary)/0.07);color:hsl(var(--primary)); }
.type-btn strong { font-size:14px;font-weight:700;color:hsl(var(--fg)); }
.type-btn span { font-size:11.5px;color:hsl(var(--muted-fg));text-align:center; }

/* Topic picker */
.cat-row { display:flex;gap:6px;overflow-x:auto;padding-bottom:4px; }
.cat-chip { font-size:12px;padding:5px 12px;border-radius:99px;border:1px solid hsl(var(--border));background:transparent;cursor:pointer;font-family:inherit;color:hsl(var(--muted-fg));white-space:nowrap; }
.cat-chip:hover { border-color:hsl(var(--primary)/.4);color:hsl(var(--primary)); }
.cat-chip--on { background:hsl(var(--primary));color:white;border-color:hsl(var(--primary)); }
.topic-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-height:280px;overflow-y:auto;padding:2px; }
.topic-btn { position:relative;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;border:1.5px solid hsl(var(--border));background:transparent;cursor:pointer;font-family:inherit;text-align:left;transition:all .15s; }
.topic-btn:hover { border-color:hsl(var(--primary)/.5);background:hsl(var(--primary)/.04); }
.topic-btn--on { border-color:hsl(var(--primary));background:hsl(var(--primary)/.08); }
.topic-icon { font-size:20px;flex-shrink:0; }
.topic-name { font-size:12.5px;font-weight:600;line-height:1.25; }
.topic-tag { position:absolute;top:5px;right:6px;font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px;background:hsl(var(--primary)/.15);color:hsl(var(--primary)); }
.empty-mini { font-size:13px;color:hsl(var(--muted-fg));text-align:center;padding:18px; }

.picked-topic { display:flex;align-items:center;gap:12px;padding:12px 14px;background:hsl(var(--primary)/.07);border:1px solid hsl(var(--primary)/.2);border-radius:12px; }
.topic-icon-big { font-size:28px; }
.picked-topic strong { font-size:14px; }
.picked-topic p { font-size:11.5px;color:hsl(var(--muted-fg));margin-top:2px; }

.range-input { width:100%;accent-color:hsl(var(--primary)); }
.range-labels { display:flex;justify-content:space-between;font-size:11px;color:hsl(var(--muted-fg)); }

/* Game cards */
.game-list { display:flex;flex-direction:column;gap:14px; }
.game-card { position:relative; padding:18px 20px 16px; overflow:hidden; transition:transform .15s, box-shadow .15s; }
.game-card:hover { transform:translateY(-1px); box-shadow:0 8px 24px -10px rgba(0,0,0,.18); }
.game-card__accent { position:absolute;top:0;left:0;bottom:0;width:4px;border-radius:4px 0 0 4px; }
.accent-teal { background:linear-gradient(180deg, hsl(172 70% 45%), hsl(172 65% 38%)); }
.accent-purple { background:linear-gradient(180deg, hsl(265 70% 60%), hsl(280 65% 55%)); }

.game-card__head { display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap; }
.game-card__icon { width:44px;height:44px;border-radius:12px;background:hsl(var(--primary)/.1);display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.game-card__title-wrap { flex:1; min-width:200px; }
.game-card__title-row { display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px; }
.game-card__title-row h3 { font-size:15.5px;font-weight:700; }
.pulse-dot { width:6px;height:6px;border-radius:50%;background:hsl(142 65% 40%);display:inline-block;margin-right:5px;animation:pulse-d 1.4s infinite; }
@keyframes pulse-d { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
.game-card__meta { display:flex;flex-wrap:wrap;gap:5px; }
.meta-chip { display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 9px;border-radius:99px;background:hsl(var(--muted));color:hsl(var(--muted-fg)); font-weight:500;}
.meta-topic { background:hsl(var(--primary)/.1);color:hsl(var(--primary)); }
.game-card__actions { display:flex;align-items:center;gap:6px;flex-shrink:0; }
.btn-start { padding:.4rem .9rem;font-size:13px; }
.btn-icon { padding:.45rem;border-radius:9px; }

.game-card__bottom { margin-top:14px;padding-top:14px;border-top:1px dashed hsl(var(--border)); display:flex;flex-direction:column;gap:10px; }
.game-code-row { display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
.code-pill { display:inline-flex;align-items:center;gap:10px;padding:7px 14px 7px 16px;border-radius:10px;background:hsl(var(--primary)/.08);border:1.5px dashed hsl(var(--primary)/.3);font-family:inherit;cursor:pointer;transition:all .15s; }
.code-pill:hover { background:hsl(var(--primary)/.13); border-style:solid; }
.code-pill__code { font-family:'JetBrains Mono','Menlo',monospace; font-size:1.05rem; font-weight:800; letter-spacing:.18em; color:hsl(var(--primary)); }
.code-hint { font-size:11.5px;color:hsl(var(--muted-fg)); }

.players-row { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
.players-empty { display:flex;align-items:center;gap:6px;font-size:11.5px;color:hsl(var(--muted-fg)); }
.players-label { font-size:11.5px;color:hsl(var(--muted-fg));flex-shrink:0; }
.players-list { display:flex;flex-wrap:wrap;gap:5px; }
.player-chip { display:flex;align-items:center;gap:5px;font-size:12px;padding:3px 10px 3px 3px;border-radius:99px;background:hsl(var(--muted)); }
.player-chip-av { width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg, hsl(var(--primary)), hsl(172 70% 38%));color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center; }
.player-score { font-weight:700;color:hsl(var(--primary)); }

/* Empty */
.empty-card { text-align:center;padding:60px 24px;display:flex;flex-direction:column;align-items:center; }
.empty-icon-wrap { width:64px;height:64px;border-radius:18px;background:hsl(var(--muted));display:flex;align-items:center;justify-content:center;margin:0 auto 14px; }
.empty-title { font-size:15px;font-weight:700;margin-bottom:4px; }
.empty-sub { font-size:13px;color:hsl(var(--muted-fg)); }

.space-y-3 > * + * { margin-top:10px; }
.p-1 { padding:4px; }

/* Modal anim */
.modal-enter-from, .modal-leave-to { opacity:0; }
.modal-enter-from .modal-box, .modal-leave-to .modal-box { transform:scale(.96) translateY(8px); }
.modal-enter-active, .modal-leave-active { transition:opacity .18s; }
.modal-enter-active .modal-box, .modal-leave-active .modal-box { transition:transform .2s; }
</style>
