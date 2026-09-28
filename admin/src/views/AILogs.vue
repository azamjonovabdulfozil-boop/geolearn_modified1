<template>
  <div class="fade-in logs-page">
    <!-- Sarlavha -->
    <div class="page-head">
      <div>
        <div class="title-row">
          <h1 class="geo-page-title">AI monitoring</h1>
          <span class="live-pill" :class="{ 'live-pill--off': !liveConnected }">
            <span class="live-dot"></span>{{ liveConnected ? 'Jonli' : 'Ulanmoqda…' }}
          </span>
        </div>
        <p class="geo-page-sub">O'quvchilar va o'qituvchilar AI yordamchiga bergan savollar hamda olingan javoblar</p>
      </div>
      <div class="head-actions">
        <button class="geo-btn-outline btn-sm" :disabled="!filtered.length" @click="exportCsv">
          <Download :size="14" /> CSV
        </button>
        <button class="geo-btn-outline btn-sm btn-danger" :disabled="!logs.length" @click="clearLogs">
          <Trash2 :size="14" /> Tozalash
        </button>
      </div>
    </div>

    <!-- Ko'rsatkichlar -->
    <div class="kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="geo-card kpi">
        <div class="kpi-icon" :style="{ background: k.bg, color: k.color }"><component :is="k.icon" :size="16" /></div>
        <div class="kpi-body">
          <span class="kpi-label">{{ k.label }}</span>
          <span class="kpi-value">{{ loading ? '—' : k.value }}</span>
          <span class="kpi-hint">{{ k.hint }}</span>
        </div>
      </div>
    </div>

    <!-- So'kinish haqidagi ko'rilmagan xabarlar -->
    <div v-if="alerts.unread.length" class="alert-panel">
      <div class="alert-head">
        <div class="alert-head-icon"><ShieldAlert :size="17" /></div>
        <div>
          <p class="alert-title">{{ alerts.unread.length }} ta qoidabuzarlik ko'rib chiqilmagan</p>
          <p class="alert-sub">Bu o'quvchilar AI'ga haqoratli so'z yozgan. Ularga avtomatik ogohlantirish berildi.</p>
        </div>
        <button class="geo-btn-outline btn-sm" @click="alerts.review('all')"><CheckCheck :size="14" /> Hammasi ko'rildi</button>
      </div>
      <div class="alert-list">
        <div v-for="a in alerts.unread.slice(0, alertLimit)" :key="a.id" class="alert-item">
          <div class="avatar av-danger">
            <img v-if="a.avatarUrl" :src="a.avatarUrl" alt="" />
            <template v-else>{{ initial(a.userName) }}</template>
          </div>
          <div class="alert-main">
            <p class="alert-name">
              {{ a.userName }}
              <span class="row-tag">{{ whoLabel(a) }}</span>
              <span class="warn-no">{{ a.retro ? "filtrdan oldin yozilgan" : `${a.warningNo || 1}-ogohlantirish` }}</span>
            </p>
            <p class="alert-q">
              <span v-for="w in a.badWords" :key="w" class="bad-chip">{{ w }}</span>
              <span class="muted">{{ dayTime(a.createdAt) }}</span>
            </p>
          </div>
          <button class="geo-btn-ghost btn-sm" @click="openAlert(a)">Ko'rish</button>
          <button class="icon-btn" title="Ko'rildi" @click="alerts.review(a.id)"><Check :size="15" /></button>
        </div>
        <button v-if="alerts.unread.length > alertLimit" class="more-btn" @click="alertLimit += 10">
          Yana {{ alerts.unread.length - alertLimit }} ta
        </button>
      </div>
    </div>

    <!-- Filtrlar -->
    <div class="geo-card toolbar">
      <div class="search-box">
        <Search :size="15" class="search-icon" />
        <input v-model="search" class="geo-input search-input" placeholder="Ism, sinf, savol yoki javob bo'yicha qidirish…" />
        <button v-if="search" class="search-clear" @click="search = ''" aria-label="Tozalash"><X :size="14" /></button>
      </div>
      <div class="seg">
        <button v-for="o in PERIODS" :key="o.value" :class="{ on: period === o.value }" @click="period = o.value">{{ o.label }}</button>
      </div>
      <div class="seg">
        <button v-for="o in STATUSES" :key="o.value" :class="{ on: status === o.value }" @click="status = o.value">
          <span v-if="o.dot" class="dot" :class="`dot--${o.value}`"></span>{{ o.label }}
          <em>{{ statusCount(o.value) }}</em>
        </button>
      </div>
      <select v-model="cls" class="geo-input role-select">
        <option value="">Barcha sinflar</option>
        <option v-for="c in classes" :key="c" :value="c">{{ c }} sinf ({{ classCount(c) }})</option>
        <option :value="TEACHERS">O'qituvchilar ({{ classCount(TEACHERS) }})</option>
      </select>
    </div>

    <!-- Yuklanmoqda -->
    <div v-if="loading" class="geo-card list-card">
      <div v-for="i in 6" :key="i" class="skeleton-row">
        <div class="geo-skeleton" style="width:34px;height:34px;border-radius:50%"></div>
        <div style="flex:1">
          <div class="geo-skeleton" style="height:12px;width:40%;margin-bottom:8px"></div>
          <div class="geo-skeleton" style="height:10px;width:75%"></div>
        </div>
      </div>
    </div>

    <!-- Bo'sh -->
    <div v-else-if="!logs.length" class="geo-card empty">
      <div class="empty-icon"><Bot :size="28" /></div>
      <p class="empty-title">Hali AI bilan muloqot bo'lmagan</p>
      <p class="empty-sub">O'quvchilar AI yordamchiga savol berishi bilan ular shu yerda darhol paydo bo'ladi.</p>
    </div>

    <!-- Ro'yxat + tafsilot -->
    <div v-else class="split" :class="{ 'split--detail': selectedUser }">
      <div class="geo-card list-card">
        <div class="list-head">
          <div class="view-seg">
            <button :class="{ on: view === 'users' }" @click="setView('users')"><Users :size="13" /> O'quvchilar bo'yicha</button>
            <button :class="{ on: view === 'feed' }" @click="setView('feed')"><ListIcon :size="13" /> Barcha so'rovlar</button>
          </div>
          <span class="list-count">
            <template v-if="view === 'users'">{{ userTotal }} kishi · </template>{{ filtered.length }} so'rov
          </span>
        </div>

        <div v-if="!filtered.length" class="no-match">
          <SearchX :size="22" />
          <p>Filtrga mos so'rov topilmadi</p>
          <button class="geo-btn-ghost btn-sm" @click="resetFilters">Filtrlarni tozalash</button>
        </div>

        <!-- Sinf → o'quvchi ko'rinishi -->
        <template v-else-if="view === 'users'">
          <div v-if="sections.length > 1" class="sec-tools">
            <button class="link-btn" @click="collapseAll(false)">Hammasini ochish</button>
            <button class="link-btn" @click="collapseAll(true)">Hammasini yig'ish</button>
          </div>
          <section v-for="sec in sections" :key="sec.key" class="sec">
            <button type="button" class="sec-head" @click="toggleSection(sec.key)">
              <ChevronRight :size="15" class="chev" :class="{ 'chev--open': !collapsed.has(sec.key) }" />
              <span class="sec-icon" :class="`sec-icon--${sec.kind}`">
                <component :is="sec.kind === 'teacher' ? GraduationCap : sec.kind === 'none' ? CircleHelp : School" :size="13" />
              </span>
              <span class="sec-name">{{ sec.label }}</span>
              <span class="sec-stats">{{ sec.users.length }} kishi · {{ sec.count }} so'rov</span>
              <span v-if="sec.issues" class="sec-issue" :title="`${sec.issues} ta offline / xato`">
                <AlertTriangle :size="11" /> {{ sec.issues }}
              </span>
            </button>

            <div v-show="!collapsed.has(sec.key)" class="sec-body">
              <button v-for="u in sec.users" :key="u.key" type="button" class="urow"
                :class="{ 'urow--on': selectedUserKey === u.key, 'urow--new': u.logs.some(l => freshIds.has(l.id)) }"
                @click="selectUser(u.key)">
                <div class="avatar" :class="u.role === 'teacher' ? 'av-teacher' : 'av-student'">
                  <img v-if="u.avatarUrl" :src="u.avatarUrl" alt="" />
                  <template v-else>{{ initial(u.name) }}</template>
                </div>
                <div class="row-main">
                  <div class="row-top">
                    <span class="row-name">{{ u.name }}</span>
                    <span class="row-time" :title="fullTime(u.logs[0].createdAt)">{{ shortTime(u.logs[0].createdAt) }}</span>
                  </div>
                  <p class="row-q">{{ u.logs[0].question }}</p>
                </div>
                <span v-if="u.aiBlocked" class="flag-badge" title="AI bloklangan"><Ban :size="12" /></span>
                <span v-if="u.flagged" class="flag-badge" :title="`${u.flagged} marta so'kingan`"><ShieldAlert :size="12" /> {{ u.flagged }}</span>
                <span class="count-badge" :class="{ 'count-badge--warn': u.issues }" :title="`${u.logs.length} ta savol`">{{ u.logs.length }}</span>
              </button>
            </div>
          </section>
        </template>

        <!-- Xronologik ko'rinish -->
        <template v-else>
          <template v-for="group in groups" :key="group.label">
            <div class="group-label">{{ group.label }}</div>
            <button v-for="log in group.items" :key="log.id" type="button" class="row"
              :class="{ 'row--on': focusId === log.id, 'row--new': freshIds.has(log.id) }"
              @click="selectUser(userKey(log), log.id)">
              <div class="avatar" :class="log.role === 'teacher' ? 'av-teacher' : 'av-student'">
                <img v-if="log.avatarUrl" :src="log.avatarUrl" alt="" />
                <template v-else>{{ initial(log.userName) }}</template>
              </div>
              <div class="row-main">
                <div class="row-top">
                  <span class="row-name">{{ log.userName || "Noma'lum" }}</span>
                  <span class="row-tag">{{ whoLabel(log) }}</span>
                  <span class="row-time" :title="fullTime(log.createdAt)">{{ shortTime(log.createdAt) }}</span>
                </div>
                <p class="row-q">{{ log.question }}</p>
              </div>
              <span class="dot" :class="`dot--${statusOf(log)}`" :title="STATUS_TEXT[statusOf(log)]"></span>
            </button>
          </template>
          <button v-if="filtered.length > limit" class="more-btn" @click="limit += PAGE">
            Yana ko'rsatish ({{ filtered.length - limit }})
          </button>
        </template>
      </div>

      <!-- Tanlangan foydalanuvchining barcha savollari -->
      <aside class="geo-card detail" v-if="selectedUser" ref="detailEl">
        <div class="detail-head">
          <button class="icon-btn back-btn" @click="selectedUserKey = null" aria-label="Orqaga"><ArrowLeft :size="16" /></button>
          <div class="avatar avatar--lg" :class="selectedUser.role === 'teacher' ? 'av-teacher' : 'av-student'">
            <img v-if="selectedUser.avatarUrl" :src="selectedUser.avatarUrl" alt="" />
            <template v-else>{{ initial(selectedUser.name) }}</template>
          </div>
          <div class="detail-who">
            <p class="detail-name">{{ selectedUser.name }}</p>
            <p class="detail-sub">{{ whoLabel(selectedUser.logs[0]) }} · oxirgi savol {{ fullTime(selectedUser.logs[0].createdAt) }}</p>
          </div>
          <span v-if="manage.user?.aiBlocked" class="blocked-badge"><Ban :size="12" /> AI bloklangan</span>
        </div>

        <!-- Boshqaruv: faqat o'quvchilar uchun -->
        <div v-if="manageable" class="manage-bar">
          <button class="geo-btn-outline btn-sm" :class="manage.user?.aiBlocked ? 'btn-ok' : 'btn-danger'"
            :disabled="busy" @click="toggleBlock">
            <component :is="manage.user?.aiBlocked ? Unlock : Ban" :size="14" />
            {{ manage.user?.aiBlocked ? "AI'ni qayta ochish" : "AI'ni bloklash" }}
          </button>
          <button class="geo-btn-outline btn-sm btn-danger" :disabled="busy || !manage.chats.length" @click="deleteAllChats">
            <Trash2 :size="14" /> Barcha chatlarni o'chirish
          </button>
        </div>

        <div class="u-stats">
          <div><b>{{ selectedUser.logs.length }}</b><span>savol</span></div>
          <div><b>{{ selectedUser.logs.length - selectedUser.issues - selectedUser.flagged }}</b><span>muvaffaqiyatli</span></div>
          <div><b :class="{ warn: selectedUser.issues }">{{ selectedUser.issues }}</b><span>offline / xato</span></div>
          <div v-if="selectedUser.flagged"><b class="danger">{{ selectedUser.flagged }}</b><span>so'kingan</span></div>
          <div v-else><b>{{ activeDays(selectedUser.logs) }}</b><span>faol kun</span></div>
        </div>

        <div v-if="manageable" class="detail-tabs">
          <button :class="{ on: detailTab === 'questions' }" @click="detailTab = 'questions'">Savollar <em>{{ selectedUser.logs.length }}</em></button>
          <button :class="{ on: detailTab === 'chats' }" @click="detailTab = 'chats'">Chatlar <em>{{ manage.chats.length }}</em></button>
        </div>

        <!-- Chatlar: ochish, bloklash, o'chirish -->
        <template v-if="manageable && detailTab === 'chats'">
          <p v-if="!manage.chats.length" class="no-chats">Bu o'quvchida saqlangan chat yo'q</p>
          <div v-for="c in manage.chats" :key="c.id" class="chat-item" :class="{ 'chat-item--locked': c.locked }">
            <div class="chat-row">
              <button type="button" class="chat-open" @click="toggleChat(c)">
                <ChevronDown :size="15" class="chev" :class="{ 'chev--open': openChatId === c.id }" />
                <div class="chat-main">
                  <p class="chat-title"><Lock v-if="c.locked" :size="12" class="lock-ic" /> {{ c.title }}</p>
                  <p class="chat-meta">
                    {{ fullTime(c.updatedAt) }} · {{ Math.round(c.messageCount / 2) }} savol
                    <span v-if="c.locked" class="warn-no">bloklangan</span>
                    <span v-if="c.flagged" class="flag-badge"><ShieldAlert :size="11" /> {{ c.flagged }}</span>
                  </p>
                </div>
              </button>
              <button class="icon-btn" :title="c.locked ? 'Blokdan chiqarish' : 'Chatni bloklash'" :disabled="busy" @click="toggleLock(c)">
                <component :is="c.locked ? Unlock : Lock" :size="14" />
              </button>
              <button class="icon-btn icon-btn--danger" title="Chatni o'chirish" :disabled="busy" @click="removeChat(c)">
                <Trash2 :size="14" />
              </button>
            </div>
            <div v-if="openChatId === c.id" class="chat-msgs">
              <div v-if="!openChatMsgs" class="geo-skeleton" style="height:60px"></div>
              <div v-for="(m, i) in openChatMsgs || []" :key="i" class="cmsg" :class="`cmsg--${m.role}`">
                <span class="cmsg-who">{{ m.role === 'user' ? selectedUser.name : 'AI' }}</span>
                <div v-if="m.role === 'user'" class="cmsg-text">{{ m.content }}</div>
                <div v-else class="cmsg-text md" :class="{ 'cmsg-warn': m.meta?.warning }" v-html="renderMarkdown(m.content)"></div>
              </div>
            </div>
          </div>
        </template>

        <div v-if="!manageable || detailTab === 'questions'" class="thread-tools">
          <span>Savollar — yangilari yuqorida</span>
          <button class="link-btn" @click="toggleAllAnswers">{{ allOpen ? "Javoblarni yig'ish" : "Barcha javoblarni ochish" }}</button>
        </div>

        <article v-for="l in (!manageable || detailTab === 'questions' ? selectedUser.logs : [])" :key="l.id" :id="`log-${l.id}`" class="qa"
          :class="{ 'qa--focus': focusId === l.id, 'qa--new': freshIds.has(l.id) }">
          <button type="button" class="qa-head" @click="toggleAnswer(l.id)">
            <span class="dot" :class="`dot--${statusOf(l)}`" :title="STATUS_TEXT[statusOf(l)]"></span>
            <span class="qa-q">{{ l.question }}</span>
            <span class="qa-time" :title="fullTime(l.createdAt)">{{ dayTime(l.createdAt) }}</span>
            <ChevronDown :size="15" class="chev" :class="{ 'chev--open': openAnswers.has(l.id) }" />
          </button>
          <div v-if="openAnswers.has(l.id)" class="qa-body">
            <div v-if="l.flagged" class="flag-box">
              <ShieldAlert :size="15" />
              <div class="flag-text">
                <b>Haqoratli so'z ishlatilgan</b> ·
                <template v-if="l.retro">filtr qo'shilishidan oldin yozilgan — o'quvchiga ogohlantirish berilmagan, AI javob bergan</template>
                <template v-else>{{ l.warningNo || 1 }}-ogohlantirish berildi</template>
                <div class="flag-words"><span v-for="w in l.badWords" :key="w" class="bad-chip">{{ w }}</span></div>
              </div>
              <button v-if="!l.reviewed" class="geo-btn-outline btn-sm" @click.stop="alerts.review(l.id)"><Check :size="13" /> Ko'rildi</button>
              <span v-else class="reviewed"><CheckCheck :size="13" /> Ko'rilgan</span>
            </div>
            <div class="msg-label">
              <Bot :size="13" /> {{ statusOf(l) === 'error' ? 'Xato matni' : statusOf(l) === 'flagged' && !l.retro ? "O'quvchiga berilgan ogohlantirish" : 'AI javobi' }}
              <span class="provider">{{ providerLabel(l) }}</span>
              <button class="copy-btn copy-btn--danger" title="Savolni o'chirish" @click="removeLog(l)"><Trash2 :size="12" /></button>
              <button class="copy-btn" style="margin-left:0" @click="copy(l)">
                <component :is="copiedId === l.id ? Check : Copy" :size="12" /> {{ copiedId === l.id ? 'Nusxalandi' : 'Nusxa' }}
              </button>
            </div>
            <div v-if="statusOf(l) === 'error'" class="msg-box msg-box--err">{{ l.answer }}</div>
            <div v-else class="msg-box msg-box--a md" v-html="renderMarkdown(l.answer)"></div>
            <p v-if="statusOf(l) === 'offline'" class="offline-note">
              <AlertTriangle :size="13" /> AI xizmatiga ulanib bo'lmadi — zaxira (offline) javob ko'rsatilgan.
            </p>
          </div>
        </article>
      </aside>

      <aside v-else class="geo-card detail detail--empty">
        <MousePointerClick :size="26" />
        <p>O'quvchini tanlang — uning barcha savollari va AI javoblari shu yerda ko'rinadi</p>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Trash2, Download, Search, SearchX, X, Bot, ArrowLeft, Copy, Check, AlertTriangle, MousePointerClick,
  MessagesSquare, CalendarClock, Users, ShieldCheck, ChevronRight, ChevronDown, School, GraduationCap,
  CircleHelp, List as ListIcon, ShieldAlert, CheckCheck, Ban, Lock, Unlock,
} from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive, liveConnected } from "@shared/composables/live";
import { renderMarkdown } from "@shared/composables/markdown";
import { useAlertsStore } from "@shared/stores/alerts";

