<template>
  <div class="fade-in">
    <div class="page-header">
      <h1 class="geo-page-title">Reyting</h1>
      <p class="geo-page-sub">Barcha o'quvchilar reytingi</p>
    </div>

    <!-- My rank highlight -->
    <div v-if="myRank" class="my-rank geo-card">
      <div class="my-rank-pos">
        <span class="my-rank-num">#{{ myRank.rank }}</span>
        <span class="my-rank-lbl">O'rnim</span>
      </div>
      <div class="my-rank-info">
        <p class="my-name">{{ myRank.name }} <span class="you-tag">Sen</span></p>
        <p class="my-sub">
          {{ myRank.grade }}-sinf · {{ myRank.testsCompleted }} test
          <template v-if="myRank.gradeRank"> · sinfda #{{ myRank.gradeRank }}</template>
        </p>
      </div>
      <div class="my-score">
        <p class="my-score-val">{{ myRank.totalScore }}</p>
        <p class="my-score-lbl">ball</p>
      </div>
    </div>

    <!-- Sinf bo'yicha bo'limlar -->
    <div class="grade-tabs">
      <button class="grade-tab" :class="{ 'grade-tab--on': activeGrade === 0 }" @click="selectGrade(0)">
        Umumiy
      </button>
      <button v-for="g in grades.open" :key="g" class="grade-tab"
        :class="{ 'grade-tab--on': activeGrade === g }" @click="selectGrade(g)">
        {{ g }}-sinf
      </button>
    </div>

    <!-- Ratings table -->
    <div class="geo-card ratings-card">
      <div class="ratings-head">
        <div class="head-icon">
          <Trophy :size="15" style="color:hsl(45 85%42%)" />
        </div>
        <h2>{{ activeGrade === 0 ? 'Umumiy reyting' : `${activeGrade}-sinf reytingi` }}</h2>
        <span class="geo-badge geo-badge-muted ml-auto">{{ ratings.length }} o'quvchi</span>
      </div>

      <div v-if="loading" class="p-4">
        <div v-for="i in 6" :key="i" class="geo-skeleton mb-2" style="height:52px"></div>
      </div>

      <div v-else-if="!ratings.length" class="empty-grade">
        Bu sinfda hali o'quvchi yo'q
      </div>

      <div v-else class="rating-list">
        <div v-for="entry in paged.visible.value" :key="entry.userId"
          class="rating-row"
          :class="{ 'rating-row--me': entry.userId === auth.user?.id }">
          <div class="rank-col">
            <span v-if="entry.rank <= 3" class="medal"><Medal :size="22" :class="`medal-${entry.rank}`" /></span>
            <span v-else class="rank-n">#{{ entry.rank }}</span>
          </div>
          <div class="user-av">{{ entry.name.charAt(0).toUpperCase() }}</div>
          <div class="user-inf">
            <p class="u-name">
              {{ entry.name }}
              <span v-if="entry.userId === auth.user?.id" class="you-inline">(Sen)</span>
            </p>
            <p class="u-sub">{{ entry.grade }}-sinf · {{ entry.testsCompleted }} test</p>
          </div>
          <div class="score-col">
            <Star :size="12" style="color:hsl(45 85%44%)" />
            <span class="s-val">{{ entry.totalScore }}</span>
          </div>
        </div>
        <ShowMore :remaining="paged.remaining.value" :shown="paged.visible.value.length"
          :step="paged.pageSize" @more="paged.more" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { Trophy, Star, Medal } from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useAuthStore } from "@shared/stores/auth";
import { useGradesStore } from "@shared/stores/grades";
import { usePaged } from "@shared/composables/paged";
import ShowMore from "@shared/components/ShowMore.vue";

const auth = useAuthStore();
const grades = useGradesStore();
const ratings = ref([]);
const paged = usePaged(ratings, 30);
const myRank = ref(null);
const loading = ref(true);
const activeGrade = ref(0);   // 0 = umumiy

async function loadRatings(silent = false) {
  if (silent !== true) loading.value = true;
  const query = activeGrade.value ? `?grade=${activeGrade.value}` : "";
  try { ratings.value = await api(`/api/ratings${query}`); } catch {}
  loading.value = false;
}

