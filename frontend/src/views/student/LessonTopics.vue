<template>
  <div class="fade-in">
    <div class="back-header">
      <RouterLink to="/student/lessons" class="back-btn">
        <ArrowLeft :size="16" />
      </RouterLink>
      <div>
        <h1 class="geo-page-title">{{ lesson?.title ?? 'Mavzular' }}</h1>
        <p class="geo-page-sub">{{ topics.length }} ta mavzu · har biriga 15 variantli + 15 yozma test</p>
      </div>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="geo-skeleton" style="height:82px"></div>
    </div>

    <div v-else-if="!topics.length" class="geo-card empty-card">
      <FileText :size="32" style="color:hsl(var(--muted-fg));opacity:.4;display:block;margin:0 auto 12px" />
      <p class="empty-title">Bu darsda mavzular yo'q</p>
      <p class="empty-sub">O'qituvchi hali mavzular qo'shmagan yoki PDF yuklamagan</p>
    </div>

    <div v-else class="topic-list">
      <div v-for="(topic, idx) in topics" :key="topic.id" class="topic-card geo-card">
        <button class="topic-main" @click="toggle(topic.id)">
          <div class="topic-num">{{ String(idx + 1).padStart(2, '0') }}</div>
          <div class="topic-body">
            <p class="topic-title">{{ topic.title }}</p>
            <p v-if="topic.content" class="topic-preview">{{ shortPreview(topic.content) }}</p>
            <div class="topic-meta">
              <span class="meta-pill"><BookOpen :size="11" /> mavzu</span>
              <span class="meta-pill meta-pill--open"><ListChecks :size="11" /> {{ (topic.openTests || topic.tests || []).length }} variantli</span>
              <span class="meta-pill meta-pill--closed"><PenLine :size="11" /> {{ (topic.closedTests || []).length }} yozma</span>
            </div>
          </div>
          <ChevronRight :size="18" class="chevron" :class="{ 'chevron--open': expanded.has(topic.id) }" />
        </button>

        <div v-if="expanded.has(topic.id)" class="topic-expanded">
          <div class="content-block">
            <div class="block-head">
              <BookOpen :size="14" />
              <span>Mavzu mazmuni</span>
            </div>
            <p class="content-text">{{ mediumPreview(topic.content) || 'Bu mavzu uchun matn hali kiritilmagan.' }}</p>
            <RouterLink :to="`/student/topics/${topic.id}/read`" class="read-more-btn">
              <FileText :size="14" /> Batafsil o'qish (2-sahifa) →
            </RouterLink>
          </div>

          <div class="action-grid">
            <RouterLink :to="`/student/topics/${topic.id}/test?mode=open`" class="action-card action-open">
              <div class="action-icon"><ListChecks :size="22" /></div>
              <div class="action-info">
                <p class="action-title">Ochiq test</p>
                <p class="action-sub">15 ta ABC variantli savol</p>
              </div>
              <ChevronRight :size="16" />
            </RouterLink>

            <RouterLink :to="`/student/topics/${topic.id}/test?mode=closed`" class="action-card action-closed">
              <div class="action-icon"><PenLine :size="22" /></div>
              <div class="action-info">
                <p class="action-title">Yopiq test</p>
                <p class="action-sub">15 ta yozma savol</p>
              </div>
              <ChevronRight :size="16" />
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { ArrowLeft, FileText, ChevronRight, BookOpen, ListChecks, PenLine } from "lucide-vue-next";
import { api } from "@/composables/api";

const route = useRoute();
const lessonId = Number(route.params.id);
const lesson = ref(null);
const topics = ref([]);
const loading = ref(true);
const expanded = ref(new Set());

