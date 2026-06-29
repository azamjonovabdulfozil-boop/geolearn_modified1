<template>
  <div class="fade-in">
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">{{ settings.t('dashboard_title') }}</h1>
        <p class="geo-page-sub">{{ settings.t('dashboard_sub') }}</p>
      </div>
      <div class="header-date">
        <span>{{ today }}</span>
      </div>
    </div>

    <!-- Stats grid -->
    <div class="stats-grid">
      <div v-for="s in stats" :key="s.label" class="stat-card geo-card">
        <div class="stat-icon" :style="`background:${s.bg}`">
          <component :is="s.icon" :size="20" :style="`color:${s.color}`" />
        </div>
        <div class="stat-body">
          <p class="stat-value">{{ loading ? '—' : s.value }}</p>
          <p class="stat-label">{{ s.label }}</p>
        </div>
        <div class="stat-trend" v-if="!loading">
          <TrendingUp :size="14" style="color:hsl(142 60% 40%)" />
        </div>
      </div>
    </div>

    <!-- Bottom grid -->
    <div class="bottom-grid">
      <!-- Top students -->
      <div class="geo-card panel">
        <div class="panel-head">
          <div class="panel-icon" style="background:hsl(45 90% 50%/0.12)">
            <Trophy :size="16" style="color:hsl(45 85% 42%)" />
          </div>
          <h2 class="panel-title">{{ settings.t('top_students') }}</h2>
          <span class="geo-badge geo-badge-muted ml-auto">{{ topStudents.length }}</span>
        </div>

        <div v-if="loading" class="space-y-2">
          <div v-for="i in 4" :key="i" class="geo-skeleton" style="height:52px"></div>
        </div>
        <div v-else-if="!topStudents.length" class="empty-state">
          <Users :size="36" style="opacity:.3" />
          <p>{{ settings.t('no_students_yet') }}</p>
        </div>
        <div v-else class="student-list">
          <div v-for="(s, i) in topStudents.slice(0,6)" :key="s.userId" class="student-row">
            <div class="rank-num" :class="['rank-1','rank-2','rank-3'][i] || 'rank-n'">
              {{ i < 3 ? ['🥇','🥈','🥉'][i] : i+1 }}
            </div>
            <div class="student-avatar">{{ s.name.charAt(0).toUpperCase() }}</div>
            <div class="student-info">
              <p class="student-name">{{ s.name }}</p>
              <p class="student-sub">{{ s.grade }}-sinf</p>
            </div>
            <div class="student-score">
              <Star :size="12" style="color:hsl(45 85% 44%)" />
              <span>{{ s.totalScore }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity -->
      <div class="geo-card panel">
        <div class="panel-head">
          <div class="panel-icon" style="background:hsl(var(--primary)/0.1)">
            <Activity :size="16" style="color:hsl(var(--primary))" />
          </div>
          <h2 class="panel-title">{{ settings.t('recent_activity') }}</h2>
        </div>

        <div v-if="loading" class="space-y-2">
          <div v-for="i in 5" :key="i" class="geo-skeleton" style="height:44px"></div>
        </div>
        <div v-else-if="!activity.length" class="empty-state">
          <Activity :size="36" style="opacity:.3" />
          <p>{{ settings.t('no_activity_yet') }}</p>
        </div>
        <div v-else class="activity-list">
          <div v-for="a in activity.slice(0,8)" :key="a.id" class="activity-row">
            <div class="activity-dot"></div>
            <div class="activity-info">
              <p class="activity-name">{{ a.studentName }}</p>
              <p class="activity-topic">{{ a.topicTitle }}</p>
            </div>
            <span class="activity-score">+{{ a.pointsEarned }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { Users, BookOpen, FileQuestion, Trophy, Activity, Gamepad2, Star, TrendingUp } from "lucide-vue-next";
import { api } from "@/composables/api";
import { useSettingsStore } from "@/stores/settings";

const settings = useSettingsStore();
const loading = ref(true);
const dashData = ref(null);
const activity = ref([]);
const topStudents = computed(() => dashData.value?.topStudents ?? []);

const today = computed(() =>
  new Date().toLocaleDateString(settings.language === "ru" ? "ru-RU" : "uz-UZ",
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
);

const stats = computed(() => [
  { label: settings.t('total_students'), value: dashData.value?.totalStudents ?? 0, icon: Users, color: "hsl(174 65% 30%)", bg: "hsl(174 65% 30%/0.1)" },
  { label: settings.t('total_lessons'),  value: dashData.value?.totalLessons  ?? 0, icon: BookOpen, color: "#8b5cf6", bg: "#8b5cf620" },
  { label: settings.t('total_tests'),    value: dashData.value?.totalTests    ?? 0, icon: FileQuestion, color: "#f59e0b", bg: "#f59e0b18" },
  { label: settings.t('active_games'),   value: dashData.value?.activeGames   ?? 0, icon: Gamepad2, color: "#10b981", bg: "#10b98118" },
]);

onMounted(async () => {
  try {
    const [dash, act] = await Promise.all([
      api("/api/analytics/dashboard"),
      api("/api/analytics/activity"),
    ]);
    dashData.value = dash;
    activity.value = act ?? [];
  } catch {}
  loading.value = false;
});
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  flex-wrap: wrap;
  gap: 12px;
}
.header-date {
  font-size: 13px;
  color: hsl(var(--muted-fg));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  padding: 6px 14px;
  border-radius: 99px;
  text-transform: capitalize;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
@media (min-width: 900px) { .stats-grid { grid-template-columns: repeat(4, 1fr); } }

.stat-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.stat-icon {
  width: 48px; height: 48px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.stat-body { flex: 1; min-width: 0; }
.stat-value {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -.03em;
  margin-bottom: 4px;
}
.stat-label {
  font-size: 12px;
  color: hsl(var(--muted-fg));
  font-weight: 500;
}
.stat-trend { flex-shrink: 0; }

/* Panels */
.bottom-grid {
  display: grid;
  gap: 16px;
}
@media (min-width: 900px) { .bottom-grid { grid-template-columns: 1fr 1fr; } }

.panel { padding: 20px; }
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.panel-icon {
  width: 34px; height: 34px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.panel-title { font-size: 14.5px; font-weight: 700; }
.ml-auto { margin-left: auto; }

/* Students */
.student-list { display: flex; flex-direction: column; gap: 4px; }
.student-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  transition: background .15s;
}
.student-row:hover { background: hsl(var(--muted)); }
.rank-num {
  width: 28px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}
.rank-n { color: hsl(var(--muted-fg)); font-size: 12px; }
.student-avatar {
  width: 32px; height: 32px;
  border-radius: 9px;
  background: hsl(var(--primary));
  color: white;
  font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.student-info { flex: 1; min-width: 0; }
.student-name { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.student-sub  { font-size: 11px; color: hsl(var(--muted-fg)); }
.student-score {
  display: flex; align-items: center; gap: 4px;
  font-size: 13px; font-weight: 700;
  flex-shrink: 0;
}

/* Activity */
.activity-list { display: flex; flex-direction: column; gap: 2px; }
.activity-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  transition: background .15s;
}
.activity-row:hover { background: hsl(var(--muted)); }
.activity-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: hsl(var(--primary));
  flex-shrink: 0;
}
.activity-info { flex: 1; min-width: 0; }
.activity-name  { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.activity-topic { font-size: 11.5px; color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.activity-score {
  font-size: 12px; font-weight: 700;
  padding: 2px 9px;
  border-radius: 99px;
  background: hsl(var(--primary)/0.1);
  color: hsl(var(--primary));
  flex-shrink: 0;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 0;
  color: hsl(var(--muted-fg));
  font-size: 14px;
}
.space-y-2 > * + * { margin-top: 8px; }
</style>
