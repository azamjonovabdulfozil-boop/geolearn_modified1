<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Darslar</h1>
        <p class="geo-page-sub">{{ lessons.length }} ta dars mavjud</p>
      </div>
      <button @click="showCreate = true" class="geo-btn-primary">
        <Plus :size="16" /> Dars yaratish
      </button>
    </div>

    <!-- Create Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreate" class="modal-back" @click.self="showCreate = false">
          <div class="modal-box geo-card">
            <div class="modal-head">
              <h2>Yangi dars</h2>
              <button @click="showCreate = false" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </div>
            <div class="form-stack">
              <div class="form-field">
                <label>Sarlavha</label>
                <input v-model="newLesson.title" class="geo-input" placeholder="Dars sarlavhasi" />
              </div>
              <div class="form-field">
                <label>Tavsif (ixtiyoriy)</label>
                <input v-model="newLesson.description" class="geo-input" placeholder="Qisqacha tavsif" />
              </div>
              <div class="form-field">
                <label>Sinf tanlang</label>
                <div class="grade-grid">
                  <button v-for="g in grades.open" :key="g" type="button"
                    @click="newLesson.grade = g" class="grade-btn"
                    :class="{ 'grade-btn--on': newLesson.grade === g }">{{ g }}</button>
                </div>
              </div>
              <div class="form-field">
                <label>Qaysi sinflar uchun</label>
                <SectionPicker v-model="newLesson.section" />
              </div>
              <div class="modal-actions">
                <button @click="showCreate = false" class="geo-btn-outline flex-1">Bekor</button>
                <button @click="createLesson" :disabled="!newLesson.title || creating" class="geo-btn-primary flex-1">
                  <Loader2 v-if="creating" :size="15" class="animate-spin" />
                  {{ creating ? '...' : 'Yaratish' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- PDF Result Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="pdfResult" class="modal-back" @click.self="pdfResult = null">
          <div class="pdf-modal geo-card">

            <!-- Sarlavha -->
            <header class="pdf-head">
              <div class="pdf-head-icon"><CheckCircle2 :size="20" /></div>
              <div class="pdf-head-text">
                <h2>PDF qayta ishlandi</h2>
                <p>{{ pdfResult.lessonTitle }} — mavzular va testlar yaratildi</p>
              </div>
              <button @click="pdfResult = null" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </header>

            <!-- Statistika -->
            <div class="pdf-stats">
              <div v-for="st in pdfStats" :key="st.label" class="pdf-stat">
                <span class="pdf-stat-num">{{ st.value }}</span>
                <span class="pdf-stat-lbl">{{ st.label }}</span>
              </div>
            </div>

            <p v-if="pdfResult.mode" class="pdf-mode">
              🔍 {{ modeLabel }}<span v-if="pdfResult.pages"> · {{ pdfResult.pages }} sahifa</span>
            </p>

            <!-- Mavzular ro'yxati -->
            <div class="pdf-list-head">
              <span>Yaratilgan mavzular</span>
              <span class="pdf-list-count">{{ pdfResult.topics?.length ?? 0 }}</span>
            </div>

            <div class="pdf-list">
              <div v-for="(tp, i) in pdfResult.topics" :key="tp.id" class="pdf-topic">
                <span class="pdf-topic-num">{{ i + 1 }}</span>
                <p class="pdf-topic-title line-clamp-2" :title="tp.title">{{ tp.title }}</p>
                <div class="pdf-topic-tags">
                  <span class="geo-badge geo-badge-primary">{{ tp.testsCount }} variantli</span>
                  <span class="geo-badge geo-badge-muted">{{ tp.closedCount }} yozma</span>
                </div>
              </div>
            </div>

            <!-- Pastki tugmalar -->
            <footer class="pdf-foot">
              <button @click="pdfResult = null" class="geo-btn-outline flex-1">Yopish</button>
              <RouterLink :to="`/lessons/${pdfResult.lessonId}/topics`" class="geo-btn-primary flex-1"
                @click="pdfResult = null">
                <FileText :size="15" /> Mavzularni ko'rish
              </RouterLink>
            </footer>

          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="geo-skeleton" style="height:88px"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="!lessons.length" class="geo-card empty-card">
      <div class="empty-icon-wrap">
        <BookOpen :size="30" style="color:hsl(var(--muted-fg));opacity:.5" />
      </div>
      <p class="empty-title">Hali darslar yo'q</p>
      <p class="empty-sub">Birinchi darsni yarating</p>
    </div>

    <!-- List -->
    <div v-else class="lesson-list">
      <div v-for="lesson in lessons" :key="lesson.id" class="lesson-card geo-card">
        <div class="lesson-icon">
          <BookOpen :size="20" style="color:hsl(var(--primary))" />
        </div>
        <div class="lesson-body">
          <div class="lesson-title-row">
            <h3>{{ lesson.title }}</h3>
            <span class="geo-badge geo-badge-primary">{{ lesson.grade }}-sinf</span>
            <span v-if="lesson.section && lesson.section !== 'all'" class="geo-badge geo-badge-muted">{{ sectionFlag(lesson.section) }} {{ sectionLabel(lesson.section) }}</span>
            <span v-if="lesson.topics?.length" class="geo-badge geo-badge-muted">{{ lesson.topics.length }} mavzu</span>
          </div>
          <p v-if="lesson.description" class="lesson-desc">{{ lesson.description }}</p>
        </div>
        <div class="lesson-actions">
          <RouterLink :to="`/lessons/${lesson.id}/topics`" class="geo-btn-outline btn-sm">
            <FileText :size="14" /> Mavzular
          </RouterLink>
          <label class="geo-btn-outline btn-sm cursor-pointer" :class="{ 'btn-loading': uploadingId === lesson.id }">
            <Loader2 v-if="uploadingId === lesson.id" :size="14" class="animate-spin" />
            <Upload v-else :size="14" />
            PDF
            <input type="file" accept=".pdf,application/pdf" class="hidden" :disabled="uploadingId === lesson.id"
              @change="e => uploadPdf(lesson.id, e)" />
          </label>
          <button @click="deleteLesson(lesson.id)" class="geo-btn-ghost btn-icon text-red-400 hover-red">
            <Trash2 :size="16" />
          </button>
        </div>
        <div v-if="uploadingId === lesson.id" class="upload-bar">
          <Loader2 :size="13" class="animate-spin" />
          PDF o'qilmoqda — mavzular va testlar yaratilmoqda (30-60 sek)...
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { Plus, BookOpen, Trash2, Upload, FileText, Loader2, X, CheckCircle2 } from "lucide-vue-next";
import { api, resolveUrl } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useGradesStore } from "@shared/stores/grades";
import { useSettingsStore } from "@shared/stores/settings";
import SectionPicker from "@shared/components/SectionPicker.vue";
import { sectionLabel, sectionFlag } from "@shared/sections";

const settings = useSettingsStore();
const grades = useGradesStore();

const lessons = ref([]);
const loading = ref(true);
const showCreate = ref(false);
const creating = ref(false);
const uploadingId = ref(null);
const pdfResult = ref(null);
const newLesson = ref(emptyLesson());
function emptyLesson() {
  return { title: "", description: "", grade: grades.fallback(7), section: settings.section };
}

const pdfStats = computed(() => {
  const topics = pdfResult.value?.topics ?? [];
  return [
    { label: "Mavzu",              value: pdfResult.value?.topicsCreated ?? topics.length },
    { label: "Variantli test",     value: topics.reduce((s, t) => s + (t.testsCount || 0), 0) },
    { label: "Yozma savol",        value: topics.reduce((s, t) => s + (t.closedCount || 0), 0) },
  ];
});

const MODE_LABELS = {
  headings: "Mavzular PDF sarlavhalari bo'yicha ajratildi",
  ai: "Mavzular matn tahlili (AI) bo'yicha ajratildi",
  chunks: "PDF da sarlavha topilmadi — matn bo'laklarga bo'lindi",
};
const modeLabel = computed(() => MODE_LABELS[pdfResult.value?.mode] || "");

async function load() {
  try { lessons.value = await api("/api/lessons"); } catch {}
  loading.value = false;
}
onMounted(load);
useLive(["lessons", "topics"], load);

async function createLesson() {
  creating.value = true;
  try {
    await api("/api/lessons", { method: "POST", body: JSON.stringify(newLesson.value) });
    showCreate.value = false;
    newLesson.value = emptyLesson();
    await load();
  } catch {}
  creating.value = false;
}

async function deleteLesson(id) {
  if (!confirm("Darsni o'chirasizmi?")) return;
  try { await api(`/api/lessons/${id}`, { method: "DELETE" }); await load(); } catch {}
}

async function uploadPdf(id, e) {
  const file = e.target.files?.[0];
  if (!file) return;
  uploadingId.value = id;
  const fd = new FormData();
  fd.append("pdf", file);
  const token = localStorage.getItem("geo_token");
  try {
    const resp = await fetch(resolveUrl(`/api/lessons/${id}/pdf`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await resp.json();
    if (data.success) {
      pdfResult.value = {
        ...data,
        lessonId: id,
        lessonTitle: lessons.value.find(l => l.id === id)?.title ?? "Dars",
      };
      await load();
    } else {
      alert(data.error || "PDF qayta ishlashda xato");
    }
  } catch (err) {
    alert("Xato: " + err.message);
  }
  uploadingId.value = null;
  e.target.value = "";
}
</script>

<style scoped>
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
}

/* Modal */
.modal-back {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  background: rgba(0,0,0,.45);
  backdrop-filter: blur(4px);
}
.modal-box { width: 100%; max-width: 440px; padding: 24px; }
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.modal-head h2 { font-size: 17px; font-weight: 700; }
.form-stack { display: flex; flex-direction: column; gap: 16px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field label { font-size: 13px; font-weight: 600; }
.grade-grid { display: grid; grid-template-columns: repeat(6,1fr); gap: 6px; }
.grade-btn {
  padding: 9px 4px; border-radius: 10px;
  font-size: 13.5px; font-weight: 600; cursor: pointer;
  border: 1.5px solid hsl(var(--border));
  background: transparent; color: hsl(var(--muted-fg));
  transition: all .15s; font-family: inherit;
}
.grade-btn:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--primary)); }
.grade-btn--on {
  background: hsl(var(--primary)); color: white;
  border-color: hsl(var(--primary));
  box-shadow: 0 2px 8px hsl(var(--primary)/.3);
}
.modal-actions { display: flex; gap: 10px; padding-top: 4px; }
.flex-1 { flex: 1; }
.hidden { display: none; }
.w-full { width: 100%; }
.mt-4 { margin-top: 16px; }

