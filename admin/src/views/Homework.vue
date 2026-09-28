<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Uy ishlari</h1>
        <p class="geo-page-sub">O'quvchilarga vazifa bering va javoblarini baholang</p>
      </div>
      <button @click="openCreate" class="geo-btn-primary">
        <Plus :size="16" /> Uy ishi berish
      </button>
    </div>

    <!-- Statistika -->
    <div class="stats-grid">
      <div v-for="s in stats" :key="s.label" class="stat-card geo-card">
        <div class="stat-icon" :style="`background:${s.bg}`">
          <component :is="s.icon" :size="18" :style="`color:${s.color}`" />
        </div>
        <div>
          <p class="stat-value">{{ loading ? '—' : s.value }}</p>
          <p class="stat-label">{{ s.label }}</p>
        </div>
      </div>
    </div>

    <!-- Sinf filtri -->
    <div class="grade-tabs">
      <button class="grade-tab" :class="{ 'grade-tab--on': activeGrade === 0 }" @click="selectGrade(0)">
        Barcha sinflar
      </button>
      <button v-for="g in grades.open" :key="g" class="grade-tab"
        :class="{ 'grade-tab--on': activeGrade === g }" @click="selectGrade(g)">
        {{ g }}-sinf
      </button>
    </div>

    <!-- Ro'yxat -->
    <div v-if="loading" class="hw-list">
      <div v-for="i in 3" :key="i" class="geo-skeleton" style="height:118px"></div>
    </div>

    <div v-else-if="!items.length" class="geo-card empty-card">
      <div class="empty-icon-wrap"><ClipboardCheck :size="28" style="color:hsl(var(--muted-fg));opacity:.5" /></div>
      <p class="empty-title">Hali uy ishi yo'q</p>
      <p class="empty-sub">Birinchi vazifani yarating — o'quvchilar panelida darrov ko'rinadi</p>
    </div>

    <div v-else class="hw-list">
      <div v-for="hw in items" :key="hw.id" class="hw-card geo-card geo-card-hover" @click="openDetail(hw)">
        <div class="hw-main">
          <div class="hw-head">
            <h3 class="hw-title">{{ hw.title }}</h3>
            <span class="geo-badge geo-badge-primary">{{ hw.className || `${hw.grade}-sinf` }}</span>
            <span v-if="hw.group" class="geo-badge geo-badge-success">
              <Users :size="11" /> {{ hw.group }}-guruh
            </span>
            <span v-else-if="hw.studentIds?.length" class="geo-badge geo-badge-muted">
              <Users :size="11" /> {{ hw.studentIds.length }} ta tanlangan
            </span>
            <span v-if="hw.section && hw.section !== 'all'" class="geo-badge geo-badge-muted">{{ sectionLabel(hw.section) }}</span>
            <span v-if="hw.overdue" class="geo-badge geo-badge-warning">Muddati tugagan</span>
          </div>
          <p v-if="hw.description" class="hw-desc line-clamp-2">{{ hw.description }}</p>
          <div class="hw-meta">
            <span><CalendarClock :size="13" /> {{ hw.dueDate ? fmtDue(hw.dueDate) : 'Muddatsiz' }}</span>
            <span v-if="hw.lessonTitle"><BookOpen :size="13" /> {{ hw.lessonTitle }}</span>
            <span><Send :size="13" /> {{ hw.submittedCount }}/{{ hw.assignedCount }} topshirdi</span>
            <span v-if="hw.avgGrade !== null"><Star :size="13" /> o'rtacha {{ hw.avgGrade }}</span>
          </div>
        </div>
        <div class="hw-side">
          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill" :style="`width:${pct(hw.submittedCount, hw.assignedCount)}%`"></div>
            </div>
            <span class="progress-text">{{ pct(hw.submittedCount, hw.assignedCount) }}%</span>
          </div>
          <div class="hw-actions">
            <span v-if="hw.submittedCount > hw.gradedCount" class="geo-badge geo-badge-warning">
              {{ hw.submittedCount - hw.gradedCount }} ta baholanmagan
            </span>
            <button class="icon-btn" title="O'chirish" @click.stop="removeHomework(hw)">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Yaratish modali ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreate" class="modal-back" @click.self="showCreate = false">
          <div class="modal-box geo-card">
            <div class="modal-head">
              <h2>Uy ishi berish</h2>
              <button @click="showCreate = false" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </div>

            <div class="form-stack">
              <div class="form-field">
                <label>Sarlavha *</label>
                <input v-model="form.title" class="geo-input" placeholder="Masalan: Materiklar bo'yicha jadval to'ldirish" />
              </div>

              <div class="form-field">
                <label>Vazifa matni</label>
                <textarea v-model="form.description" class="geo-input" rows="4"
                  placeholder="O'quvchi nima qilishi kerakligini yozing..."></textarea>
              </div>

              <div class="form-field">
                <label>Qaysi sinflar uchun</label>
                <SectionPicker :model-value="form.section" @update:model-value="setFormSection" />
              </div>

              <div class="form-field">
                <label>Sinf *</label>
                <div class="grade-grid">
                  <button v-for="g in grades.open" :key="g" type="button" class="grade-btn"
                    :class="{ 'grade-btn--on': form.grade === g }" @click="setFormGrade(g)">{{ g }}</button>
                </div>
                <div class="class-chips">
                  <button type="button" class="class-chip" :class="{ 'class-chip--on': !form.className }"
                    @click="setFormClass('')">Butun {{ form.grade }}-sinf</button>
                  <button v-for="c in classesForGrade" :key="c.name" type="button" class="class-chip"
                    :class="{ 'class-chip--on': form.className === c.name }" @click="setFormClass(c.name)">
                    {{ c.name }}
                  </button>
                </div>
              </div>

              <div class="form-row">
                <div class="form-field">
                  <label>Topshirish muddati</label>
                  <input v-model="form.dueDate" type="datetime-local" class="geo-input" />
                </div>
                <div class="form-field">
                  <label>Dars (ixtiyoriy)</label>
                  <select v-model="form.lessonId" class="geo-input">
                    <option value="">— tanlanmagan —</option>
                    <option v-for="l in lessonsForGrade" :key="l.id" :value="l.id">{{ l.title }}</option>
                  </select>
                </div>
              </div>

              <div class="form-field">
                <label>Havola (ixtiyoriy)</label>
                <input v-model="form.attachmentUrl" class="geo-input" placeholder="https://... (fayl yoki manba)" />
              </div>

              <div class="form-field">
                <label>Kimga beriladi</label>
                <div class="target-tabs">
                  <button v-for="t in targetTabs" :key="t.key" type="button" class="target-tab"
                    :class="{ 'target-tab--on': target === t.key }" @click="target = t.key">
                    {{ t.label }}<em v-if="t.count !== null">{{ t.count }}</em>
                  </button>
                </div>

                <div v-if="target === 'pick'" class="student-picker">
                  <p v-if="!students.length" class="picker-empty">Bu sinfda o'quvchi yo'q</p>
                  <label v-for="st in students" :key="st.id" class="picker-row">
                    <input type="checkbox" :value="st.id" v-model="form.studentIds" />
                    <span class="picker-av">{{ st.name.charAt(0).toUpperCase() }}</span>
                    <span class="picker-name">{{ st.name }}</span>
                    <span class="picker-group">{{ st.group }}-guruh</span>
                    <span class="picker-user">{{ st.className || '@' + st.username }}</span>
                  </label>
                </div>
                <template v-else>
                  <p class="picker-hint">{{ targetHint }}</p>
                  <div v-if="targetStudents.length" class="group-preview">
                    <span v-for="st in targetStudents" :key="st.id" class="group-name">
                      {{ st.name }}<em v-if="!form.className && st.className"> · {{ st.className }}</em>
                    </span>
                  </div>
                </template>
              </div>

              <p v-if="createError" class="error-msg">{{ createError }}</p>

              <div class="modal-actions">
                <button @click="showCreate = false" class="geo-btn-outline flex-1">Bekor</button>
                <button @click="createHomework" :disabled="!form.title.trim() || creating" class="geo-btn-primary flex-1">
                  <Loader2 v-if="creating" :size="15" class="animate-spin" />
                  {{ creating ? '...' : 'Berish' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Javoblar modali ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="detail" class="modal-back" @click.self="detail = null">
          <div class="modal-box modal-box--wide geo-card">
            <div class="modal-head">
              <div>
                <h2>{{ detail.title }}</h2>
                <p class="detail-sub">
                  {{ detail.className || `${detail.grade}-sinf` }}<template v-if="detail.group"> · {{ detail.group }}-guruh</template> ·
                  {{ detail.dueDate ? fmtDue(detail.dueDate) : 'muddatsiz' }} ·
                  {{ submittedCount }}/{{ detail.students.length }} topshirdi
                </p>
              </div>
              <button @click="detail = null" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </div>

            <p v-if="detail.description" class="detail-desc">{{ detail.description }}</p>
            <a v-if="detail.attachmentUrl" :href="detail.attachmentUrl" target="_blank" rel="noopener" class="detail-link">
              <LinkIcon :size="13" /> {{ detail.attachmentUrl }}
            </a>

            <div v-if="!detail.students.length" class="empty-state">
              <Users :size="34" style="opacity:.3" />
              <p class="empty-title">O'quvchi yo'q</p>
              <p class="empty-sub">Bu sinfda ro'yxatdan o'tgan o'quvchi topilmadi</p>
            </div>

            <div v-else class="sub-list">
              <div v-for="st in detail.students" :key="st.userId" class="sub-item">
                <div class="sub-row" @click="toggleOpen(st.userId)">
                  <span class="student-av">{{ st.name.charAt(0).toUpperCase() }}</span>
                  <div class="sub-info">
                    <p class="student-name">{{ st.name }}</p>
                    <p class="sub-time">
                      {{ st.submittedAt ? fmtDate(st.submittedAt) : 'topshirmagan' }}
                      <span v-if="st.late" class="late-tag">kech</span>
                    </p>
                  </div>
                  <span class="geo-badge" :class="statusClass(st.status)">{{ statusLabel(st.status) }}</span>
                  <span v-if="st.gradeValue !== null" class="grade-pill-big">{{ st.gradeValue }}</span>
                  <ChevronDown :size="16" class="chev" :class="{ 'chev--open': openIds.has(st.userId) }" />
                </div>

                <div v-if="openIds.has(st.userId)" class="sub-body">
                  <template v-if="st.submissionId">
                    <p v-if="st.text" class="answer-text">{{ st.text }}</p>
                    <a v-if="st.attachmentUrl" :href="st.attachmentUrl" target="_blank" rel="noopener" class="detail-link">
                      <LinkIcon :size="13" /> {{ st.attachmentUrl }}
                    </a>
                    <div class="grade-form">
                      <input v-model="gradeForms[st.userId].grade" type="number" min="0" max="100"
                        class="geo-input grade-input" placeholder="Baho (0-100)" />
                      <input v-model="gradeForms[st.userId].feedback" class="geo-input"
                        placeholder="Izoh (ixtiyoriy)" />
                      <button class="geo-btn-primary" :disabled="gradingId === st.submissionId"
                        @click="gradeSubmission(st)">
                        <Loader2 v-if="gradingId === st.submissionId" :size="15" class="animate-spin" />
                        {{ st.gradeValue !== null ? 'Yangilash' : 'Baholash' }}
                      </button>
                    </div>
                    <p v-if="st.feedback" class="feedback-note">Izoh: {{ st.feedback }}</p>
                  </template>
                  <p v-else class="no-answer">O'quvchi hali javob yubormagan.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import {
  Plus, X, Trash2, Loader2, ClipboardCheck, Users, CalendarClock, BookOpen,
  Send, Star, ChevronDown, Link as LinkIcon,
} from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useGradesStore } from "@shared/stores/grades";
import { useSettingsStore } from "@shared/stores/settings";
import SectionPicker from "@shared/components/SectionPicker.vue";
import { sectionLabel } from "@shared/sections";