function toggle(id) {
  const next = new Set(expanded.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expanded.value = next;
}

function shortPreview(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
}
function mediumPreview(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > 360 ? s.slice(0, 360) + "…" : s;
}

onMounted(async () => {
  try {
    const les = await api(`/api/lessons/${lessonId}`);
    lesson.value = les;
    topics.value = les.topics ?? [];
  } catch {}
  loading.value = false;
});
</script>

<style scoped>
.back-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
.back-btn {
  width: 36px; height: 36px; border-radius: 10px;
  background: hsl(var(--card)); border: 1.5px solid hsl(var(--border));
  display: flex; align-items: center; justify-content: center;
  color: hsl(var(--fg)); text-decoration: none; flex-shrink: 0;
}
.back-btn:hover { background: hsl(var(--muted)); }

.topic-list { display: flex; flex-direction: column; gap: 12px; }
.topic-card {
  overflow: hidden; padding: 0;
  transition: border-color .2s, box-shadow .2s, transform .15s;
}
.topic-card:hover { border-color: hsl(var(--primary)/.4); box-shadow: 0 12px 32px hsl(var(--primary)/.1); }

.topic-main {
  width: 100%; display: flex; align-items: flex-start; gap: 16px;
  padding: 18px 20px; background: transparent; border: 0;
  color: inherit; font-family: inherit; text-align: left; cursor: pointer;
}
.topic-num {
  width: 44px; height: 44px; border-radius: 12px;
  background: linear-gradient(135deg, hsl(var(--primary)/.15), hsl(var(--primary)/.05));
  color: hsl(var(--primary));
  font-size: 15px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; letter-spacing: -.02em;
}
.topic-body { flex: 1; min-width: 0; }
.topic-title { font-size: 15.5px; font-weight: 700; margin-bottom: 4px; line-height: 1.35; }
.topic-preview {
  font-size: 12.5px; color: hsl(var(--muted-fg));
  line-height: 1.5; margin-bottom: 10px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.topic-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.meta-pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600;
  padding: 3px 9px; border-radius: 99px;
  background: hsl(var(--muted)); color: hsl(var(--muted-fg));
}
.meta-pill--open { background: hsl(var(--primary)/.12); color: hsl(var(--primary)); }
.meta-pill--closed { background: hsl(38 90% 50%/.15); color: hsl(28 80% 38%); }

.chevron { color: hsl(var(--muted-fg)); transition: transform .25s; flex-shrink: 0; margin-top: 14px; }
.chevron--open { transform: rotate(90deg); color: hsl(var(--primary)); }

.topic-expanded {
  padding: 4px 20px 20px;
  display: flex; flex-direction: column; gap: 16px;
  animation: slideDown .25s ease;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.content-block {
  background: hsl(var(--muted)/.5);
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  padding: 14px 16px;
}
.block-head {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700;
  color: hsl(var(--primary));
  text-transform: uppercase; letter-spacing: .04em;
  margin-bottom: 10px;
}
.content-text {
  font-size: 14px; line-height: 1.75;
  color: hsl(var(--fg));
  white-space: pre-wrap;
  margin-bottom: 12px;
}
.read-more-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700;
  color: hsl(var(--primary));
  text-decoration: none;
  padding: 8px 14px; border-radius: 10px;
  background: hsl(var(--primary)/.1);
  border: 1.5px solid hsl(var(--primary)/.25);
  transition: all .15s;
}
.read-more-btn:hover { background: hsl(var(--primary)/.18); border-color: hsl(var(--primary)/.55); transform: translateY(-1px); }

.action-grid {
  display: grid; gap: 10px;
  grid-template-columns: 1fr;
}
@media (min-width: 540px) { .action-grid { grid-template-columns: 1fr 1fr; } }

.action-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  text-decoration: none; color: hsl(var(--fg));
  border: 1.5px solid hsl(var(--border));
  background: hsl(var(--card));
  transition: all .15s;
}
.action-card:hover { transform: translateY(-1px); box-shadow: 0 8px 22px hsl(var(--primary)/.12); }
.action-icon {
  width: 42px; height: 42px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.action-open .action-icon { background: hsl(var(--primary)/.12); color: hsl(var(--primary)); }
.action-open:hover { border-color: hsl(var(--primary)/.5); }
.action-closed .action-icon { background: hsl(38 90% 50%/.18); color: hsl(28 80% 38%); }
.action-closed:hover { border-color: hsl(38 90% 50%/.55); }
.action-info { flex: 1; min-width: 0; }
.action-title { font-size: 14.5px; font-weight: 700; margin-bottom: 2px; }
.action-sub { font-size: 12px; color: hsl(var(--muted-fg)); }

.empty-card { text-align: center; padding: 56px 24px; }
.empty-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: hsl(var(--muted-fg)); }
.space-y-3 > * + * { margin-top: 10px; }
</style>
