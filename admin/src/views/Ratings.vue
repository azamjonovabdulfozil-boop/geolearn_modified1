<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Reyting</h1>
        <p class="geo-page-sub">O'quvchilar reytingi va natijalar</p>
      </div>
    </div>

    <div class="geo-card ratings-card">
      <div class="ratings-head">
        <div class="ratings-head-icon">
          <Trophy :size="16" style="color:hsl(45 85% 42%)" />
        </div>
        <h2>Umumiy reyting jadvali</h2>
        <span class="geo-badge geo-badge-muted ml-auto">{{ ratings.length }} o'quvchi</span>
      </div>

      <div v-if="loading" class="p-4">
        <div v-for="i in 6" :key="i" class="geo-skeleton mb-2" style="height:56px"></div>
      </div>

      <div v-else-if="!ratings.length" class="empty-state">
        <Users :size="40" style="opacity:.3" />
        <p class="empty-title">Hali o'quvchilar yo'q</p>
        <p class="empty-sub">O'quvchilar ro'yxatdan o'tgach bu yerda ko'rinadi</p>
      </div>

      <div v-else class="ratings-list">
        <div v-for="entry in ratings" :key="entry.userId"
          class="rating-row" @mouseenter="hoverId = entry.userId" @mouseleave="hoverId = null">
          <!-- Rank -->
          <div class="rank-col">
            <span v-if="entry.rank <= 3" class="rank-medal">{{ ['🥇','🥈','🥉'][entry.rank-1] }}</span>
            <span v-else class="rank-num">#{{ entry.rank }}</span>
          </div>
          <!-- Avatar -->
          <div class="user-avatar">{{ entry.name.charAt(0).toUpperCase() }}</div>
          <!-- Info -->
          <div class="user-info">
            <p class="user-name">{{ entry.name }}</p>
            <p class="user-sub">{{ entry.grade }}-sinf · {{ entry.testsCompleted }} test</p>
          </div>
          <!-- Score -->
          <div class="score-col">
            <Star :size="13" style="color:hsl(45 85%44%)" />
            <span class="score-val">{{ entry.totalScore }}</span>
            <span class="score-unit">ball</span>
          </div>
          <!-- Delete -->
          <button v-if="hoverId === entry.userId"
            @click="deleteStudent(entry)"
            :disabled="deletingId === entry.userId"
            class="geo-btn-ghost btn-del" title="O'quvchini o'chirish">
            <Loader2 v-if="deletingId === entry.userId" :size="14" class="animate-spin" />
            <Trash2 v-else :size="14" />
          </button>
          <div v-else class="del-placeholder"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { Trophy, Star, Trash2, Users, Loader2 } from "lucide-vue-next";
import { api } from "@shared/composables/api";

const ratings = ref([]);
const loading = ref(true);
const hoverId = ref(null);
const deletingId = ref(null);

async function load() {
  try { ratings.value = await api("/api/ratings"); } catch {}
  loading.value = false;
}
onMounted(load);

async function deleteStudent(entry) {
  deletingId.value = entry.userId;
  try {
    await api(`/api/users/${entry.userId}`, { method: "DELETE" });
    await load();
  } catch {}
  deletingId.value = null;
  hoverId.value = null;
}
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.ml-auto { margin-left: auto; }

.ratings-card { overflow: hidden; }
.ratings-head {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid hsl(var(--border));
}
.ratings-head-icon {
  width: 32px; height: 32px;
  border-radius: 9px;
  background: hsl(45 90% 50%/0.12);
  display: flex; align-items: center; justify-content: center;
}
.ratings-head h2 { font-size: 14.5px; font-weight: 700; }

.ratings-list { }
.rating-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid hsl(var(--border));
  transition: background .15s;
}
.rating-row:last-child { border-bottom: none; }
.rating-row:hover { background: hsl(var(--muted)/0.5); }

.rank-col { width: 36px; text-align: center; flex-shrink: 0; }
.rank-medal { font-size: 1.2rem; }
.rank-num { font-size: 12.5px; font-weight: 700; color: hsl(var(--muted-fg)); }

.user-avatar {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: hsl(var(--primary));
  color: white;
  font-size: 14px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.user-info { flex: 1; min-width: 0; }
.user-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-sub  { font-size: 11.5px; color: hsl(var(--muted-fg)); }

.score-col {
  display: flex; align-items: center; gap: 5px;
  flex-shrink: 0;
}
.score-val { font-size: 15px; font-weight: 800; }
.score-unit { font-size: 11.5px; color: hsl(var(--muted-fg)); }

.btn-del {
  width: 32px; height: 32px;
  padding: 0;
  border-radius: 8px;
  flex-shrink: 0;
  color: hsl(0 60% 50%);
}
.btn-del:hover { background: hsl(0 60% 50%/0.1); }
.del-placeholder { width: 32px; flex-shrink: 0; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 48px 24px; color: hsl(var(--muted-fg)); text-align: center;
}
.empty-title { font-size: 15px; font-weight: 700; color: hsl(var(--fg)); }
.empty-sub { font-size: 13px; }

.p-4 { padding: 16px; }
.mb-2 { margin-bottom: 8px; }
</style>
