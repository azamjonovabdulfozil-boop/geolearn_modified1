<template>
  <div class="fade-in">
    <div class="back-header">
      <button class="back-btn" @click="$router.back()">
        <ArrowLeft :size="16" />
      </button>
      <div style="flex:1;min-width:0">
        <h1 class="geo-page-title">{{ topic?.title || 'Mavzu' }}</h1>
        <p class="geo-page-sub">To'liq mavzu matni · {{ pages.length }} bet</p>
      </div>
    </div>

    <div v-if="loading" class="geo-skeleton" style="height:420px"></div>

    <template v-else-if="topic">
      <article class="reader geo-card">
        <header class="reader-head">
          <div class="badge"><BookOpen :size="13" /> Mavzu matni</div>
          <h2>{{ topic.title }}</h2>
          <div class="page-pill">{{ pageIdx + 1 }} / {{ pages.length }}</div>
        </header>

        <div class="reader-body">
          <p v-for="(para, i) in pages[pageIdx]" :key="i" class="para">{{ para }}</p>
        </div>

        <nav class="reader-nav">
          <button class="nav-btn" :disabled="pageIdx === 0" @click="prev">
            <ChevronLeft :size="16" /> Oldingi bet
          </button>
          <div class="dots">
            <button v-for="(_, i) in pages" :key="i"
              class="dot" :class="{ 'dot--on': i === pageIdx }"
              @click="pageIdx = i; scrollTop()"></button>
          </div>
          <button class="nav-btn nav-btn--primary"
            v-if="pageIdx < pages.length - 1" @click="next">
            Keyingi bet <ChevronRight :size="16" />
          </button>
          <RouterLink v-else :to="`/topics/${topic.id}/test?mode=open`"
            class="nav-btn nav-btn--primary">
            Testga o'tish <ChevronRight :size="16" />
          </RouterLink>
        </nav>
      </article>

      <div class="bottom-actions">
        <RouterLink :to="`/topics/${topic.id}/test?mode=open`" class="bottom-card">
          <ListChecks :size="20" />
          <div>
            <p class="ba-title">Ochiq test</p>
            <p class="ba-sub">15 ta ABC variantli savol</p>
          </div>
          <ChevronRight :size="16" />
        </RouterLink>
        <RouterLink :to="`/topics/${topic.id}/test?mode=closed`" class="bottom-card">
          <PenLine :size="20" />
          <div>
            <p class="ba-title">Yopiq test</p>
            <p class="ba-sub">15 ta yozma savol</p>
          </div>
          <ChevronRight :size="16" />
        </RouterLink>
      </div>
    </template>

    <div v-else class="geo-card" style="padding:48px;text-align:center">
      <p>Mavzu topilmadi</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, ListChecks, PenLine } from "lucide-vue-next";
import { api } from "@shared/composables/api";

const route = useRoute();
const topicId = Number(route.params.id);
const topic = ref(null);
const loading = ref(true);
const pageIdx = ref(0);

const PARAS_PER_PAGE = 4;

const paragraphs = computed(() => {
  const txt = (topic.value?.content || "").replace(/\r/g, "\n").trim();
  if (!txt) return [];
  // Split by blank lines OR sentence groups
  let parts = txt.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length < 4) {
    // Group sentences into chunks of ~2-3 each
    const sentences = txt.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
    parts = [];
    for (let i = 0; i < sentences.length; i += 2) {
      parts.push(sentences.slice(i, i + 2).join(" "));
    }
  }
  return parts.filter(p => p.length > 8);
});

const pages = computed(() => {
  const ps = paragraphs.value;
  if (!ps.length) return [["Bu mavzu uchun matn hali kiritilmagan."]];
  const out = [];
  for (let i = 0; i < ps.length; i += PARAS_PER_PAGE) {
    out.push(ps.slice(i, i + PARAS_PER_PAGE));
  }
  return out;
});

