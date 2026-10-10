<template>
  <div class="fade-in dash">
    <!-- Sarlavha -->
    <header class="dash-head">
      <div>
        <h1 class="geo-page-title">{{ settings.t('dashboard_title') }}</h1>
        <p class="geo-page-sub">Platforma bo'yicha to'liq tahlil · {{ today }}</p>
      </div>
      <div class="head-tools">
        <div class="range-switch">
          <button v-for="r in RANGES" :key="r.days" class="range-btn"
                  :class="{ 'range-btn--on': range === r.days }" @click="range = r.days">
            {{ r.label }}
          </button>
        </div>
        <span class="live-chip" :class="{ 'live-chip--paused': paused }">
          <span class="live-dot"></span>{{ paused ? 'Pauza' : 'Jonli' }} · {{ updatedAt || '—' }}
        </span>
        <button class="icon-btn" title="Yangilash" @click="load()">
          <RefreshCw :size="15" :class="{ spin: refreshing }" />
        </button>
      </div>
    </header>

    <!-- Asosiy KPI -->
    <div class="kpi-grid">
      <StatCard :icon="Users" label="O'quvchilar" :value="k.students?.total ?? 0"
                :sub="`${k.students?.activeWeek ?? 0} tasi shu hafta faol`"
                :delta="k.students?.delta" color="hsl(var(--chart-1))"
                :spark="spark('students')" :loading="loading" to="/ratings" />
      <StatCard :icon="ClipboardCheck" label="Bugungi testlar" :value="k.tests?.today ?? 0"
                :sub="`Haftada ${k.tests?.week ?? 0} ta · o'rtacha ${k.tests?.avgWeek ?? 0}%`"
                :delta="k.tests?.delta" color="hsl(var(--chart-3))"
                :spark="spark('tests')" spark-type="bar" :loading="loading" to="/results" />
      <StatCard :icon="Eye" label="Video ko'rishlari" :value="k.videos?.totalViews ?? 0"
                :sub="`${k.videos?.completed ?? 0} ta oxirigacha · o'rtacha ${k.videos?.avgCompletion ?? 0}%`"
                :delta="k.videos?.delta" color="hsl(var(--chart-4))"
                :spark="spark('videoViews')" :loading="loading" to="/videos" />
      <StatCard :icon="Target" label="O'rtacha natija" :value="k.tests?.avgPercentage ?? 0" unit="%"
                :sub="`O'zlashtirish ${k.tests?.passRate ?? 0}%`"
                color="hsl(var(--chart-2))" :spark="spark('avgPercentage')" :loading="loading" />
    </div>

    <!-- Kichik ko'rsatkichlar -->
    <div class="mini-strip">
      <div class="mini" :class="{ 'mini--live': k.students?.online }">
        <span class="mini-dot" :class="{ 'mini-dot--on': k.students?.online }"></span>
        <b>{{ k.students?.online ?? 0 }}</b><span>Onlayn</span>
      </div>
      <div class="mini"><BookOpen :size="14" /><b>{{ k.content?.lessons ?? 0 }}</b><span>Dars</span></div>
      <div class="mini"><Layers :size="14" /><b>{{ k.content?.topics ?? 0 }}</b><span>Mavzu</span></div>
      <div class="mini"><FileQuestion :size="14" /><b>{{ k.content?.questions ?? 0 }}</b><span>Savol</span></div>
      <div class="mini"><Video :size="14" /><b>{{ k.content?.videos ?? 0 }}</b><span>Video</span></div>
      <div class="mini" :class="{ 'mini--warn': k.homework?.ungraded }">
        <ClipboardCheck :size="14" /><b>{{ k.homework?.ungraded ?? 0 }}</b><span>Baholanmagan</span>
      </div>
      <div class="mini"><Bot :size="14" /><b>{{ k.ai?.questions ?? 0 }}</b><span>AI savol</span></div>
      <div class="mini"><Trophy :size="14" /><b>{{ k.tests?.total ?? 0 }}</b><span>Jami test</span></div>
    </div>

    <!-- Dinamika + ko'rish holati -->
    <div class="dash-grid grid-main">
      <PanelCard title="Faollik dinamikasi" :subtitle="`Oxirgi ${range} kun`" :icon="Activity"
                 :loading="loading" color="hsl(var(--chart-1))">
        <template #actions>
          <div class="legend-inline">
            <span><i style="background:hsl(var(--chart-1))"></i>Testlar</span>
            <span><i style="background:hsl(var(--chart-4))"></i>Video</span>
            <span><i style="background:hsl(var(--chart-2))"></i>Uy ishi</span>
          </div>
        </template>
        <ChartArea :series="activitySeries" :labels="rangeLabels" :tooltip-titles="rangeFullLabels"
                   :height="250" :max-labels="range > 14 ? 10 : 7" />
      </PanelCard>

      <PanelCard title="Videolarni ko'rish holati" subtitle="Barcha o'quvchilar bo'yicha"
                 :icon="MonitorPlay" :loading="loading" color="hsl(var(--chart-4))"
                 :empty="!watchTotal" empty-text="Hali video ko'rilmagan">
        <div class="watch-panel">
          <ChartDonut :items="watchItems" :size="140" :thickness="17"
                      center-label="ko'rish" :center-value="watchTotal" />
          <div class="watch-summary">
            <ChartRing :value="k.videos?.avgCompletion ?? 0" :size="88" :thickness="9"
                       color="hsl(var(--chart-4))" label="o'rtacha ko'rildi" />
            <p class="watch-note">
              <b>{{ k.videos?.completed ?? 0 }}</b> ta ko'rish oxirigacha yetkazilgan
            </p>
          </div>
        </div>
      </PanelCard>
    </div>

    <!-- Sinflar / natijalar / soatlar -->
    <div class="dash-grid grid-3">
      <PanelCard title="Sinflar kesimi" subtitle="O'quvchi va o'rtacha natija" :icon="GraduationCap"
                 :loading="loading" color="hsl(var(--chart-2))" :empty="!gradeRows.length"
                 empty-text="Sinflar bo'yicha ma'lumot yo'q">
        <ChartBars :labels="gradeLabels" :series="gradeSeries" :height="150" />
        <ul class="grade-list">
          <li v-for="g in gradeRows" :key="g.grade" class="grade-row">
            <span class="grade-tag">{{ g.grade }}</span>
            <div class="grade-bar"><div class="grade-fill" :style="{ width: g.avgPercentage + '%' }"></div></div>
            <b class="grade-pct">{{ g.avgPercentage }}%</b>
            <span v-if="g.online" class="grade-online"><i></i>{{ g.online }}</span>
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="Natijalar taqsimoti" subtitle="Barcha urinishlar" :icon="BarChart3"
                 :loading="loading" color="hsl(var(--chart-3))" :empty="!k.tests?.total"
                 empty-text="Hali test ishlanmagan">
        <ChartBars :labels="bucketLabels" :series="bucketSeries" :height="170" />
        <div class="bucket-note">
          <span class="dot dot-ok"></span> 60% dan yuqori — {{ k.tests?.passRate ?? 0 }}%
        </div>
      </PanelCard>

      <PanelCard title="Faol soatlar" subtitle="Oxirgi 7 kun · qachon ishlashadi" :icon="Clock"
                 :loading="loading" color="hsl(var(--chart-5))">
        <ChartHeat :cells="hourCells" :columns="12" :show-labels="true"
                   color="var(--chart-5)" min-label="sokin" max-label="gavjum" />
        <div class="weekday-mini">
          <div v-for="d in weekdays" :key="d.label" class="wd">
            <div class="wd-bar-wrap">
              <div class="wd-bar" :style="{ height: wdHeight(d) }"></div>
            </div>
            <span>{{ d.label }}</span>
          </div>
        </div>
      </PanelCard>
    </div>

    <!-- Videolar bo'yicha jalb qilinganlik -->
    <PanelCard title="Videolar bo'yicha jalb qilinganlik"
               subtitle="Har bir video qancha ko'rilgan" :icon="Video"
               :loading="loading" color="hsl(var(--chart-4))"
               :empty="!videoRows.length" empty-text="Hali video qo'shilmagan">
      <template #actions>
        <RouterLink to="/videos" class="link-btn">Videolar <ChevronRight :size="13" /></RouterLink>
      </template>
      <div class="vid-table">
        <div v-for="v in videoRows" :key="v.id" class="vid-row">
          <div class="vid-main">
            <p class="vid-title">{{ v.title }}</p>
            <p class="vid-sub">{{ v.grade }}-sinf · {{ v.viewers }} o'quvchi · {{ v.totalViews }} marta</p>
          </div>
          <div class="vid-bar">
            <WatchBar :percent="v.avgPercent" :label="`O'rtacha ${v.avgPercent}%`" />
          </div>
          <div class="vid-stats">
            <span class="chip chip-ok" :title="'Oxirigacha ko\'rganlar'">
              <CheckCircle2 :size="11" /> {{ v.completed }}
            </span>
            <span class="chip chip-half" :title="'Yarmidan oshirganlar'">
              <PlayCircle :size="11" /> {{ v.half }}
            </span>
          </div>
        </div>
      </div>
    </PanelCard>

    <!-- Kim ko'rdi / top / e'tibor -->
    <div class="dash-grid grid-3">
      <PanelCard title="Videoni kim ko'rdi" subtitle="Jonli lenta · qanchasini ko'rgani bilan"
                 :icon="Eye" color="hsl(var(--chart-4))" :loading="loading"
                 :empty="!videoViews.length" empty-text="Hali hech kim video ko'rmagan">
        <ul class="feed">
          <li v-for="v in videoViews" :key="v.videoId + '-' + v.userId"
              class="feed-row" :class="{ 'feed-row--new': isFresh(v.lastViewedAt) }">
            <div class="feed-avatar">{{ initial(v.studentName) }}</div>
            <div class="feed-main">
              <p class="feed-name">
                {{ v.studentName }}
                <span v-if="v.grade" class="feed-grade">{{ v.grade }}-sinf</span>
                <span class="feed-time">{{ timeAgo(v.lastViewedAt) }}</span>
              </p>
              <p class="feed-sub"><Play :size="9" /> {{ v.videoTitle }}</p>
              <WatchBar :percent="v.percent" :status="v.status" :label="v.statusLabel" />
            </div>
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="Top o'quvchilar" subtitle="Ball bo'yicha" :icon="Trophy"
                 color="hsl(var(--chart-3))" :loading="loading"
                 :empty="!topStudents.length" empty-text="Hali o'quvchilar yo'q">
        <template #actions>
          <RouterLink to="/ratings" class="link-btn">Reyting <ChevronRight :size="13" /></RouterLink>
        </template>
        <ol class="rank-list">
          <li v-for="(s, i) in topStudents.slice(0, 7)" :key="s.userId" class="rank-row">
            <span class="rank-pos" :class="`rank-${i + 1}`"><Medal v-if="i < 3" :size="18" :class="`medal-${i + 1}`" /><template v-else>{{ i + 1 }}</template></span>
            <div class="rank-avatar">{{ initial(s.name) }}</div>
            <div class="rank-info">
              <p class="rank-name">{{ s.name }}</p>
              <p class="rank-sub">{{ s.className || `${s.grade}-sinf` }} · {{ s.testsCompleted }} test · {{ s.avgPercentage }}%</p>
            </div>
            <span class="rank-score"><Star :size="11" />{{ s.totalScore }}</span>
          </li>
        </ol>
      </PanelCard>

      <PanelCard title="E'tibor talab qiladi" subtitle="Yordam kerak bo'lgan o'quvchilar"
                 :icon="AlertTriangle" color="hsl(var(--chart-4))" :loading="loading"
                 :empty="!atRisk.length" empty-text="Hammasi yaxshi ketyapti">
        <ul class="risk-list">
          <li v-for="r in atRisk" :key="r.userId" class="risk-row">
            <div class="risk-avatar">{{ initial(r.name) }}</div>
            <div class="risk-info">
              <p class="risk-name">{{ r.name }} <span>{{ r.grade }}-sinf</span></p>
              <p class="risk-reason">{{ r.reason }}</p>
            </div>
            <span v-if="r.daysInactive !== null" class="risk-days">{{ r.daysInactive }} kun</span>
            <span v-else class="risk-days risk-days--never">yangi</span>
          </li>
        </ul>
      </PanelCard>
    </div>

    <!-- Mavzular / faoliyat / onlayn -->
    <div class="dash-grid grid-3">
      <PanelCard title="Eng qiyin mavzular" subtitle="O'rtacha natija bo'yicha" :icon="Target"
                 color="hsl(var(--chart-4))" :loading="loading"
                 :empty="!hardTopics.length" empty-text="Hali natijalar yo'q">
        <ul class="topic-list">
          <li v-for="t in hardTopics" :key="t.title" class="topic-row">
            <div class="topic-info">
              <p class="topic-name" :title="t.title">{{ t.title }}</p>
              <p class="topic-sub">{{ t.attempts }} urinish · {{ t.students }} o'quvchi</p>
            </div>
            <div class="topic-bar">
              <div class="topic-fill" :style="{ width: t.avgPercentage + '%', background: pctColor(t.avgPercentage) }"></div>
            </div>
            <b class="topic-pct" :style="{ color: pctColor(t.avgPercentage) }">{{ t.avgPercentage }}%</b>
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="So'nggi faoliyat" subtitle="Test natijalari" :icon="Activity"
                 color="hsl(var(--chart-1))" :loading="loading"
                 :empty="!activity.length" empty-text="Hali faoliyat yo'q">
        <template #actions>
          <RouterLink to="/results" class="link-btn">Barchasi <ChevronRight :size="13" /></RouterLink>
        </template>
        <ul class="act-list">
          <li v-for="a in activity.slice(0, 8)" :key="a.id" class="act-row"
              :class="{ 'feed-row--new': isFresh(a.createdAt) }">
            <span class="act-dot" :style="{ background: pctColor(a.percentage) }"></span>
            <div class="act-info">
              <p class="act-name">{{ a.studentName }} <span v-if="a.grade">· {{ a.grade }}-sinf</span></p>
              <p class="act-sub">{{ a.topicTitle }} · {{ timeAgo(a.createdAt) }}</p>
            </div>
            <span class="act-pct" :style="{ color: pctColor(a.percentage), background: pctBg(a.percentage) }">
              {{ a.percentage }}%
            </span>
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="Hozir saytda" :subtitle="`Oxirgi 5 daqiqa · ${onlineList.length} ta`"
                 :icon="Radio" color="hsl(var(--success))" :loading="loading"
                 :empty="!onlineList.length" empty-text="Hozir hech kim yo'q">
        <ul class="online-list">
          <li v-for="u in onlineList" :key="u.id" class="online-row">
            <span class="online-pulse"></span>
            <div class="online-avatar">{{ initial(u.name) }}</div>
            <div class="online-info">
              <p class="online-name">{{ u.name }}</p>
              <p class="online-sub">{{ u.className || `${u.grade}-sinf` }} · {{ timeAgo(u.lastSeenAt) }}</p>
            </div>
          </li>
        </ul>
        <div v-if="recentSubs.length" class="subs-block">
          <p class="subs-title">So'nggi topshiriqlar</p>
          <div v-for="s in recentSubs" :key="s.id" class="subs-row">
            <ClipboardCheck :size="12" />
            <span class="subs-name">{{ s.studentName }}</span>
            <span class="subs-hw">{{ s.homeworkTitle }}</span>
            <span v-if="s.grade != null" class="subs-grade">{{ s.grade }}</span>
            <span v-else class="subs-pending">yangi</span>
          </div>
        </div>
      </PanelCard>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { RouterLink } from "vue-router";
