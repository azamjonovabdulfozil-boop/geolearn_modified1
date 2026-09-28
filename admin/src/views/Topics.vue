<template>
  <div class="fade-in">
    <div class="back-header">
      <RouterLink to="/lessons" class="back-btn"><ArrowLeft :size="16" /></RouterLink>
      <div class="bh-text">
        <h1 class="geo-page-title">{{ lesson?.title ?? 'Mavzular' }}</h1>
        <p class="geo-page-sub">
          {{ topics.length }} ta mavzu · har urinishda o'quvchiga {{ perAttempt }} ta savol tushadi
        </p>
      </div>
      <button v-if="topics.length" class="geo-btn-outline all-btn"
              :disabled="Boolean(generatingId) || regenAll" @click="regenerateAll">
        <Loader2 v-if="regenAll" :size="14" class="animate-spin" />
        <Sparkles v-else :size="14" />
        {{ regenAll ? `${doneCount}/${topics.length}...` : "Barcha testlarni yangilash" }}
      </button>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="geo-skeleton" style="height:72px"></div>
    </div>

    <div v-else-if="!topics.length" class="geo-card empty-card">
      <FileText :size="32" style="color:hsl(var(--muted-fg));opacity:.4;margin:0 auto 10px;display:block" />
      <p class="empty-title">Mavzular yo'q</p>
      <p class="empty-sub">PDF yuklang, mavzular avtomatik ajratiladi</p>
    </div>

    <div v-else class="topic-list">
      <div v-for="topic in topics" :key="topic.id" class="topic-card geo-card">
        <div class="topic-head">
          <button class="topic-toggle" @click="toggle(topic)">
            <div class="topic-icon"><FileText :size="16" style="color:hsl(var(--primary))" /></div>
            <div class="topic-info">
              <span class="topic-title">{{ topic.title }}</span>
              <span class="badges">
                <span class="pill pill-open">
                  <ListChecks :size="11" /> {{ counts(topic).open }} variantli
                </span>
                <span class="pill pill-closed">
                  <PenLine :size="11" /> {{ counts(topic).closed }} yozma
                </span>
              </span>
            </div>
            <ChevronDown :size="16" class="chevron" :class="{ 'chevron--open': expanded.has(topic.id) }" />
          </button>

          <button @click.stop="generateTests(topic)" :disabled="generatingId === topic.id || regenAll"
                  class="geo-btn-primary gen-btn">
            <Loader2 v-if="generatingId === topic.id" :size="13" class="animate-spin" />
            <RefreshCw v-else-if="counts(topic).open" :size="13" />
            <Sparkles v-else :size="13" />
            {{ generatingId === topic.id ? 'Yangilanmoqda...' : (counts(topic).open ? 'Yangilash' : 'Test yaratish') }}
          </button>
        </div>

        <Transition name="expand">
          <div v-if="expanded.has(topic.id)" class="topic-body">
            <!-- Bo'limlar -->
            <div class="tabs">
              <button v-for="t in TABS" :key="t.key" class="tab"
                      :class="{ 'tab--on': tabOf(topic.id) === t.key }"
                      @click="setTab(topic.id, t.key)">
                <component :is="t.icon" :size="13" />
                {{ t.label }}
                <span v-if="t.key !== 'text'" class="tab-count">
                  {{ t.key === 'open' ? counts(topic).open : counts(topic).closed }}
                </span>
              </button>
            </div>

            <div v-if="loadingTests.has(topic.id)" class="tests-loading">
              <Loader2 :size="16" class="animate-spin" /> Savollar yuklanmoqda...
            </div>

            <!-- Mavzu matni -->
            <p v-else-if="tabOf(topic.id) === 'text'" class="topic-text">
              {{ topic.content || "Bu mavzuda matn yo'q." }}
            </p>

            <!-- Variantli savollar (javobi belgilangan) -->
            <template v-else-if="tabOf(topic.id) === 'open'">
              <p v-if="!bank(topic.id).open.length" class="tests-empty">
                Savollar yo'q — "Test yaratish" tugmasini bosing.
              </p>
              <ol v-else class="q-list">
                <li v-for="(q, i) in bank(topic.id).open" :key="q.id ?? i" class="q-item">
                  <p class="q-text"><span class="q-num">{{ i + 1 }}</span>{{ q.questionText || q.question }}</p>
                  <ul class="opts">
                    <li v-for="(opt, oi) in q.options" :key="oi" class="opt"
                        :class="{ 'opt--right': oi === q.correctIndex }">
                      <span class="opt-letter">{{ LETTERS[oi] }}</span>
                      <span class="opt-text">{{ opt }}</span>
                      <Check v-if="oi === q.correctIndex" :size="13" class="opt-check" />
                    </li>
                  </ul>
                  <p class="answer-line">
                    <CheckCircle2 :size="12" />
                    To'g'ri javob: <b>{{ LETTERS[q.correctIndex] }}</b> — {{ q.options?.[q.correctIndex] }}
                  </p>
                </li>
              </ol>
            </template>

            <!-- Yozma savollar (namunaviy javob bilan) -->
            <template v-else>
              <p v-if="!bank(topic.id).closed.length" class="tests-empty">
                Yozma savollar yo'q — "Test yaratish" tugmasini bosing.
              </p>
              <ol v-else class="q-list">
                <li v-for="(q, i) in bank(topic.id).closed" :key="q.id ?? i" class="q-item">
                  <p class="q-text"><span class="q-num q-num--w">{{ i + 1 }}</span>{{ q.questionText || q.question }}</p>
                  <div v-if="q.answer" class="written-answer">
                    <p class="wa-label"><Key :size="11" /> Namunaviy javob (matndan)</p>
                    <p class="wa-text">{{ q.answer }}</p>
                  </div>
                  <p v-else class="wa-none">Namunaviy javob saqlanmagan — "Yangilash" bosing.</p>
                </li>
              </ol>
            </template>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute, RouterLink } from "vue-router";