const settings = useSettingsStore();
const grades = useGradesStore();

const items = ref([]);
const lessons = ref([]);
const students = ref([]);
const loading = ref(true);
const activeGrade = ref(0);

const showCreate = ref(false);
const creating = ref(false);
const createError = ref("");
// "all" — barcha guruhlar, "g1"/"g2" — sinfning yarmi, "pick" — qo'lda tanlash
const target = ref("all");
const classNames = ref([]);
const form = ref(emptyForm());

const detail = ref(null);
const openIds = ref(new Set());
const gradeForms = reactive({});
const gradingId = ref(null);

function emptyForm() {
  return {
    title: "", description: "", grade: grades.fallback(7), className: "", section: settings.section,
    dueDate: "", lessonId: "", attachmentUrl: "", studentIds: [],
  };
}

const stats = computed(() => {
  const list = items.value;
  const submitted = list.reduce((s, h) => s + h.submittedCount, 0);
  const graded = list.reduce((s, h) => s + h.gradedCount, 0);
  const withAvg = list.filter(h => h.avgGrade !== null);
  return [
    { label: "Uy ishlari",      value: list.length, icon: ClipboardCheck, color: "hsl(174 65% 30%)", bg: "hsl(174 65% 30%/0.1)" },
    { label: "Topshirilgan",    value: submitted,   icon: Send,           color: "#8b5cf6", bg: "#8b5cf620" },
    { label: "Baholanmagan",    value: submitted - graded, icon: CalendarClock, color: "#f59e0b", bg: "#f59e0b18" },
    { label: "O'rtacha baho",   value: withAvg.length ? Math.round(withAvg.reduce((s, h) => s + h.avgGrade, 0) / withAvg.length) : "—",
      icon: Star, color: "#10b981", bg: "#10b98118" },
  ];
});