const PAGE = 60;
const DAY = 24 * 60 * 60 * 1000;
const PERIODS = [
  { value: "today", label: "Bugun" },
  { value: "week", label: "7 kun" },
  { value: "month", label: "30 kun" },
  { value: "all", label: "Hammasi" },
];
const STATUSES = [
  { value: "", label: "Hammasi" },
  { value: "ok", label: "Muvaffaqiyatli", dot: true },
  { value: "offline", label: "Offline", dot: true },
  { value: "error", label: "Xato", dot: true },
  { value: "flagged", label: "So'kinish", dot: true },
];
const STATUS_TEXT = { ok: "Muvaffaqiyatli", offline: "Offline javob", error: "Xato", flagged: "So'kinish — ogohlantirildi" };

const route = useRoute();
const router = useRouter();
const alerts = useAlertsStore();
alerts.start();
const alertLimit = ref(5);

const logs = ref([]);
const loading = ref(true);
const search = ref("");
const period = ref("all");
const status = ref("");
const cls = ref("");           // "" — barchasi, sinf nomi yoki TEACHERS
const TEACHERS = "__teachers";
const classes = ref([]);         // "Sinflar" sahifasida yaratilgan sinflar
const limit = ref(PAGE);
const selectedUserKey = ref(null);
const focusId = ref(null);             // ro'yxatda bosilgan aniq savol
const openAnswers = ref(new Set());    // javobi ochilgan savollar
const collapsed = ref(new Set());      // yig'ilgan sinf bo'limlari
const freshIds = ref(new Set());
const copiedId = ref(null);
const detailEl = ref(null);