import {
  Users, ClipboardCheck, Eye, Target, BookOpen, Layers, FileQuestion, Video, Bot,
  Trophy, Activity, RefreshCw, Play, Star, AlertTriangle, Clock, BarChart3,
  GraduationCap, Radio, ChevronRight, CheckCircle2, PlayCircle, MonitorPlay,
} from "lucide-vue-next";
import { Medal } from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useSettingsStore } from "@shared/stores/settings";
import StatCard from "@shared/components/charts/StatCard.vue";
import PanelCard from "@shared/components/charts/PanelCard.vue";
import ChartArea from "@shared/components/charts/ChartArea.vue";
import ChartBars from "@shared/components/charts/ChartBars.vue";
import ChartDonut from "@shared/components/charts/ChartDonut.vue";
import ChartRing from "@shared/components/charts/ChartRing.vue";
import ChartHeat from "@shared/components/charts/ChartHeat.vue";
import WatchBar from "@shared/components/charts/WatchBar.vue";

const settings = useSettingsStore();

const RANGES = [{ days: 7, label: "7 kun" }, { days: 14, label: "14 kun" }, { days: 30, label: "30 kun" }];
const range = ref(7);

const loading = ref(true);
const refreshing = ref(false);
const paused = ref(false);
const updatedAt = ref("");
const data = ref({});
const activity = ref([]);