const lessonsForGrade = computed(() =>
  lessons.value.filter(l => Number(l.grade) === Number(form.value.grade))
);

const classesForGrade = computed(() =>
  classNames.value.filter(c => c.grade === form.value.grade
    && (form.value.section === "all" || !c.section || c.section === form.value.section)));

const groupOf = (n) => students.value.filter(s => s.group === n);
const targetTabs = computed(() => [
  { key: "all", label: "Barcha guruhlar", count: students.value.length },
  { key: "g1", label: "1-guruh", count: groupOf(1).length },
  { key: "g2", label: "2-guruh", count: groupOf(2).length },
  { key: "pick", label: "Tanlash", count: null },
]);
const targetStudents = computed(() =>
  target.value === "g1" ? groupOf(1) : target.value === "g2" ? groupOf(2) : students.value);
const targetHint = computed(() => {
  const who = form.value.className || `${form.value.grade}-sinf`;
  if (target.value === "all") return `${who}ning barcha o'quvchilariga (ikkala guruh) yuboriladi`;
  const n = target.value === "g1" ? 1 : 2;
  return `${who} o'quvchilarining ${n === 1 ? 'birinchi' : 'ikkinchi'} yarmiga (50%) yuboriladi — `
    + `har bir sinf alifbo tartibida ikki guruhga bo'linadi`;
});

