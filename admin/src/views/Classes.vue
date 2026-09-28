<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Sinflar</h1>
        <p class="geo-page-sub">Sinf yarating va o'quvchilar ro'yxatini Excel, Word yoki boshqa fayldan yuklang</p>
      </div>
      <button @click="openAdd()" class="geo-btn-primary">
        <Plus :size="16" /> Sinf qo'shish
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

    <!-- O'quvchilar yozgan, lekin hali yaratilmagan sinflar -->
    <div v-if="unlinked.length" class="geo-card unlinked">
      <AlertCircle :size="16" style="color:hsl(38 80% 42%);flex-shrink:0" />
      <p>
        O'quvchilar ro'yxatdan o'tishda yozgan, lekin hali qo'shilmagan sinflar:
        <button v-for="u in unlinked" :key="u.name" class="unlinked-chip" @click="openAdd(u.name)">
          {{ u.name }} <em>{{ u.count }}</em>
        </button>
      </p>
    </div>

    <div v-if="loading" class="class-grid">
      <div v-for="i in 4" :key="i" class="geo-skeleton" style="height:150px"></div>
    </div>

    <div v-else-if="!classes.length" class="geo-card empty-card">
      <div class="empty-icon-wrap"><School :size="28" style="color:hsl(var(--muted-fg));opacity:.5" /></div>
      <p class="empty-title">Hali sinf qo'shilmagan</p>
      <p class="empty-sub">Sinf qo'shing va o'quvchilar ro'yxatini fayldan yuklang</p>
      <button @click="openAdd()" class="geo-btn-primary" style="margin-top:14px"><Plus :size="15" /> Sinf qo'shish</button>
    </div>

    <div v-else class="class-grid">
      <div v-for="c in classes" :key="c.id" class="class-card geo-card geo-card-hover" @click="detailId = c.id">
        <div class="class-top">
          <span class="class-name">{{ c.name }}</span>
          <span class="geo-badge" :class="c.section === 'ru' ? 'geo-badge-warning' : 'geo-badge-primary'">
            {{ sectionFlag(c.section) }} {{ c.section === 'ru' ? 'Rus' : "O'zbek" }}
          </span>
        </div>
        <div class="class-nums">
          <span><Users :size="13" /> {{ c.total }} o'quvchi</span>
          <span><UserCheck :size="13" /> {{ c.registered }} kirgan</span>
          <span v-if="c.online" class="online-txt"><span class="dot"></span> {{ c.online }} onlayn</span>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill" :style="`width:${pct(c.registered, c.total)}%`"></div></div>
          <span class="progress-text">{{ pct(c.registered, c.total) }}%</span>
        </div>
        <p class="class-hint">{{ c.total - c.registered }} ta o'quvchi hali saytga kirmagan</p>
      </div>
    </div>

    <!-- ── Sinf qo'shish modali ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAdd" class="modal-back" @click.self="closeAdd">
          <div class="modal-box modal-box--wide geo-card">
            <div class="modal-head">
              <div>
                <h2>{{ addTarget ? `${addTarget.name} — ro'yxat qo'shish` : "Sinf qo'shish" }}</h2>
                <p class="detail-sub">O'quvchilar ro'yxatini fayldan yuklang yoki qo'lda kiriting</p>
              </div>
              <button @click="closeAdd" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </div>

            <div class="form-stack">
              <div class="form-row">
                <div class="form-field">
                  <label>Sinf nomi *</label>
                  <input v-model="addForm.name" class="geo-input" placeholder="Masalan: 7-A, 11-V" maxlength="12" :disabled="!!addTarget" />
                  <p v-if="addForm.name && !addTarget" class="name-hint" :class="{ 'name-hint--err': !normalizedName }">
                    {{ normalizedName ? `${normalizedName} sinf yaratiladi` : "Raqam (1–11) va harf yozing, masalan: 11-V" }}
                  </p>
                </div>
                <div class="form-field">
                  <label>Sinf turi *</label>
                  <SectionPicker v-model="addForm.section" :with-all="false" />
                </div>
              </div>

              <!-- Fayl -->
              <label class="dropzone" :class="{ 'dropzone--over': dragOver }"
                @dragover.prevent="dragOver = true" @dragleave.prevent="dragOver = false" @drop.prevent="onDrop">
                <input type="file" class="hidden" :accept="ACCEPT" @change="onFile" />
                <Loader2 v-if="parsing" :size="22" class="animate-spin" style="color:hsl(var(--primary))" />
                <FileSpreadsheet v-else :size="22" style="color:hsl(var(--primary))" />
                <span class="dz-title">{{ parsing ? "O'qilmoqda..." : fileName || "Faylni tanlang yoki shu yerga tashlang" }}</span>
                <span class="dz-sub">Excel (.xlsx), Word (.docx), CSV, TXT, PDF — F.I.Sh ustuni bo'lsa yetarli</span>
              </label>
              <p v-if="!addTarget" class="name-hint">
                Ro'yxat ixtiyoriy: sinfni hozir bo'sh yaratib, o'quvchilarni keyin qo'shish ham mumkin.
              </p>

              <details class="manual">
                <summary>yoki ro'yxatni qo'lda kiriting</summary>
                <textarea v-model="manualText" class="geo-input" rows="5"
                  placeholder="Har bir qatorda bitta o'quvchi:&#10;Aliyev Vali Karimovich&#10;Karimova Nigora 7-B"></textarea>
                <button class="geo-btn-outline btn-sm" :disabled="!manualText.trim() || parsing" @click="parseManual">
                  <ListChecks :size="14" /> Ro'yxatni tekshirish
                </button>
              </details>

              <p v-if="addError" class="error-msg">{{ addError }}</p>

              <!-- Ko'rib chiqish jadvali -->
              <div v-if="preview.length" class="preview">
                <div class="preview-head">
                  <strong>{{ preview.length }} ta o'quvchi</strong>
                  <span class="ok-txt">{{ previewRegistered }} tasi saytga kirgan</span>
                  <span class="muted-txt">{{ preview.length - previewRegistered }} tasi kirmagan</span>
                </div>
                <div class="table-wrap">
                  <table class="st-table">
                    <thead>
                      <tr><th>#</th><th>F.I.Sh</th><th>Sinfi</th><th>Saytga kirdimi</th><th></th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="(r, i) in preview" :key="i">
                        <td class="num">{{ i + 1 }}</td>
                        <td class="name">{{ r.fullName }}</td>
                        <td><span class="cls-pill">{{ r.className || addForm.name || '—' }}</span></td>
                        <td>
                          <span v-if="r.registered" class="status status--yes">
                            <span v-if="r.online" class="dot"></span><Check v-else :size="12" />
                            {{ r.online ? 'Hozir onlayn' : 'Kirgan' }}
                          </span>
                          <span v-else class="status status--no"><Minus :size="12" /> Kirmagan</span>
                        </td>
                        <td><button class="icon-btn" title="Olib tashlash" @click="preview.splice(i, 1)"><X :size="13" /></button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="modal-actions">
                <button @click="closeAdd" class="geo-btn-outline flex-1">Bekor</button>
                <button @click="saveClass" :disabled="!canSave || saving" class="geo-btn-primary flex-1">
                  <Loader2 v-if="saving" :size="15" class="animate-spin" />
                  {{ saving ? '...' : addTarget ? "Ro'yxatga qo'shish" : "Sinfni saqlash" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Sinf tafsilotlari ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="detail" class="modal-back" @click.self="detailId = null">
          <div class="modal-box modal-box--wide geo-card">
            <div class="modal-head">
              <div>
                <h2>{{ detail.name }} sinf</h2>
                <p class="detail-sub">
                  {{ detail.total }} o'quvchi · {{ detail.registered }} saytga kirgan · {{ detail.online }} hozir onlayn
                </p>
              </div>
              <button @click="detailId = null" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </div>

            <div class="detail-tools">
              <SectionPicker :model-value="detail.section" :with-all="false" @update:model-value="changeSection" />
              <button class="geo-btn-outline btn-sm" @click="openAdd(detail.name, detail)"><Upload :size="14" /> Ro'yxat yuklash</button>
              <button class="geo-btn-ghost btn-sm danger" @click="removeClass(detail)"><Trash2 :size="14" /> Sinfni o'chirish</button>
            </div>

            <div class="filter-tabs">
              <button v-for="f in detailFilters" :key="f.key" class="grade-tab"
                :class="{ 'grade-tab--on': detailFilter === f.key }" @click="detailFilter = f.key">
                {{ f.label }} <em>{{ f.count }}</em>
              </button>
            </div>

            <div v-if="!detailRows.length" class="empty-mini">O'quvchi yo'q</div>
            <div v-else class="table-wrap">
              <table class="st-table">
                <thead>
                  <tr><th>#</th><th>F.I.Sh</th><th>Sinfi</th><th>Saytga kirdimi</th><th>Oxirgi kirish</th><th></th></tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in detailRows" :key="r.id">
                    <td class="num">{{ i + 1 }}</td>
                    <td class="name">
                      {{ r.fullName }}
                      <span v-if="r.registered && r.username" class="uname">@{{ r.username }}</span>
                      <span v-if="!r.inRoster" class="extra-tag" title="O'zi ro'yxatdan o'tgan, yuklangan ro'yxatda yo'q">ro'yxatda yo'q</span>
                    </td>
                    <td><span class="cls-pill">{{ r.className }}</span></td>
                    <td>
                      <span v-if="r.online" class="status status--yes"><span class="dot"></span> Onlayn</span>
                      <span v-else-if="r.registered" class="status status--yes"><Check :size="12" /> Kirgan</span>
                      <span v-else class="status status--no"><Minus :size="12" /> Kirmagan</span>
                    </td>
                    <td class="muted-txt">{{ r.lastSeenAt ? timeAgo(r.lastSeenAt) : '—' }}</td>
                    <td>
                      <button v-if="r.inRoster" class="icon-btn" title="Ro'yxatdan olib tashlash" @click="removeStudent(detail, r)">
                        <Trash2 :size="13" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  Plus, X, Trash2, Loader2, School, Users, UserCheck, Wifi, AlertCircle, FileSpreadsheet,
  ListChecks, Check, Minus, Upload,
} from "lucide-vue-next";
import { api, resolveUrl } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useSettingsStore } from "@shared/stores/settings";
import SectionPicker from "@shared/components/SectionPicker.vue";
import { sectionFlag } from "@shared/sections";

