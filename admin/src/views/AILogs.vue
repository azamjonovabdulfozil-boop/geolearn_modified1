<template>
  <div class="fade-in logs-page">
    <!-- ══ Sarlavha ══ -->
    <header class="page-head">
      <div class="head-text">
        <div class="title-row">
          <span class="title-icon"><Bot :size="20" /></span>
          <h1 class="geo-page-title">AI monitoring</h1>
          <span class="live-pill" :class="{ 'live-pill--off': !liveConnected }">
            <span class="live-dot"></span>{{ liveConnected ? 'Jonli' : 'Ulanmoqda…' }}
          </span>
        </div>
        <p class="geo-page-sub">O'quvchilar AI yordamchiga nima so'raganini va qanday javob olganini shu yerda kuzatasiz</p>
      </div>
      <div class="head-actions">
        <button class="geo-btn-outline btn-sm" :disabled="!filtered.length" title="Filtrlangan so'rovlarni Excel (CSV) faylga yuklab olish" @click="exportCsv">
          <Download :size="14" /> CSV yuklab olish
        </button>
        <button class="geo-btn-outline btn-sm btn-danger" :disabled="!logs.length" title="Barcha AI loglarini o'chirish" @click="clearLogs">
          <Trash2 :size="14" /> Hammasini tozalash
        </button>
      </div>
    </header>

    <!-- ══ Ko'rsatkichlar ══ -->
    <section class="kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="geo-card kpi">
        <div class="kpi-top">
          <span class="kpi-icon" :style="{ background: k.bg, color: k.color }"><component :is="k.icon" :size="16" /></span>
          <span class="kpi-label">{{ k.label }}</span>
        </div>
        <span class="kpi-value" :style="{ color: k.label === 'Qoidabuzarlik' && k.value ? k.color : null }">{{ loading ? '—' : k.value }}</span>
        <span class="kpi-hint">{{ k.hint }}</span>
      </div>
    </section>

    <!-- ══ Ko'rib chiqilmagan qoidabuzarliklar (yig'iladigan) ══ -->
    <section v-if="alerts.unread.length" class="alert-panel">
      <div class="alert-head">
        <span class="alert-head-icon"><ShieldAlert :size="18" /></span>
        <div class="alert-head-text">
          <p class="alert-title">{{ alerts.unread.length }} ta qoidabuzarlik ko'rib chiqilmagan</p>
          <p class="alert-sub">O'quvchilar AI'ga haqoratli so'z yozgan — ularga avtomatik ogohlantirish berildi. Ko'rib chiqing.</p>
        </div>
        <div class="alert-head-actions">
          <button class="geo-btn-outline btn-sm" @click="alertsOpen = !alertsOpen">
            <ChevronDown :size="14" class="chev" :class="{ 'chev--open': alertsOpen }" />
            {{ alertsOpen ? 'Yig\'ish' : 'Ro\'yxatni ko\'rish' }}
          </button>
          <button class="geo-btn-outline btn-sm" @click="alerts.review('all')"><CheckCheck :size="14" /> Hammasi ko'rildi</button>
        </div>
      </div>
      <div v-if="alertsOpen" class="alert-list">
        <div v-for="a in alerts.unread.slice(0, alertLimit)" :key="a.id" class="alert-item">
          <div class="avatar av-danger">
            <img v-if="a.avatarUrl" :src="a.avatarUrl" alt="" />
            <template v-else>{{ initial(a.userName) }}</template>
          </div>
          <div class="alert-main">
            <p class="alert-name">{{ a.userName }} <span class="tag">{{ whoLabel(a) }}</span></p>
            <p class="alert-meta">
              <span class="warn-no">{{ a.retro ? "filtrdan oldin yozilgan" : `${a.warningNo || 1}-ogohlantirish` }}</span>
              <span v-for="w in a.badWords" :key="w" class="bad-chip">{{ w }}</span>
              <span class="muted">{{ dayTime(a.createdAt) }}</span>
            </p>
          </div>
          <button class="geo-btn-outline btn-sm" @click="openAlert(a)"><Eye :size="13" /> Ko'rish</button>
          <button class="geo-btn-ghost btn-sm" title="Ko'rildi deb belgilash" @click="alerts.review(a.id)"><Check :size="14" /> Ko'rildi</button>
        </div>
        <button v-if="alerts.unread.length > alertLimit" class="more-btn" @click="alertLimit += 10">
          Yana {{ alerts.unread.length - alertLimit }} tasini ko'rsatish
        </button>
      </div>
    </section>

    <!-- ══ Asosiy ish maydoni ══ -->
    <section class="geo-card workspace">
      <!-- Filtrlar -->
      <div class="filters">
        <div class="f-search">
          <Search :size="16" class="search-icon" />
          <input v-model="search" class="geo-input search-input" placeholder="Qidirish: o'quvchi ismi, sinf, savol yoki javob matni…" />
          <button v-if="search" class="search-clear" @click="search = ''" aria-label="Tozalash"><X :size="14" /></button>
        </div>
        <label class="f-field">
          <span class="f-label"><CalendarClock :size="13" /> Davr</span>
          <select v-model="period" class="geo-input f-select">
            <option v-for="o in PERIODS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
        <label class="f-field">
          <span class="f-label"><School :size="13" /> Sinf</span>
          <select v-model="cls" class="geo-input f-select">
            <option value="">Barcha sinflar</option>
            <option v-for="c in classes" :key="c" :value="c">{{ c }} sinf ({{ classCount(c) }})</option>
            <option :value="TEACHERS">O'qituvchilar ({{ classCount(TEACHERS) }})</option>
          </select>
        </label>
      </div>

      <!-- Holat bo'yicha filtr — har biri nima ekani yozilgan -->
      <div class="status-row">
        <span class="f-label">Javob holati:</span>
        <button v-for="o in STATUSES" :key="o.value" class="status-chip" :class="[`status-chip--${o.value || 'all'}`, { on: status === o.value }]"
          :title="o.value ? STATUS_HELP[o.value] : 'Barcha so\'rovlar'" @click="status = o.value">
          <component v-if="o.value" :is="STATUS_ICON[o.value]" :size="13" />
          {{ o.label }}
          <em>{{ statusCount(o.value) }}</em>
        </button>
        <button v-if="search || period !== 'all' || status || cls" class="link-btn reset-link" @click="resetFilters">
          <X :size="12" /> Filtrlarni tozalash
        </button>
      </div>

      <!-- Yuklanmoqda -->
      <div v-if="loading" class="pane-wrap">
        <div class="list-pane">
          <div v-for="i in 7" :key="i" class="skeleton-row">
            <div class="geo-skeleton" style="width:38px;height:38px;border-radius:12px"></div>
            <div style="flex:1">
              <div class="geo-skeleton" style="height:12px;width:45%;margin-bottom:8px"></div>
              <div class="geo-skeleton" style="height:10px;width:80%"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bo'sh -->
      <div v-else-if="!logs.length" class="empty">
        <div class="empty-icon"><Bot :size="30" /></div>
        <p class="empty-title">Hali AI bilan muloqot bo'lmagan</p>
        <p class="empty-sub">O'quvchilar AI yordamchiga savol berishi bilan ular shu yerda darhol paydo bo'ladi.</p>
      </div>

      <!-- Ro'yxat + tafsilot -->
      <div v-else class="pane-wrap" :class="{ 'pane-wrap--detail': selectedUser }">
        <!-- ── Chap: kim so'radi ── -->
        <div class="list-pane">
          <div class="list-head">
            <div class="tabs">
              <button :class="{ on: view === 'users' }" @click="setView('users')"><Users :size="14" /> O'quvchilar bo'yicha</button>
              <button :class="{ on: view === 'feed' }" @click="setView('feed')"><ListIcon :size="14" /> Barcha savollar</button>
            </div>
            <p class="list-count">
              <template v-if="view === 'users'"><b>{{ userTotal }}</b> kishi · </template><b>{{ filtered.length }}</b> ta savol
            </p>
          </div>

          <div v-if="!filtered.length" class="no-match">
            <SearchX :size="24" />
            <p>Filtrga mos savol topilmadi</p>
            <button class="geo-btn-outline btn-sm" @click="resetFilters">Filtrlarni tozalash</button>
          </div>

          <!-- Sinf → o'quvchi -->
          <div v-else-if="view === 'users'" class="list-scroll">
            <div v-if="sections.length > 1" class="sec-tools">
              <button class="link-btn" @click="collapseAll(false)">Hammasini ochish</button>
              <span>·</span>
              <button class="link-btn" @click="collapseAll(true)">Hammasini yig'ish</button>
            </div>
            <section v-for="sec in sections" :key="sec.key" class="sec">
              <button type="button" class="sec-head" @click="toggleSection(sec.key)">
                <ChevronRight :size="15" class="chev" :class="{ 'chev--open': !collapsed.has(sec.key) }" />
                <span class="sec-icon" :class="`sec-icon--${sec.kind}`">
                  <component :is="sec.kind === 'teacher' ? GraduationCap : sec.kind === 'none' ? CircleHelp : School" :size="14" />
                </span>
                <span class="sec-name">{{ sec.label }}</span>
                <span class="sec-stats">{{ sec.users.length }} kishi · {{ sec.count }} savol</span>
                <span v-if="sec.issues" class="pill pill--warn" :title="`${sec.issues} ta muammoli savol (offline, xato yoki so'kinish)`">
                  <AlertTriangle :size="11" /> {{ sec.issues }} muammo
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
                    <p class="row-q"><span class="row-q-label">Oxirgi savol:</span> {{ u.logs[0].question }}</p>
                    <div class="row-badges">
                      <span class="pill">{{ u.logs.length }} ta savol</span>
                      <span v-if="u.issues" class="pill pill--warn"><AlertTriangle :size="11" /> {{ u.issues }} xato</span>
                      <span v-if="u.flagged" class="pill pill--danger"><ShieldAlert :size="11" /> {{ u.flagged }} so'kinish</span>
                      <span v-if="u.aiBlocked" class="pill pill--danger"><Ban :size="11" /> AI bloklangan</span>
                    </div>
                  </div>
                </button>
              </div>
            </section>
          </div>

          <!-- Vaqt bo'yicha -->
          <div v-else class="list-scroll">
            <template v-for="group in groups" :key="group.label">
              <div class="group-label">{{ group.label }}</div>
              <button v-for="log in group.items" :key="log.id" type="button" class="frow"
                :class="{ 'frow--on': focusId === log.id, 'frow--new': freshIds.has(log.id) }"
                @click="selectUser(userKey(log), log.id)">
                <span class="frow-time" :title="fullTime(log.createdAt)">{{ shortTime(log.createdAt) }}</span>
                <div class="row-main">
                  <div class="row-top">
                    <span class="row-name">{{ log.userName || "Noma'lum" }}</span>
                    <span class="tag">{{ whoLabel(log) }}</span>
                  </div>
                  <p class="row-q">{{ log.question }}</p>
                </div>
                <span class="status-badge" :class="`status-badge--${statusOf(log)}`" :title="STATUS_TEXT[statusOf(log)]">
                  <component :is="STATUS_ICON[statusOf(log)]" :size="12" /> {{ statusLabel(log) }}
                </span>
              </button>
            </template>
            <button v-if="filtered.length > limit" class="more-btn" @click="limit += PAGE">
              Yana ko'rsatish ({{ filtered.length - limit }} ta qoldi)
            </button>
          </div>
        </div>

        <!-- ── O'ng: tanlangan o'quvchi ── -->
        <aside v-if="selectedUser" ref="detailEl" class="detail-pane">
          <div class="detail-head">
            <button class="icon-btn back-btn" @click="selectedUserKey = null" aria-label="Orqaga"><ArrowLeft :size="17" /></button>
            <div class="avatar avatar--lg" :class="selectedUser.role === 'teacher' ? 'av-teacher' : 'av-student'">
              <img v-if="selectedUser.avatarUrl" :src="selectedUser.avatarUrl" alt="" />
              <template v-else>{{ initial(selectedUser.name) }}</template>
            </div>
            <div class="detail-who">
              <p class="detail-name">
                {{ selectedUser.name }}
                <span v-if="manage.user?.aiBlocked" class="pill pill--danger"><Ban :size="11" /> AI bloklangan</span>
              </p>
              <p class="detail-sub">{{ whoLabel(selectedUser.logs[0]) }} · oxirgi savol: {{ fullTime(selectedUser.logs[0].createdAt) }}</p>
            </div>
          </div>

          <!-- Statistikasi -->
          <div class="u-stats">
            <div class="u-stat"><b>{{ selectedUser.logs.length }}</b><span>jami savol</span></div>
            <div class="u-stat u-stat--ok"><b>{{ selectedUser.logs.length - selectedUser.issues - selectedUser.flagged }}</b><span>javob olgan</span></div>
            <div class="u-stat" :class="{ 'u-stat--warn': selectedUser.issues }"><b>{{ selectedUser.issues }}</b><span>offline / xato</span></div>
            <div v-if="selectedUser.flagged" class="u-stat u-stat--danger"><b>{{ selectedUser.flagged }}</b><span>so'kingan</span></div>
            <div v-else class="u-stat"><b>{{ activeDays(selectedUser.logs) }}</b><span>faol kun</span></div>
          </div>

          <!-- Boshqaruv: faqat o'quvchilar uchun -->
          <div v-if="manageable" class="manage-bar">
            <span class="manage-label">Boshqarish:</span>
            <button class="geo-btn-outline btn-sm" :class="manage.user?.aiBlocked ? 'btn-ok' : 'btn-danger'"
              :disabled="busy" @click="toggleBlock">
              <component :is="manage.user?.aiBlocked ? Unlock : Ban" :size="14" />
              {{ manage.user?.aiBlocked ? "Blokni ochish (AI va chat)" : "AI'dan foydalanishni bloklash" }}
            </button>
            <button class="geo-btn-outline btn-sm btn-danger" :disabled="busy || !manage.chats.length" @click="deleteAllChats">
              <Trash2 :size="14" /> Barcha chatlarini o'chirish
            </button>
          </div>

          <div v-if="manageable" class="tabs tabs--detail">
            <button :class="{ on: detailTab === 'questions' }" @click="detailTab = 'questions'"><MessagesSquare :size="14" /> Savol-javoblar <em>{{ selectedUser.logs.length }}</em></button>
            <button :class="{ on: detailTab === 'chats' }" @click="detailTab = 'chats'"><ListIcon :size="14" /> Chatlar <em>{{ manage.chats.length }}</em></button>
          </div>

          <!-- Chatlar -->
          <template v-if="manageable && detailTab === 'chats'">
            <p class="hint-line">Chatni bosib ichini o'qing. <Lock :size="11" /> — chatni bloklash, <Trash2 :size="11" /> — o'chirish.</p>
            <p v-if="!manage.chats.length" class="no-chats">Bu o'quvchida saqlangan chat yo'q</p>
            <div v-for="c in manage.chats" :key="c.id" class="chat-item" :class="{ 'chat-item--locked': c.locked }">
              <div class="chat-row">
                <button type="button" class="chat-open" @click="toggleChat(c)">
                  <ChevronDown :size="15" class="chev" :class="{ 'chev--open': openChatId === c.id }" />
                  <div class="chat-main">
                    <p class="chat-title"><Lock v-if="c.locked" :size="12" class="lock-ic" /> {{ c.title }}</p>
                    <p class="chat-meta">
                      {{ fullTime(c.updatedAt) }} · {{ Math.round(c.messageCount / 2) }} ta savol
                      <span v-if="c.locked" class="pill pill--warn">bloklangan</span>
                      <span v-if="c.flagged" class="pill pill--danger"><ShieldAlert :size="11" /> {{ c.flagged }} so'kinish</span>
                    </p>
                  </div>
                </button>
                <button class="icon-btn" :title="c.locked ? 'Blokdan chiqarish' : 'Chatni bloklash'" :disabled="busy" @click="toggleLock(c)">
                  <component :is="c.locked ? Unlock : Lock" :size="15" />
                </button>
                <button class="icon-btn icon-btn--danger" title="Chatni o'chirish" :disabled="busy" @click="removeChat(c)">
                  <Trash2 :size="15" />
                </button>
              </div>
              <div v-if="openChatId === c.id" class="chat-msgs">
                <div v-if="!openChatMsgs" class="geo-skeleton" style="height:60px"></div>
                <div v-for="(m, i) in openChatMsgs || []" :key="i" class="cmsg" :class="`cmsg--${m.role}`">
                  <span class="cmsg-who">{{ m.role === 'user' ? selectedUser.name : 'AI yordamchi' }}</span>
                  <div v-if="m.role === 'user'" class="cmsg-text">{{ m.content }}</div>
                  <div v-else class="cmsg-text md" :class="{ 'cmsg-warn': m.meta?.warning }" v-html="renderMarkdown(m.content)"></div>
                </div>
              </div>
            </div>
          </template>

          <!-- Savol-javoblar -->
          <template v-if="!manageable || detailTab === 'questions'">
            <div class="thread-tools">
              <span>Yangilari yuqorida · savolni bosing — javob ochiladi</span>
              <button class="link-btn" @click="toggleAllAnswers">{{ allOpen ? "Javoblarni yig'ish" : "Barcha javoblarni ochish" }}</button>
            </div>

            <article v-for="l in selectedUser.logs" :key="l.id" :id="`log-${l.id}`" class="qa"
              :class="[`qa--${statusOf(l)}`, { 'qa--focus': focusId === l.id, 'qa--new': freshIds.has(l.id), 'qa--open': openAnswers.has(l.id) }]">
              <button type="button" class="qa-head" @click="toggleAnswer(l.id)">
                <span class="qa-q-icon"><User :size="13" /></span>
                <span class="qa-q">{{ l.question }}</span>
                <span class="qa-side">
                  <span class="status-badge" :class="`status-badge--${statusOf(l)}`" :title="STATUS_TEXT[statusOf(l)]">
                    <component :is="STATUS_ICON[statusOf(l)]" :size="12" /> {{ statusLabel(l) }}
                  </span>
                  <span class="qa-time" :title="fullTime(l.createdAt)">{{ dayTime(l.createdAt) }}</span>
                </span>
                <ChevronDown :size="16" class="chev" :class="{ 'chev--open': openAnswers.has(l.id) }" />
              </button>

              <div v-if="openAnswers.has(l.id)" class="qa-body">
                <div v-if="l.flagged" class="flag-box">
                  <ShieldAlert :size="16" />
                  <div class="flag-text">
                    <b>Haqoratli so'z ishlatilgan</b>
                    <p>
                      <template v-if="l.retro">Filtr qo'shilishidan oldin yozilgan — o'quvchiga ogohlantirish berilmagan, AI javob bergan.</template>
                      <template v-else>O'quvchiga {{ l.warningNo || 1 }}-ogohlantirish berildi.</template>
                    </p>
                    <div class="flag-words"><span v-for="w in l.badWords" :key="w" class="bad-chip">{{ w }}</span></div>
                  </div>
                  <button v-if="!l.reviewed" class="geo-btn-outline btn-sm" @click.stop="alerts.review(l.id)"><Check :size="13" /> Ko'rildi</button>
                  <span v-else class="reviewed"><CheckCheck :size="13" /> Ko'rilgan</span>
                </div>

                <div class="answer">
                  <div class="answer-head">
                    <span class="answer-title">
                      <Bot :size="14" />
                      {{ statusOf(l) === 'error' ? 'Xato matni' : statusOf(l) === 'flagged' && !l.retro ? "O'quvchiga berilgan ogohlantirish" : 'AI javobi' }}
                    </span>
                    <span class="provider">{{ providerLabel(l) }}</span>
                  </div>
                  <div v-if="statusOf(l) === 'error'" class="msg-box msg-box--err">{{ l.answer }}</div>
                  <div v-else class="msg-box md" v-html="renderMarkdown(l.answer)"></div>
                  <p v-if="statusOf(l) === 'offline'" class="offline-note">
                    <AlertTriangle :size="13" /> AI xizmatiga ulanib bo'lmadi — o'quvchiga zaxira (offline) javob ko'rsatilgan.
                  </p>
                  <div class="answer-actions">
                    <button class="geo-btn-ghost btn-sm" @click="copy(l)">
                      <component :is="copiedId === l.id ? Check : Copy" :size="13" /> {{ copiedId === l.id ? 'Nusxalandi' : 'Javobni nusxalash' }}
                    </button>
                    <button class="geo-btn-ghost btn-sm btn-danger-ghost" @click="removeLog(l)">
                      <Trash2 :size="13" /> Savolni o'chirish
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </template>
        </aside>

        <aside v-else class="detail-pane detail-pane--empty">
          <div class="empty-icon"><MousePointerClick :size="26" /></div>
          <p class="empty-title">O'quvchini tanlang</p>
          <p class="empty-sub">Chap tomondagi ro'yxatdan o'quvchini bosing — uning barcha savollari, AI javoblari va chatlari shu yerda ochiladi.</p>
          <div class="legend">
            <p class="legend-title">Belgilar nimani bildiradi:</p>
            <div v-for="s in STATUSES.filter(x => x.value)" :key="s.value" class="legend-row">
              <span class="status-badge" :class="`status-badge--${s.value}`"><component :is="STATUS_ICON[s.value]" :size="12" /> {{ s.label }}</span>
              <span>{{ STATUS_HELP[s.value] }}</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Trash2, Download, Search, SearchX, X, Bot, ArrowLeft, Copy, Check, AlertTriangle, MousePointerClick,
  MessagesSquare, CalendarClock, Users, ShieldCheck, ChevronRight, ChevronDown, School, GraduationCap,
  CircleHelp, List as ListIcon, ShieldAlert, CheckCheck, Ban, Lock, Unlock, Eye, User, CircleCheck, WifiOff, CircleX,
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
// Faqat ko'rinish uchun: holat belgisi va uning izohi
const STATUS_ICON = { ok: CircleCheck, offline: WifiOff, error: CircleX, flagged: ShieldAlert };
const STATUS_HELP = {
  ok: "AI savolga javob berdi",
  offline: "AI ishlamadi — zaxira javob ko'rsatildi",
  error: "So'rovda xatolik yuz berdi",
  flagged: "O'quvchi haqoratli so'z yozdi — ogohlantirildi",
};
function statusLabel(l) { return STATUSES.find(s => s.value === statusOf(l))?.label ?? ""; }