const submittedCount = computed(() =>
  detail.value ? detail.value.students.filter(s => s.submissionId).length : 0
);

function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }

async function load(silent = false) {
  if (silent !== true) loading.value = true;
  const qs = activeGrade.value ? `?grade=${activeGrade.value}` : "";
  try { items.value = await api(`/api/homework${qs}`); } catch { items.value = []; }
  loading.value = false;
}

async function loadLessons() {
  try { lessons.value = await api("/api/lessons"); } catch {}
}

async function loadStudents() {
  const f = form.value;
  const qs = new URLSearchParams({ grade: f.grade, section: f.section });
  if (f.className) qs.set("className", f.className);
  try { students.value = await api(`/api/homework/students?${qs}`); } catch { students.value = []; }
}

async function loadClassNames() {
  try { classNames.value = await api("/api/classes/names"); } catch {}
}

onMounted(() => { load(); loadLessons(); loadClassNames(); });
useLive(["homework", "homework_submissions", "users"], () => Promise.all([load(true), refreshDetail()]));
useLive(["lessons"], loadLessons);
useLive(["classes", "users"], loadClassNames);

/** Ochiq uy ishi oynasini yangilaydi (yozilayotgan baholarga tegmaydi). */
async function refreshDetail() {
  if (!detail.value) return;
  try {
    const data = await api(`/api/homework/${detail.value.id}`);
    if (detail.value?.id !== data.id) return;
    for (const st of data.students) {
      gradeForms[st.userId] ??= { grade: st.gradeValue ?? "", feedback: st.feedback ?? "" };
    }
    detail.value = data;
  } catch {}
}