// Ko'rinish: sinf → o'quvchi (default) yoki xronologik
const VIEW_KEY = "geo_ailogs_view";
const view = ref((() => { try { return localStorage.getItem(VIEW_KEY) === "feed" ? "feed" : "users"; } catch { return "users"; } })());
function setView(v) {
  view.value = v;
  try { localStorage.setItem(VIEW_KEY, v); } catch {}
}

async function load() {
  try {
    const data = await api("/api/ai/logs");
    // Yangi kelganlarini qisqa vaqt ajratib ko'rsatamiz
    if (!loading.value) {
      const known = new Set(logs.value.map(l => l.id));
      const fresh = data.filter(l => !known.has(l.id)).map(l => l.id);
      if (fresh.length) {
        freshIds.value = new Set(fresh);
        setTimeout(() => { freshIds.value = new Set(); }, 4000);
      }
    }
    logs.value = data;
  } catch {}
  loading.value = false;
}
// Sinflar ro'yxati — yangi sinf qo'shilsa yoki o'chirilsa darhol yangilanadi
async function loadClasses() {
  try {
    const data = await api("/api/classes");
    classes.value = (data.classes ?? []).map(c => c.name)
      .sort((a, b) => a.localeCompare(b, "uz", { numeric: true }));
    if (cls.value && cls.value !== TEACHERS && !classes.value.includes(cls.value)) cls.value = "";
  } catch {}
}

