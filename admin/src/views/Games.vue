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
                <h2>{{ step === 1 ? 'O\'yin turini tanlang' : step === 2 ? 'Mavzu yoki darslikni tanlang' : 'Sozlamalar' }}</h2>
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

            <!-- Step 2: manba — tayyor mavzu yoki yuklangan darslik -->
            <div v-else-if="step === 2" class="form-stack">
              <div class="source-tabs">
                <button type="button" class="source-tab" :class="{ 'source-tab--on': form.source === 'topic' }"
                  @click="form.source = 'topic'">
                  <Globe2 :size="15" /> Tayyor mavzular
                </button>
                <button type="button" class="source-tab" :class="{ 'source-tab--on': form.source === 'lesson' }"
                  @click="pickLessonSource">
                  <BookOpen :size="15" /> Darslik asosida
                </button>
              </div>

              <!-- Darslik -->
              <template v-if="form.source === 'lesson'">
                <div v-if="lessonsLoading" class="empty-mini"><Loader2 :size="16" class="animate-spin" /></div>
                <div v-else-if="!lessons.length" class="empty-mini">
                  Hali darslik yuklanmagan. "Darslar" bo'limida darslik (PDF) qo'shing.
                </div>
                <template v-else>
                  <div class="lesson-list">
                    <button v-for="l in lessons" :key="l.id" type="button"
                      class="lesson-btn" :class="{ 'lesson-btn--on': form.lessonId === l.id }"
                      @click="selectLesson(l)">
                      <span class="lesson-ico">📘</span>
                      <span class="lesson-info">
                        <strong>{{ l.title }}</strong>
                        <em>{{ l.grade }}-sinf · {{ l.topics?.length || 0 }} ta mavzu</em>
                      </span>
                      <Check v-if="form.lessonId === l.id" :size="16" style="color:hsl(var(--primary))" />
                    </button>
                  </div>
                  <div v-if="pickedLesson" class="form-field">
                    <label>Qaysi mavzulardan savol tuzilsin?</label>
                    <div class="lt-list">
                      <button type="button" class="lt-chip" :class="{ 'lt-chip--on': !form.lessonTopicId }"
                        @click="form.lessonTopicId = null">Butun darslik</button>
                      <button v-for="t in pickedLesson.topics" :key="t.id" type="button"
                        class="lt-chip" :class="{ 'lt-chip--on': form.lessonTopicId === t.id }"
                        @click="form.lessonTopicId = t.id">{{ t.title }}</button>
                    </div>
                    <p v-if="!pickedLesson.topics?.length" class="field-note">
                      Bu darslikda mavzular yo'q — avval PDF yuklang.
                    </p>
                  </div>
                </template>
              </template>

              <!-- Tayyor mavzular -->
              <template v-else>
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
              </template>
              <div class="modal-actions">
                <button @click="step = 1" class="geo-btn-outline flex-1">← Orqaga</button>
                <button @click="step = 3" :disabled="!sourceReady" class="geo-btn-primary flex-1">Davom etish →</button>
              </div>
            </div>

            <!-- Step 3: settings -->
            <div v-else class="form-stack">
              <div class="picked-topic">
                <span class="topic-icon-big">{{ form.source === 'lesson' ? '📘' : pickedTopic?.icon }}</span>
                <div>
                  <strong>{{ pickedSummary.title }}</strong>
                  <p>{{ pickedSummary.sub }} · {{ form.gameType === 'bosh_qotirma' ? "Bosh qo'tirma" : 'Viktorina' }}</p>
                </div>
              </div>
              <div class="form-field">
                <label>Qaysi sinflar uchun</label>
                <SectionPicker v-model="form.section" />
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
              <span v-if="game.source === 'lesson'" class="meta-chip meta-topic">
                <BookOpen :size="12" /> {{ game.lessonTitle }}<template v-if="game.lessonTopicId"> · {{ game.topicName }}</template>
              </span>
              <span v-else-if="game.topicName" class="meta-chip meta-topic">{{ game.topicName }}</span>
              <span v-if="game.section && game.section !== 'all'" class="meta-chip">{{ sectionLabel(game.section) }}</span>
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

          <div v-if="playersOf(game).length" class="players-row">
            <div class="players-head">
              <Users :size="13" style="opacity:.6" />
              <span class="players-label">
                <strong>{{ onlineOf(game) }}</strong> o'quvchi o'yinda
                <template v-if="leftOf(game).length"> · {{ leftOf(game).length }} chiqib ketdi</template>
              </span>
            </div>
            <div class="players-list">
              <span v-for="p in playersOf(game)" :key="p.userId"
                class="player-chip" :class="{ 'player-chip--left': !p.online }"
                :title="p.online ? 'O\'yinda' : 'Chiqib ketdi'">
                <span class="player-chip-av">{{ p.name?.charAt(0)?.toUpperCase() || '?' }}</span>
                <span class="player-chip-name">
                  {{ p.name }}
                  <em v-if="p.className || p.grade">{{ p.className || `${p.grade}-sinf` }}</em>
                </span>
                <span v-if="!p.online" class="player-left-tag">chiqdi</span>
                <span v-else-if="game.status === 'active'" class="player-score">{{ p.score }}</span>
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

    <!-- Chiqib ketganlar haqida xabarnomalar -->
    <Teleport to="body">
      <div class="toast-stack">
        <TransitionGroup name="toast">
          <div v-for="n in notifications" :key="n.key" class="toast" :class="`toast--${n.type}`">
            <component :is="n.type === 'leave' ? UserMinus : UserPlus" :size="16" />
            <div class="toast-body">
              <p class="toast-msg">{{ n.message }}</p>
              <p class="toast-sub">{{ n.gameTitle }}</p>
            </div>
            <button class="toast-x" @click="dismiss(n.key)"><X :size="14" /></button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Plus, Gamepad2, Brain, HelpCircle, Play, Copy, Check, Loader2, X, Trash2, Users, UserMinus, UserPlus, BookOpen, Globe2 } from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useSettingsStore } from "@shared/stores/settings";