const k = computed(() => data.value.kpi ?? {});
const series = computed(() => data.value.series ?? {});
const lists = computed(() => data.value.lists ?? {});
const topStudents = computed(() => data.value.topStudents ?? []);
const videoViews = computed(() => lists.value.recentVideoViews ?? []);
const onlineList = computed(() => lists.value.onlineStudents ?? []);
const atRisk = computed(() => lists.value.atRisk ?? []);
const recentSubs = computed(() => (lists.value.recentSubmissions ?? []).slice(0, 4));
const gradeRows = computed(() => (series.value.grades ?? []).filter(g => g.students > 0));
const buckets = computed(() => series.value.scoreBuckets ?? []);
const gradeLabels = computed(() => gradeRows.value.map(g => `${g.grade}-sinf`));
const gradeSeries = computed(() => [
  { key: "st", label: "O'quvchi", values: gradeRows.value.map(g => g.students), color: "hsl(var(--chart-2))" },
  { key: "ts", label: "Test", values: gradeRows.value.map(g => g.tests), color: "hsl(var(--chart-1))" },
]);
const bucketLabels = computed(() => buckets.value.map(b => b.label));
const bucketSeries = computed(() => [
  { key: "c", label: "Urinish", values: buckets.value.map(b => b.count), color: "hsl(var(--chart-3))" },
]);