onMounted(() => { load(); loadClasses(); });
useLive(["ai_logs", "users"], load, { delay: 200 });
useLive(["classes"], loadClasses);

async function clearLogs() {
  if (!confirm(`Barcha ${logs.value.length} ta AI so'rovi o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) return;
  try { await api("/api/ai/logs", { method: "DELETE" }); logs.value = []; selectedUserKey.value = null; } catch (e) { alert(e.message); }
}

// ── Holat ──
function statusOf(l) {
  if (l.flagged) return "flagged";
  if (l.success !== false) return "ok";
  return l.provider === "offline" ? "offline" : "error";
}
function statusCount(v) {
  const base = periodFiltered.value;
  return v ? base.filter(l => statusOf(l) === v).length : base.length;
}
function providerLabel(l) {
  if (l.flagged) return "Moderatsiya";
  if (statusOf(l) === "error") return "Provayder: —";
  return l.provider === "offline" ? "Offline zaxira" : `Provayder: ${l.provider || "—"}`;
}
function whoLabel(l) {
  if (l.role === "teacher") return "O'qituvchi";
  return l.className ? `${l.className} sinf` : l.grade ? `${l.grade}-sinf` : "O'quvchi";
}
function initial(name) { return (name || "?").trim().charAt(0).toUpperCase(); }

// ── Filtrlash ──
const periodFiltered = computed(() => {
  if (period.value === "all") return logs.value;
  const from = period.value === "today"
    ? new Date().setHours(0, 0, 0, 0)
    : Date.now() - (period.value === "week" ? 7 : 30) * DAY;
  return logs.value.filter(l => new Date(l.createdAt).getTime() >= from);
});

const filtered = computed(() => {
  let list = periodFiltered.value;
  if (status.value) list = list.filter(l => statusOf(l) === status.value);
  if (cls.value) list = list.filter(l => matchesClass(l, cls.value));
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter(l =>
      [l.userName, l.className, l.question, l.answer].some(x => (x || "").toLowerCase().includes(q)));
  }
  return list;
});

watch([search, period, status, cls], () => { limit.value = PAGE; });

function resetFilters() { search.value = ""; period.value = "all"; status.value = ""; cls.value = ""; }

// Kun bo'yicha guruhlash
const groups = computed(() => {
  const today = new Date().setHours(0, 0, 0, 0);
  const out = [];
  for (const l of filtered.value.slice(0, limit.value)) {
    const day = new Date(l.createdAt).setHours(0, 0, 0, 0);
    const label = day === today ? "Bugun"
      : day === today - DAY ? "Kecha"
      : dateLabel(day);
    if (out.at(-1)?.label !== label) out.push({ label, items: [] });
    out.at(-1).items.push(l);
  }
  return out;
});

// ── Sinf → o'quvchi guruhlari ──
const NO_CLASS = "__none";
function userKey(l) { return l.userId != null ? `u${l.userId}` : `n:${l.userName}`; }
function sectionOf(l) { return l.role === "teacher" ? TEACHERS : (l.className || NO_CLASS); }
const isIssue = (l) => statusOf(l) !== "ok";

/** Foydalanuvchilar: { key, name, role, avatarUrl, logs (yangisi birinchi), issues } */
const users = computed(() => {
  const map = new Map();
  for (const l of filtered.value) {
    const k = userKey(l);
    if (!map.has(k)) map.set(k, { key: k, name: l.userName || "Noma'lum", role: l.role, avatarUrl: l.avatarUrl, aiBlocked: l.aiBlocked, section: sectionOf(l), logs: [], issues: 0, flagged: 0 });
    const u = map.get(k);
    u.logs.push(l);
    if (l.flagged) u.flagged++;
    else if (isIssue(l)) u.issues++;
  }
  return [...map.values()];
});
const userTotal = computed(() => users.value.length);

const sections = computed(() => {
  const map = new Map();
  for (const u of users.value) {
    if (!map.has(u.section)) map.set(u.section, []);
    map.get(u.section).push(u);
  }
  // Tartib: "Sinflar" sahifasidagi sinflar, keyin boshqa sinflar, sinfsizlar, o'qituvchilar
  const rank = (k) => k === TEACHERS ? 3 : k === NO_CLASS ? 2 : classes.value.includes(k) ? 0 : 1;
  return [...map.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "uz", { numeric: true }))
    .map(([key, list]) => {
      list.sort((a, b) => new Date(b.logs[0].createdAt) - new Date(a.logs[0].createdAt));
      return {
        key,
        kind: key === TEACHERS ? "teacher" : key === NO_CLASS ? "none" : "class",
        label: key === TEACHERS ? "O'qituvchilar" : key === NO_CLASS ? "Sinfi ko'rsatilmagan" : `${key} sinf`,
        users: list,
        count: list.reduce((n, u) => n + u.logs.length, 0),
        issues: list.reduce((n, u) => n + u.issues + u.flagged, 0),
      };
    });
});

function toggleSection(k) {
  const next = new Set(collapsed.value);
  next.has(k) ? next.delete(k) : next.add(k);
  collapsed.value = next;
}
function collapseAll(on) { collapsed.value = on ? new Set(sections.value.map(s => s.key)) : new Set(); }

const selectedUser = computed(() => users.value.find(u => u.key === selectedUserKey.value) ?? null);

function selectUser(key, logId = null) {
  selectedUserKey.value = key;
  const u = users.value.find(x => x.key === key);
  focusId.value = logId ?? u?.logs[0]?.id ?? null;
  openAnswers.value = new Set(focusId.value != null ? [focusId.value] : []);
  nextTick(() => {
    const el = focusId.value != null && document.getElementById(`log-${focusId.value}`);
    if (logId && el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    else detailEl.value?.scrollTo?.({ top: 0 });
  });
}

/** Xabardan: filtrlarni tozalab, o'sha o'quvchi va savolni ochadi. */
function openAlert(a) {
  resetFilters();
  if (view.value !== "users") setView("users");
  const key = userKey(a);
  const u = users.value.find(x => x.key === key);
  if (u) collapsed.value = new Set([...collapsed.value].filter(k => k !== u.section));
  selectUser(key, a.id);
  alerts.review(a.id);
}

// Toast'dagi "Ko'rish" → /ai-logs?alert=ID
watch([() => route.query.alert, () => logs.value.length], ([id]) => {
  if (!id || loading.value) return;
  const log = logs.value.find(l => l.id === Number(id));
  if (!log) return;
  openAlert(log);
  router.replace({ query: {} });
}, { immediate: true });

// ── O'quvchi chatlarini boshqarish (o'chirish / bloklash) ──
const detailTab = ref("questions");
const manage = ref({ user: null, chats: [] });
const openChatId = ref(null);
const openChatMsgs = ref(null);
const busy = ref(false);

const selectedUserId = computed(() => selectedUser.value?.logs[0]?.userId ?? null);
const manageable = computed(() => !!selectedUser.value && selectedUser.value.role !== "teacher" && selectedUserId.value != null);

async function loadUserChats() {
  const id = selectedUserId.value;
  if (!manageable.value) { manage.value = { user: null, chats: [] }; return; }
  try {
    const data = await api(`/api/ai/admin/users/${id}/chats`);
    if (selectedUserId.value !== id) return;
    manage.value = data;
    if (openChatId.value && !data.chats.some(c => c.id === openChatId.value)) openChatId.value = null;
    else if (openChatId.value) loadOpenChat();
  } catch {}
}
watch(selectedUserId, () => {
  manage.value = { user: null, chats: [] };
  openChatId.value = null;
  loadUserChats();
});
useLive(["ai_chats", "users"], loadUserChats);

async function loadOpenChat() {
  const id = openChatId.value;
  try {
    const chat = await api(`/api/ai/admin/chats/${id}`);
    if (openChatId.value === id) openChatMsgs.value = chat.messages ?? [];
  } catch {}
}
function toggleChat(c) {
  if (openChatId.value === c.id) { openChatId.value = null; return; }
  openChatId.value = c.id;
  openChatMsgs.value = null;
  loadOpenChat();
}

async function act(fn) {
  busy.value = true;
  try { await fn(); } catch (e) { alert(e.message || "Xatolik"); }
  busy.value = false;
  loadUserChats();
}
function toggleBlock() {
  const blocked = !manage.value.user?.aiBlocked;
  if (blocked && !confirm(`${selectedUser.value.name} uchun AI yordamchi bloklansinmi? U AI'ga savol bera olmaydi.`)) return;
  act(() => api(`/api/ai/admin/users/${selectedUserId.value}/block`, { method: "PUT", body: JSON.stringify({ blocked }) }));
}
function deleteAllChats() {
  if (!confirm(`${selectedUser.value.name}ning barcha ${manage.value.chats.length} ta chati va AI loglari o'chirilsinmi? Qaytarib bo'lmaydi.`)) return;
  act(() => api(`/api/ai/admin/users/${selectedUserId.value}/chats`, { method: "DELETE" }));
}
function toggleLock(c) {
  act(() => api(`/api/ai/admin/chats/${c.id}/lock`, { method: "PUT", body: JSON.stringify({ locked: !c.locked }) }));
}
function removeChat(c) {
  if (!confirm(`"${c.title}" chati va undagi savollar o'chirilsinmi?`)) return;
  act(() => api(`/api/ai/admin/chats/${c.id}`, { method: "DELETE" }));
}
function removeLog(l) {
  if (!confirm("Bu savol va AI javobi o'chirilsinmi?")) return;
  act(async () => {
    await api(`/api/ai/logs/${l.id}`, { method: "DELETE" });
    logs.value = logs.value.filter(x => x.id !== l.id);
  });
}

function toggleAnswer(id) {
  const next = new Set(openAnswers.value);
  next.has(id) ? next.delete(id) : next.add(id);
  openAnswers.value = next;
}
const allOpen = computed(() => !!selectedUser.value && selectedUser.value.logs.every(l => openAnswers.value.has(l.id)));
function toggleAllAnswers() {
  openAnswers.value = allOpen.value ? new Set() : new Set(selectedUser.value.logs.map(l => l.id));
}
function activeDays(list) { return new Set(list.map(l => new Date(l.createdAt).toDateString())).size; }

function matchesClass(l, c) {
  return c === TEACHERS ? l.role === "teacher" : l.role !== "teacher" && l.className === c;
}
function classCount(c) { return periodFiltered.value.filter(l => matchesClass(l, c)).length; }


// ── Ko'rsatkichlar ──
const kpis = computed(() => {
  const all = logs.value;
  const today = new Date().setHours(0, 0, 0, 0);
  const todayCount = all.filter(l => new Date(l.createdAt).getTime() >= today).length;
  const weekAgo = Date.now() - 7 * DAY;
  const weekUsers = new Set(all.filter(l => new Date(l.createdAt).getTime() >= weekAgo).map(l => l.userId)).size;
  const flagged = all.filter(l => l.flagged);
  const aiCalls = all.length - flagged.length;       // so'kinishlar AI ga yuborilmaydi
  const ok = all.filter(l => statusOf(l) === "ok").length;
  const rate = aiCalls ? Math.round((ok / aiCalls) * 100) : 0;
  const failed = aiCalls - ok;
  return [
    { label: "Jami so'rovlar", value: all.length, hint: `${new Set(all.map(l => l.userId)).size} ta foydalanuvchidan`, icon: MessagesSquare, color: "hsl(var(--primary))", bg: "hsl(var(--primary)/.1)" },
    { label: "Bugun", value: todayCount, hint: "bugungi so'rovlar", icon: CalendarClock, color: "hsl(220 70% 50%)", bg: "hsl(220 70% 50%/.1)" },
    { label: "Faol foydalanuvchilar", value: weekUsers, hint: "oxirgi 7 kunda", icon: Users, color: "hsl(265 60% 55%)", bg: "hsl(265 60% 55%/.1)" },
    { label: "Muvaffaqiyat", value: `${rate}%`, hint: failed ? `${failed} ta offline / xato` : "barcha javoblar muvaffaqiyatli",
      icon: ShieldCheck, color: rate >= 90 ? "hsl(var(--success))" : "hsl(var(--warning))", bg: rate >= 90 ? "hsl(var(--success)/.1)" : "hsl(var(--warning)/.12)" },
    { label: "Qoidabuzarlik", value: flagged.length, hint: flagged.length ? `${new Set(flagged.map(l => l.userId)).size} ta o'quvchi so'kingan` : "so'kinish yo'q",
      icon: ShieldAlert, color: flagged.length ? "hsl(var(--destructive))" : "hsl(var(--muted-fg))", bg: flagged.length ? "hsl(var(--destructive)/.1)" : "hsl(var(--muted))" },
  ];
});

// ── Vaqt ──
function shortTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "hozir";
  if (min < 60) return `${min} daq`;
  return dayTime(iso);
}
// Brauzerlar "uz-UZ" oylarini "M08" deb chiqaradi — nomlarni o'zimiz yozamiz
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
function dateLabel(ts) {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()}-${MONTHS[d.getMonth()]}${sameYear ? "" : ` ${d.getFullYear()}`}`;
}
function fullTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${dateLabel(d)}, ${hhmm(d)}`;
}
/** Bugun — faqat soat, boshqa kunlar — sana va soat. */
function dayTime(iso) {
  const d = new Date(iso);
  const today = new Date().setHours(0, 0, 0, 0);
  const day = new Date(iso).setHours(0, 0, 0, 0);
  if (day === today) return hhmm(d);
  if (day === today - DAY) return `Kecha ${hhmm(d)}`;
  return fullTime(iso);
}

