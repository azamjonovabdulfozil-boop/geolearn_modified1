<template>
  <div class="fade-in dash">
    <!-- Salomlashuv -->
    <header class="hero geo-card">
      <div class="hero-left">
        <div class="hero-avatar">
          <img v-if="me.avatarUrl" :src="me.avatarUrl" class="hero-img" />
          <span v-else>{{ initial(me.name) }}</span>
        </div>
        <div>
          <h1 class="hero-title">{{ greeting }}, {{ firstName }}!</h1>
          <p class="hero-sub">
            {{ me.grade }}-sinf · Sinfda <b>#{{ me.gradeRank ?? '—' }}</b> o'rin ·
            Umumiy <b>#{{ me.rank ?? '—' }}</b>
          </p>
        </div>
      </div>
      <div class="hero-right">
        <div class="streak" :class="{ 'streak--on': kpi.streak > 0 }">
          <Flame :size="17" />
          <div>
            <b>{{ kpi.streak ?? 0 }}</b>
            <span>kun ketma-ket</span>
          </div>
        </div>
        <ChartRing :value="kpi.progress ?? 0" :size="76" :thickness="8" label="o'zlashtirildi" />
      </div>
    </header>

    <!-- KPI -->
    <div class="kpi-grid">
      <StatCard :icon="Trophy" label="Umumiy reyting" :value="`#${me.rank ?? '—'}`"
                :sub="`${me.totalStudents ?? 0} o'quvchi orasida`" color="hsl(var(--chart-3))"
                :loading="loading" to="/ratings" />
      <StatCard :icon="Star" label="Ballaringiz" :value="kpi.points ?? 0"
                :sub="`Shu hafta +${kpi.pointsWeek ?? 0}`" color="hsl(var(--chart-2))"
                :spark="pointsSpark" :loading="loading" />
      <StatCard :icon="Target" label="O'rtacha natija" :value="kpi.avgPercentage ?? 0" unit="%"
                :sub="`Eng yaxshi ${kpi.bestResult ?? 0}% · sinf ${kpi.classAvg ?? 0}%`"
                color="hsl(var(--chart-1))" :spark="avgSpark" :loading="loading" />
      <StatCard :icon="ClipboardCheck" label="Ishlangan testlar" :value="kpi.tests ?? 0"
                :sub="`Shu hafta ${kpi.testsWeek ?? 0} ta`" color="hsl(var(--chart-5))"
                :spark="testsSpark" spark-type="bar" :loading="loading" to="/lessons" />
    </div>

    <!-- Progress halqalari -->
    <div class="rings">
      <div class="ring-item">
        <ChartRing :value="kpi.progress ?? 0" :size="94" :thickness="9" color="hsl(var(--chart-1))" />
        <div class="ring-text">
          <p class="ring-title">Mavzular</p>
          <p class="ring-sub">{{ kpi.topicsSolved ?? 0 }} / {{ kpi.topicsTotal ?? 0 }} ta yechilgan</p>
        </div>
      </div>
      <div class="ring-item">
        <ChartRing :value="videoPct" :size="94" :thickness="9" color="hsl(var(--chart-4))" />
        <div class="ring-text">
          <p class="ring-title">Videolar</p>
          <p class="ring-sub">{{ kpi.videosCompleted ?? 0 }} / {{ kpi.videosTotal ?? 0 }} oxirigacha</p>
        </div>
      </div>
      <div class="ring-item">
        <ChartRing :value="hwPct" :size="94" :thickness="9" color="hsl(var(--chart-2))" />
        <div class="ring-text">
          <p class="ring-title">Uy ishlari</p>
          <p class="ring-sub">{{ kpi.homeworkDone ?? 0 }} / {{ kpi.homeworkTotal ?? 0 }} topshirilgan</p>
        </div>
      </div>
      <div class="ring-item">
        <ChartRing :value="kpi.avgWatch ?? 0" :size="94" :thickness="9" color="hsl(var(--chart-5))" />
        <div class="ring-text">
          <p class="ring-title">Video ko'rish</p>
          <p class="ring-sub">O'rtacha {{ kpi.avgWatch ?? 0 }}% ko'rilgan</p>
        </div>
      </div>
    </div>

    <!-- Grafiklar -->
    <div class="dash-grid grid-main">
      <PanelCard title="Faolligingiz" subtitle="Oxirgi 14 kun" :icon="Activity"
                 :loading="loading" color="hsl(var(--chart-1))">
        <template #actions>
          <div class="legend-inline">
            <span><i style="background:hsl(var(--chart-1))"></i>Testlar</span>
            <span><i style="background:hsl(var(--chart-3))"></i>Ball</span>
          </div>
        </template>
        <ChartArea :series="dailySeries" :labels="dailyLabels" :tooltip-titles="dailyFull" :height="230" />
      </PanelCard>

      <PanelCard title="Natijalar dinamikasi" subtitle="Oxirgi urinishlar" :icon="TrendingUp"
                 :loading="loading" color="hsl(var(--chart-2))"
                 :empty="!trend.length" empty-text="Hali test ishlamagansiz">
        <ChartArea :series="trendSeries" :labels="trendLabels" :tooltip-titles="trendTitles"
                   :height="230" :y-ticks="4" :format-value="v => v + '%'" />
      </PanelCard>
    </div>

    <!-- Mavzular / taqqoslash / taqsimot -->
    <div class="dash-grid grid-3">
      <PanelCard title="Mavzular bo'yicha" subtitle="Qaysi mavzuda kuchlisiz" :icon="BookOpen"
                 :loading="loading" color="hsl(var(--chart-1))"
                 :empty="!topicRows.length" empty-text="Hali natijalar yo'q">
        <ul class="topic-list">
          <li v-for="t in topicRows" :key="t.title" class="topic-row">
            <div class="topic-info">
              <p class="topic-name" :title="t.title">{{ t.title }}</p>
              <p class="topic-sub">{{ t.attempts }} urinish · eng yaxshi {{ t.best }}%</p>
            </div>
            <div class="topic-bar">
              <div class="topic-fill" :style="{ width: t.avgPercentage + '%', background: pctColor(t.avgPercentage) }"></div>
            </div>
            <b class="topic-pct" :style="{ color: pctColor(t.avgPercentage) }">{{ t.avgPercentage }}%</b>
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="Sinf bilan taqqoslash" subtitle="Siz va sinf o'rtachasi" :icon="Users"
                 :loading="loading" color="hsl(var(--chart-2))">
        <ChartBars :labels="compareLabels" :series="compareSeries" :height="150"
                   :format-value="v => v + '%'" />
        <div class="compare-note" :class="compareGood ? 'compare-note--good' : 'compare-note--warn'">
          <component :is="compareGood ? TrendingUp : TrendingDown" :size="13" />
          <span v-if="compareGood">Sinf o'rtachasidan {{ compareDiff }}% yuqoridasiz — zo'r!</span>
          <span v-else>Sinf o'rtachasiga yetish uchun {{ compareDiff }}% kerak</span>
        </div>
        <div class="strengths">
          <div v-if="strengths.length" class="str-block">
            <p class="str-title str-title--good">Kuchli tomonlar</p>
            <span v-for="t in strengths" :key="t.title" class="str-chip str-chip--good">{{ t.title }}</span>
          </div>
          <div v-if="weaknesses.length" class="str-block">
            <p class="str-title str-title--bad">Takrorlash kerak</p>
            <span v-for="t in weaknesses" :key="t.title" class="str-chip str-chip--bad">{{ t.title }}</span>
          </div>
        </div>
      </PanelCard>

      <PanelCard title="Natijalar taqsimoti" subtitle="Barcha urinishlaringiz" :icon="BarChart3"
                 :loading="loading" color="hsl(var(--chart-3))"
                 :empty="!kpi.tests" empty-text="Hali test ishlamagansiz">
        <ChartDonut :items="bucketItems" :size="136" :thickness="16"
                    center-label="urinish" :center-value="kpi.tests ?? 0" />
      </PanelCard>
    </div>

    <!-- Videolar / natijalar / uy ishi -->
    <div class="dash-grid grid-3">
      <PanelCard title="Videolarim" subtitle="Qanchasini ko'rgansiz" :icon="Video"
                 :loading="loading" color="hsl(var(--chart-4))"
                 :empty="!videos.length" empty-text="Sinfingiz uchun video yo'q">
        <template #actions>
          <RouterLink to="/videos" class="link-btn">Barchasi <ChevronRight :size="13" /></RouterLink>
        </template>
        <ul class="vid-list">
          <li v-for="v in videos" :key="v.id" class="vid-row">
            <div class="vid-head">
              <p class="vid-title" :title="v.title">{{ v.title }}</p>
              <span class="vid-pct">{{ v.percent }}%</span>
            </div>
            <WatchBar :percent="v.percent" :status="v.status || 'opened'"
                      :label="v.statusLabel" />
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="So'nggi natijalar" subtitle="Oxirgi testlaringiz" :icon="ClipboardCheck"
                 :loading="loading" color="hsl(var(--chart-1))"
                 :empty="!recent.length" empty-text="Hali testlar ishlanmagan">
        <template #empty-action>
          <RouterLink to="/lessons" class="geo-btn-primary btn-go">Darslarni ko'rish</RouterLink>
        </template>
        <ul class="act-list">
          <li v-for="a in recent" :key="a.id" class="act-row">
            <span class="act-dot" :style="{ background: pctColor(a.percentage) }"></span>
            <div class="act-info">
              <p class="act-name">{{ a.topicTitle }}</p>
              <p class="act-sub">{{ a.correct }}/{{ a.total }} to'g'ri · {{ timeAgo(a.createdAt) }}</p>
            </div>
            <span class="act-pct" :style="{ color: pctColor(a.percentage), background: pctBg(a.percentage) }">
              {{ Math.round(a.percentage) }}%
            </span>
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="Sinf reytingi" :subtitle="`${me.grade}-sinf top 5`" :icon="Medal"
                 :loading="loading" color="hsl(var(--chart-3))"
                 :empty="!classTop.length" empty-text="Reyting bo'sh">
        <ol class="rank-list">
          <li v-for="(s, i) in classTop" :key="s.userId" class="rank-row"
              :class="{ 'rank-row--me': s.userId === me.id }">
            <span class="rank-pos"><Medal v-if="i < 3" :size="18" :class="`medal-${i + 1}`" /><template v-else>{{ i + 1 }}</template></span>
            <div class="rank-avatar">{{ initial(s.name) }}</div>
            <div class="rank-info">
              <p class="rank-name">{{ s.name }}<span v-if="s.userId === me.id"> (siz)</span></p>
              <p class="rank-sub">{{ s.testsCompleted }} test · {{ s.avgPercentage }}%</p>
            </div>
            <span class="rank-score"><Star :size="11" />{{ s.totalScore }}</span>
          </li>
        </ol>

        <div v-if="pendingHw.length" class="hw-block">
          <p class="hw-title"><ClipboardList :size="12" /> Topshirilmagan uy ishlari</p>
          <RouterLink v-for="h in pendingHw" :key="h.id" to="/homework" class="hw-row">
            <span class="hw-name">{{ h.title }}</span>
            <ChevronRight :size="13" />
          </RouterLink>
        </div>
      </PanelCard>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { RouterLink } from "vue-router";
