<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Faol o'quvchilar</h1>
        <p class="geo-page-sub">Kim hozir saytda, kim bugun kirgan va kim uzoq vaqt kirmagan</p>
      </div>
      <span class="live"><span class="dot"></span> Jonli · {{ updatedLabel }}</span>
    </div>

    <div class="stats-grid">
      <button v-for="s in stats" :key="s.key" class="stat-card geo-card"
        :class="{ 'stat-card--on': filter === s.key }" @click="filter = s.key">
        <div class="stat-icon" :style="`background:${s.bg}`">
          <component :is="s.icon" :size="18" :style="`color:${s.color}`" />
        </div>
        <div>
          <p class="stat-value">{{ loading ? '—' : s.value }}</p>
          <p class="stat-label">{{ s.label }}</p>
        </div>
      </button>
    </div>

    <div class="toolbar">
      <div class="search">
        <Search :size="15" class="search-ico" />
        <input v-model="search" class="geo-input" placeholder="Ism yoki username bo'yicha qidirish..." />
      </div>
      <select v-model="classFilter" class="geo-input class-select">
        <option value="">Barcha sinflar</option>
        <option v-for="c in classNames" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <div v-if="loading" class="list">
      <div v-for="i in 5" :key="i" class="geo-skeleton" style="height:62px"></div>
    </div>

    <div v-else-if="!rows.length" class="geo-card empty-card">
      <Users :size="30" style="opacity:.35" />
      <p class="empty-title">O'quvchi topilmadi</p>
      <p class="empty-sub">Filtrni o'zgartirib ko'ring</p>
    </div>

    <div v-else class="geo-card table-card">
      <table class="st-table">
        <thead>
          <tr>
            <th>O'quvchi</th><th>Sinfi</th><th>Holati</th><th>Oxirgi kirish</th>
            <th class="r">Bugungi testlar</th><th class="r">Ball</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in paged.visible.value" :key="s.id">
            <td>
              <div class="who">
                <span class="av" :class="{ 'av--on': s.online }">
                  <img v-if="s.avatarUrl" :src="s.avatarUrl" />
                  <template v-else>{{ s.name?.charAt(0)?.toUpperCase() }}</template>
                </span>
                <div>
                  <p class="nm">{{ s.name }}</p>
                  <p class="un">@{{ s.username }}</p>
                </div>
              </div>
            </td>
            <td>
              <span class="cls-pill">{{ s.className || (s.grade ? `${s.grade}-sinf` : '—') }}</span>
              <span v-if="s.section" class="sec">{{ s.section === 'ru' ? '🇷🇺' : '🇺🇿' }}</span>
            </td>
            <td>
              <span v-if="s.online" class="status status--on"><span class="dot"></span> Onlayn</span>
              <span v-else-if="s.activeToday" class="status status--today">Bugun kirgan</span>
              <span v-else-if="s.activeWeek" class="status status--week">Shu hafta</span>
              <span v-else-if="s.lastSeenAt" class="status status--off">Faol emas</span>
              <span v-else class="status status--off">Hech kirmagan</span>
            </td>
            <td class="muted">{{ s.lastSeenAt ? timeAgo(s.lastSeenAt) : '—' }}</td>
            <td class="r">{{ s.testsToday }}</td>
            <td class="r strong">{{ s.totalScore }}</td>
          </tr>
        </tbody>
      </table>
      <ShowMore :remaining="paged.remaining.value" :shown="paged.visible.value.length"
        :step="paged.pageSize" @more="paged.more" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { usePaged } from "@shared/composables/paged";
import ShowMore from "@shared/components/ShowMore.vue";
import { Users, Wifi, CalendarCheck, CalendarDays, UserX, Search } from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";

const data = ref({ summary: {}, students: [] });
const loading = ref(true);
const updatedAt = ref(null);
const now = ref(Date.now());
const filter = ref("online");
const search = ref("");
const classFilter = ref("");
let timer = null;
let tick = null;

const stats = computed(() => {
  const s = data.value.summary;
  return [
    { key: "online", label: "Hozir onlayn",     value: s.online ?? 0, icon: Wifi,          color: "#10b981", bg: "#10b98118" },
    { key: "today",  label: "Bugun kirgan",     value: s.today ?? 0,  icon: CalendarCheck, color: "hsl(174 65% 30%)", bg: "hsl(174 65% 30%/0.1)" },
    { key: "week",   label: "Shu hafta",        value: s.week ?? 0,   icon: CalendarDays,  color: "#8b5cf6", bg: "#8b5cf620" },
    { key: "all",    label: "Jami o'quvchilar", value: s.total ?? 0,  icon: Users,         color: "#0ea5e9", bg: "#0ea5e918" },
    { key: "never",  label: "Hech kirmagan",    value: s.never ?? 0,  icon: UserX,         color: "#f59e0b", bg: "#f59e0b18" },
  ];
});

const classNames = computed(() =>
  [...new Set(data.value.students.map(s => s.className).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "uz", { numeric: true })));