// ── Amallar ──
async function copy(l) {
  try {
    await navigator.clipboard.writeText(l.answer || "");
    copiedId.value = l.id;
    setTimeout(() => { if (copiedId.value === l.id) copiedId.value = null; }, 1600);
  } catch {}
}

function exportCsv() {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Vaqt", "Foydalanuvchi", "Rol", "Sinf", "Holat", "Provayder", "Savol", "Javob"]];
  for (const l of filtered.value) {
    rows.push([fullTime(l.createdAt), l.userName, l.role === "teacher" ? "O'qituvchi" : "O'quvchi",
      l.className ?? "", STATUS_TEXT[statusOf(l)], l.provider ?? "", l.question, l.answer]);
  }
  const blob = new Blob(["﻿" + rows.map(r => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ai-loglar-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>

<style scoped>
.logs-page { max-width: 1280px; }

/* Sarlavha */
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.title-row { display: flex; align-items: center; gap: 10px; }
.head-actions { display: flex; gap: 8px; }
.btn-sm { padding: 7px 12px; font-size: 12.5px; }
.btn-danger { color: hsl(var(--destructive)); }
.btn-danger:hover:not(:disabled) { background: hsl(var(--destructive)/.08); border-color: hsl(var(--destructive)/.4); }

.live-pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 99px;
  font-size: 11.5px; font-weight: 700; background: hsl(var(--success)/.12); color: hsl(var(--success));
}
.live-pill--off { background: hsl(var(--muted)); color: hsl(var(--muted-fg)); }
.live-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: pulse 1.6s ease-in-out infinite; }
.live-pill--off .live-dot { animation: none; }

/* KPI */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 12px; }
.kpi { display: flex; gap: 12px; padding: 14px 16px; border-radius: 14px; }
.kpi-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.kpi-body { display: flex; flex-direction: column; min-width: 0; }
.kpi-label { font-size: 12px; color: hsl(var(--muted-fg)); font-weight: 600; }
.kpi-value { font-size: 22px; font-weight: 800; line-height: 1.25; font-variant-numeric: tabular-nums; }
.kpi-hint { font-size: 11.5px; color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Filtrlar */
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px; margin-bottom: 12px; border-radius: 14px; }
.search-box { position: relative; flex: 1 1 260px; }
.search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: hsl(var(--muted-fg)); pointer-events: none; }
.search-input { padding-left: 34px; padding-right: 30px; }
.search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: 0; background: none; color: hsl(var(--muted-fg)); cursor: pointer; display: flex; padding: 3px; border-radius: 6px; }
.search-clear:hover { background: hsl(var(--muted)); }
.seg { display: inline-flex; background: hsl(var(--muted)); border-radius: 10px; padding: 3px; gap: 2px; flex-wrap: wrap; }
.seg button {
  display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; cursor: pointer;
  padding: 6px 10px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: hsl(var(--muted-fg)); font-family: inherit;
}
.seg button:hover { color: hsl(var(--fg)); }
.seg button.on { background: hsl(var(--card)); color: hsl(var(--fg)); box-shadow: 0 1px 3px hsl(var(--fg)/.1); }
.seg em { font-style: normal; font-size: 11px; opacity: .7; font-variant-numeric: tabular-nums; }
.role-select { width: auto; min-width: 150px; }

