<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">🧠 AI Monitoring</h1>
        <p class="geo-page-sub">Talabalar AI bilan qilgan muloqotlari</p>
      </div>
      <button v-if="logs.length" @click="clearLogs" class="geo-btn-outline btn-danger">
        <Trash2 :size="15" /> Loglarni tozalash
      </button>
    </div>

    <!-- Stats -->
    <div v-if="logs.length" class="stats-row">
      <div class="stat-card geo-card">
        <span class="stat-num">{{ logs.length }}</span>
        <span class="stat-label">Jami so'rovlar</span>
      </div>
      <div class="stat-card geo-card">
        <span class="stat-num">{{ uniqueUsers }}</span>
        <span class="stat-label">Talabalar</span>
      </div>
      <div class="stat-card geo-card">
        <span class="stat-num success">{{ successCount }}</span>
        <span class="stat-label">Muvaffaqiyatli</span>
      </div>
      <div class="stat-card geo-card">
        <span class="stat-num danger">{{ logs.length - successCount }}</span>
        <span class="stat-label">Xato</span>
      </div>
    </div>

    <!-- Filter -->
    <div v-if="logs.length" class="filter-row geo-card">
      <input v-model="search" class="geo-input" placeholder="Talaba ismi yoki savol bo'yicha qidiring..." />
      <select v-model="filterRole" class="geo-input" style="max-width:160px">
        <option value="">Hammasi</option>
        <option value="student">O'quvchi</option>
        <option value="teacher">O'qituvchi</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="geo-skeleton" style="height:100px"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="!logs.length" class="geo-card empty-card">
      <div class="empty-icon"><MessageSquare :size="30" /></div>
      <p class="empty-title">Hali AI muloqotlari yo'q</p>
      <p class="empty-sub">Talabalar AI bilan suhbat boshlasa, bu yerda ko'rinadi</p>
    </div>

    <!-- Logs list -->
    <div v-else class="logs-list">
      <div v-for="log in filteredLogs" :key="log.id" class="log-card geo-card"
           :class="log.success === false ? 'log-card--error' : ''">
        <div class="log-header">
          <div class="log-user">
            <div class="user-avatar" :class="log.role === 'teacher' ? 'av-teacher' : 'av-student'">
              {{ (log.userName || '?')[0].toUpperCase() }}
            </div>
            <div>
              <span class="user-name">{{ log.userName || 'Noma\'lum' }}</span>
              <span class="user-role">{{ log.role === 'teacher' ? '🎓 O\'qituvchi' : '👤 O\'quvchi' }}</span>
            </div>
          </div>
          <div class="log-meta">
            <span class="log-status" :class="log.success === false ? 'status-error' : 'status-ok'">
              {{ log.success === false ? '✗ Xato' : '✓ OK' }}
            </span>
            <span class="log-time">{{ formatTime(log.createdAt) }}</span>
          </div>
        </div>

        <div class="log-body">
          <div class="log-bubble log-bubble--q">
            <span class="bubble-label">❓ Savol</span>
            <p>{{ log.question }}</p>
          </div>
          <div class="log-bubble log-bubble--a">
            <span class="bubble-label">🤖 AI Javobi</span>
            <p>{{ log.answer }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { Trash2, MessageSquare } from "lucide-vue-next";
import { api } from "@/composables/api";

const logs = ref([]);
const loading = ref(true);
const search = ref("");
const filterRole = ref("");

async function load() {
  loading.value = true;
  try { logs.value = await api("/api/ai/logs"); } catch {}
  loading.value = false;
}
onMounted(load);

async function clearLogs() {
  if (!confirm("Barcha loglarni o'chirasizmi?")) return;
  try { await api("/api/ai/logs", { method: "DELETE" }); logs.value = []; } catch {}
}

const successCount = computed(() => logs.value.filter(l => l.success !== false).length);
const uniqueUsers = computed(() => new Set(logs.value.map(l => l.userId)).size);

const filteredLogs = computed(() => {
  let list = logs.value;
  if (filterRole.value) list = list.filter(l => l.role === filterRole.value);
  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter(l =>
      (l.userName || "").toLowerCase().includes(q) ||
      (l.question || "").toLowerCase().includes(q)
    );
  }
  return list;
});

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("uz-UZ") + " " + d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}
</script>

<style scoped>
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
}

.stats-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 12px; margin-bottom: 16px;
}
@media (max-width: 640px) { .stats-row { grid-template-columns: repeat(2,1fr); } }
.stat-card { padding: 16px 20px; text-align: center; }
.stat-num { display: block; font-size: 28px; font-weight: 800; color: hsl(var(--primary)); }
.stat-num.success { color: hsl(var(--success)); }
.stat-num.danger  { color: hsl(var(--destructive)); }
.stat-label { font-size: 12px; color: hsl(var(--muted-fg)); }

.filter-row { display: flex; gap: 10px; padding: 14px; margin-bottom: 16px; flex-wrap: wrap; }
.filter-row .geo-input { flex: 1; min-width: 200px; }

.logs-list { display: flex; flex-direction: column; gap: 12px; }
.log-card { padding: 18px 20px; }
.log-card--error { border-left: 3px solid hsl(var(--destructive)); }

.log-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px; flex-wrap: wrap; gap: 8px;
}
.log-user { display: flex; align-items: center; gap: 10px; }
.user-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700;
}
.av-student { background: hsl(var(--primary)/0.15); color: hsl(var(--primary)); }
.av-teacher { background: hsl(38 90% 48%/0.15); color: hsl(38 90% 40%); }
.user-name { display: block; font-weight: 700; font-size: 14px; }
.user-role { display: block; font-size: 11.5px; color: hsl(var(--muted-fg)); }

.log-meta { display: flex; align-items: center; gap: 10px; }
.log-status { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 99px; }
.status-ok    { background: hsl(var(--success)/0.12); color: hsl(var(--success)); }
.status-error { background: hsl(var(--destructive)/0.12); color: hsl(var(--destructive)); }
.log-time { font-size: 12px; color: hsl(var(--muted-fg)); }

.log-body { display: flex; flex-direction: column; gap: 10px; }
.log-bubble {
  padding: 12px 16px; border-radius: 12px;
}
.log-bubble--q { background: hsl(var(--muted)); }
.log-bubble--a { background: hsl(var(--primary)/0.07); border: 1px solid hsl(var(--primary)/0.15); }
.bubble-label { display: block; font-size: 11px; font-weight: 700; color: hsl(var(--muted-fg)); margin-bottom: 5px; letter-spacing: .04em; text-transform: uppercase; }
.log-bubble p { font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; }

/* Empty */
.empty-card { text-align: center; padding: 60px 24px; }
.empty-icon {
  width: 60px; height: 60px; border-radius: 16px;
  background: hsl(var(--muted));
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px; color: hsl(var(--muted-fg)/0.5);
}
.empty-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: hsl(var(--muted-fg)); }

.space-y-3 > * + * { margin-top: 10px; }
.btn-danger { color: hsl(var(--destructive)); border-color: hsl(var(--destructive)/0.4); }
.btn-danger:hover { background: hsl(var(--destructive)/0.08); }
</style>