/* ── PDF natijasi ──
   Modal balandligi ekran bilan cheklangan; faqat mavzular ro'yxati
   aylanadi, sarlavha va tugmalar doim ko'rinib turadi. */
.pdf-modal {
  width: 100%; max-width: 580px;
  max-height: min(680px, 88vh);
  display: flex; flex-direction: column;
  overflow: hidden;
}

.pdf-head {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid hsl(var(--border));
}
.pdf-head-icon {
  width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
  background: hsl(var(--success)/0.13); color: hsl(var(--success));
  display: flex; align-items: center; justify-content: center;
}
.pdf-head-text { flex: 1; min-width: 0; }
.pdf-head-text h2 { font-size: 16.5px; font-weight: 700; letter-spacing: -.01em; }
.pdf-head-text p {
  font-size: 12.5px; color: hsl(var(--muted-fg)); margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.pdf-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 16px 22px 14px; }
.pdf-stat { background: hsl(var(--muted)/0.7); border-radius: 14px; padding: 13px 8px; text-align: center; }
.pdf-stat-num { display: block; font-size: 24px; font-weight: 800; color: hsl(var(--primary)); line-height: 1.15; }
.pdf-stat-lbl { display: block; font-size: 11.5px; color: hsl(var(--muted-fg)); margin-top: 3px; }

