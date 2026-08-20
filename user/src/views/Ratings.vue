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
        <p class="my-sub">{{ myRank.grade }}-sinf · {{ myRank.testsCompleted }} test</p>
      </div>
      <div class="my-score">
        <p class="my-score-val">{{ myRank.totalScore }}</p>
        <p class="my-score-lbl">ball</p>
      </div>
    </div>

    <!-- Ratings table -->
    <div class="geo-card ratings-card">
      <div class="ratings-head">
        <div class="head-icon">
          <Trophy :size="15" style="color:hsl(45 85%42%)" />
        </div>
        <h2>Umumiy reyting</h2>
        <span class="geo-badge geo-badge-muted ml-auto">{{ ratings.length }} o'quvchi</span>
      </div>

      <div v-if="loading" class="p-4">
        <div v-for="i in 6" :key="i" class="geo-skeleton mb-2" style="height:52px"></div>
      </div>

      <div v-else class="rating-list">
        <div v-for="entry in ratings" :key="entry.userId"
          class="rating-row"
          :class="{ 'rating-row--me': entry.userId === auth.user?.id }">
          <div class="rank-col">
            <span v-if="entry.rank <= 3" class="medal">{{ ['🥇','🥈','🥉'][entry.rank-1] }}</span>
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { Trophy, Star } from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useAuthStore } from "@shared/stores/auth";

const auth = useAuthStore();
const ratings = ref([]);
const myRank = ref(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const [r, m] = await Promise.all([api("/api/ratings"), api("/api/ratings/me")]);
    ratings.value = r;
    myRank.value = m;
  } catch {}
  loading.value = false;
});
</script>

<style scoped>
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
</style>