.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
.dot--ok { background: hsl(var(--success)); }
.dot--offline { background: hsl(var(--warning)); }
.dot--error { background: hsl(var(--destructive)); }
.dot--flagged { background: hsl(330 75% 50%); box-shadow: 0 0 0 2px hsl(330 75% 50%/.25); }

/* Qoidabuzarliklar */
.alert-panel { border: 1px solid hsl(var(--destructive)/.3); background: hsl(var(--destructive)/.04); border-radius: 14px; padding: 12px; margin-bottom: 12px; }
.alert-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.alert-head > div:nth-child(2) { flex: 1; min-width: 200px; }
.alert-head-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: hsl(var(--destructive)/.12); color: hsl(var(--destructive)); flex-shrink: 0; }
.alert-title { font-size: 14px; font-weight: 700; color: hsl(var(--destructive)); }
.alert-sub { font-size: 12px; color: hsl(var(--muted-fg)); }
.alert-list { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.alert-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); }
.alert-main { flex: 1; min-width: 0; }
.alert-name { font-size: 13px; font-weight: 700; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.alert-q { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 3px; font-size: 11.5px; }
.warn-no { font-size: 11px; font-weight: 700; color: hsl(var(--destructive)); }
.bad-chip { font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 6px; background: hsl(var(--destructive)/.1); color: hsl(var(--destructive)); }
.av-danger { background: hsl(var(--destructive)/.12); color: hsl(var(--destructive)); }
.flag-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 99px; background: hsl(var(--destructive)/.12); color: hsl(var(--destructive)); flex-shrink: 0; }
.flag-box { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 10px; margin-bottom: 10px; background: hsl(var(--destructive)/.07); border: 1px solid hsl(var(--destructive)/.25); color: hsl(var(--destructive)); font-size: 12.5px; }
.flag-text { flex: 1; }
.flag-words { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px; }
.reviewed { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; color: hsl(var(--muted-fg)); white-space: nowrap; }
.u-stats b.danger { color: hsl(var(--destructive)); }