.pdf-mode { font-size: 12.5px; color: hsl(var(--muted-fg)); margin: -4px 0 12px; }
.pdf-list-head {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 22px 8px;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: hsl(var(--muted-fg));
}
.pdf-list-count {
  background: hsl(var(--muted)); border-radius: 99px;
  padding: 1px 8px; font-size: 11px; letter-spacing: 0;
}

.pdf-list {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 0 22px 4px;
  display: flex; flex-direction: column; gap: 6px;
}
.pdf-topic {
  display: flex; align-items: flex-start; gap: 11px;
  padding: 10px 12px; border-radius: 12px;
  border: 1px solid hsl(var(--border));
  transition: background .15s, border-color .15s;
}
.pdf-topic:hover { background: hsl(var(--muted)/0.5); border-color: hsl(var(--primary)/.35); }
.pdf-topic-num {
  width: 22px; height: 22px; border-radius: 7px; flex-shrink: 0;
  background: hsl(var(--primary)/0.12); color: hsl(var(--primary));
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  margin-top: 1px;
}
.pdf-topic-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; line-height: 1.45; }
.pdf-topic-tags { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; align-items: flex-end; }

.pdf-foot {
  display: flex; gap: 10px;
  padding: 14px 22px 18px;
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}
.pdf-foot .flex-1 { flex: 1; text-decoration: none; }

@media (max-width: 560px) {
  .pdf-topic { flex-wrap: wrap; }
  .pdf-topic-tags { flex-direction: row; width: 100%; padding-left: 33px; }
}

/* List */
.lesson-list { display: flex; flex-direction: column; gap: 10px; }
.lesson-card {
  padding: 16px 20px;
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
}
.lesson-icon {
  width: 46px; height: 46px; border-radius: 13px;
  background: hsl(var(--primary)/0.1);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.lesson-body { flex: 1; min-width: 0; }
.lesson-title-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 3px;
}
.lesson-title-row h3 { font-size: 15px; font-weight: 700; }
.lesson-desc { font-size: 13px; color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lesson-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
.btn-sm { padding: .4rem .8rem; font-size: 13px; border-radius: .65rem; }
.btn-icon { padding: .45rem .45rem; border-radius: .65rem; }
.hover-red:hover { background: hsl(0 60% 50%/0.1); color: hsl(0 60% 50%); }
.cursor-pointer { cursor: pointer; }
.btn-loading { opacity: .75; pointer-events: none; }
.upload-bar {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding-top: 10px; margin-top: 10px;
  border-top: 1px solid hsl(var(--border));
  font-size: 13px; color: hsl(var(--primary));
}

/* Empty */
.empty-card { text-align: center; padding: 60px 24px; }
.empty-icon-wrap {
  width: 64px; height: 64px; border-radius: 18px;
  background: hsl(var(--muted));
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px;
}   
.empty-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: hsl(var(--muted-fg)); }
.space-y-3 > * + * { margin-top: 10px; }
.p-1 { padding: 4px; }
</style>