const ACCEPT = ".xlsx,.xls,.xlsm,.docx,.doc,.csv,.txt,.pdf";
const settings = useSettingsStore();

const classes = ref([]);
const unlinked = ref([]);
const loading = ref(true);

const showAdd = ref(false);
const addTarget = ref(null);         // mavjud sinfga ro'yxat qo'shilayotgan bo'lsa
const addForm = ref({ name: "", section: "uz" });
const preview = ref([]);
const manualText = ref("");
const fileName = ref("");
const parsing = ref(false);
const saving = ref(false);
const addError = ref("");
const dragOver = ref(false);

const detailId = ref(null);
const detailFilter = ref("all");
let timer = null;

const detail = computed(() => classes.value.find(c => c.id === detailId.value) ?? null);

const stats = computed(() => {
  const list = classes.value;
  const total = list.reduce((s, c) => s + c.total, 0);
  const reg = list.reduce((s, c) => s + c.registered, 0);
  const online = list.reduce((s, c) => s + c.online, 0);
  return [
    { label: "Sinflar",           value: list.length, icon: School,    color: "hsl(174 65% 30%)", bg: "hsl(174 65% 30%/0.1)" },
    { label: "O'quvchilar",       value: total,       icon: Users,     color: "#8b5cf6", bg: "#8b5cf620" },
    { label: "Saytga kirgan",     value: reg,         icon: UserCheck, color: "#10b981", bg: "#10b98118" },
    { label: "Hozir onlayn",      value: online,      icon: Wifi,      color: "#f59e0b", bg: "#f59e0b18" },
  ];
});