import {
  Trophy, Star, Target, ClipboardCheck, Activity, TrendingUp, TrendingDown,
  BookOpen, Users, BarChart3, Video, Medal, ChevronRight, Flame, ClipboardList,
} from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useAuthStore } from "@shared/stores/auth";
import StatCard from "@shared/components/charts/StatCard.vue";
import PanelCard from "@shared/components/charts/PanelCard.vue";
import ChartArea from "@shared/components/charts/ChartArea.vue";
import ChartBars from "@shared/components/charts/ChartBars.vue";
import ChartDonut from "@shared/components/charts/ChartDonut.vue";
import ChartRing from "@shared/components/charts/ChartRing.vue";
import WatchBar from "@shared/components/charts/WatchBar.vue";

const auth = useAuthStore();
const loading = ref(true);
const data = ref({});

const me = computed(() => data.value.me ?? { name: auth.user?.name, grade: auth.user?.grade });
const kpi = computed(() => data.value.kpi ?? {});
const series = computed(() => data.value.series ?? {});
const lists = computed(() => data.value.lists ?? {});

const firstName = computed(() => (me.value.name || "").split(" ")[0] || "do'stim");
const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 11) return "Xayrli tong";
  if (h < 17) return "Xayrli kun";
  return "Xayrli kech";
});

