<template>
  <div class="fade-in">
    <!-- Welcome header -->
    <div class="welcome-header">
      <div class="welcome-text">
        <h1 class="geo-page-title">Xush kelibsiz, {{ auth.user?.name?.split(' ')[0] }}! 👋</h1>
        <p class="geo-page-sub">Bugun ham geografiyani o'rganishda davom eting</p>
      </div>
      <div class="welcome-avatar">
        <img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" class="wa-img" />
        <span v-else>{{ auth.user?.name?.charAt(0)?.toUpperCase() }}</span>
      </div>
    </div>

    <!-- Stat cards -->
    <div class="stat-row">
      <div class="stat-card geo-card">
        <div class="stat-icon" style="background:hsl(45 90% 50%/0.12)">
          <Trophy :size="20" style="color:hsl(45 85% 42%)" />
        </div>
        <div>
          <p class="stat-val" style="color:hsl(var(--primary))">#{{ myRank?.rank ?? '—' }}</p>
          <p class="stat-lbl">{{ myRank?.totalScore ?? 0 }} ball · Reyting</p>
        </div>
      </div>
      <div class="stat-card geo-card">
        <div class="stat-icon" style="background:hsl(var(--primary)/0.1)">
          <FileQuestion :size="20" style="color:hsl(var(--primary))" />
        </div>
        <div>
          <p class="stat-val">{{ myRank?.testsCompleted ?? 0 }}</p>
          <p class="stat-lbl">Ishlangan testlar</p>
        </div>
      </div>
    </div>

    <!-- Activity -->
    <div class="geo-card activity-card">
      <div class="card-head">
        <div class="head-icon" style="background:hsl(var(--primary)/0.1)">
          <Activity :size="16" style="color:hsl(var(--primary))" />
        </div>
        <h2 class="card-title">So'nggi faoliyat</h2>
      </div>

      <div v-if="loading" class="space-y-2">
        <div v-for="i in 4" :key="i" class="geo-skeleton" style="height:52px"></div>
      </div>

      <div v-else-if="!activity.length" class="empty-state">
        <Activity :size="36" style="opacity:.3" />
        <p class="empty-title">Hali testlar ishlanmagan</p>
        <RouterLink to="/lessons" class="geo-btn-primary btn-go">
          Darslarni ko'rish
        </RouterLink>
      </div>

      <div v-else class="act-list">
        <div v-for="a in activity.slice(0,8)" :key="a.id" class="act-row">
          <div class="act-icon">
            <CheckCircle :size="16" style="color:hsl(var(--primary))" />
          </div>
          <div class="act-info">
            <p class="act-name">{{ a.topicTitle }}</p>
            <p class="act-sub">{{ Math.round(a.percentage) }}% to'g'ri · {{ a.timeTaken }}s</p>
          </div>
          <span class="act-score">+{{ a.pointsEarned }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { Trophy, FileQuestion, Activity, CheckCircle } from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useAuthStore } from "@shared/stores/auth";

const auth = useAuthStore();
const loading = ref(true);
const myRank = ref(null);
const activity = ref([]);

onMounted(async () => {
  try {
    const [rank, act] = await Promise.all([
      api("/api/ratings/me"),
      api("/api/analytics/activity"),
    ]);
    myRank.value = rank;
    activity.value = act ?? [];
  } catch {}
  loading.value = false;
});
</script>

<style scoped>
.welcome-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
}
.welcome-avatar {
  width: 48px; height: 48px;
  border-radius: 14px;
  background: hsl(var(--primary));
  color: white;
  font-size: 18px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.wa-img { width: 100%; height: 100%; object-fit: cover; }

.stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
.stat-card { padding: 18px; display: flex; align-items: center; gap: 14px; }
.stat-icon { width: 44px; height: 44px; border-radius: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-val { font-size: 1.9rem; font-weight: 800; line-height: 1; letter-spacing: -.03em; margin-bottom: 4px; }
.stat-lbl { font-size: 11.5px; color: hsl(var(--muted-fg)); font-weight: 500; }

.activity-card { padding: 20px; }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.head-icon { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
.card-title { font-size: 14.5px; font-weight: 700; }

.act-list { display: flex; flex-direction: column; gap: 3px; }
.act-row {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 10px; border-radius: 11px;
  transition: background .15s;
}
.act-row:hover { background: hsl(var(--muted)); }
.act-icon { width: 36px; height: 36px; border-radius: 10px; background: hsl(var(--primary)/0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.act-info { flex: 1; min-width: 0; }
.act-name { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-sub  { font-size: 11.5px; color: hsl(var(--muted-fg)); }
.act-score { font-size: 12.5px; font-weight: 700; padding: 3px 10px; border-radius: 99px; background: hsl(var(--primary)/0.1); color: hsl(var(--primary)); flex-shrink: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 36px 0; color: hsl(var(--muted-fg)); text-align: center; }
.empty-title { font-size: 14px; font-weight: 600; }
.btn-go { padding: .55rem 1.25rem; font-size: 13.5px; }

.space-y-2 > * + * { margin-top: 8px; }
</style>