function scrollTop() { window.scrollTo({ top: 0, behavior: "smooth" }); }
function next() { if (pageIdx.value < pages.value.length - 1) { pageIdx.value++; scrollTop(); } }
function prev() { if (pageIdx.value > 0) { pageIdx.value--; scrollTop(); } }

onMounted(async () => {
  try {
    // Find topic by traversing lessons (no direct endpoint)
    const lessons = await api("/api/lessons");
    for (const l of lessons) {
      const det = await api(`/api/lessons/${l.id}`);
      const t = (det.topics || []).find(x => x.id === topicId);
      if (t) { topic.value = t; break; }
    }
  } catch {}
  loading.value = false;
});
</script>

<style scoped>
.back-header { display:flex;align-items:center;gap:14px;margin-bottom:20px; }
.back-btn { width:36px;height:36px;border-radius:10px;background:hsl(var(--card));border:1.5px solid hsl(var(--border));display:flex;align-items:center;justify-content:center;color:hsl(var(--fg));cursor:pointer; }
.back-btn:hover { background:hsl(var(--muted)); }

.reader { padding:0; overflow:hidden; }
.reader-head {
  padding:22px 26px 14px;
  border-bottom:1px solid hsl(var(--border));
  background:linear-gradient(135deg, hsl(var(--primary)/.08), transparent);
  position:relative;
}
.badge { display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:hsl(var(--primary));text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px; }
.reader-head h2 { font-size:22px;font-weight:800;line-height:1.3;padding-right:80px; }
.page-pill { position:absolute;top:22px;right:26px;background:hsl(var(--primary));color:#fff;font-size:12px;font-weight:700;padding:5px 12px;border-radius:99px; }

.reader-body { padding:26px;display:flex;flex-direction:column;gap:14px; }
.para { font-size:15.5px;line-height:1.85;color:hsl(var(--fg));text-indent:1.4em; }
.para:first-letter { font-weight:600; }

.reader-nav { display:flex;align-items:center;gap:10px;padding:16px 22px;border-top:1px solid hsl(var(--border));background:hsl(var(--muted)/.4);flex-wrap:wrap; }
.nav-btn { display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;font-size:13.5px;font-weight:600;border:1.5px solid hsl(var(--border));background:hsl(var(--card));color:hsl(var(--fg));cursor:pointer;font-family:inherit;text-decoration:none;transition:all .15s; }
.nav-btn:hover:not(:disabled) { border-color:hsl(var(--primary)/.5);color:hsl(var(--primary)); }
.nav-btn:disabled { opacity:.4;cursor:not-allowed; }
.nav-btn--primary { background:hsl(var(--primary));color:#fff;border-color:hsl(var(--primary));margin-left:auto; }
.nav-btn--primary:hover { background:hsl(var(--primary)/.9);color:#fff; }
.dots { display:flex;gap:6px;flex:1;justify-content:center;flex-wrap:wrap; }
.dot { width:9px;height:9px;border-radius:50%;border:0;background:hsl(var(--border));cursor:pointer;padding:0;transition:all .15s; }
.dot--on { background:hsl(var(--primary));transform:scale(1.4); }

.bottom-actions { display:grid;gap:10px;grid-template-columns:1fr;margin-top:16px; }
@media (min-width:540px) { .bottom-actions { grid-template-columns:1fr 1fr; } }
.bottom-card { display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;background:hsl(var(--card));border:1.5px solid hsl(var(--border));text-decoration:none;color:hsl(var(--fg));transition:all .15s; }
.bottom-card:hover { border-color:hsl(var(--primary)/.5);transform:translateY(-1px);box-shadow:0 8px 20px hsl(var(--primary)/.1); }
.bottom-card > svg:first-child { color:hsl(var(--primary));flex-shrink:0; }
.bottom-card > div { flex:1;min-width:0; }
.ba-title { font-size:14px;font-weight:700; }
.ba-sub { font-size:12px;color:hsl(var(--muted-fg)); }
</style>