const route = useRoute();
const router = useRouter();
const alerts = useAlertsStore();
alerts.start();
const alertLimit = ref(5);
const alertsOpen = ref(false);  // qoidabuzarliklar ro'yxati: sukut bo'yicha yig'iq (joy egallamasin)

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
.logs-page { max-width: 1320px; display: flex; flex-direction: column; gap: 14px; }

/* ── Sarlavha ── */
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.head-text { min-width: 0; }
.title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.title-icon { width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: hsl(var(--primary)/.12); color: hsl(var(--primary)); }
.live-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 700; background: hsl(var(--success)/.12); color: hsl(var(--success)); }
.live-pill--off { background: hsl(var(--muted)); color: hsl(var(--muted-fg)); }
.live-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: pulse 1.6s ease-in-out infinite; }
.head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-sm { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; font-size: 12.5px; border-radius: 10px; white-space: nowrap; }
.btn-danger { color: hsl(var(--destructive)); border-color: hsl(var(--destructive)/.35); }
.btn-danger:hover:not(:disabled) { background: hsl(var(--destructive)/.08); border-color: hsl(var(--destructive)); }
.btn-ok { color: hsl(var(--success)); border-color: hsl(var(--success)/.4); }
.btn-danger-ghost { color: hsl(var(--destructive)); }