/* Boshqaruv */
.blocked-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 700; background: hsl(var(--destructive)/.12); color: hsl(var(--destructive)); white-space: nowrap; }
.manage-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.btn-ok { color: hsl(var(--success)); }
.btn-ok:hover:not(:disabled) { background: hsl(var(--success)/.08); }
.detail-tabs { display: flex; gap: 4px; border-bottom: 1px solid hsl(var(--border)); margin: 4px 0 10px; }
.detail-tabs button { border: 0; background: none; font-family: inherit; font-size: 13px; font-weight: 600; color: hsl(var(--muted-fg)); padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.detail-tabs button.on { color: hsl(var(--primary)); border-bottom-color: hsl(var(--primary)); }
.detail-tabs em { font-style: normal; font-size: 11px; background: hsl(var(--muted)); padding: 1px 6px; border-radius: 99px; margin-left: 4px; }
.no-chats { font-size: 13px; color: hsl(var(--muted-fg)); padding: 20px 0; text-align: center; }
.chat-item { border: 1px solid hsl(var(--border)); border-radius: 12px; margin-bottom: 8px; overflow: hidden; }
.chat-item--locked { border-color: hsl(var(--destructive)/.35); background: hsl(var(--destructive)/.03); }
.chat-row { display: flex; align-items: center; gap: 6px; padding-right: 8px; }
.chat-open { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 0; background: none; cursor: pointer; font-family: inherit; color: inherit; text-align: left; }
.chat-open .chev--open { transform: rotate(180deg); }
.chat-main { min-width: 0; }
.chat-title { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-meta { font-size: 11.5px; color: hsl(var(--muted-fg)); display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.lock-ic { display: inline; vertical-align: -1px; color: hsl(var(--destructive)); }
.chat-row .icon-btn, .alert-item .icon-btn { display: flex; }
.icon-btn:disabled { opacity: .5; cursor: wait; }
.icon-btn--danger { color: hsl(var(--destructive)); }
.icon-btn--danger:hover { background: hsl(var(--destructive)/.08); }
.chat-msgs { border-top: 1px solid hsl(var(--border)); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; background: hsl(var(--muted)/.25); }
.cmsg { display: flex; flex-direction: column; gap: 3px; }
.cmsg--user { align-items: flex-end; }
.cmsg-who { font-size: 10.5px; font-weight: 700; color: hsl(var(--muted-fg)); text-transform: uppercase; letter-spacing: .04em; }
.cmsg-text { max-width: 88%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.55; }
.cmsg--user .cmsg-text { background: hsl(var(--primary)); color: #fff; white-space: pre-wrap; }
.cmsg--assistant .cmsg-text { background: hsl(var(--card)); border: 1px solid hsl(var(--border)); }
.cmsg-text.cmsg-warn { background: hsl(var(--destructive)/.08); border-color: hsl(var(--destructive)/.3); }
.copy-btn--danger:hover { color: hsl(var(--destructive)); background: hsl(var(--destructive)/.08); }

/* Ro'yxat + tafsilot */
.split { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 12px; align-items: start; }
@media (max-width: 1024px) {
  .split { grid-template-columns: 1fr; }
  .detail--empty { display: none; }
  .split--detail .list-card { display: none; }
}

.list-card { padding: 6px; border-radius: 14px; max-height: calc(100vh - 170px); overflow-y: auto; }
.list-head { position: sticky; top: -6px; z-index: 1; background: hsl(var(--card)); padding: 8px 10px; font-size: 12px; font-weight: 700; display: flex; gap: 4px; }
.muted { color: hsl(var(--muted-fg)); font-weight: 500; }
.group-label { padding: 10px 10px 4px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: hsl(var(--muted-fg)); }

.row {
  width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px;
  border: 1px solid transparent; background: transparent; text-align: left; cursor: pointer; font-family: inherit; color: inherit;
  transition: background .12s, border-color .12s;
}
.row:hover { background: hsl(var(--muted)/.7); }
.row--on { background: hsl(var(--primary)/.08); border-color: hsl(var(--primary)/.25); }
.row--new { animation: flash 2.4s ease-out; }
@keyframes flash { from { background: hsl(var(--primary)/.18); } to { background: transparent; } }
.row-main { flex: 1; min-width: 0; }
.row-top { display: flex; align-items: baseline; gap: 6px; }
.row-name { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-tag { font-size: 11px; color: hsl(var(--muted-fg)); white-space: nowrap; }
.row-time { margin-left: auto; font-size: 11px; color: hsl(var(--muted-fg)); white-space: nowrap; font-variant-numeric: tabular-nums; }
.row-q { font-size: 12.5px; color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }

.avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar--lg { width: 42px; height: 42px; font-size: 16px; }
.av-student { background: hsl(var(--primary)/.14); color: hsl(var(--primary)); }
.av-teacher { background: hsl(38 90% 48%/.15); color: hsl(38 80% 38%); }

.more-btn { width: 100%; margin-top: 4px; padding: 9px; border: 1px dashed hsl(var(--border)); border-radius: 10px; background: none; color: hsl(var(--primary)); font-weight: 600; font-size: 12.5px; cursor: pointer; font-family: inherit; }
.more-btn:hover { background: hsl(var(--primary)/.05); }
.no-match { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 16px; color: hsl(var(--muted-fg)); font-size: 13px; }
.skeleton-row { display: flex; gap: 10px; align-items: center; padding: 10px; }

/* Tafsilot */
.detail { padding: 18px; border-radius: 14px; position: sticky; top: 12px; max-height: calc(100vh - 170px); overflow-y: auto; }
.detail--empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 320px; color: hsl(var(--muted-fg)); text-align: center; font-size: 13px; }
.detail-head { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid hsl(var(--border)); }
.detail-who { flex: 1; min-width: 0; }
.detail-name { font-size: 15px; font-weight: 700; }
.detail-sub { font-size: 12px; color: hsl(var(--muted-fg)); }
.back-btn { display: none; }
@media (max-width: 1024px) { .back-btn { display: flex; } .detail { position: static; max-height: none; } }
.icon-btn { width: 32px; height: 32px; border-radius: 9px; border: 1px solid hsl(var(--border)); background: none; color: inherit; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }

.status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.status-badge--ok { background: hsl(var(--success)/.12); color: hsl(var(--success)); }
.status-badge--offline { background: hsl(var(--warning)/.14); color: hsl(38 75% 36%); }
.status-badge--error { background: hsl(var(--destructive)/.12); color: hsl(var(--destructive)); }

.meta-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 4px; }
.meta { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 8px; background: hsl(var(--muted)); font-size: 11.5px; color: hsl(var(--muted-fg)); font-weight: 600; }
.meta--link { cursor: pointer; color: hsl(var(--primary)); background: hsl(var(--primary)/.08); }
.meta--link:hover { background: hsl(var(--primary)/.14); }

.msg { margin-top: 14px; }
.msg-label { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: hsl(var(--muted-fg)); margin-bottom: 6px; }
.copy-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: hsl(var(--muted-fg)); font-size: 11.5px; font-weight: 600; text-transform: none; letter-spacing: 0; cursor: pointer; padding: 3px 6px; border-radius: 6px; font-family: inherit; }
.copy-btn:hover { background: hsl(var(--muted)); color: hsl(var(--fg)); }
.msg-box { padding: 12px 14px; border-radius: 12px; font-size: 13.5px; line-height: 1.65; }
.msg-box--q { background: hsl(var(--muted)); white-space: pre-wrap; font-weight: 500; }
.msg-box--a { background: hsl(var(--primary)/.05); border: 1px solid hsl(var(--primary)/.14); }
.msg-box--err { background: hsl(var(--destructive)/.07); border: 1px solid hsl(var(--destructive)/.2); color: hsl(var(--destructive)); white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 12.5px; }
.offline-note { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: hsl(38 75% 36%); }
:global(.dark) .offline-note, :global(.dark) .status-badge--offline { color: hsl(38 80% 58%); }

.md :deep(p) { margin: 0 0 8px; }
.md :deep(p:last-child) { margin-bottom: 0; }
.md :deep(p.md-h) { font-weight: 700; margin-top: 4px; }
.md :deep(ul), .md :deep(ol) { margin: 4px 0 8px; padding-left: 22px; }
.md :deep(ul) { list-style: disc; }
.md :deep(ol) { list-style: decimal; }
.md :deep(li) { margin-bottom: 4px; }
.md :deep(strong) { font-weight: 700; }
.md :deep(code) { background: hsl(var(--fg)/.07); padding: 1px 5px; border-radius: 5px; font-size: 12.5px; }
.md :deep(.md-table-wrap) { overflow-x: auto; margin: 6px 0 8px; }
.md :deep(table) { border-collapse: collapse; font-size: 13px; min-width: 100%; }
.md :deep(th), .md :deep(td) { border: 1px solid hsl(var(--border)); padding: 6px 10px; text-align: left; }
.md :deep(th) { font-weight: 700; background: hsl(var(--fg)/.04); }

/* Ko'rinish tanlash */
.list-head { flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.view-seg { display: inline-flex; background: hsl(var(--muted)); border-radius: 9px; padding: 3px; gap: 2px; }
.view-seg button {
  display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; cursor: pointer; font-family: inherit;
  padding: 5px 10px; border-radius: 7px; font-size: 12px; font-weight: 600; color: hsl(var(--muted-fg));
}
.view-seg button.on { background: hsl(var(--card)); color: hsl(var(--fg)); box-shadow: 0 1px 3px hsl(var(--fg)/.1); }
.list-count { font-size: 11.5px; font-weight: 600; color: hsl(var(--muted-fg)); }
.link-btn { border: 0; background: none; color: hsl(var(--primary)); font-size: 11.5px; font-weight: 600; cursor: pointer; padding: 2px 4px; border-radius: 5px; font-family: inherit; }
.link-btn:hover { background: hsl(var(--primary)/.08); }
.sec-tools { display: flex; justify-content: flex-end; gap: 4px; padding: 0 6px 4px; }

/* Sinf bo'limlari */
.sec + .sec { margin-top: 4px; }
.sec-head {
  width: 100%; display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 10px;
  border: 0; background: hsl(var(--muted)/.55); cursor: pointer; font-family: inherit; color: inherit; text-align: left;
}
.sec-head:hover { background: hsl(var(--muted)); }
.chev { color: hsl(var(--muted-fg)); transition: transform .15s; flex-shrink: 0; }
.sec-head .chev--open { transform: rotate(90deg); }
.qa-head .chev--open { transform: rotate(180deg); }
.sec-icon { width: 24px; height: 24px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sec-icon--class { background: hsl(var(--primary)/.12); color: hsl(var(--primary)); }
.sec-icon--teacher { background: hsl(38 90% 48%/.15); color: hsl(38 80% 38%); }
.sec-icon--none { background: hsl(var(--muted)); color: hsl(var(--muted-fg)); }
.sec-name { font-size: 13px; font-weight: 700; }
.sec-stats { margin-left: auto; font-size: 11.5px; color: hsl(var(--muted-fg)); font-weight: 600; white-space: nowrap; }
.sec-issue { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 99px; background: hsl(var(--warning)/.15); color: hsl(38 75% 36%); }
.sec-body { padding: 4px 0 4px 14px; margin-left: 12px; border-left: 2px solid hsl(var(--border)); }

.urow {
  width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px;
  border: 1px solid transparent; background: transparent; text-align: left; cursor: pointer; font-family: inherit; color: inherit;
}
.urow:hover { background: hsl(var(--muted)/.7); }
.urow--on { background: hsl(var(--primary)/.08); border-color: hsl(var(--primary)/.25); }
.urow--new { animation: flash 2.4s ease-out; }
.count-badge {
  min-width: 26px; height: 22px; padding: 0 7px; border-radius: 99px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11.5px; font-weight: 700; background: hsl(var(--muted)); color: hsl(var(--fg)); font-variant-numeric: tabular-nums;
}
.count-badge--warn { box-shadow: inset 0 0 0 1.5px hsl(var(--warning)); }

/* Foydalanuvchi savollari */
.u-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 10px; }
.u-stats div { background: hsl(var(--muted)/.6); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; }
.u-stats b { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; }
.u-stats b.warn { color: hsl(38 75% 40%); }
.u-stats span { font-size: 11px; color: hsl(var(--muted-fg)); }
.thread-tools { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: hsl(var(--muted-fg)); margin-bottom: 6px; }
.thread-tools .link-btn { text-transform: none; letter-spacing: 0; }

.qa { border: 1px solid hsl(var(--border)); border-radius: 12px; margin-bottom: 8px; overflow: hidden; scroll-margin: 12px; }
.qa--focus { border-color: hsl(var(--primary)/.45); box-shadow: 0 0 0 3px hsl(var(--primary)/.08); }
.qa--new { animation: flash 2.4s ease-out; }
.qa-head {
  width: 100%; display: flex; align-items: center; gap: 10px; padding: 11px 12px;
  border: 0; background: transparent; cursor: pointer; font-family: inherit; color: inherit; text-align: left;
}
.qa-head:hover { background: hsl(var(--muted)/.5); }
.qa-q { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; line-height: 1.45; }
.qa-time { font-size: 11.5px; color: hsl(var(--muted-fg)); white-space: nowrap; font-variant-numeric: tabular-nums; }
.qa-body { padding: 0 12px 12px; }
.provider { font-weight: 600; text-transform: none; letter-spacing: 0; opacity: .8; }
@media (max-width: 600px) { .u-stats { grid-template-columns: repeat(2, 1fr); } }

/* Bo'sh holat */
.empty { text-align: center; padding: 64px 24px; border-radius: 14px; }
.empty-icon { width: 58px; height: 58px; border-radius: 16px; background: hsl(var(--primary)/.1); color: hsl(var(--primary)); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
.empty-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: hsl(var(--muted-fg)); max-width: 380px; margin: 0 auto; }
</style>