const hardTopics = computed(() => (series.value.topicPerformance ?? []).slice(0, 6));
const videoRows = computed(() => (series.value.videoEngagement ?? []).slice(0, 6));
const weekdays = computed(() => series.value.weekday ?? []);

const today = computed(() =>
  new Date().toLocaleDateString(settings.language === "ru" ? "ru-RU" : "uz-UZ",
    { day: "numeric", month: "long", year: "numeric" })
);

// ── Grafik qatorlari ──
const rangeDays = computed(() => (series.value.daily30 ?? []).slice(-range.value));
const rangeLabels = computed(() => rangeDays.value.map(d => shortDate(d.date)));
const rangeFullLabels = computed(() => rangeDays.value.map(d => longDate(d.date)));

const activitySeries = computed(() => [
  { key: "tests", label: "Testlar", values: rangeDays.value.map(d => d.tests), color: "hsl(var(--chart-1))" },
  { key: "views", label: "Video ko'rish", values: rangeDays.value.map(d => d.videoViews), color: "hsl(var(--chart-4))" },
  { key: "hw", label: "Uy ishi", values: rangeDays.value.map(d => d.submissions), color: "hsl(var(--chart-2))" },
]);

/** KPI kartalari uchun 14 kunlik mini qator. */
function spark(field) {
  const days = (series.value.daily30 ?? []).slice(-14);
  if (field === "students") return days.map(d => d.students);
  return days.map(d => d[field] ?? 0);
}