import SectionPicker from "@shared/components/SectionPicker.vue";
import { sectionLabel } from "@shared/sections";

const settings = useSettingsStore();

const games = ref([]);
// { [gameCode]: { players, online, total, events } }
const players = ref({});
const notifications = ref([]);
// Har bir o'yin uchun oxirgi ko'rilgan hodisa id'si — faqat yangilarini ko'rsatamiz
const seenEventId = ref({});
let notifKey = 0;
const topics = ref([]);
const loading = ref(true);
const showCreate = ref(false);
const creating = ref(false);
const copied = ref(null);
const step = ref(1);
const topicSearch = ref("");
const activeCat = ref("Hammasi");
const form = ref(emptyForm());
const lessons = ref([]);
const lessonsLoading = ref(false);

function emptyForm() {
  return {
    title: "", gameType: "quiz", questionsCount: 10,
    source: "topic", topicId: null, lessonId: null, lessonTopicId: null,
    section: settings.section,
  };
}
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
const pickedLesson = computed(() => lessons.value.find(l => l.id === form.value.lessonId));
const sourceReady = computed(() =>
  form.value.source === "lesson" ? Boolean(pickedLesson.value?.topics?.length) : Boolean(form.value.topicId));
const pickedSummary = computed(() => {
  if (form.value.source === "lesson") {
    const l = pickedLesson.value;
    const t = l?.topics?.find(x => x.id === form.value.lessonTopicId);
    return { title: t ? t.title : l?.title, sub: t ? `Darslik: ${l?.title}` : `Butun darslik · ${l?.topics?.length || 0} ta mavzu` };
  }
  return { title: pickedTopic.value?.name, sub: pickedTopic.value?.category };
});

async function pickLessonSource() {
  form.value.source = "lesson";
  if (lessons.value.length) return;
  lessonsLoading.value = true;
  try { lessons.value = await api("/api/lessons"); } catch {}
  lessonsLoading.value = false;
}
function selectLesson(l) {
  form.value.lessonId = l.id;
  form.value.lessonTopicId = null;
  if (!form.value.title) form.value.title = l.title;
}

function statusLabel(s) {
  return s === 'waiting' ? 'Kutilmoqda' : s === 'active' ? 'Faol' : 'Tugagan';
}
function statusStyle(s) {
  if (s === 'active') return 'background:hsl(142 65% 40%/0.14);color:hsl(142 60% 30%)';
  if (s === 'waiting') return 'background:hsl(38 90% 50%/0.14);color:hsl(28 70% 32%)';
  return 'background:hsl(var(--muted));color:hsl(var(--muted-fg))';
}

function playersOf(game) { return players.value[game.gameCode]?.players ?? []; }
function onlineOf(game)  { return players.value[game.gameCode]?.online ?? 0; }
function leftOf(game)    { return playersOf(game).filter(p => !p.online); }

function dismiss(key) {
  notifications.value = notifications.value.filter(n => n.key !== key);
}

/** Yangi hodisalarni xabarnomaga aylantiradi (birinchi yuklashda ko'rsatilmaydi). */
function handleEvents(game, events, isFirstLoad) {
  const code = game.gameCode;
  const lastSeen = seenEventId.value[code] ?? 0;
  const fresh = events.filter(e => e.id > lastSeen);
  seenEventId.value[code] = events.at(-1)?.id ?? lastSeen;
  if (isFirstLoad) return;   // sahifa ochilganda eski hodisalar chiqmasin

  for (const e of fresh) {
    if (e.type !== "leave" && e.type !== "rejoin") continue;
    const key = ++notifKey;
    notifications.value = [
      ...notifications.value,
      { key, type: e.type, message: e.message, gameTitle: game.title },
    ].slice(-4);
    setTimeout(() => dismiss(key), 8000);
  }
}

async function load() {
  try {
    const gs = await api("/api/games");
    games.value = gs;
    for (const g of gs) {
      if (g.status === "finished") continue;
      try {
        const data = await api(`/api/games/${g.gameCode}/players`);
        const isFirstLoad = !(g.gameCode in seenEventId.value);
        players.value = { ...players.value, [g.gameCode]: data };
        handleEvents(g, data.events ?? [], isFirstLoad);
      } catch {}
    }
  } catch {}
  loading.value = false;
}