function selectGrade(g) {
  if (activeGrade.value === g) return;
  activeGrade.value = g;
  paged.reset();
  loadRatings();
}

async function loadMe() {
  try { myRank.value = await api("/api/ratings/me"); } catch {}
}
onMounted(async () => {
  await loadMe();
  await loadRatings();
});
useLive(["users", "activity"], () => Promise.all([loadMe(), loadRatings(true)]));
</script>

<style scoped>
.medal-1 { color: #d4a017; }
.medal-2 { color: #8e9aa6; }
.medal-3 { color: #b36a2e; }
/* Sinf bo'limlari */
.grade-tabs { display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px; }
.grade-tab {
  padding:6px 14px;border-radius:99px;
  border:1px solid hsl(var(--border));background:hsl(var(--card));
  font-family:inherit;font-size:12.5px;font-weight:600;color:hsl(var(--fg));
  cursor:pointer;transition:all .15s;
}
.grade-tab:hover { border-color:hsl(var(--primary)/.5);background:hsl(var(--primary)/0.05); }
.grade-tab--on { background:hsl(var(--primary));border-color:hsl(var(--primary));color:#fff; }
.empty-grade { padding:36px 20px;text-align:center;font-size:13px;color:hsl(var(--muted-fg)); }

.page-header { margin-bottom: 20px; }
.ml-auto { margin-left: auto; }

/* My rank card */
.my-rank {
  display: flex; align-items: center; gap: 16px;
  padding: 18px 20px;
  margin-bottom: 14px;
  border-color: hsl(var(--primary)/0.3);
  background: hsl(var(--primary)/0.03);
}
.my-rank-pos { text-align: center; flex-shrink: 0; }
.my-rank-num {
  display: block;
  font-size: 1.8rem; font-weight: 800;
  color: hsl(var(--primary));
  line-height: 1;
}
.my-rank-lbl { font-size: 11px; color: hsl(var(--muted-fg)); }
.my-rank-info { flex: 1; min-width: 0; }
.my-name { font-size: 14.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.you-tag {
  font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 99px;
  background: hsl(var(--primary)); color: white;
}
.my-sub { font-size: 12px; color: hsl(var(--muted-fg)); margin-top: 2px; }
.my-score { text-align: right; flex-shrink: 0; }
.my-score-val { font-size: 1.5rem; font-weight: 800; color: hsl(var(--primary)); line-height: 1; }
.my-score-lbl { font-size: 11px; color: hsl(var(--muted-fg)); }

/* Ratings table */
.ratings-card { overflow: hidden; }
.ratings-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid hsl(var(--border));
}
.head-icon {
  width: 30px; height: 30px; border-radius: 8px;
  background: hsl(45 90% 50%/0.1);
  display: flex; align-items: center; justify-content: center;
}
.ratings-head h2 { font-size: 14px; font-weight: 700; }

.rating-list { }
.rating-row {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 18px;
  border-bottom: 1px solid hsl(var(--border));
  transition: background .15s;
}
.rating-row:last-child { border-bottom: none; }
.rating-row:hover { background: hsl(var(--muted)/0.5); }
.rating-row--me { background: hsl(var(--primary)/0.04); }

.rank-col { width: 32px; text-align: center; flex-shrink: 0; }
.medal { font-size: 1.1rem; }
.rank-n { font-size: 12px; font-weight: 700; color: hsl(var(--muted-fg)); }

.user-av {
  width: 34px; height: 34px; border-radius: 10px;
  background: hsl(var(--primary));
  color: white; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.user-inf { flex: 1; min-width: 0; }
.u-name { font-size: 13.5px; font-weight: 600; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.you-inline { font-size: 11px; color: hsl(var(--primary)); font-weight: 700; }
.u-sub  { font-size: 11.5px; color: hsl(var(--muted-fg)); }

.score-col { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.s-val { font-size: 14px; font-weight: 800; }

.p-4 { padding: 16px; }
.mb-2 { margin-bottom: 8px; }

@media (max-width: 640px) {
  .u-name { white-space: normal; flex-wrap: wrap; overflow-wrap: anywhere; line-height: 1.3; }
}
</style>