const previewRegistered = computed(() => preview.value.filter(r => r.registered).length);
// "11v", "11 - v", "11-V" → "11-V" (backend ham shunday tekshiradi)
const normalizedName = computed(() => {
  const m = addForm.value.name.trim().match(/^(\d{1,2})\s*[-–—_./ ]?\s*["'«]?(\p{L})["'»]?$/u);
  const grade = m ? Number(m[1]) : 0;
  return grade >= 1 && grade <= 11 ? `${grade}-${m[2].toLocaleUpperCase()}` : "";
});
const canSave = computed(() => (addTarget.value ? preview.value.length > 0 : Boolean(normalizedName.value)));

const detailFilters = computed(() => {
  const rows = detail.value?.students ?? [];
  return [
    { key: "all", label: "Hammasi", count: rows.length },
    { key: "yes", label: "Kirgan", count: rows.filter(r => r.registered).length },
    { key: "no", label: "Kirmagan", count: rows.filter(r => !r.registered).length },
    { key: "online", label: "Onlayn", count: rows.filter(r => r.online).length },
  ];
});
const detailRows = computed(() => {
  const rows = detail.value?.students ?? [];
  if (detailFilter.value === "yes") return rows.filter(r => r.registered);
  if (detailFilter.value === "no") return rows.filter(r => !r.registered);
  if (detailFilter.value === "online") return rows.filter(r => r.online);
  return rows;
});

function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }

function timeAgo(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "hozirgina";
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} kun oldin` : new Date(iso).toLocaleDateString("uz-UZ");
}

async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    const data = await api("/api/classes");
    classes.value = data.classes;
    unlinked.value = data.unlinked;
  } catch {}
  loading.value = false;
}

onMounted(() => {
  load();
  timer = setInterval(() => load(true), 20000);   // kim kirgani yangilanib tursin
});
onUnmounted(() => clearInterval(timer));
useLive(["classes", "users"], () => load(true));

function openAdd(name = "", target = null) {
  addTarget.value = target;
  addForm.value = {
    name,
    section: target?.section ?? (settings.section === "ru" ? "ru" : "uz"),
  };
  preview.value = [];
  manualText.value = "";
  fileName.value = "";
  addError.value = "";
  showAdd.value = true;
}
function closeAdd() { showAdd.value = false; }

function mergePreview(rows) {
  const seen = new Set(preview.value.map(r => `${r.fullName.toLowerCase()}|${r.className ?? ""}`));
  for (const r of rows) {
    const key = `${r.fullName.toLowerCase()}|${r.className ?? ""}`;
    if (!seen.has(key)) { seen.add(key); preview.value.push(r); }
  }
}

async function uploadFile(file) {
  if (!file) return;
  fileName.value = file.name;
  parsing.value = true;
  addError.value = "";
  const fd = new FormData();
  fd.append("file", file);
  fd.append("className", addForm.value.name);
  try {
    const resp = await fetch(resolveUrl("/api/classes/parse"), {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("geo_token")}` },
      body: fd,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Faylni o'qib bo'lmadi");
    mergePreview(data.students);
    // Fayldagi sinf nomini maydonga qo'yamiz (agar hali yozilmagan bo'lsa)
    if (!addForm.value.name) addForm.value.name = data.students.find(s => s.className)?.className ?? "";
  } catch (e) {
    addError.value = e.message;
  }
  parsing.value = false;
}

