<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Test natijalari</h1>
        <p class="geo-page-sub">O'quvchilar yechgan testlar — eng yangisi birinchi</p>
      </div>
      <button @click="load" class="geo-btn-outline" :disabled="loading">
        <RefreshCw :size="15" :class="{ 'animate-spin': loading }" /> Yangilash
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

    <!-- Filtrlar -->
    <div class="filters">
      <div class="grade-tabs">
        <button class="grade-tab" :class="{ 'grade-tab--on': activeGrade === 0 }" @click="selectGrade(0)">
          Barcha sinflar
        </button>
        <button v-for="g in grades.open" :key="g" class="grade-tab"
          :class="{ 'grade-tab--on': activeGrade === g }" @click="selectGrade(g)">
          {{ g }}-sinf
        </button>
      </div>
      <div class="search-wrap">
        <Search :size="15" class="search-icon" />
        <input v-model="search" class="geo-input search-input"
          placeholder="O'quvchi yoki mavzu bo'yicha qidirish..." />
      </div>
    </div>

    <!-- Jadval -->
    <div class="geo-card results-card">
      <div v-if="loading" class="p-4">
        <div v-for="i in 6" :key="i" class="geo-skeleton mb-2" style="height:52px"></div>
      </div>

      <div v-else-if="!results.length" class="empty-state">
        <ClipboardList :size="40" style="opacity:.3" />
        <p class="empty-title">Natija yo'q</p>
        <p class="empty-sub">
          {{ search || activeGrade ? "Filtrga mos natija topilmadi" : "O'quvchilar test yechgach bu yerda ko'rinadi" }}
        </p>
      </div>

      <template v-else>
        <div class="table-scroll">
          <table class="results-table">
            <thead>
              <tr>
                <th>O'quvchi</th>
                <th>Sinf</th>
                <th>Mavzu</th>
                <th class="ta-c">To'g'ri</th>
                <th class="ta-c">Natija</th>
                <th class="ta-c">Ball</th>
                <th class="ta-c">Vaqt</th>
                <th class="ta-r">Sana</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in paged.visible.value" :key="r.id">
                <td>
                  <div class="student-cell">
                    <span class="student-av">{{ r.studentName.charAt(0).toUpperCase() }}</span>
                    <span class="student-name">{{ r.studentName }}</span>
                  </div>
                </td>
                <td><span class="grade-pill">{{ r.grade ? `${r.grade}-sinf` : '—' }}</span></td>
                <td class="topic-cell">{{ r.topicTitle || '—' }}</td>
                <td class="ta-c mono">{{ r.correct }}/{{ r.total }}</td>
                <td class="ta-c">
                  <span class="pct-pill" :class="pctClass(r.percentage)">{{ r.percentage }}%</span>
                </td>
                <td class="ta-c mono score-cell">+{{ r.pointsEarned }}</td>
                <td class="ta-c mono muted">{{ fmtTime(r.timeTaken) }}</td>
                <td class="ta-r muted nowrap">{{ fmtDate(r.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ShowMore :remaining="paged.remaining.value" :shown="paged.visible.value.length"
          :step="paged.pageSize" @more="paged.more" />
        <div class="table-foot">{{ results.length }} ta natija</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { ClipboardList, Search, RefreshCw, Users, Percent, CheckCircle2 } from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useGradesStore } from "@shared/stores/grades";
import { usePaged } from "@shared/composables/paged";
import ShowMore from "@shared/components/ShowMore.vue";

const grades = useGradesStore();

const results = ref([]);
// 100+ o'quvchida yuzlab natija — 50 tadan ko'rsatamiz
const paged = usePaged(results, 50);
const summary = ref({ totalResults: 0, students: 0, avgPercentage: 0, passed: 0 });
const loading = ref(true);
const activeGrade = ref(0);   // 0 = barcha sinflar
const search = ref("");
let searchTimer = null;

const stats = computed(() => [
  { label: "Yechilgan testlar", value: summary.value.totalResults, icon: ClipboardList, color: "hsl(174 65% 30%)", bg: "hsl(174 65% 30%/0.1)" },
  { label: "O'quvchilar",       value: summary.value.students,     icon: Users,         color: "#8b5cf6", bg: "#8b5cf620" },
  { label: "O'rtacha natija",   value: `${summary.value.avgPercentage}%`, icon: Percent, color: "#f59e0b", bg: "#f59e0b18" },
  { label: "60% dan yuqori",    value: summary.value.passed,       icon: CheckCircle2,  color: "#10b981", bg: "#10b98118" },
]);

async function load(silent = false) {
  if (silent !== true) loading.value = true;
  const params = new URLSearchParams();
  if (activeGrade.value) params.set("grade", activeGrade.value);
  if (search.value.trim()) params.set("search", search.value.trim());
  const qs = params.toString();
  try {
    const data = await api(`/api/results${qs ? `?${qs}` : ""}`);
    results.value = data.results ?? [];
    summary.value = data.summary ?? summary.value;
  } catch {
    results.value = [];
  }
  loading.value = false;
}

function selectGrade(g) {
  if (activeGrade.value === g) return;
  activeGrade.value = g;
  paged.reset();
  load();
}

// Yozish tugagach qidiramiz — har bosishda so'rov yubormaymiz
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { paged.reset(); load(); }, 350);
});

