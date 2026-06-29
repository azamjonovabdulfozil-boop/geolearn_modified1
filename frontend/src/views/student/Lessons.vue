<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Darslar</h1>
        <p class="geo-page-sub">Geografiya darslari</p>
      </div>
    </div>

    <!-- Grade filter -->
    <div class="grade-filter">
      <button v-for="g in grades" :key="g" @click="activeGrade = g"
        class="grade-chip" :class="{ 'grade-chip--on': activeGrade === g }">
        {{ g === 0 ? 'Barchasi' : `${g}-sinf` }}
      </button>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="geo-skeleton" style="height:80px"></div>
    </div>

    <div v-else-if="!filtered.length" class="geo-card empty-card">
      <BookOpen :size="36" style="color:hsl(var(--muted-fg));opacity:.4;display:block;margin:0 auto 12px" />
      <p class="empty-title">Darslar topilmadi</p>
    </div>

    <div v-else class="lesson-list">
      <RouterLink v-for="lesson in filtered" :key="lesson.id"
        :to="`/student/lessons/${lesson.id}/topics`"
        class="lesson-card geo-card geo-card-hover">
        <div class="lesson-icon">
          <BookOpen :size="22" style="color:hsl(var(--primary))" />
        </div>
        <div class="lesson-body">
          <div class="lesson-title-row">
            <h3>{{ lesson.title }}</h3>
            <span class="geo-badge geo-badge-primary">{{ lesson.grade }}-sinf</span>
          </div>
          <p class="lesson-sub">{{ (lesson.topics ?? []).length }} mavzu</p>
        </div>
        <ChevronRight :size="18" style="color:hsl(var(--muted-fg));flex-shrink:0" />
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { BookOpen, ChevronRight } from "lucide-vue-next";
import { api } from "@/composables/api";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const lessons = ref([]);
const loading = ref(true);
const activeGrade = ref(auth.user?.grade ?? 0);

const grades = computed(() => {
  const gs = [...new Set(lessons.value.map(l => l.grade))].sort((a, b) => a - b);
  return [0, ...gs];
});
const filtered = computed(() =>
  activeGrade.value === 0 ? lessons.value : lessons.value.filter(l => l.grade === activeGrade.value)
);

onMounted(async () => {
  try { lessons.value = await api("/api/lessons"); } catch {}
  loading.value = false;
});
</script>

<style scoped>
.page-header { margin-bottom: 18px; }

.grade-filter { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.grade-chip {
  padding: 7px 16px;
  border-radius: 99px;
  font-size: 13px; font-weight: 500;
  border: 1.5px solid hsl(var(--border));
  background: hsl(var(--card));
  color: hsl(var(--muted-fg));
  cursor: pointer; font-family: inherit;
  transition: all .15s;
}
.grade-chip:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--primary)); }
.grade-chip--on {
  background: hsl(var(--primary));
  color: white;
  border-color: hsl(var(--primary));
  box-shadow: 0 2px 8px hsl(var(--primary)/.3);
  font-weight: 600;
}

.lesson-list { display: flex; flex-direction: column; gap: 8px; }
.lesson-card {
  display: flex; align-items: center; gap: 16px;
  padding: 16px 18px;
  text-decoration: none; color: inherit;
  transition: all .2s;
}
.lesson-icon {
  width: 48px; height: 48px; border-radius: 14px;
  background: hsl(var(--primary)/0.1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.lesson-body { flex: 1; min-width: 0; }
.lesson-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 3px; }
.lesson-title-row h3 { font-size: 15px; font-weight: 700; }
.lesson-sub { font-size: 12.5px; color: hsl(var(--muted-fg)); }

.empty-card { text-align: center; padding: 56px 24px; }
.empty-title { font-size: 15px; font-weight: 600; color: hsl(var(--muted-fg)); }
.space-y-3 > * + * { margin-top: 10px; }
</style>