function onFile(e) {
  uploadFile(e.target.files?.[0]);
  e.target.value = "";
}
function onDrop(e) {
  dragOver.value = false;
  uploadFile(e.dataTransfer.files?.[0]);
}

async function parseManual() {
  parsing.value = true;
  addError.value = "";
  try {
    const data = await api("/api/classes/parse", {
      method: "POST",
      body: JSON.stringify({ text: manualText.value, className: addForm.value.name }),
    });
    mergePreview(data.students);
    manualText.value = "";
  } catch (e) {
    addError.value = e.data?.error || e.message;
  }
  parsing.value = false;
}

async function saveClass() {
  saving.value = true;
  addError.value = "";
  try {
    const students = preview.value.map(r => ({ fullName: r.fullName, className: r.className || normalizedName.value || addForm.value.name }));
    if (addTarget.value) {
      await api(`/api/classes/${addTarget.value.id}`, { method: "PUT", body: JSON.stringify({ students }) });
    } else {
      await api("/api/classes", {
        method: "POST",
        body: JSON.stringify({ name: normalizedName.value, section: addForm.value.section, students }),
      });
    }
    showAdd.value = false;
    await load(true);
  } catch (e) {
    addError.value = e.data?.error || "Saqlashda xato";
  }
  saving.value = false;
}