const daily = computed(() => series.value.daily14 ?? []);
const dailyLabels = computed(() => daily.value.map(d => shortDate(d.date)));
const dailyFull = computed(() => daily.value.map(d => longDate(d.date)));
const dailySeries = computed(() => [
  { key: "tests", label: "Testlar", values: daily.value.map(d => d.tests), color: "hsl(var(--chart-1))" },
  { key: "points", label: "Ball", values: daily.value.map(d => d.points), color: "hsl(var(--chart-3))" },
]);

const trend = computed(() => series.value.scoreTrend ?? []);
const trendLabels = computed(() => trend.value.map(t => shortDate(t.date)));
const trendTitles = computed(() => trend.value.map(t => t.title || "Test"));
const trendSeries = computed(() => [
  { key: "pct", label: "Natija", values: trend.value.map(t => t.percentage), color: "hsl(var(--chart-2))" },
]);

const topicRows = computed(() => (series.value.topicPerformance ?? []).slice(0, 6));
const strengths = computed(() => series.value.strengths ?? []);
const weaknesses = computed(() => series.value.weaknesses ?? []);

const compareLabels = computed(() => (series.value.classCompare ?? []).map(c => c.label));
const compareSeries = computed(() => [{
  key: "cmp", label: "O'rtacha natija",
  values: (series.value.classCompare ?? []).map(c => c.value),
  color: "hsl(var(--chart-2))",
}]);
const compareDiff = computed(() => Math.abs((kpi.value.avgPercentage ?? 0) - (kpi.value.classAvg ?? 0)));
const compareGood = computed(() => (kpi.value.avgPercentage ?? 0) >= (kpi.value.classAvg ?? 0));