function pctClass(p) {
  if (p >= 80) return "pct-high";
  if (p >= 60) return "pct-mid";
  return "pct-low";
}

function fmtTime(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Bugun ${time}`;
  return `${d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" })} ${time}`;
}

onMounted(load);
useLive(["activity", "users", "topics"], () => load(true));
</script>

<style scoped>
.page-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px; }

/* Statistika */
.stats-grid { display:grid;gap:12px;margin-bottom:20px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }
.stat-card { display:flex;align-items:center;gap:12px;padding:16px; }
.stat-icon { width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.stat-value { font-size:1.35rem;font-weight:800;line-height:1.1; }
.stat-label { font-size:12px;color:hsl(var(--muted-fg));margin-top:2px; }

/* Filtrlar */
.filters { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap; }
.grade-tabs { display:flex;flex-wrap:wrap;gap:7px; }
.grade-tab {
  padding:6px 13px;border-radius:99px;
  border:1px solid hsl(var(--border));background:hsl(var(--card));
  font-family:inherit;font-size:12.5px;font-weight:600;color:hsl(var(--fg));
  cursor:pointer;transition:all .15s;
}
.grade-tab:hover { border-color:hsl(var(--primary)/.5);background:hsl(var(--primary)/0.05); }
.grade-tab--on { background:hsl(var(--primary));border-color:hsl(var(--primary));color:#fff; }

.search-wrap { position:relative;min-width:240px;flex:1;max-width:340px; }
.search-icon { position:absolute;left:11px;top:50%;transform:translateY(-50%);color:hsl(var(--muted-fg));pointer-events:none; }
.search-input { padding-left:34px; }

/* Jadval */
.results-card { overflow:hidden; }
.table-scroll { overflow-x:auto; }
.results-table { width:100%;border-collapse:collapse;font-size:13px;min-width:760px; }
.results-table th {
  text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
  color:hsl(var(--muted-fg));padding:11px 14px;border-bottom:1px solid hsl(var(--border));
  background:hsl(var(--muted)/0.4);white-space:nowrap;
}
.results-table td { padding:11px 14px;border-bottom:1px solid hsl(var(--border)); }
.results-table tbody tr:last-child td { border-bottom:none; }
.results-table tbody tr:hover { background:hsl(var(--muted)/0.4); }

.ta-c { text-align:center; }
.ta-r { text-align:right; }
.nowrap { white-space:nowrap; }
.mono { font-family:'JetBrains Mono','Menlo',monospace;font-size:12.5px; }
.muted { color:hsl(var(--muted-fg)); }

.student-cell { display:flex;align-items:center;gap:9px; }
.student-av {
  width:28px;height:28px;border-radius:9px;flex-shrink:0;
  background:linear-gradient(135deg, hsl(var(--primary)), hsl(172 70% 38%));
  color:#fff;font-size:12px;font-weight:700;
  display:flex;align-items:center;justify-content:center;
}
.student-name { font-weight:600;white-space:nowrap; }
.topic-cell { max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }

.grade-pill { font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:99px;background:hsl(var(--muted));color:hsl(var(--muted-fg));white-space:nowrap; }
.pct-pill { display:inline-block;min-width:48px;font-size:12px;font-weight:800;padding:3px 9px;border-radius:99px; }
.pct-high { background:hsl(142 60% 38%/0.14);color:hsl(142 55% 28%); }
.pct-mid  { background:hsl(38 90% 50%/0.16);color:hsl(28 70% 32%); }
.pct-low  { background:hsl(0 70% 50%/0.11);color:hsl(0 60% 44%); }
.score-cell { font-weight:700;color:hsl(var(--primary)); }

.table-foot { padding:10px 14px;font-size:11.5px;color:hsl(var(--muted-fg));border-top:1px solid hsl(var(--border)); }

.empty-state { display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px 24px;color:hsl(var(--muted-fg));text-align:center; }
.empty-title { font-size:15px;font-weight:700;color:hsl(var(--fg)); }
.empty-sub { font-size:13px; }

.p-4 { padding:16px; }
.mb-2 { margin-bottom:8px; }
</style>