function selectGrade(g) {
  if (activeGrade.value === g) return;
  activeGrade.value = g;
  load();
}

function openCreate() {
  form.value = emptyForm();
  if (activeGrade.value) form.value.grade = activeGrade.value;
  target.value = "all";
  students.value = [];
  createError.value = "";
  showCreate.value = true;
  loadStudents();
}

function setFormGrade(g) {
  form.value.grade = g;
  form.value.className = "";
  form.value.lessonId = "";
  form.value.studentIds = [];
  loadStudents();
}

function setFormClass(name) {
  form.value.className = name;
  form.value.studentIds = [];
  loadStudents();
}

function setFormSection(section) {
  form.value.section = section;
  if (form.value.className && !classesForGrade.value.some(c => c.name === form.value.className)) {
    form.value.className = "";
  }
  form.value.studentIds = [];
  loadStudents();
}

async function createHomework() {
  creating.value = true;
  createError.value = "";
  try {
    await api("/api/homework", {
      method: "POST",
      body: JSON.stringify({
        title: form.value.title,
        description: form.value.description,
        grade: form.value.grade,
        className: form.value.className || null,
        section: form.value.section,
        group: target.value === "g1" ? 1 : target.value === "g2" ? 2 : null,
        dueDate: form.value.dueDate || null,
        lessonId: form.value.lessonId || null,
        attachmentUrl: form.value.attachmentUrl,
        studentIds: target.value === "pick" ? form.value.studentIds : [],
      }),
    });
    showCreate.value = false;
    await load();
  } catch (e) {
    createError.value = e.data?.error || "Saqlashda xato";
  }
  creating.value = false;
}

async function removeHomework(hw) {
  if (!confirm(`"${hw.title}" uy ishi va unga kelgan javoblar o'chirilsinmi?`)) return;
  try { await api(`/api/homework/${hw.id}`, { method: "DELETE" }); await load(); } catch {}
}

async function openDetail(hw) {
  try {
    const data = await api(`/api/homework/${hw.id}`);
    for (const st of data.students) {
      gradeForms[st.userId] = {
        grade: st.gradeValue ?? "",
        feedback: st.feedback ?? "",
      };
    }
    openIds.value = new Set();
    detail.value = data;
  } catch {}
}

function toggleOpen(userId) {
  const next = new Set(openIds.value);
  next.has(userId) ? next.delete(userId) : next.add(userId);
  openIds.value = next;
}

async function gradeSubmission(st) {
  const f = gradeForms[st.userId];
  const value = Number(f.grade);
  if (!Number.isFinite(value) || value < 0 || value > 100) return;
  gradingId.value = st.submissionId;
  try {
    await api(`/api/homework/submissions/${st.submissionId}/grade`, {
      method: "PUT",
      body: JSON.stringify({ grade: value, feedback: f.feedback }),
    });
    const id = detail.value.id;
    const keepOpen = new Set(openIds.value);
    await openDetail({ id });
    openIds.value = keepOpen;
    await load();
  } catch {}
  gradingId.value = null;
}

const STATUS = {
  pending:   { label: "Kutilmoqda",   cls: "geo-badge-muted" },
  overdue:   { label: "Topshirmagan", cls: "geo-badge-warning" },
  submitted: { label: "Topshirdi",    cls: "geo-badge-primary" },
  graded:    { label: "Baholandi",    cls: "geo-badge-success" },
};
function statusLabel(s) { return STATUS[s]?.label ?? s; }
function statusClass(s) { return STATUS[s]?.cls ?? "geo-badge-muted"; }

function fmtDue(iso) {
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  return today ? `Bugun ${time}` : `${d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" })} ${time}`;
}
</script>

<style scoped>
.page-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px; }