/* ── Ko'rsatkichlar ── */
.kpi-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.kpi { padding: 14px 16px; border-radius: 14px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.kpi-top { display: flex; align-items: center; gap: 8px; }
.kpi-icon { width: 28px; height: 28px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.kpi-label { font-size: 12.5px; font-weight: 600; color: hsl(var(--muted-fg)); }
.kpi-value { font-size: 26px; font-weight: 800; line-height: 1.15; letter-spacing: -.02em; margin-top: 4px; }
.kpi-hint { font-size: 11.5px; color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Qoidabuzarliklar ── */
.alert-panel { border: 1px solid hsl(var(--destructive)/.3); background: hsl(var(--destructive)/.05); border-radius: 14px; padding: 12px 14px; }
.alert-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.alert-head-icon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: hsl(var(--destructive)/.12); color: hsl(var(--destructive)); flex-shrink: 0; }
.alert-head-text { flex: 1; min-width: 220px; }
.alert-title { font-size: 14.5px; font-weight: 700; color: hsl(var(--destructive)); }
.alert-sub { font-size: 12.5px; color: hsl(var(--muted-fg)); margin-top: 2px; }
.alert-head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.alert-list { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.alert-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 11px; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); flex-wrap: wrap; }
.alert-main { flex: 1; min-width: 180px; }
.alert-name { font-size: 13.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.alert-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 3px; font-size: 12px; }
.warn-no { font-size: 11.5px; font-weight: 700; color: hsl(var(--destructive)); }
.bad-chip { font-family: ui-monospace, monospace; font-size: 11.5px; padding: 1px 7px; border-radius: 6px; background: hsl(var(--destructive)/.1); color: hsl(var(--destructive)); }
.muted { color: hsl(var(--muted-fg)); }

/* ── Ish maydoni ── */
.workspace { padding: 0; border-radius: 16px; overflow: hidden; }
.filters { display: flex; align-items: flex-end; gap: 10px; padding: 14px 16px 10px; flex-wrap: wrap; border-bottom: 1px solid hsl(var(--border)); }
.f-search { position: relative; flex: 1; min-width: 240px; }
.search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: hsl(var(--muted-fg)); pointer-events: none; }
.search-input { padding-left: 40px; padding-right: 34px; }
.search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border: none; border-radius: 7px; background: hsl(var(--muted)); color: hsl(var(--muted-fg)); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.f-field { display: flex; flex-direction: column; gap: 4px; min-width: 150px; }
.f-label { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: hsl(var(--muted-fg)); text-transform: uppercase; letter-spacing: .03em; }
.f-select { padding-top: 9px; padding-bottom: 9px; cursor: pointer; }