const bucketItems = computed(() =>
  (series.value.scoreBuckets ?? []).filter(b => b.count > 0).map((b, i) => ({
    label: b.label, value: b.count,
    color: ["hsl(var(--destructive))", "hsl(var(--chart-4))", "hsl(var(--warning))", "hsl(var(--chart-5))", "hsl(var(--success))"][i] ?? undefined,
  }))
);

const videos = computed(() => lists.value.videos ?? []);
const recent = computed(() => (lists.value.recentActivity ?? []).slice(0, 7));
const classTop = computed(() => lists.value.topStudents ?? []);
const pendingHw = computed(() => (lists.value.pendingHomework ?? []).slice(0, 3));

const videoPct = computed(() =>
  kpi.value.videosTotal ? Math.round(((kpi.value.videosCompleted ?? 0) / kpi.value.videosTotal) * 100) : 0
);
const hwPct = computed(() =>
  kpi.value.homeworkTotal ? Math.round(((kpi.value.homeworkDone ?? 0) / kpi.value.homeworkTotal) * 100) : 0
);

const testsSpark = computed(() => daily.value.map(d => d.tests));
const pointsSpark = computed(() => daily.value.map(d => d.points));
const avgSpark = computed(() => daily.value.map(d => d.avgPercentage));

// ── Formatlash ──
function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function longDate(iso) {
  return new Date(iso).toLocaleDateString("uz-UZ", { weekday: "short", day: "numeric", month: "long" });
}
function timeAgo(iso) {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hozir";
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.floor(h / 24)} kun oldin`;
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

// ── Yuklash (jonli) ──
let timer = null;
async function load() {
  if (document.hidden) return;
  try { data.value = await api("/api/analytics/student"); } catch {}
  loading.value = false;
}
function onVisibility() { if (!document.hidden) load(); }

onMounted(() => {
  load();
  timer = setInterval(load, 12000);
  document.addEventListener("visibilitychange", onVisibility);
});
onUnmounted(() => {
  clearInterval(timer);
  document.removeEventListener("visibilitychange", onVisibility);
});
useLive(["activity", "users", "video_views", "videos", "lessons", "topics", "homework", "homework_submissions"], load, { delay: 800 });
</script>

<style scoped>
.medal-1 { color: #d4a017; }
.medal-2 { color: #8e9aa6; }
.medal-3 { color: #b36a2e; }
.dash { display: flex; flex-direction: column; gap: 13px; }

/* Hero */
.hero {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 18px 20px; flex-wrap: wrap;
  background: linear-gradient(135deg, hsl(var(--primary) / .07), hsl(var(--card)) 55%);
  border-color: hsl(var(--primary) / .18);
}
.hero-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.hero-avatar {
  width: 52px; height: 52px; border-radius: 16px;
  background: hsl(var(--primary)); color: #fff;
  font-size: 20px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
  box-shadow: 0 6px 16px hsl(var(--primary) / .3);
}
.hero-img { width: 100%; height: 100%; object-fit: cover; }
.hero-title { font-size: 1.25rem; font-weight: 800; letter-spacing: -.02em; }
.hero-sub { font-size: 12.5px; color: hsl(var(--muted-fg)); margin-top: 3px; }
.hero-sub b { color: hsl(var(--primary)); font-weight: 700; }
.hero-right { display: flex; align-items: center; gap: 14px; }
.streak {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 14px; border-radius: 14px;
  background: hsl(var(--muted)); color: hsl(var(--muted-fg));
}
.streak--on { background: hsl(var(--warning) / .13); color: hsl(var(--warning)); }
.streak b { font-size: 19px; font-weight: 800; line-height: 1; display: block; }
.streak span { font-size: 10px; }

/* KPI */
.kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (min-width: 1000px) { .kpi-grid { grid-template-columns: repeat(4, 1fr); } }

/* Halqalar — ramkasiz, ochiq joylashuv */
.rings {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 18px 14px; padding: 6px 4px;
}
@media (min-width: 900px) { .rings { grid-template-columns: repeat(4, 1fr); } }
.ring-item { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ring-text { min-width: 0; }
.ring-title { font-size: 13px; font-weight: 700; }
.ring-sub { font-size: 11px; color: hsl(var(--muted-fg)); margin-top: 2px; line-height: 1.35; }

/* Setkalar */
.dash-grid { display: grid; gap: 12px; }
.grid-main { grid-template-columns: 1fr; }
@media (min-width: 1000px) { .grid-main { grid-template-columns: 1fr 1fr; } }
.grid-3 { grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); }

.legend-inline { display: flex; gap: 10px; }
.legend-inline span { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: hsl(var(--muted-fg)); }
.legend-inline i { width: 8px; height: 8px; border-radius: 2px; }

/* Mavzular */
.topic-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.topic-row { display: grid; grid-template-columns: minmax(0, 1fr) 66px 38px; align-items: center; gap: 8px; }
.topic-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topic-sub { font-size: 10px; color: hsl(var(--muted-fg)); }
.topic-bar { height: 6px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
.topic-fill { height: 100%; border-radius: 99px; transition: width .6s; }
.topic-pct { font-size: 11.5px; font-weight: 800; text-align: right; }

/* Taqqoslash */
.compare-note {
  display: flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 600;
  padding: 8px 11px; border-radius: 10px; margin-top: 14px;
}
.compare-note--good { color: hsl(var(--success)); background: hsl(var(--success) / .1); }
.compare-note--warn { color: hsl(var(--warning)); background: hsl(var(--warning) / .1); }
.strengths { margin-top: 12px; display: flex; flex-direction: column; gap: 9px; }
.str-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 5px; }
.str-title--good { color: hsl(var(--success)); }
.str-title--bad { color: hsl(var(--destructive)); }
.str-chip {
  display: inline-block; font-size: 11px; font-weight: 600;
  padding: 3px 9px; border-radius: 99px; margin: 0 4px 4px 0;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom;
}
.str-chip--good { color: hsl(var(--success)); background: hsl(var(--success) / .1); }
.str-chip--bad { color: hsl(var(--destructive)); background: hsl(var(--destructive) / .1); }

/* Videolar */
.vid-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.vid-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
.vid-title { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vid-pct { font-size: 11.5px; font-weight: 800; color: hsl(var(--muted-fg)); flex-shrink: 0; }

/* Faoliyat */
.act-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.act-row { display: flex; align-items: center; gap: 9px; padding: 8px; border-radius: 11px; transition: background .15s; }
.act-row:hover { background: hsl(var(--muted) / .6); }
.act-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.act-info { flex: 1; min-width: 0; }
.act-name { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-sub { font-size: 10.5px; color: hsl(var(--muted-fg)); }
.act-pct { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 99px; flex-shrink: 0; }

/* Reyting */
.rank-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.rank-row { display: flex; align-items: center; gap: 9px; padding: 7px 8px; border-radius: 11px; }
.rank-row--me { background: hsl(var(--primary) / .09); box-shadow: inset 2px 0 0 hsl(var(--primary)); }
.rank-pos { width: 22px; text-align: center; font-size: 12.5px; font-weight: 800; color: hsl(var(--muted-fg)); flex-shrink: 0; }
.rank-avatar { width: 30px; height: 30px; border-radius: 9px; background: hsl(var(--primary)); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rank-info { flex: 1; min-width: 0; }
.rank-name { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rank-name span { color: hsl(var(--primary)); font-weight: 700; }
.rank-sub { font-size: 10.5px; color: hsl(var(--muted-fg)); }
.rank-score { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 800; color: hsl(var(--warning)); flex-shrink: 0; }

/* Uy ishi */
.hw-block { margin-top: 14px; padding-top: 12px; border-top: 1px dashed hsl(var(--border)); }
.hw-title { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; color: hsl(var(--warning)); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 7px; }
.hw-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 7px 9px; border-radius: 9px; background: hsl(var(--warning) / .08);
  color: hsl(var(--fg)); text-decoration: none; font-size: 12px; margin-bottom: 4px;
}
.hw-row:hover { background: hsl(var(--warning) / .16); }
.hw-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.link-btn { display: inline-flex; align-items: center; gap: 2px; font-size: 11.5px; font-weight: 600; color: hsl(var(--primary)); text-decoration: none; }
.link-btn:hover { text-decoration: underline; }
.btn-go { padding: .5rem 1.1rem; font-size: 13px; }
</style>