import {
  ArrowLeft, FileText, ChevronDown, Sparkles, Loader2, RefreshCw,
  ListChecks, PenLine, Check, CheckCircle2, Key, AlignLeft,
} from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useSettingsStore } from "@shared/stores/settings";

const route = useRoute();
const settings = useSettingsStore();
const lessonId = Number(route.params.id);

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const TABS = [
  { key: "open", label: "Variantli", icon: ListChecks },
  { key: "closed", label: "Yozma", icon: PenLine },
  { key: "text", label: "Mavzu matni", icon: AlignLeft },
];

const lesson = ref(null);
const topics = ref([]);
const loading = ref(true);
const expanded = ref(new Set());
const generatingId = ref(null);
const regenAll = ref(false);
const doneCount = ref(0);
const perAttempt = ref(15);
const loadingTests = ref(new Set());
// { [topicId]: { open: [], closed: [] } }
const banks = ref({});
const tabs = ref({});

function counts(topic) {
  const b = banks.value[topic.id];
  if (b) return { open: b.open.length, closed: b.closed.length };
  // Hali yuklanmagan bo'lsa — mavzu obyektidagi ma'lumot
  return {
    open: (topic.openTests ?? topic.tests ?? []).length,
    closed: (topic.closedTests ?? []).length,
  };
}
function bank(id) { return banks.value[id] ?? { open: [], closed: [] }; }
function tabOf(id) { return tabs.value[id] ?? "open"; }
function setTab(id, key) { tabs.value = { ...tabs.value, [id]: key }; }

function toggle(topic) {
  const next = new Set(expanded.value);
  if (next.has(topic.id)) next.delete(topic.id);
  else {
    next.add(topic.id);
    if (!banks.value[topic.id]) loadTests(topic.id);
  }
  expanded.value = next;
}

async function loadTests(topicId) {
  const busy = new Set(loadingTests.value);
  busy.add(topicId);
  loadingTests.value = busy;
  try {
    const data = await api(`/api/topics/${topicId}/tests?mode=all`);
    banks.value = {
      ...banks.value,
      [topicId]: { open: data.open ?? [], closed: data.closed ?? [] },
    };
    if (data.perAttempt) perAttempt.value = data.perAttempt;
  } catch {}
  const done = new Set(loadingTests.value);
  done.delete(topicId);
  loadingTests.value = done;
}

async function load() {
  try {
    const les = await api(`/api/lessons/${lessonId}`);
    lesson.value = les;
    topics.value = les.topics ?? [];
  } catch {}
  loading.value = false;
}
onMounted(load);
useLive(["lessons", "topics"], load);

/** Testlarni qaytadan yaratadi va ekrandagi ro'yxatni darrov yangilaydi. */
async function generateTests(topic) {
  generatingId.value = topic.id;
  try {
    const res = await api("/api/topics/generate-tests", {
      method: "POST",
      body: JSON.stringify({
        topicId: topic.id,
        topicTitle: topic.title,
        topicContent: topic.content || topic.title,
        language: settings.language,
      }),
    });
    banks.value = {
      ...banks.value,
      [topic.id]: { open: res.open ?? res.tests ?? [], closed: res.closed ?? [] },
    };
    if (res.perAttempt) perAttempt.value = res.perAttempt;
    // Yangi savollar darrov ko'rinsin
    const next = new Set(expanded.value);
    next.add(topic.id);
    expanded.value = next;
  } catch {}
  generatingId.value = null;
}

async function regenerateAll() {
  regenAll.value = true;
  doneCount.value = 0;
  for (const tp of topics.value) {
    generatingId.value = tp.id;
    await generateTests(tp);
    doneCount.value++;
  }
  generatingId.value = null;
  regenAll.value = false;
}
</script>

<style scoped>
.back-header { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; flex-wrap: wrap; }
.bh-text { flex: 1; min-width: 200px; }
.back-btn {
  width: 36px; height: 36px; border-radius: 10px;
  background: hsl(var(--card)); border: 1.5px solid hsl(var(--border));
  display: flex; align-items: center; justify-content: center;
  color: hsl(var(--fg)); text-decoration: none; transition: background .15s; flex-shrink: 0;
}
.back-btn:hover { background: hsl(var(--muted)); }
.all-btn { padding: .45rem 1rem; font-size: 12.5px; border-radius: .7rem; display: inline-flex; align-items: center; gap: 6px; }