.stats-grid { display:grid;gap:12px;margin-bottom:20px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }
.stat-card { display:flex;align-items:center;gap:12px;padding:16px; }
.stat-icon { width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.stat-value { font-size:1.35rem;font-weight:800;line-height:1.1; }
.stat-label { font-size:12px;color:hsl(var(--muted-fg));margin-top:2px; }

.grade-tabs { display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px; }
.grade-tab { padding:6px 13px;border-radius:99px;border:1px solid hsl(var(--border));background:hsl(var(--card));font-family:inherit;font-size:12.5px;font-weight:600;color:hsl(var(--fg));cursor:pointer;transition:all .15s; }
.grade-tab:hover { border-color:hsl(var(--primary)/.5);background:hsl(var(--primary)/0.05); }
.grade-tab--on { background:hsl(var(--primary));border-color:hsl(var(--primary));color:#fff; }

/* Ro'yxat */
.hw-list { display:flex;flex-direction:column;gap:12px; }
.hw-card { display:flex;gap:16px;padding:16px 18px;cursor:pointer;align-items:flex-start; }
.hw-main { flex:1;min-width:0; }
.hw-head { display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px; }
.hw-title { font-size:15px;font-weight:700;letter-spacing:-.01em; }
.hw-desc { font-size:13px;color:hsl(var(--muted-fg));margin-bottom:8px; }
.hw-meta { display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:hsl(var(--muted-fg)); }
.hw-meta span { display:inline-flex;align-items:center;gap:5px; }

.hw-side { display:flex;flex-direction:column;align-items:flex-end;gap:10px;min-width:150px; }
.progress-wrap { display:flex;align-items:center;gap:8px;width:100%; }
.progress-bar { flex:1;height:6px;border-radius:99px;background:hsl(var(--muted));overflow:hidden; }
.progress-fill { height:100%;border-radius:99px;background:hsl(var(--primary));transition:width .3s; }
.progress-text { font-size:11.5px;font-weight:700;color:hsl(var(--muted-fg));min-width:32px;text-align:right; }
.hw-actions { display:flex;align-items:center;gap:8px; }
.icon-btn { width:30px;height:30px;border-radius:9px;border:1px solid hsl(var(--border));background:transparent;color:hsl(var(--muted-fg));cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s; }
.icon-btn:hover { background:hsl(var(--destructive)/.1);border-color:hsl(var(--destructive)/.4);color:hsl(var(--destructive)); }

/* Modal */
.modal-back { position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45);backdrop-filter:blur(4px); }
.modal-box { width:100%;max-width:480px;padding:24px;max-height:88vh;overflow-y:auto; }
.modal-box--wide { max-width:720px; }
.modal-head { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px; }
.modal-head h2 { font-size:17px;font-weight:700; }
.detail-sub { font-size:12.5px;color:hsl(var(--muted-fg));margin-top:3px; }
.detail-desc { font-size:13.5px;color:hsl(var(--fg));background:hsl(var(--muted)/.5);border-radius:12px;padding:12px 14px;margin-bottom:10px;white-space:pre-wrap; }
.detail-link { display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:hsl(var(--primary));text-decoration:none;word-break:break-all;margin-bottom:12px; }
.detail-link:hover { text-decoration:underline; }

.form-stack { display:flex;flex-direction:column;gap:16px; }
.form-field { display:flex;flex-direction:column;gap:6px; }
.form-field label { font-size:13px;font-weight:600; }
.form-row { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
.grade-grid { display:grid;grid-template-columns:repeat(6,1fr);gap:6px; }
.grade-btn { padding:9px 4px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;border:1.5px solid hsl(var(--border));background:transparent;color:hsl(var(--muted-fg));transition:all .15s;font-family:inherit; }
.grade-btn:hover { border-color:hsl(var(--primary)/.5);color:hsl(var(--primary)); }
.grade-btn--on { background:hsl(var(--primary));color:white;border-color:hsl(var(--primary)); }
.modal-actions { display:flex;gap:10px;padding-top:4px; }
.flex-1 { flex:1; }
.error-msg { font-size:12.5px;color:hsl(var(--destructive));font-weight:500; }

.target-tabs { display:flex;flex-wrap:wrap;gap:6px; }
.target-tab { flex:1;padding:8px;border-radius:10px;border:1.5px solid hsl(var(--border));background:transparent;color:hsl(var(--muted-fg));font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s; }
.target-tab--on { background:hsl(var(--primary));border-color:hsl(var(--primary));color:#fff; }
.picker-hint { font-size:12px;color:hsl(var(--muted-fg));margin-top:2px; }
.student-picker { max-height:190px;overflow-y:auto;border:1px solid hsl(var(--border));border-radius:12px;padding:6px;margin-top:4px; }
.picker-empty { font-size:12.5px;color:hsl(var(--muted-fg));padding:10px;text-align:center; }
.picker-row { display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:9px;cursor:pointer;font-size:13px; }
.picker-row:hover { background:hsl(var(--muted)/.6); }
.picker-av { width:24px;height:24px;border-radius:7px;background:hsl(var(--primary)/.15);color:hsl(var(--primary));font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.picker-name { font-weight:600;flex:1; }
.picker-user { font-size:11.5px;color:hsl(var(--muted-fg)); }
.picker-group { font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:99px;background:hsl(var(--muted));color:hsl(var(--muted-fg)); }
.target-tab em { font-style:normal;opacity:.7;margin-left:5px;font-size:11.5px; }
.class-chips { display:flex;flex-wrap:wrap;gap:6px;margin-top:6px; }
.class-chip { padding:5px 12px;border-radius:99px;border:1px solid hsl(var(--border));background:transparent;font-family:inherit;font-size:12px;font-weight:600;color:hsl(var(--muted-fg));cursor:pointer;transition:all .15s; }
.class-chip:hover { border-color:hsl(var(--primary)/.5);color:hsl(var(--primary)); }
.class-chip--on { background:hsl(var(--primary)/.1);border-color:hsl(var(--primary));color:hsl(var(--primary)); }
.group-preview { display:flex;flex-wrap:wrap;gap:5px;max-height:120px;overflow-y:auto;margin-top:4px; }
.group-name { font-size:11.5px;padding:3px 9px;border-radius:8px;background:hsl(var(--muted)/.7); }
.group-name em { font-style:normal;color:hsl(var(--muted-fg)); }

/* Javoblar */
.sub-list { display:flex;flex-direction:column;gap:8px; }
.sub-item { border:1px solid hsl(var(--border));border-radius:14px;overflow:hidden; }
.sub-row { display:flex;align-items:center;gap:10px;padding:11px 13px;cursor:pointer;transition:background .15s; }
.sub-row:hover { background:hsl(var(--muted)/.5); }
.student-av { width:30px;height:30px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,hsl(var(--primary)),hsl(172 70% 38%));color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center; }
.sub-info { flex:1;min-width:0; }
.student-name { font-size:13.5px;font-weight:600; }
.sub-time { font-size:11.5px;color:hsl(var(--muted-fg));display:flex;align-items:center;gap:6px; }
.late-tag { color:hsl(var(--destructive));font-weight:700; }
.grade-pill-big { font-size:13px;font-weight:800;color:hsl(var(--primary));min-width:26px;text-align:right; }
.chev { color:hsl(var(--muted-fg));transition:transform .2s;flex-shrink:0; }
.chev--open { transform:rotate(180deg); }

.sub-body { padding:0 13px 13px;border-top:1px solid hsl(var(--border)); }
.answer-text { font-size:13px;line-height:1.65;white-space:pre-wrap;background:hsl(var(--muted)/.5);border-radius:12px;padding:11px 13px;margin:11px 0; }
.no-answer { font-size:12.5px;color:hsl(var(--muted-fg));padding:12px 0 2px; }
.grade-form { display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px; }
.grade-input { width:120px;flex:none; }
.grade-form .geo-input:not(.grade-input) { flex:1;min-width:150px; }
.feedback-note { font-size:12px;color:hsl(var(--muted-fg));margin-top:8px;font-style:italic; }

/* Empty */
.empty-card { text-align:center;padding:60px 24px; }
.empty-icon-wrap { width:60px;height:60px;border-radius:16px;background:hsl(var(--muted));display:flex;align-items:center;justify-content:center;margin:0 auto 12px; }
.empty-title { font-size:15px;font-weight:700;margin-bottom:4px; }
.empty-sub { font-size:13px;color:hsl(var(--muted-fg)); }
.empty-state { display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px 20px;color:hsl(var(--muted-fg));text-align:center; }
.p-1 { padding:4px; }

@media (max-width: 720px) {
  .hw-card { flex-direction:column; }
  .hw-side { align-items:stretch;min-width:0;width:100%; }
  .hw-actions { justify-content:space-between; }
  .form-row { grid-template-columns:1fr; }
}
</style>
