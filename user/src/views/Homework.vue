<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Uy ishlari</h1>
        <p class="geo-page-sub">O'qituvchi bergan vazifalar va sizning javoblaringiz</p>
      </div>
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

    <!-- Filtr -->
    <div class="tabs">
      <button v-for="t in TABS" :key="t.key" class="tab"
        :class="{ 'tab--on': activeTab === t.key }" @click="activeTab = t.key">
        {{ t.label }}
        <span v-if="countOf(t.key)" class="tab-count">{{ countOf(t.key) }}</span>
      </button>
    </div>

    <!-- Ro'yxat -->
    <div v-if="loading" class="hw-list">
      <div v-for="i in 3" :key="i" class="geo-skeleton" style="height:110px"></div>
    </div>

    <div v-else-if="!filtered.length" class="geo-card empty-card">
      <div class="empty-icon-wrap"><ClipboardCheck :size="28" style="color:hsl(var(--muted-fg));opacity:.5" /></div>
      <p class="empty-title">{{ items.length ? 'Bu bo\'limda vazifa yo\'q' : 'Hali uy ishi berilmagan' }}</p>
      <p class="empty-sub">O'qituvchi vazifa bergach shu yerda ko'rinadi</p>
    </div>

    <div v-else class="hw-list">
      <div v-for="hw in filtered" :key="hw.id" class="hw-card geo-card geo-card-hover" @click="open(hw)">
        <div class="hw-stripe" :class="`stripe--${hw.status}`"></div>
        <div class="hw-main">
          <div class="hw-head">
            <h3 class="hw-title">{{ hw.title }}</h3>
            <span class="geo-badge" :class="statusClass(hw.status)">{{ statusLabel(hw.status) }}</span>
            <span v-if="hw.submission?.grade != null" class="geo-badge geo-badge-success">
              <Star :size="11" /> {{ hw.submission.grade }} ball
            </span>
          </div>
          <p v-if="hw.description" class="hw-desc line-clamp-2">{{ hw.description }}</p>
          <div class="hw-meta">
            <span :class="{ 'meta-danger': hw.overdue && hw.status !== 'graded' && hw.status !== 'submitted' }">
              <CalendarClock :size="13" /> {{ hw.dueDate ? dueText(hw) : 'Muddatsiz' }}
            </span>
            <span v-if="hw.lessonTitle"><BookOpen :size="13" /> {{ hw.lessonTitle }}</span>
            <span><User :size="13" /> {{ hw.teacherName }}</span>
          </div>
        </div>
        <ChevronRight :size="18" class="hw-chev" />
      </div>
    </div>

    <!-- ── Vazifa modali ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="current" class="modal-back" @click.self="close">
          <div class="modal-box geo-card">
            <div class="modal-head">
              <div>
                <h2>{{ current.title }}</h2>
                <p class="detail-sub">
                  {{ current.dueDate ? dueText(current) : 'Muddatsiz' }} · {{ current.teacherName }}
                </p>
              </div>
              <button @click="close" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </div>

            <p v-if="current.description" class="detail-desc">{{ current.description }}</p>
            <a v-if="current.attachmentUrl" :href="current.attachmentUrl" target="_blank" rel="noopener" class="detail-link">
              <LinkIcon :size="13" /> Qo'shimcha material
            </a>

            <!-- Baholangan -->
            <div v-if="current.status === 'graded'" class="graded-box">
              <div class="graded-head">
                <CheckCircle2 :size="18" style="color:hsl(var(--success))" />
                <div>
                  <p class="graded-title">Baholandi</p>
                  <p class="graded-sub">{{ current.submission.gradedBy || "O'qituvchi" }} tomonidan</p>
                </div>
                <span class="graded-score">{{ current.submission.grade }}<small>/100</small></span>
              </div>
              <p v-if="current.submission.feedback" class="graded-feedback">
                “{{ current.submission.feedback }}”
              </p>
            </div>

            <!-- Javob -->
            <div class="form-stack">
              <div class="form-field">
                <label>{{ current.status === 'graded' ? 'Sizning javobingiz' : 'Javobingiz' }}</label>
                <textarea v-model="answer.text" class="geo-input" rows="7"
                  :disabled="current.status === 'graded'"
                  placeholder="Javobingizni shu yerga yozing..."></textarea>
              </div>

              <div class="form-field">
                <label>Havola (ixtiyoriy)</label>
                <input v-model="answer.attachmentUrl" class="geo-input"
                  :disabled="current.status === 'graded'"
                  placeholder="https://... (Google Drive, rasm va h.k.)" />
              </div>

              <p v-if="submitError" class="error-msg">{{ submitError }}</p>
              <p v-if="savedOk" class="ok-msg"><CheckCircle2 :size="14" /> Javob saqlandi!</p>

              <p v-if="current.status === 'graded'" class="locked-note">
                Ish baholangani uchun javobni o'zgartirib bo'lmaydi.
              </p>
              <p v-else-if="current.overdue" class="late-note">
                Muddat tugagan — javob «kech topshirilgan» deb belgilanadi.
              </p>

              <div class="modal-actions">
                <button @click="close" class="geo-btn-outline flex-1">Yopish</button>
                <button v-if="current.status !== 'graded'" @click="submit"
                  :disabled="(!answer.text.trim() && !answer.attachmentUrl.trim()) || sending"
                  class="geo-btn-primary flex-1">
                  <Loader2 v-if="sending" :size="15" class="animate-spin" />
                  <Send v-else :size="15" />
                  {{ sending ? '...' : (current.submission ? "Javobni yangilash" : "Topshirish") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import {
  ClipboardCheck, CalendarClock, BookOpen, User, ChevronRight, X, Send,
  Loader2, CheckCircle2, Star, Link as LinkIcon,
} from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";

const TABS = [
  { key: "active",    label: "Bajarilishi kerak" },
  { key: "submitted", label: "Topshirilgan" },
  { key: "graded",    label: "Baholangan" },
  { key: "all",       label: "Barchasi" },
];

const items = ref([]);
const loading = ref(true);
const activeTab = ref("active");

const current = ref(null);
const answer = ref({ text: "", attachmentUrl: "" });
const sending = ref(false);
const submitError = ref("");
const savedOk = ref(false);

const stats = computed(() => [
  { label: "Jami vazifalar", value: items.value.length, icon: ClipboardCheck, color: "hsl(174 65% 30%)", bg: "hsl(174 65% 30%/0.1)" },
  { label: "Bajarilmagan",   value: countOf("active"), icon: CalendarClock, color: "#f59e0b", bg: "#f59e0b18" },
  { label: "Topshirilgan",   value: countOf("submitted"), icon: Send, color: "#8b5cf6", bg: "#8b5cf620" },
  { label: "O'rtacha baho",  value: avgGrade.value, icon: Star, color: "#10b981", bg: "#10b98118" },
]);

const avgGrade = computed(() => {
  const graded = items.value.filter(h => h.submission?.grade != null);
  if (!graded.length) return "—";
  return Math.round(graded.reduce((s, h) => s + h.submission.grade, 0) / graded.length);
});

function matches(hw, tab) {
  if (tab === "all") return true;
  if (tab === "active") return hw.status === "pending" || hw.status === "overdue";
  return hw.status === tab;
}

const filtered = computed(() => items.value.filter(hw => matches(hw, activeTab.value)));

function countOf(tab) {
  return items.value.filter(hw => matches(hw, tab)).length;
}

async function load(silent = false) {
  if (silent !== true) loading.value = true;
  try { items.value = await api("/api/homework"); } catch { items.value = []; }
  loading.value = false;
}
onMounted(load);
useLive(["homework", "homework_submissions"], () => load(true));

function open(hw) {
  current.value = hw;
  answer.value = {
    text: hw.submission?.text ?? "",
    attachmentUrl: hw.submission?.attachmentUrl ?? "",
  };
  submitError.value = "";
  savedOk.value = false;
}

function close() { current.value = null; }

async function submit() {
  sending.value = true;
  submitError.value = "";
  savedOk.value = false;
  try {
    await api(`/api/homework/${current.value.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ text: answer.value.text, attachmentUrl: answer.value.attachmentUrl }),
    });
    savedOk.value = true;
    const id = current.value.id;
    await load();
    current.value = items.value.find(h => h.id === id) ?? null;
  } catch (e) {
    submitError.value = e.data?.error || "Yuborishda xato";
  }
  sending.value = false;
}

const STATUS = {
  pending:   { label: "Yangi",        cls: "geo-badge-primary" },
  overdue:   { label: "Muddati o'tdi", cls: "geo-badge-warning" },
  submitted: { label: "Topshirildi",  cls: "geo-badge-muted" },
  graded:    { label: "Baholandi",    cls: "geo-badge-success" },
};
function statusLabel(s) { return STATUS[s]?.label ?? s; }
function statusClass(s) { return STATUS[s]?.cls ?? "geo-badge-muted"; }

/** "3 kun qoldi" / "2 kun kechikdi" ko'rinishidagi muddat matni. */
function dueText(hw) {
  const due = new Date(hw.dueDate);
  const dateStr = due.toLocaleString("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.ceil((due - Date.now()) / 86400000);
  if (hw.status === "graded" || hw.status === "submitted") return dateStr;
  if (diffDays < 0) return `${dateStr} · ${Math.abs(diffDays)} kun kechikdi`;
  if (diffDays === 0) return `${dateStr} · bugun tugaydi`;
  return `${dateStr} · ${diffDays} kun qoldi`;
}
</script>

<style scoped>
.page-header { margin-bottom:24px; }

.stats-grid { display:grid;gap:12px;margin-bottom:20px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); }
.stat-card { display:flex;align-items:center;gap:12px;padding:16px; }
.stat-icon { width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.stat-value { font-size:1.35rem;font-weight:800;line-height:1.1; }
.stat-label { font-size:12px;color:hsl(var(--muted-fg));margin-top:2px; }

.tabs { display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px; }
.tab { display:inline-flex;align-items:center;gap:6px;padding:6px 13px;border-radius:99px;border:1px solid hsl(var(--border));background:hsl(var(--card));font-family:inherit;font-size:12.5px;font-weight:600;color:hsl(var(--fg));cursor:pointer;transition:all .15s; }
.tab:hover { border-color:hsl(var(--primary)/.5);background:hsl(var(--primary)/0.05); }
.tab--on { background:hsl(var(--primary));border-color:hsl(var(--primary));color:#fff; }
.tab-count { font-size:11px;font-weight:800;background:hsl(var(--muted));color:hsl(var(--muted-fg));border-radius:99px;padding:0 6px; }
.tab--on .tab-count { background:rgba(255,255,255,.25);color:#fff; }

.hw-list { display:flex;flex-direction:column;gap:12px; }
.hw-card { display:flex;align-items:center;gap:14px;padding:0;cursor:pointer;overflow:hidden; }
.hw-stripe { width:4px;align-self:stretch;flex-shrink:0;background:hsl(var(--muted)); }
.stripe--pending   { background:hsl(var(--primary)); }
.stripe--overdue   { background:hsl(var(--warning)); }
.stripe--submitted { background:hsl(var(--muted-fg)); }
.stripe--graded    { background:hsl(var(--success)); }
.hw-main { flex:1;min-width:0;padding:15px 0; }
.hw-head { display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px; }
.hw-title { font-size:15px;font-weight:700;letter-spacing:-.01em; }
.hw-desc { font-size:13px;color:hsl(var(--muted-fg));margin-bottom:8px; }
.hw-meta { display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:hsl(var(--muted-fg)); }
.hw-meta span { display:inline-flex;align-items:center;gap:5px; }
.meta-danger { color:hsl(var(--destructive));font-weight:600; }
.hw-chev { color:hsl(var(--muted-fg));flex-shrink:0;margin-right:16px; }

/* Modal */
.modal-back { position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45);backdrop-filter:blur(4px); }
.modal-box { width:100%;max-width:560px;padding:24px;max-height:88vh;overflow-y:auto; }
.modal-head { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px; }
.modal-head h2 { font-size:17px;font-weight:700; }
.detail-sub { font-size:12.5px;color:hsl(var(--muted-fg));margin-top:3px; }
.detail-desc { font-size:13.5px;line-height:1.7;background:hsl(var(--muted)/.5);border-radius:12px;padding:12px 14px;margin-bottom:10px;white-space:pre-wrap; }
.detail-link { display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:hsl(var(--primary));text-decoration:none;margin-bottom:14px; }
.detail-link:hover { text-decoration:underline; }

.graded-box { border:1px solid hsl(var(--success)/.35);background:hsl(var(--success)/.07);border-radius:14px;padding:13px 15px;margin-bottom:16px; }
.graded-head { display:flex;align-items:center;gap:10px; }
.graded-title { font-size:13.5px;font-weight:700; }
.graded-sub { font-size:11.5px;color:hsl(var(--muted-fg)); }
.graded-score { margin-left:auto;font-size:1.5rem;font-weight:800;color:hsl(var(--success));line-height:1; }
.graded-score small { font-size:.8rem;font-weight:600;color:hsl(var(--muted-fg)); }
.graded-feedback { font-size:13px;font-style:italic;color:hsl(var(--fg));margin-top:9px;padding-top:9px;border-top:1px solid hsl(var(--success)/.25); }

.form-stack { display:flex;flex-direction:column;gap:14px; }
.form-field { display:flex;flex-direction:column;gap:6px; }
.form-field label { font-size:13px;font-weight:600; }
.modal-actions { display:flex;gap:10px;padding-top:2px; }
.flex-1 { flex:1; }
.error-msg { font-size:12.5px;color:hsl(var(--destructive));font-weight:500; }
.ok-msg { display:flex;align-items:center;gap:6px;font-size:12.5px;color:hsl(var(--success));font-weight:600; }
.late-note { font-size:12px;color:hsl(var(--warning));font-weight:500; }
.locked-note { font-size:12px;color:hsl(var(--muted-fg)); }

.empty-card { text-align:center;padding:60px 24px; }
.empty-icon-wrap { width:60px;height:60px;border-radius:16px;background:hsl(var(--muted));display:flex;align-items:center;justify-content:center;margin:0 auto 12px; }
.empty-title { font-size:15px;font-weight:700;margin-bottom:4px; }
.empty-sub { font-size:13px;color:hsl(var(--muted-fg)); }
.p-1 { padding:4px; }
</style>