.topic-list { display: flex; flex-direction: column; gap: 9px; }
.topic-card { overflow: hidden; }
.topic-head { display: flex; align-items: center; gap: 10px; padding: 6px 14px 6px 6px; }
.topic-toggle {
  flex: 1; min-width: 0;
  display: flex; align-items: center; gap: 12px;
  padding: 10px; background: transparent; border: none; cursor: pointer;
  font-family: inherit; text-align: left; border-radius: 12px; transition: background .15s;
}
.topic-toggle:hover { background: hsl(var(--muted)/.5); }
.topic-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: hsl(var(--primary)/0.1);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.topic-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.topic-title { font-size: 14px; font-weight: 600; color: hsl(var(--fg)); }
.badges { display: flex; gap: 6px; flex-wrap: wrap; }
.pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px;
}
.pill-open { color: hsl(var(--primary)); background: hsl(var(--primary)/.1); }
.pill-closed { color: hsl(var(--chart-2)); background: hsl(var(--chart-2)/.12); }
.chevron { color: hsl(var(--muted-fg)); transition: transform .2s; flex-shrink: 0; }
.chevron--open { transform: rotate(180deg); }
.gen-btn { padding: .4rem .9rem; font-size: 12.5px; border-radius: .7rem; flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; }

.topic-body { padding: 4px 16px 16px; border-top: 1px dashed hsl(var(--border)); margin: 0 14px 0 6px; }

/* Bo'limlar */
.tabs { display: flex; gap: 6px; margin: 14px 0; flex-wrap: wrap; }
.tab {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid hsl(var(--border)); background: transparent;
  color: hsl(var(--muted-fg)); font-family: inherit; font-size: 12px; font-weight: 600;
  transition: all .15s;
}
.tab:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--primary)); }
.tab--on { background: hsl(var(--primary)); border-color: hsl(var(--primary)); color: #fff; }
.tab-count { font-size: 10.5px; opacity: .85; background: rgba(255,255,255,.22); padding: 0 6px; border-radius: 99px; }
.tab:not(.tab--on) .tab-count { background: hsl(var(--muted)); }

.tests-loading { display: flex; align-items: center; gap: 8px; padding: 20px 4px; font-size: 13px; color: hsl(var(--muted-fg)); }
.tests-empty { padding: 18px 4px; font-size: 13px; color: hsl(var(--muted-fg)); }
.topic-text { font-size: 13.5px; line-height: 1.7; color: hsl(var(--muted-fg)); white-space: pre-wrap; }

/* Savollar */
.q-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; max-height: 560px; overflow-y: auto; }
.q-item { padding: 12px 14px; border-radius: 14px; background: hsl(var(--muted)/.5); }
.q-text { font-size: 13px; font-weight: 600; line-height: 1.55; display: flex; gap: 8px; }
.q-num {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 7px;
  background: hsl(var(--primary)); color: #fff;
  font-size: 11px; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center;
}
.q-num--w { background: hsl(var(--chart-2)); }

.opts { list-style: none; margin: 10px 0 0 30px; padding: 0; display: grid; gap: 5px; }
.opt {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border-radius: 9px;
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  font-size: 12.5px;
}
.opt--right {
  background: hsl(var(--success)/.1);
  border-color: hsl(var(--success)/.45);
  font-weight: 600;
}
.opt-letter {
  width: 18px; height: 18px; border-radius: 6px; flex-shrink: 0;
  background: hsl(var(--muted)); color: hsl(var(--muted-fg));
  font-size: 10.5px; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center;
}
.opt--right .opt-letter { background: hsl(var(--success)); color: #fff; }
.opt-text { flex: 1; min-width: 0; }
.opt-check { color: hsl(var(--success)); flex-shrink: 0; }

.answer-line {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  margin: 9px 0 0 30px; font-size: 11.5px; font-weight: 600;
  color: hsl(var(--success));
}
.answer-line b { font-weight: 800; }

.written-answer {
  margin: 9px 0 0 30px; padding: 9px 12px;
  border-radius: 10px; background: hsl(var(--chart-2)/.08);
  border-left: 3px solid hsl(var(--chart-2));
}
.wa-label {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em;
  color: hsl(var(--chart-2)); margin-bottom: 4px;
}
.wa-text { font-size: 12.5px; line-height: 1.6; color: hsl(var(--fg)); }
.wa-none { margin: 8px 0 0 30px; font-size: 11.5px; color: hsl(var(--muted-fg)); font-style: italic; }

.expand-enter-active, .expand-leave-active { transition: all .2s ease; }
.expand-enter-from, .expand-leave-to { opacity: 0; transform: translateY(-6px); }

.empty-card { text-align: center; padding: 60px 24px; }
.empty-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: hsl(var(--muted-fg)); }
.space-y-3 > * + * { margin-top: 10px; }
</style>
