<template>
  <div class="fade-in">
    <div class="back-header">
      <RouterLink to="/lessons" class="back-btn">
        <ArrowLeft :size="16" />
      </RouterLink>
      <div>
        <h1 class="geo-page-title">{{ lesson?.title ?? 'Mavzular' }}</h1>
        <p class="geo-page-sub">Dars mavzulari</p>
      </div>
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
        <button class="topic-toggle" @click="toggle(topic.id)">
          <div class="topic-left">
            <div class="topic-icon">
              <FileText :size="16" style="color:hsl(var(--primary))" />
            </div>
            <div class="topic-info">
              <span class="topic-title">{{ topic.title }}</span>
              <span v-if="(testCounts[topic.id] ?? 0) > 0" class="geo-badge geo-badge-success ml-8">
                ✓ {{ testCounts[topic.id] }} test
              </span>
              <span v-else class="geo-badge geo-badge-muted ml-8">Testlar yo'q</span>
            </div>
          </div>
          <div class="topic-right">
            <button @click.stop="generateTests(topic)" :disabled="generatingId === topic.id"
              class="geo-btn-primary gen-btn">
              <Loader2 v-if="generatingId === topic.id" :size="13" class="animate-spin" />
              <Sparkles v-else :size="13" />
              {{ generatingId === topic.id ? 'Yaratilmoqda...' : (testCounts[topic.id] ? 'Yangilash' : 'Test yaratish') }}
            </button>
            <ChevronDown :size="16" class="chevron" :class="{ 'chevron--open': expanded.has(topic.id) }" />
          </div>
        </button>

        <Transition name="expand">
          <div v-if="expanded.has(topic.id)" class="topic-content">
            <p>{{ topic.content || 'Bu mavzuda matn yoq.' }}</p>
            <div v-if="topic.tests?.length" class="tests-preview">
              <p class="tests-title">Test savollari</p>
              <ol>
                <li v-for="test in topic.tests.slice(0, 15)" :key="test.id">{{ test.questionText || test.question }}</li>
              </ol>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { ArrowLeft, FileText, ChevronDown, Sparkles, Loader2 } from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useSettingsStore } from "@shared/stores/settings";

const route = useRoute();
const settings = useSettingsStore();
const lessonId = Number(route.params.id);
const lesson = ref(null);
const topics = ref([]);
const loading = ref(true);
const expanded = ref(new Set());
const generatingId = ref(null);
const testCounts = ref({});

function toggle(id) {
  if (expanded.value.has(id)) expanded.value.delete(id);
  else expanded.value.add(id);
}

async function load() {
  try {
    const les = await api(`/api/lessons/${lessonId}`);
    lesson.value = les;
    topics.value = les.topics ?? [];
  } catch {}
  loading.value = false;
  loadTestCounts();
}

async function loadTestCounts() {
  for (const tp of topics.value) {
    try {
      const tests = await api(`/api/topics/${tp.id}/tests`);
      testCounts.value = { ...testCounts.value, [tp.id]: tests.length };
    } catch {}
  }
}

onMounted(load);

async function generateTests(topic) {
  generatingId.value = topic.id;
  try {
    await api("/api/topics/generate-tests", {
      method: "POST",
      body: JSON.stringify({ topicId: topic.id, topicTitle: topic.title, topicContent: topic.content || topic.title, language: settings.language }),
    });
    const tests = await api(`/api/topics/${topic.id}/tests`);
    testCounts.value = { ...testCounts.value, [topic.id]: tests.length };
  } catch {}
  generatingId.value = null;
}
</script>

<style scoped>
.back-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
.back-btn {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: hsl(var(--card));
  border: 1.5px solid hsl(var(--border));
  display: flex; align-items: center; justify-content: center;
  color: hsl(var(--fg)); text-decoration: none;
  transition: background .15s;
  flex-shrink: 0;
}
.back-btn:hover { background: hsl(var(--muted)); }

.topic-list { display: flex; flex-direction: column; gap: 8px; }
.topic-card { overflow: hidden; }
.topic-toggle {
  width: 100%;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  background: transparent; border: none; cursor: pointer;
  font-family: inherit; gap: 12px;
  transition: background .15s;
}
.topic-toggle:hover { background: hsl(var(--muted)/0.5); }
.topic-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; text-align: left; }
.topic-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: hsl(var(--primary)/0.1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.topic-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1; min-width: 0; }
.topic-title { font-size: 14.5px; font-weight: 600; color: hsl(var(--fg)); }
.ml-8 { margin-left: 0; }
.topic-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.gen-btn { padding: .35rem .85rem; font-size: 12.5px; border-radius: .65rem; }
.chevron { color: hsl(var(--muted-fg)); transition: transform .2s; }
.chevron--open { transform: rotate(180deg); }

.topic-content {
  padding: 0 16px 14px 64px;
  font-size: 13.5px;
  line-height: 1.65;
  color: hsl(var(--muted-fg));
}
.topic-content p { white-space: pre-wrap; }
.tests-preview { margin-top: 14px; padding: 14px; border-radius: 14px; background: hsl(var(--muted)/.55); border: 1px solid hsl(var(--border)); color: hsl(var(--fg)); }
.tests-title { font-weight: 800; font-size: 13px; margin-bottom: 8px; color: hsl(var(--primary)); }
.tests-preview ol { padding-left: 20px; display: grid; gap: 6px; }
.tests-preview li { color: hsl(var(--fg)); font-size: 13px; line-height: 1.5; }

.expand-enter-active, .expand-leave-active { transition: all .2s ease; }
.expand-enter-from, .expand-leave-to { opacity: 0; transform: translateY(-6px); }

.empty-card { text-align: center; padding: 60px 24px; }
.empty-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: hsl(var(--muted-fg)); }
.space-y-3 > * + * { margin-top: 10px; }
</style>