async function openCreate() {
  showCreate.value = true;
  step.value = 1;
  form.value = emptyForm();
  if (!topics.value.length) {
    try { topics.value = await api("/api/topics"); } catch {}
  }
}
function closeCreate() { showCreate.value = false; }

async function createGame() {
  creating.value = true;
  try {
    const f = form.value;
    await api("/api/games", {
      method: "POST",
      body: JSON.stringify(f.source === "lesson"
        ? { ...f, topicId: null }
        : { ...f, lessonId: null, lessonTopicId: null }),
    });
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
useLive(["games"], load, { delay: 150 });
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
.source-tabs { display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;border-radius:12px;background:hsl(var(--muted)/.6); }
.source-tab { display:flex;align-items:center;justify-content:center;gap:7px;padding:9px;border-radius:9px;border:none;background:transparent;font-family:inherit;font-size:13px;font-weight:600;color:hsl(var(--muted-fg));cursor:pointer;transition:all .15s; }
.source-tab--on { background:hsl(var(--card));color:hsl(var(--fg));box-shadow:0 1px 4px rgba(0,0,0,.08); }
.lesson-list { display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;padding:2px; }
.lesson-btn { display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1.5px solid hsl(var(--border));background:transparent;font-family:inherit;text-align:left;cursor:pointer;color:hsl(var(--fg));transition:all .15s; }
.lesson-btn:hover { border-color:hsl(var(--primary)/.5); }
.lesson-btn--on { border-color:hsl(var(--primary));background:hsl(var(--primary)/.06); }
.lesson-ico { font-size:20px; }
.lesson-info { flex:1;min-width:0;display:flex;flex-direction:column; }
.lesson-info strong { font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.lesson-info em { font-style:normal;font-size:11.5px;color:hsl(var(--muted-fg)); }
.lt-list { display:flex;flex-wrap:wrap;gap:6px;max-height:150px;overflow-y:auto; }
.lt-chip { padding:5px 11px;border-radius:99px;border:1px solid hsl(var(--border));background:transparent;font-family:inherit;font-size:12px;font-weight:600;color:hsl(var(--muted-fg));cursor:pointer;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.lt-chip--on { background:hsl(var(--primary));border-color:hsl(var(--primary));color:#fff; }
.field-note { font-size:12px;color:hsl(var(--muted-fg)); }

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

.players-row { display:flex;flex-direction:column;gap:8px; }
.players-head { display:flex;align-items:center;gap:6px; }
.players-empty { display:flex;align-items:center;gap:6px;font-size:11.5px;color:hsl(var(--muted-fg)); }
.players-label { font-size:11.5px;color:hsl(var(--muted-fg));flex-shrink:0; }
.players-label strong { font-size:13px;color:hsl(var(--fg)); }
.players-list { display:flex;flex-wrap:wrap;gap:5px; }
.player-chip { display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 10px 3px 3px;border-radius:99px;background:hsl(var(--muted));transition:opacity .2s; }
.player-chip-av { width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg, hsl(var(--primary)), hsl(172 70% 38%));color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.player-chip-name { display:flex;align-items:baseline;gap:5px;font-weight:600; }
.player-chip-name em { font-style:normal;font-weight:500;font-size:10.5px;color:hsl(var(--muted-fg)); }
.player-score { font-weight:700;color:hsl(var(--primary)); }

/* Chiqib ketgan o'quvchi */
.player-chip--left { opacity:.55;background:hsl(0 60% 50%/0.09); }
.player-chip--left .player-chip-av { background:hsl(var(--muted-fg)); }
.player-left-tag { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:hsl(0 60% 46%); }

/* Xabarnomalar */
.toast-stack { position:fixed;right:18px;bottom:18px;z-index:120;display:flex;flex-direction:column;gap:10px;max-width:min(340px, calc(100vw - 36px)); }
.toast {
  display:flex;align-items:flex-start;gap:10px;
  padding:12px 12px 12px 14px;border-radius:14px;
  background:hsl(var(--card));border:1px solid hsl(var(--border));
  box-shadow:0 12px 32px -12px rgba(0,0,0,.35);
}
.toast--leave  { border-left:3px solid hsl(0 65% 52%); color:hsl(0 60% 44%); }
.toast--rejoin { border-left:3px solid hsl(142 60% 38%); color:hsl(142 55% 30%); }
.toast-body { flex:1;min-width:0; }
.toast-msg { font-size:13px;font-weight:650;color:hsl(var(--fg));line-height:1.35; }
.toast-sub { font-size:11px;color:hsl(var(--muted-fg));margin-top:2px; }
.toast-x { background:none;border:none;cursor:pointer;color:hsl(var(--muted-fg));padding:2px;border-radius:6px;flex-shrink:0; }
.toast-x:hover { background:hsl(var(--muted)); }

.toast-enter-active, .toast-leave-active { transition:all .3s cubic-bezier(.4,0,.2,1); }
.toast-enter-from { opacity:0;transform:translateX(24px); }
.toast-leave-to   { opacity:0;transform:translateX(24px); }
.toast-move { transition:transform .3s; }

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