.status-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 10px 16px 12px; border-bottom: 1px solid hsl(var(--border)); background: hsl(var(--muted)/.35); }
.status-row .f-label { margin-right: 4px; }
.status-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 99px; border: 1.5px solid hsl(var(--border)); background: hsl(var(--card)); font-size: 12.5px; font-weight: 600; font-family: inherit; color: hsl(var(--fg)); cursor: pointer; transition: all .15s; }
.status-chip em { font-style: normal; font-size: 11px; font-weight: 700; padding: 0 6px; border-radius: 99px; background: hsl(var(--muted)); color: hsl(var(--muted-fg)); }
.status-chip:hover { border-color: hsl(var(--primary)/.5); }
.status-chip.on { border-color: hsl(var(--primary)); background: hsl(var(--primary)/.08); color: hsl(var(--primary)); }
.status-chip--ok svg { color: hsl(var(--success)); }
.status-chip--offline svg { color: hsl(var(--warning)); }
.status-chip--error svg { color: hsl(var(--destructive)); }
.status-chip--flagged svg { color: hsl(330 75% 50%); }
.reset-link { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }
.link-btn { border: none; background: none; padding: 0; font-family: inherit; font-size: 12px; font-weight: 600; color: hsl(var(--primary)); cursor: pointer; }
.link-btn:hover { text-decoration: underline; }