async function changeSection(section) {
  if (!detail.value || detail.value.section === section) return;
  try {
    await api(`/api/classes/${detail.value.id}`, { method: "PUT", body: JSON.stringify({ section }) });
    await load(true);
    // Boshqa bo'limga o'tgan sinf joriy filtrdan chiqib ketishi mumkin
    if (!detail.value) detailId.value = null;
  } catch (e) { alert(e.data?.error || "Xatolik"); }
}

async function removeStudent(cls, row) {
  if (!confirm(`${row.fullName} ro'yxatdan olib tashlansinmi?`)) return;
  try { await api(`/api/classes/${cls.id}/students/${row.id}`, { method: "DELETE" }); await load(true); } catch {}
}

async function removeClass(cls) {
  if (!confirm(`${cls.name} sinfi o'chirilsinmi? (O'quvchilar akkauntlari o'chmaydi)`)) return;
  try {
    await api(`/api/classes/${cls.id}`, { method: "DELETE" });
    detailId.value = null;
    await load(true);
  } catch {}
}
</script>

<style scoped>
.page-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px; }

.stats-grid { display:grid;gap:12px;margin-bottom:16px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); }
.stat-card { display:flex;align-items:center;gap:12px;padding:16px; }
.stat-icon { width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.stat-value { font-size:1.35rem;font-weight:800;line-height:1.1; }
.stat-label { font-size:12px;color:hsl(var(--muted-fg));margin-top:2px; }

.unlinked { display:flex;gap:10px;align-items:flex-start;padding:12px 14px;margin-bottom:16px;font-size:13px;background:hsl(38 90% 50%/.07);border-color:hsl(38 80% 50%/.3); }
.unlinked p { line-height:1.9; }
.unlinked-chip { margin-left:6px;padding:2px 10px;border-radius:99px;border:1px solid hsl(38 70% 45%/.45);background:hsl(var(--card));font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:hsl(var(--fg)); }
.unlinked-chip em { font-style:normal;color:hsl(var(--muted-fg));font-weight:600;margin-left:3px; }
.unlinked-chip:hover { border-color:hsl(var(--primary));color:hsl(var(--primary)); }

.class-grid { display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); }
.class-card { padding:16px;cursor:pointer;display:flex;flex-direction:column;gap:10px; }
.class-top { display:flex;align-items:center;justify-content:space-between;gap:8px; }
.class-name { font-size:1.6rem;font-weight:800;letter-spacing:-.02em; }
.class-nums { display:flex;flex-wrap:wrap;gap:12px;font-size:12.5px;color:hsl(var(--muted-fg)); }
.class-nums span { display:inline-flex;align-items:center;gap:5px; }
.class-hint { font-size:11.5px;color:hsl(var(--muted-fg)); }
.online-txt { color:hsl(142 60% 32%);font-weight:600; }
.dot { width:7px;height:7px;border-radius:50%;background:hsl(142 70% 42%);box-shadow:0 0 0 3px hsl(142 70% 42%/.2);display:inline-block; }

.progress-wrap { display:flex;align-items:center;gap:8px; }
.progress-bar { flex:1;height:6px;border-radius:99px;background:hsl(var(--muted));overflow:hidden; }
.progress-fill { height:100%;border-radius:99px;background:hsl(142 60% 40%);transition:width .3s; }
.progress-text { font-size:11.5px;font-weight:700;color:hsl(var(--muted-fg));min-width:32px;text-align:right; }

.empty-card { padding:40px 20px;text-align:center;display:flex;flex-direction:column;align-items:center; }
.empty-icon-wrap { width:56px;height:56px;border-radius:16px;background:hsl(var(--muted));display:flex;align-items:center;justify-content:center;margin-bottom:12px; }
.empty-title { font-weight:700;font-size:15px; }
.empty-sub { font-size:13px;color:hsl(var(--muted-fg));margin-top:4px; }
.empty-mini { padding:24px;text-align:center;font-size:13px;color:hsl(var(--muted-fg)); }