const watchItems = computed(() =>
  (series.value.watchBreakdown ?? [])
    .filter(w => w.count > 0)
    .map(w => ({
      label: w.label,
      value: w.count,
      color: {
        completed: "hsl(var(--success))",
        half: "hsl(var(--warning))",
        started: "hsl(var(--chart-5))",
        opened: "hsl(var(--muted-fg))",
      }[w.key],
    }))
);
const watchTotal = computed(() => watchItems.value.reduce((s, w) => s + w.value, 0));

const hourCells = computed(() =>
  (series.value.hourly ?? []).map(h => ({
    label: `${String(h.hour).padStart(2, "0")}:00`,
    short: String(h.hour).padStart(2, "0"),
    value: (h.tests || 0) + (h.views || 0),
  }))
);

function wdHeight(d) {
  const max = Math.max(1, ...weekdays.value.map(x => x.tests));
  return `${Math.max(6, (d.tests / max) * 100)}%`;
}

// ── Formatlash ──
function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function longDate(iso) {
  return new Date(iso).toLocaleDateString(settings.language === "ru" ? "ru-RU" : "uz-UZ",
    { weekday: "short", day: "numeric", month: "long" });
}
function timeAgo(iso) {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hozir";
  if (min < 60) return `${min} daq`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} soat`;
  return `${Math.floor(h / 24)} kun`;
}
function isFresh(iso) {
  return iso ? Date.now() - new Date(iso).getTime() < 2 * 60 * 1000 : false;
}
function initial(name) { return (name || "?").trim().charAt(0).toUpperCase(); }
function pctColor(p) {
  const v = Math.round(p || 0);
  if (v >= 80) return "hsl(var(--success))";
  if (v >= 60) return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
}
function pctBg(p) {
  const v = Math.round(p || 0);
  if (v >= 80) return "hsl(var(--success) / .12)";
  if (v >= 60) return "hsl(var(--warning) / .12)";
  return "hsl(var(--destructive) / .12)";
}

// ── Jonli yangilanish ──
const REFRESH_MS = 8000;
let timer = null;

async function load() {
  if (document.hidden) return;
  refreshing.value = true;
  try {
    const [dash, act] = await Promise.all([
      api("/api/analytics/dashboard"),
      api("/api/analytics/activity"),
    ]);
    data.value = dash ?? {};
    activity.value = act ?? [];
    updatedAt.value = new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {}
  loading.value = false;
  refreshing.value = false;
}

function onVisibility() {
  paused.value = document.hidden;
  if (!document.hidden) load();
}

onMounted(() => {
  load();
  timer = setInterval(load, REFRESH_MS);
  document.addEventListener("visibilitychange", onVisibility);
});
onUnmounted(() => {
  clearInterval(timer);
  document.removeEventListener("visibilitychange", onVisibility);
});
useLive(["users", "activity", "video_views", "videos", "lessons", "topics", "games",
  "homework", "homework_submissions", "ai_logs", "classes", "test_variants"], load, { delay: 800 });
</script>

<style scoped>
.medal-1 { color: #d4a017; }
.medal-2 { color: #8e9aa6; }
.medal-3 { color: #b36a2e; }
.dash { display: flex; flex-direction: column; gap: 14px; }

/* Sarlavha */
.dash-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 2px; }
.head-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.range-switch { display: flex; background: hsl(var(--muted)); border-radius: 99px; padding: 3px; gap: 2px; }
.range-btn {
  border: none; background: transparent; cursor: pointer; font-family: inherit;
  font-size: 11.5px; font-weight: 600; color: hsl(var(--muted-fg));
  padding: 5px 12px; border-radius: 99px; transition: all .15s;
}
.range-btn--on { background: hsl(var(--card)); color: hsl(var(--primary)); box-shadow: 0 1px 3px rgb(0 0 0 / .1); }
.live-chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 600; color: hsl(var(--success));
  background: hsl(var(--success) / .1); border: 1px solid hsl(var(--success) / .22);
  padding: 6px 11px; border-radius: 99px;
}
.live-chip--paused { color: hsl(var(--muted-fg)); background: hsl(var(--muted)); border-color: hsl(var(--border)); }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: blink 1.7s infinite; }
@keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
.icon-btn {
  width: 32px; height: 32px; border-radius: 10px; cursor: pointer;
  border: 1px solid hsl(var(--border)); background: hsl(var(--card)); color: hsl(var(--muted-fg));
  display: flex; align-items: center; justify-content: center; transition: all .15s;
}
.icon-btn:hover { color: hsl(var(--primary)); border-color: hsl(var(--primary) / .5); }
.spin { animation: rot 1s linear infinite; }
@keyframes rot { to { transform: rotate(360deg) } }

/* Setkalar */
.kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (min-width: 1000px) { .kpi-grid { grid-template-columns: repeat(4, 1fr); } }
.dash-grid { display: grid; gap: 12px; }
.grid-main { grid-template-columns: 1fr; }
@media (min-width: 1050px) { .grid-main { grid-template-columns: 1.65fr 1fr; } }
.grid-3 { grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); }

/* Kichik ko'rsatkichlar */
.mini-strip {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
}
@media (min-width: 640px) { .mini-strip { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1100px) { .mini-strip { grid-template-columns: repeat(8, 1fr); } }
.mini {
  display: flex; align-items: center; gap: 6px;
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 12px; padding: 9px 11px; color: hsl(var(--muted-fg));
  transition: border-color .15s;
}
.mini:hover { border-color: hsl(var(--primary) / .4); }
.mini b { font-size: 15px; font-weight: 800; color: hsl(var(--fg)); }
.mini span { font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mini--warn b { color: hsl(var(--warning)); }
.mini--live { border-color: hsl(var(--success) / .35); }
.mini-dot { width: 8px; height: 8px; border-radius: 50%; background: hsl(var(--border)); flex-shrink: 0; }
.mini-dot--on { background: hsl(var(--success)); box-shadow: 0 0 0 3px hsl(var(--success) / .18); }

/* Legenda */
.legend-inline { display: flex; gap: 10px; flex-wrap: wrap; }
.legend-inline span { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: hsl(var(--muted-fg)); }
.legend-inline i { width: 8px; height: 8px; border-radius: 2px; }

/* Ko'rish paneli */
.watch-panel { display: flex; flex-direction: column; gap: 14px; }
.watch-summary { display: flex; align-items: center; gap: 14px; padding-top: 12px; border-top: 1px dashed hsl(var(--border)); }
.watch-note { font-size: 12px; color: hsl(var(--muted-fg)); line-height: 1.5; }
.watch-note b { color: hsl(var(--fg)); font-size: 14px; }

/* Sinflar */
.grade-list { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.grade-row { display: flex; align-items: center; gap: 8px; }
.grade-tag { width: 26px; height: 22px; border-radius: 7px; background: hsl(var(--muted)); font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.grade-bar { flex: 1; height: 6px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
.grade-fill { height: 100%; background: hsl(var(--chart-2)); border-radius: 99px; transition: width .6s; }
.grade-pct { font-size: 11.5px; font-weight: 800; width: 34px; text-align: right; }
.grade-online { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; color: hsl(var(--success)); font-weight: 700; }
.grade-online i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

.bucket-note { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: hsl(var(--muted-fg)); margin-top: 12px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot-ok { background: hsl(var(--success)); }

/* Hafta kunlari */
.weekday-mini { display: flex; gap: 5px; margin-top: 14px; }
.wd { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.wd-bar-wrap { width: 100%; height: 34px; display: flex; align-items: flex-end; }
.wd-bar { width: 100%; background: hsl(var(--chart-5) / .55); border-radius: 4px 4px 0 0; transition: height .5s; }
.wd span { font-size: 9.5px; color: hsl(var(--muted-fg)); }

/* Videolar jadvali */
.vid-table { display: flex; flex-direction: column; gap: 4px; }
.vid-row {
  display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(120px, 1fr) auto;
  align-items: center; gap: 12px; padding: 9px 10px; border-radius: 11px; transition: background .15s;
}
.vid-row:hover { background: hsl(var(--muted) / .6); }
.vid-title { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vid-sub { font-size: 11px; color: hsl(var(--muted-fg)); margin-top: 2px; }
.vid-stats { display: flex; gap: 5px; }
.chip { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 99px; }
.chip-ok { color: hsl(var(--success)); background: hsl(var(--success) / .12); }
.chip-half { color: hsl(var(--warning)); background: hsl(var(--warning) / .12); }
@media (max-width: 700px) { .vid-row { grid-template-columns: 1fr; gap: 6px; } }

/* Lenta */
.feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; max-height: 400px; overflow-y: auto; }
.feed-row { display: flex; gap: 10px; padding: 9px 10px; border-radius: 12px; transition: background .15s; }
.feed-row:hover { background: hsl(var(--muted) / .6); }
.feed-row--new { background: hsl(var(--success) / .07); box-shadow: inset 2px 0 0 hsl(var(--success)); }
.feed-avatar { width: 32px; height: 32px; border-radius: 50%; background: hsl(var(--primary)); color: #fff; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.feed-main { flex: 1; min-width: 0; }
.feed-name { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; }
.feed-grade { font-size: 10px; font-weight: 700; color: hsl(var(--primary)); background: hsl(var(--primary) / .1); padding: 1px 6px; border-radius: 99px; }
.feed-time { margin-left: auto; font-size: 10.5px; color: hsl(var(--muted-fg)); font-weight: 500; flex-shrink: 0; }
.feed-sub { display: flex; align-items: center; gap: 4px; font-size: 11px; color: hsl(var(--muted-fg)); margin: 3px 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Reyting */
.rank-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.rank-row { display: flex; align-items: center; gap: 9px; padding: 7px 8px; border-radius: 11px; transition: background .15s; }
.rank-row:hover { background: hsl(var(--muted) / .6); }
.rank-pos { width: 22px; text-align: center; font-size: 12.5px; font-weight: 800; color: hsl(var(--muted-fg)); flex-shrink: 0; }
.rank-avatar { width: 30px; height: 30px; border-radius: 9px; background: hsl(var(--primary)); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rank-info { flex: 1; min-width: 0; }
.rank-name { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rank-sub { font-size: 10.5px; color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rank-score { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 800; color: hsl(var(--warning)); flex-shrink: 0; }

/* E'tibor */
.risk-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; max-height: 400px; overflow-y: auto; }
.risk-row { display: flex; align-items: center; gap: 9px; padding: 8px; border-radius: 11px; background: hsl(var(--destructive) / .05); }
.risk-avatar { width: 30px; height: 30px; border-radius: 50%; background: hsl(var(--destructive) / .15); color: hsl(var(--destructive)); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.risk-info { flex: 1; min-width: 0; }
.risk-name { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.risk-name span { font-size: 10.5px; color: hsl(var(--muted-fg)); font-weight: 500; }
.risk-reason { font-size: 10.5px; color: hsl(var(--destructive)); }
.risk-days { font-size: 10.5px; font-weight: 700; color: hsl(var(--muted-fg)); flex-shrink: 0; }
.risk-days--never { color: hsl(var(--chart-5)); }

/* Mavzular */
.topic-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.topic-row { display: grid; grid-template-columns: minmax(0, 1fr) 70px 38px; align-items: center; gap: 8px; }
.topic-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topic-sub { font-size: 10px; color: hsl(var(--muted-fg)); }
.topic-bar { height: 6px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
.topic-fill { height: 100%; border-radius: 99px; transition: width .6s; }
.topic-pct { font-size: 11.5px; font-weight: 800; text-align: right; }

/* Faoliyat */
.act-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.act-row { display: flex; align-items: center; gap: 9px; padding: 8px; border-radius: 11px; transition: background .15s; }
.act-row:hover { background: hsl(var(--muted) / .6); }
.act-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.act-info { flex: 1; min-width: 0; }
.act-name { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-name span { font-weight: 500; color: hsl(var(--muted-fg)); font-size: 11px; }
.act-sub { font-size: 10.5px; color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-pct { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 99px; flex-shrink: 0; }

/* Onlayn */
.online-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; max-height: 360px; overflow-y: auto; }
.online-row { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 11px; }
.online-pulse { width: 7px; height: 7px; border-radius: 50%; background: hsl(var(--success)); box-shadow: 0 0 0 0 hsl(var(--success) / .5); animation: pulse 2s infinite; flex-shrink: 0; }
@keyframes pulse { 70% { box-shadow: 0 0 0 7px transparent } 100% { box-shadow: 0 0 0 0 transparent } }
.online-avatar { width: 28px; height: 28px; border-radius: 50%; background: hsl(var(--success) / .15); color: hsl(var(--success)); font-size: 11.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.online-info { min-width: 0; }
.online-name { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.online-sub { font-size: 10.5px; color: hsl(var(--muted-fg)); }

.subs-block { margin-top: 14px; padding-top: 12px; border-top: 1px dashed hsl(var(--border)); }
.subs-title { font-size: 10.5px; font-weight: 700; color: hsl(var(--muted-fg)); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 7px; }
.subs-row { display: flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 4px 0; color: hsl(var(--muted-fg)); }
.subs-name { font-weight: 600; color: hsl(var(--fg)); white-space: nowrap; }
.subs-hw { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.subs-grade { font-weight: 800; color: hsl(var(--success)); }
.subs-pending { font-weight: 700; color: hsl(var(--warning)); }

.link-btn { display: inline-flex; align-items: center; gap: 2px; font-size: 11.5px; font-weight: 600; color: hsl(var(--primary)); text-decoration: none; }
.link-btn:hover { text-decoration: underline; }
</style>