/* Ikki ustun: chapda ro'yxat, o'ngda tafsilot (ikkalasi o'z ichida skroll) */
.pane-wrap { display: grid; grid-template-columns: minmax(300px, 5fr) minmax(0, 7fr); height: calc(100vh - 150px); min-height: 560px; }
.list-pane { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid hsl(var(--border)); }
.list-head { padding: 12px 14px 10px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid hsl(var(--border)); }
.list-count { font-size: 12px; color: hsl(var(--muted-fg)); }
.list-count b { color: hsl(var(--fg)); }
.list-scroll { flex: 1; overflow-y: auto; padding: 8px; min-height: 0; }

.tabs { display: flex; gap: 4px; padding: 3px; border-radius: 11px; background: hsl(var(--muted)); }
.tabs button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 10px; border: none; border-radius: 9px; background: transparent; font-size: 12.5px; font-weight: 600; font-family: inherit; color: hsl(var(--muted-fg)); cursor: pointer; transition: all .15s; white-space: nowrap; }
.tabs button.on { background: hsl(var(--card)); color: hsl(var(--fg)); box-shadow: 0 1px 3px hsl(0 0% 0% / .08); }
.tabs em { font-style: normal; font-size: 11px; padding: 0 6px; border-radius: 99px; background: hsl(var(--primary)/.12); color: hsl(var(--primary)); }