/* Modal */
.modal-back { position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45);backdrop-filter:blur(4px); }
.modal-box { width:100%;max-width:480px;padding:24px;max-height:90vh;overflow-y:auto; }
.modal-box--wide { max-width:760px; }
.modal-head { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px; }
.modal-head h2 { font-size:17px;font-weight:700; }
.detail-sub { font-size:12.5px;color:hsl(var(--muted-fg));margin-top:3px; }
.form-stack { display:flex;flex-direction:column;gap:14px; }
.form-field { display:flex;flex-direction:column;gap:6px; }
.form-field label { font-size:13px;font-weight:600; }
.form-row { display:grid;grid-template-columns:1fr 1.4fr;gap:12px; }
@media (max-width:620px) { .form-row { grid-template-columns:1fr; } }
.modal-actions { display:flex;gap:10px;padding-top:4px; }
.flex-1 { flex:1; }
.hidden { display:none; }
.btn-sm { padding:.35rem .7rem;font-size:12px;border-radius:.6rem; }
.name-hint { font-size:11.5px;color:hsl(var(--primary));font-weight:600; }
.name-hint--err { color:hsl(var(--destructive));font-weight:500; }
.error-msg { font-size:12.5px;color:hsl(var(--destructive));font-weight:500; }

.dropzone { display:flex;flex-direction:column;align-items:center;gap:6px;padding:22px 16px;border:2px dashed hsl(var(--border));border-radius:14px;cursor:pointer;text-align:center;transition:all .15s;background:hsl(var(--muted)/.3); }
.dropzone:hover, .dropzone--over { border-color:hsl(var(--primary));background:hsl(var(--primary)/.05); }
.dz-title { font-size:13.5px;font-weight:700; }
.dz-sub { font-size:11.5px;color:hsl(var(--muted-fg)); }

.manual summary { font-size:12.5px;font-weight:600;color:hsl(var(--primary));cursor:pointer;margin-bottom:8px; }
.manual textarea { margin-bottom:8px;font-size:13px; }

.preview { border:1px solid hsl(var(--border));border-radius:14px;overflow:hidden; }
.preview-head { display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:10px 14px;background:hsl(var(--muted)/.4);font-size:12.5px; }
.ok-txt { color:hsl(142 55% 32%);font-weight:600; }
.muted-txt { color:hsl(var(--muted-fg));font-size:12px; }

.table-wrap { max-height:340px;overflow:auto; }
.st-table { width:100%;border-collapse:collapse;font-size:13px; }
.st-table th { position:sticky;top:0;background:hsl(var(--card));text-align:left;font-size:11.5px;font-weight:700;color:hsl(var(--muted-fg));padding:8px 10px;border-bottom:1px solid hsl(var(--border));white-space:nowrap; }
.st-table td { padding:8px 10px;border-bottom:1px solid hsl(var(--border)/.6);vertical-align:middle; }
.st-table tr:last-child td { border-bottom:none; }
.st-table .num { color:hsl(var(--muted-fg));width:30px; }
.st-table .name { font-weight:600; }
.uname { font-size:11px;font-weight:500;color:hsl(var(--muted-fg));margin-left:6px; }
.extra-tag { font-size:10.5px;font-weight:600;color:hsl(28 70% 38%);background:hsl(38 90% 50%/.14);padding:1px 7px;border-radius:99px;margin-left:6px; }
.cls-pill { font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:99px;background:hsl(var(--primary)/.1);color:hsl(var(--primary));white-space:nowrap; }
.status { display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:3px 9px;border-radius:99px;white-space:nowrap; }
.status--yes { background:hsl(142 60% 40%/.12);color:hsl(142 55% 28%); }
.status--no { background:hsl(var(--muted));color:hsl(var(--muted-fg)); }
.icon-btn { width:28px;height:28px;border-radius:8px;border:1px solid hsl(var(--border));background:transparent;color:hsl(var(--muted-fg));cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s; }
.icon-btn:hover { background:hsl(var(--destructive)/.1);border-color:hsl(var(--destructive)/.4);color:hsl(var(--destructive)); }

.detail-tools { display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px; }
.detail-tools > :first-child { flex:1;min-width:240px; }
.danger { color:hsl(var(--destructive)); }
.filter-tabs { display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px; }
.grade-tab { padding:5px 12px;border-radius:99px;border:1px solid hsl(var(--border));background:hsl(var(--card));font-family:inherit;font-size:12px;font-weight:600;color:hsl(var(--fg));cursor:pointer;transition:all .15s; }
.grade-tab em { font-style:normal;opacity:.65;margin-left:3px; }
.grade-tab--on { background:hsl(var(--primary));border-color:hsl(var(--primary));color:#fff; }
</style>