const rows = computed(() => {
  let list = data.value.students;
  if (filter.value === "online") list = list.filter(s => s.online);
  else if (filter.value === "today") list = list.filter(s => s.activeToday);
  else if (filter.value === "week") list = list.filter(s => s.activeWeek);
  else if (filter.value === "never") list = list.filter(s => !s.lastSeenAt);
  if (classFilter.value) list = list.filter(s => s.className === classFilter.value);
  const q = search.value.trim().toLowerCase();
  if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.username?.toLowerCase().includes(q));
  return list;
});

// 100+ o'quvchida jadval juda uzun bo'lmasligi uchun 40 tadan
const paged = usePaged(rows, 40);
watch([filter, classFilter, search], () => paged.reset());

const updatedLabel = computed(() => {
  if (!updatedAt.value) return "yuklanmoqda";
  const sec = Math.round((now.value - updatedAt.value) / 1000);
  return sec < 5 ? "hozirgina yangilandi" : `${sec} soniya oldin yangilandi`;
});

function timeAgo(iso) {
  const m = Math.round((now.value - new Date(iso).getTime()) / 60000);
  if (m < 1) return "hozirgina";
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} kun oldin` : new Date(iso).toLocaleDateString("uz-UZ");
}

async function load() {
  try {
    data.value = await api("/api/students/active");
    updatedAt.value = Date.now();
    // Hozir hech kim onlayn bo'lmasa — birinchi ochilishda bo'sh ro'yxat ko'rsatmaymiz
    if (loading.value && !data.value.summary.online) filter.value = "all";
  } catch {}
  loading.value = false;
}

onMounted(() => {
  load();
  timer = setInterval(load, 15000);
  tick = setInterval(() => { now.value = Date.now(); }, 5000);
});
onUnmounted(() => { clearInterval(timer); clearInterval(tick); });
useLive(["users", "activity", "classes"], load);
</script>

<style scoped>
.page-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px; }
.live { display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:hsl(var(--muted-fg));padding:6px 12px;border-radius:99px;background:hsl(var(--card));border:1px solid hsl(var(--border)); }
.dot { width:7px;height:7px;border-radius:50%;background:hsl(142 70% 42%);box-shadow:0 0 0 3px hsl(142 70% 42%/.2);display:inline-block; }

.stats-grid { display:grid;gap:10px;margin-bottom:16px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); }
.stat-card { display:flex;align-items:center;gap:12px;padding:14px;text-align:left;cursor:pointer;font-family:inherit;color:inherit;transition:all .15s; }
.stat-card:hover { border-color:hsl(var(--primary)/.4); }
.stat-card--on { border-color:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary)/.12); }
.stat-icon { width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.stat-value { font-size:1.3rem;font-weight:800;line-height:1.1; }
.stat-label { font-size:12px;color:hsl(var(--muted-fg));margin-top:2px; }

.toolbar { display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap; }
.search { position:relative;flex:1;min-width:220px; }
.search-ico { position:absolute;left:12px;top:50%;transform:translateY(-50%);color:hsl(var(--muted-fg)); }
.search input { padding-left:36px; }
.class-select { width:180px; }

.list { display:flex;flex-direction:column;gap:8px; }
.empty-card { padding:40px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px; }
.empty-title { font-weight:700; }
.empty-sub { font-size:13px;color:hsl(var(--muted-fg)); }

.table-card { padding:0;overflow-x:auto; }
.st-table { width:100%;border-collapse:collapse;font-size:13px;min-width:640px; }
.st-table th { text-align:left;font-size:11.5px;font-weight:700;color:hsl(var(--muted-fg));padding:10px 14px;border-bottom:1px solid hsl(var(--border));white-space:nowrap; }
.st-table td { padding:10px 14px;border-bottom:1px solid hsl(var(--border)/.6); }
.st-table tr:last-child td { border-bottom:none; }
.r { text-align:right !important; }
.strong { font-weight:800;color:hsl(var(--primary)); }
.muted { color:hsl(var(--muted-fg));font-size:12.5px;white-space:nowrap; }
.who { display:flex;align-items:center;gap:10px; }
.av { position:relative;width:34px;height:34px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,hsl(var(--primary)),hsl(172 70% 38%));color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;overflow:hidden; }
.av img { width:100%;height:100%;object-fit:cover; }
.av--on::after { content:"";position:absolute;right:1px;bottom:1px;width:9px;height:9px;border-radius:50%;background:hsl(142 70% 42%);border:2px solid hsl(var(--card)); }
.nm { font-weight:600; }
.un { font-size:11.5px;color:hsl(var(--muted-fg)); }
.cls-pill { font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:99px;background:hsl(var(--primary)/.1);color:hsl(var(--primary));white-space:nowrap; }
.sec { margin-left:5px;font-size:13px; }
.status { display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:3px 10px;border-radius:99px;white-space:nowrap; }
.status--on { background:hsl(142 60% 40%/.12);color:hsl(142 55% 28%); }
.status--today { background:hsl(174 65% 30%/.12);color:hsl(174 65% 26%); }
.status--week { background:#8b5cf61a;color:#7c3aed; }
.status--off { background:hsl(var(--muted));color:hsl(var(--muted-fg)); }
</style>