.sec-tools { display: flex; justify-content: flex-end; align-items: center; gap: 6px; padding: 0 6px 6px; font-size: 12px; color: hsl(var(--muted-fg)); }
.sec { margin-bottom: 6px; }
.sec-head { width: 100%; display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: none; border-radius: 10px; background: hsl(var(--muted)/.6); font-family: inherit; cursor: pointer; text-align: left; position: sticky; top: -8px; z-index: 1; }
.sec-head:hover { background: hsl(var(--muted)); }
.sec-icon { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sec-icon--class { background: hsl(var(--primary)/.12); color: hsl(var(--primary)); }
.sec-icon--teacher { background: hsl(265 60% 55%/.12); color: hsl(265 60% 50%); }
.sec-icon--none { background: hsl(var(--muted)); color: hsl(var(--muted-fg)); }
.sec-name { font-size: 13.5px; font-weight: 700; color: hsl(var(--fg)); }
.sec-stats { margin-left: auto; font-size: 11.5px; color: hsl(var(--muted-fg)); white-space: nowrap; }
.sec-body { display: flex; flex-direction: column; gap: 2px; padding: 4px 0 4px 6px; }
.chev { transition: transform .18s; flex-shrink: 0; color: hsl(var(--muted-fg)); }
.chev--open { transform: rotate(90deg); }
.qa-head .chev--open, .chat-open .chev--open, .alert-head .chev--open { transform: rotate(180deg); }

.urow { width: 100%; display: flex; align-items: flex-start; gap: 11px; padding: 10px 10px; border: 1.5px solid transparent; border-radius: 12px; background: none; font-family: inherit; text-align: left; cursor: pointer; transition: background .15s, border-color .15s; }
.urow:hover { background: hsl(var(--muted)/.6); }
.urow--on { background: hsl(var(--primary)/.07); border-color: hsl(var(--primary)/.45); }
.urow--new, .frow--new { animation: flash 1.6s ease-out 2; }
.avatar { width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; overflow: hidden; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar--lg { width: 50px; height: 50px; border-radius: 15px; font-size: 19px; }
.av-student { background: hsl(var(--primary)/.13); color: hsl(var(--primary)); }
.av-teacher { background: hsl(265 60% 55%/.14); color: hsl(265 60% 50%); }
.av-danger { background: hsl(var(--destructive)/.12); color: hsl(var(--destructive)); }
.row-main { flex: 1; min-width: 0; }
.row-top { display: flex; align-items: center; gap: 8px; }
.row-name { font-size: 13.5px; font-weight: 700; color: hsl(var(--fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-time { margin-left: auto; font-size: 11.5px; color: hsl(var(--muted-fg)); flex-shrink: 0; }
.row-q { font-size: 12.5px; color: hsl(var(--muted-fg)); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-q-label { font-weight: 600; color: hsl(var(--fg)/.7); }
.row-badges { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.tag { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 6px; background: hsl(var(--muted)); color: hsl(var(--muted-fg)); white-space: nowrap; }
.pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; background: hsl(var(--muted)); color: hsl(var(--muted-fg)); white-space: nowrap; }
.pill--warn { background: hsl(var(--warning)/.14); color: hsl(35 85% 38%); }
.pill--danger { background: hsl(var(--destructive)/.1); color: hsl(var(--destructive)); }

.group-label { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: hsl(var(--muted-fg)); padding: 12px 8px 6px; }
.frow { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px; border: 1.5px solid transparent; border-radius: 12px; background: none; font-family: inherit; text-align: left; cursor: pointer; }
.frow:hover { background: hsl(var(--muted)/.6); }
.frow--on { background: hsl(var(--primary)/.07); border-color: hsl(var(--primary)/.45); }
.frow-time { width: 66px; flex-shrink: 0; font-size: 11.5px; font-weight: 700; line-height: 1.3; color: hsl(var(--muted-fg)); font-variant-numeric: tabular-nums; }

/* Holat belgisi — rang + matn */
.status-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 99px; white-space: nowrap; flex-shrink: 0; }
.status-badge--ok { background: hsl(var(--success)/.12); color: hsl(var(--success)); }
.status-badge--offline { background: hsl(var(--warning)/.15); color: hsl(35 85% 38%); }
.status-badge--error { background: hsl(var(--destructive)/.1); color: hsl(var(--destructive)); }
.status-badge--flagged { background: hsl(330 75% 50%/.12); color: hsl(330 70% 45%); }

.more-btn { width: 100%; margin-top: 8px; padding: 10px; border: 1.5px dashed hsl(var(--border)); border-radius: 11px; background: none; font-size: 12.5px; font-weight: 600; font-family: inherit; color: hsl(var(--primary)); cursor: pointer; }
.more-btn:hover { background: hsl(var(--primary)/.05); border-color: hsl(var(--primary)/.5); }
.no-match { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px 16px; color: hsl(var(--muted-fg)); font-size: 13px; text-align: center; }
.skeleton-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }

/* ── Tafsilot ── */
.detail-pane { overflow-y: auto; padding: 18px 20px 24px; min-height: 0; }
.detail-pane--empty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; color: hsl(var(--muted-fg)); }
.detail-head { display: flex; align-items: center; gap: 13px; padding-bottom: 14px; border-bottom: 1px solid hsl(var(--border)); }
.detail-who { min-width: 0; flex: 1; }
.detail-name { font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.detail-sub { font-size: 12.5px; color: hsl(var(--muted-fg)); margin-top: 3px; }
.icon-btn.back-btn { display: none; }
.icon-btn { width: 34px; height: 34px; border-radius: 10px; border: 1px solid hsl(var(--border)); background: hsl(var(--card)); color: hsl(var(--muted-fg)); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all .15s; }
.icon-btn:hover:not(:disabled) { color: hsl(var(--primary)); border-color: hsl(var(--primary)/.5); }
.icon-btn--danger:hover:not(:disabled) { color: hsl(var(--destructive)); border-color: hsl(var(--destructive)/.5); background: hsl(var(--destructive)/.06); }

.u-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
.u-stat { padding: 10px 12px; border-radius: 12px; background: hsl(var(--muted)/.6); display: flex; flex-direction: column; gap: 1px; }
.u-stat b { font-size: 20px; font-weight: 800; line-height: 1.2; }
.u-stat span { font-size: 11.5px; color: hsl(var(--muted-fg)); }
.u-stat--ok b { color: hsl(var(--success)); }
.u-stat--warn b { color: hsl(35 85% 42%); }
.u-stat--danger b { color: hsl(var(--destructive)); }

.manage-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-radius: 12px; border: 1px dashed hsl(var(--border)); margin-bottom: 14px; }
.manage-label { font-size: 12px; font-weight: 700; color: hsl(var(--muted-fg)); margin-right: 2px; }
.tabs--detail { margin-bottom: 12px; }
.hint-line { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 12px; color: hsl(var(--muted-fg)); margin-bottom: 10px; }
.no-chats { font-size: 13px; color: hsl(var(--muted-fg)); padding: 24px 0; text-align: center; }

.chat-item { border: 1px solid hsl(var(--border)); border-radius: 12px; margin-bottom: 8px; overflow: hidden; }
.chat-item--locked { border-color: hsl(var(--warning)/.5); background: hsl(var(--warning)/.04); }
.chat-row { display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 4px; }
.chat-open { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 6px; border: none; background: none; font-family: inherit; text-align: left; cursor: pointer; }
.chat-main { min-width: 0; }
.chat-title { font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11.5px; color: hsl(var(--muted-fg)); margin-top: 3px; }
.lock-ic { display: inline; vertical-align: -1px; color: hsl(var(--warning)); }
.chat-msgs { border-top: 1px solid hsl(var(--border)); padding: 12px; display: flex; flex-direction: column; gap: 10px; max-height: 440px; overflow-y: auto; background: hsl(var(--muted)/.3); }
.cmsg { display: flex; flex-direction: column; gap: 3px; max-width: 88%; }
.cmsg--user { align-self: flex-end; align-items: flex-end; }
.cmsg-who { font-size: 11px; font-weight: 700; color: hsl(var(--muted-fg)); }
.cmsg-text { font-size: 13px; line-height: 1.55; padding: 8px 12px; border-radius: 12px; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); white-space: pre-wrap; }
.cmsg--user .cmsg-text { background: hsl(var(--primary)); color: white; border-color: transparent; }
.cmsg-text.md { white-space: normal; }
.cmsg-warn { background: hsl(var(--destructive)/.07); border-color: hsl(var(--destructive)/.3); }

.thread-tools { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 12px; color: hsl(var(--muted-fg)); margin-bottom: 10px; }

/* Savol-javob kartasi */
.qa { border: 1px solid hsl(var(--border)); border-left: 4px solid hsl(var(--border)); border-radius: 12px; margin-bottom: 8px; background: hsl(var(--card)); transition: box-shadow .15s; }
.qa--ok { border-left-color: hsl(var(--success)); }
.qa--offline { border-left-color: hsl(var(--warning)); }
.qa--error { border-left-color: hsl(var(--destructive)); }
.qa--flagged { border-left-color: hsl(330 75% 50%); }
.qa--focus { box-shadow: 0 0 0 2px hsl(var(--primary)/.35); }
.qa--new { animation: flash 1.6s ease-out 2; }
.qa-head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 11px 12px; border: none; background: none; font-family: inherit; text-align: left; cursor: pointer; }
.qa-q-icon { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: hsl(var(--muted)); color: hsl(var(--muted-fg)); flex-shrink: 0; }
.qa-q { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: hsl(var(--fg)); line-height: 1.45; }
.qa:not(.qa--open) .qa-q { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qa-side { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
.qa-time { font-size: 11px; color: hsl(var(--muted-fg)); white-space: nowrap; }
.qa-body { padding: 0 12px 12px 48px; display: flex; flex-direction: column; gap: 10px; }

.flag-box { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 11px; background: hsl(var(--destructive)/.06); border: 1px solid hsl(var(--destructive)/.25); color: hsl(var(--destructive)); flex-wrap: wrap; }
.flag-text { flex: 1; min-width: 180px; font-size: 12.5px; color: hsl(var(--fg)); }
.flag-text b { color: hsl(var(--destructive)); }
.flag-text p { margin-top: 2px; color: hsl(var(--muted-fg)); }
.flag-words { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.reviewed { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: hsl(var(--success)); }

.answer { border-radius: 11px; background: hsl(var(--muted)/.45); padding: 10px 12px; }
.answer-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.answer-title { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: hsl(var(--primary)); }
.provider { font-size: 11px; color: hsl(var(--muted-fg)); }
.msg-box { font-size: 13.5px; line-height: 1.6; color: hsl(var(--fg)); }
.msg-box--err { font-family: ui-monospace, monospace; font-size: 12px; color: hsl(var(--destructive)); white-space: pre-wrap; }
.offline-note { display: flex; align-items: center; gap: 6px; font-size: 12px; color: hsl(35 85% 38%); margin-top: 8px; }
.answer-actions { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; padding-top: 8px; border-top: 1px solid hsl(var(--border)); }

.md :deep(p) { margin: 0 0 6px; }
.md :deep(p:last-child) { margin-bottom: 0; }
.md :deep(p.md-h) { font-weight: 700; }
.md :deep(ul), .md :deep(ol) { margin: 2px 0 6px; padding-left: 20px; }
.md :deep(ul) { list-style: disc; }
.md :deep(ol) { list-style: decimal; }
.md :deep(strong) { font-weight: 700; }
.md :deep(code) { background: hsl(var(--fg)/.07); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
.md :deep(.md-table-wrap) { overflow-x: auto; margin: 6px 0; }
.md :deep(table) { border-collapse: collapse; font-size: 12.5px; }
.md :deep(th), .md :deep(td) { border: 1px solid hsl(var(--border)); padding: 5px 9px; text-align: left; }
.md :deep(.md-img) { max-width: 260px; border-radius: 10px; }

/* Bo'sh holatlar */
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 20px; }
.empty-icon { width: 58px; height: 58px; border-radius: 17px; background: hsl(var(--primary)/.1); color: hsl(var(--primary)); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
.empty-title { font-size: 15px; font-weight: 700; color: hsl(var(--fg)); }
.empty-sub { font-size: 13px; color: hsl(var(--muted-fg)); max-width: 380px; }
.legend { margin-top: 20px; padding: 14px 16px; border-radius: 14px; background: hsl(var(--muted)/.5); text-align: left; display: flex; flex-direction: column; gap: 8px; max-width: 440px; width: 100%; }
.legend-title { font-size: 12px; font-weight: 700; color: hsl(var(--fg)); }
.legend-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.legend-row .status-badge { min-width: 116px; justify-content: center; }

@keyframes flash { 0% { background: hsl(var(--success)/.18); } 100% { background: transparent; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }

/* ── Moslashuvchanlik ── */
@media (max-width: 1200px) {
  .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1024px) {
  .pane-wrap { grid-template-columns: 1fr; height: auto; min-height: 0; }
  .list-pane { border-right: none; }
  .list-scroll { max-height: 70vh; }
  .pane-wrap--detail .list-pane { display: none; }
  .detail-pane--empty { display: none; }
  .icon-btn.back-btn { display: inline-flex; }
}
@media (max-width: 640px) {
  .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kpi-value { font-size: 22px; }
  .head-actions { width: 100%; }
  .head-actions .btn-sm { flex: 1; justify-content: center; }
  .filters { padding: 12px; }
  .f-field { flex: 1; min-width: 130px; }
  .status-row { padding: 10px 12px; }
  .reset-link { margin-left: 0; }
  .u-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .detail-pane { padding: 14px; }
  .qa-body { padding-left: 12px; }
  .qa-head { flex-wrap: wrap; }
  .qa-side { flex-direction: row; align-items: center; gap: 8px; }
  .alert-item .btn-sm { flex: 1; justify-content: center; }
}
</style>
