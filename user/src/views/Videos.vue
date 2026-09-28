<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Videolar</h1>
        <p class="geo-page-sub">Sinf bo'yicha geografiya darsliklari</p>
      </div>
      <div v-if="stats.total" class="head-stats">
        <div class="hs"><b>{{ stats.completed }}</b><span>tugatilgan</span></div>
        <div class="hs"><b>{{ stats.started }}</b><span>boshlangan</span></div>
        <div class="hs"><b>{{ stats.total }}</b><span>jami</span></div>
      </div>
    </div>

    <div class="grade-filter">
      <button v-for="g in grades" :key="g" @click="activeGrade = g"
        class="grade-chip" :class="{ 'grade-chip--on': activeGrade === g }">
        {{ g === 0 ? 'Barchasi' : `${g}-sinf` }}
      </button>
    </div>

    <div v-if="loading" class="video-grid">
      <div v-for="i in 4" :key="i" class="geo-skeleton" style="aspect-ratio:16/9;border-radius:1rem"></div>
    </div>

    <div v-else-if="!filtered.length" class="geo-card empty-card">
      <Video :size="34" style="color:hsl(var(--muted-fg));opacity:.4;display:block;margin:0 auto 12px" />
      <p class="empty-title">Hali videolar yo'q</p>
    </div>

    <div v-else class="video-grid">
      <div v-for="v in filtered" :key="v.id" class="video-card geo-card" @click="openVideo(v)">
        <div class="video-thumb">
          <img :src="resolveUrl(v.thumbUrl)" class="thumb-img" loading="lazy" alt="" />
          <div class="thumb-overlay">
            <div class="play-btn"><Play :size="18" style="color:hsl(var(--primary));margin-left:2px" /></div>
          </div>
          <span class="grade-tag">{{ v.grade }}-sinf</span>
          <span v-if="v.myCompleted" class="done-tag"><CheckCircle2 :size="11" /> Ko'rilgan</span>
          <div v-if="v.myPercent" class="thumb-progress">
            <div class="thumb-progress-fill" :style="{ width: v.myPercent + '%' }"></div>
          </div>
        </div>
        <div class="video-info">
          <p class="video-title">{{ v.title }}</p>
          <div class="video-meta">
            <span v-if="v.myPercent" class="meta-pct">{{ v.myPercent }}% ko'rilgan</span>
            <span v-else class="meta-new">Yangi</span>
            <span v-if="v.myPositionSec && !v.myCompleted" class="meta-resume">
              <RotateCcw :size="11" /> {{ formatTime(v.myPositionSec) }} dan davom etadi
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Pleyer ────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="playing" class="player-back" @click.self="closePlayer">
        <div class="player-box">
          <div class="player-head">
            <div class="ph-left">
              <p class="player-title">{{ playing.title }}</p>
              <p class="player-sub">{{ playing.grade }}-sinf · Geografiya darsi</p>
            </div>
            <button @click="closePlayer" class="player-close" title="Yopish">✕</button>
          </div>

          <!-- Sahna: iframe ustidan qalqon, o'z boshqaruvimiz -->
          <div ref="stageEl" class="stage" :class="{ 'stage--idle': !showControls && isPlaying }"
               @mousemove="wakeControls" @touchstart="wakeControls">
            <div class="media"><div ref="playerEl"></div></div>

            <!-- Qalqon: bosishlar pleyerga o'tmaydi (manba ham, menyu ham ochilmaydi) -->
            <div class="shield" @click="togglePlay" @dblclick.prevent @contextmenu.prevent></div>

            <div v-if="!ready && !failed" class="stage-msg">
              <Loader2 :size="22" class="spin" /> <span>Yuklanmoqda...</span>
            </div>
            <div v-if="failed" class="stage-msg stage-msg--err">
              <AlertCircle :size="22" /> <span>Video yuklanmadi. Internetni tekshirib, qayta urinib ko'ring.</span>
            </div>

            <!-- Pauza holati -->
            <div v-if="ready && !isPlaying && !ended" class="pause-layer" @click="togglePlay">
              <div class="big-play"><Play :size="30" /></div>
              <p class="pause-title">{{ playing.title }}</p>
              <p class="pause-hint">Davom ettirish uchun bosing</p>
            </div>

            <!-- Tugadi: YouTube ning tavsiya ekranini to'sadi -->
            <div v-if="ended" class="end-layer">
              <CheckCircle2 :size="40" />
              <p class="end-title">Video tugadi</p>
              <p class="end-sub">Ushbu dars to'liq ko'rildi</p>
              <div class="end-actions">
                <button class="end-btn end-btn--ghost" @click="replay"><RotateCcw :size="14" /> Qaytadan</button>
                <button class="end-btn" @click="closePlayer">Yopish</button>
              </div>
            </div>

            <!-- O'z boshqaruv paneli -->
            <div class="controls" @click.stop>
              <button class="ctrl-btn" @click="togglePlay" :title="isPlaying ? 'To\'xtatish' : 'Davom etish'">
                <component :is="isPlaying ? Pause : Play" :size="17" />
              </button>

              <span class="ctrl-time">{{ formatTime(position) }} / {{ duration ? formatTime(duration) : '—:—' }}</span>

              <!-- Progress: faqat ko'rsatkich, bosib o'tkazib bo'lmaydi -->
              <div class="ctrl-bar" @click="noSeekHint" :title="'Videoni o\'tkazib bo\'lmaydi'">
                <div class="ctrl-bar-track">
                  <div class="ctrl-bar-fill" :style="{ width: playedPct + '%' }"></div>
                </div>
                <Lock :size="11" class="bar-lock" />
              </div>

              <button class="ctrl-btn" @click="toggleMute" :title="muted ? 'Ovozni yoqish' : 'Ovozsiz'">
                <component :is="muted || volume === 0 ? VolumeX : Volume2" :size="17" />
              </button>
              <input class="ctrl-vol" type="range" min="0" max="100" v-model.number="volume" />

              <button class="ctrl-btn" @click="toggleFullscreen" title="To'liq ekran">
                <component :is="isFullscreen ? Minimize : Maximize" :size="16" />
              </button>
            </div>

            <Transition name="hint">
              <div v-if="hint" class="hint"><Lock :size="12" /> {{ hint }}</div>
            </Transition>
          </div>

          <!-- Ko'rish holati -->
          <div class="player-progress">
            <div class="pp-bar"><div class="pp-fill" :style="{ width: livePercent + '%' }"></div></div>
            <div class="pp-meta">
              <span class="pp-status" :class="`pp-status--${liveStatus}`">
                <component :is="STATUS_ICON[liveStatus]" :size="12" /> {{ STATUS_TEXT[liveStatus] }}
              </span>
              <span class="pp-pct">{{ livePercent }}%</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import {
  Video, Play, Pause, CheckCircle2, RotateCcw, CircleDashed, PlayCircle,
  Loader2, AlertCircle, Volume2, VolumeX, Maximize, Minimize, Lock,
} from "lucide-vue-next";
import { api, resolveUrl } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useAuthStore } from "@shared/stores/auth";
import { loadYouTubeApi, formatTime } from "@shared/composables/youtube";

const auth = useAuthStore();
const videos = ref([]);
const loading = ref(true);
const playing = ref(null);
const activeGrade = ref(auth.user?.grade ?? 0);

// ── Pleyer holati ──
const stageEl = ref(null);
const playerEl = ref(null);
const ready = ref(false);
const failed = ref(false);
const isPlaying = ref(false);
const ended = ref(false);
const position = ref(0);
const duration = ref(0);
const maxPercent = ref(0);
const volume = ref(100);
const muted = ref(false);
const isFullscreen = ref(false);
const showControls = ref(true);
const hint = ref("");

let player = null;
let tickTimer = null;
let hintTimer = null;
let idleTimer = null;
let lastSentAt = 0;
let lastTickAt = 0;
let unsentWatched = 0;
// O'tkazib yuborishni taqiqlash uchun: ruxsat etilgan oxirgi nuqta
let allowedTime = 0;
let seekGuardUntil = 0;

const TICK_MS = 250;
const MAX_DRIFT = 1.5;      // shundan katta sakrash — o'tkazib yuborish

const STATUS_ICON = { completed: CheckCircle2, half: PlayCircle, started: CircleDashed, opened: CircleDashed };
const STATUS_TEXT = {
  completed: "Oxirigacha ko'rdingiz",
  half: "Yarmidan oshdingiz",
  started: "Ko'rilmoqda",
  opened: "Boshlanmadi",
};

const grades = computed(() => {
  const gs = [...new Set(videos.value.map(v => v.grade))].sort((a, b) => a - b);
  return [0, ...gs];
});
const filtered = computed(() =>
  activeGrade.value === 0 ? videos.value : videos.value.filter(v => v.grade === activeGrade.value)
);
const stats = computed(() => ({
  total: videos.value.length,
  started: videos.value.filter(v => v.myPercent > 0).length,
  completed: videos.value.filter(v => v.myCompleted).length,
}));

const playedPct = computed(() =>
  duration.value ? Math.min(100, (position.value / duration.value) * 100) : 0
);
const livePercent = computed(() => Math.min(100, Math.round(maxPercent.value)));
const liveStatus = computed(() => {
  const p = livePercent.value;
  if (p >= 90) return "completed";
  if (p >= 45) return "half";
  if (p > 0) return "started";
  return "opened";
});

// ── Ochish ──
async function openVideo(v) {
  playing.value = v;
  ready.value = false;
  failed.value = false;
  ended.value = false;
  isPlaying.value = false;
  position.value = 0;
  duration.value = 0;
  maxPercent.value = v.myPercent || 0;
  unsentWatched = 0;
  lastSentAt = 0;

  api(`/api/videos/${v.id}/view`, { method: "POST" }).catch(() => {});

  await nextTick();
  try {
    const YT = await loadYouTubeApi();
    player = new YT.Player(playerEl.value, {
      width: "100%",
      height: "100%",
      videoId: v.mediaId,
      playerVars: {
        autoplay: 1,
        controls: 0,          // manba boshqaruvi umuman ko'rinmaydi
        disablekb: 1,         // klaviatura bilan o'tkazib bo'lmaydi
        modestbranding: 1,
        rel: 0,
        fs: 0,
        iv_load_policy: 3,    // izohlar yo'q
        playsinline: 1,
        cc_load_policy: 0,
        showinfo: 0,
      },
      events: {
        onReady: (e) => {
          ready.value = true;
          duration.value = e.target.getDuration() || 0;
          e.target.setPlaybackRate?.(1);
          e.target.setVolume(volume.value);
          // Subtitrlar va manba modullari o'chiriladi
          try { e.target.unloadModule("captions"); } catch {}
          try { e.target.unloadModule("cc"); } catch {}

          // Qolgan joyidan davom etadi (bu allaqachon ko'rilgan qism)
          const resume = playing.value?.myPositionSec || 0;
          if (resume > 5 && !playing.value?.myCompleted && resume < duration.value - 10) {
            allowedTime = resume;
            seekGuardUntil = Date.now() + 2500;
            e.target.seekTo(resume, true);
          } else {
            allowedTime = 0;
          }
          e.target.playVideo();
          startTicking();
        },
        onStateChange: (e) => {
          const S = window.YT.PlayerState;
          isPlaying.value = e.data === S.PLAYING;
          if (e.data === S.PLAYING) { ended.value = false; wakeControls(); }
          if (e.data === S.ENDED) {
            ended.value = true;
            isPlaying.value = false;
            maxPercent.value = 100;
            sendProgress(true);
          } else if (e.data === S.PAUSED) {
            showControls.value = true;
            sendProgress();
          }
        },
        onPlaybackRateChange: (e) => {
          if (e.target.getPlaybackRate() !== 1) e.target.setPlaybackRate(1);
        },
        onError: () => { failed.value = true; ready.value = true; },
      },
    });
  } catch {
    failed.value = true;
    ready.value = true;
  }
}

/** Har chorak soniyada: progress + o'tkazib yuborishni bloklash. */
function startTicking() {
  clearInterval(tickTimer);
  lastTickAt = Date.now();
  tickTimer = setInterval(() => {
    if (!player?.getCurrentTime) return;
    const now = Date.now();
    const delta = (now - lastTickAt) / 1000;
    lastTickAt = now;

    const t = player.getCurrentTime() || 0;
    duration.value = player.getDuration() || duration.value;

    // ── O'tkazib yuborishni taqiqlash ──
    // Tabiiy o'ynashda vaqt sekin o'sadi. Katta sakrash bo'lsa — qaytaramiz.
    if (now > seekGuardUntil) {
      const jump = t - allowedTime;
      if (jump > MAX_DRIFT) {
        seekGuardUntil = now + 700;
        player.seekTo(allowedTime, true);          // oldinga o'tkazish — bekor
        noSeekHint("Videoni oldinga o'tkazib bo'lmaydi");
        position.value = allowedTime;
        return;
      }
      if (jump < -MAX_DRIFT) {
        seekGuardUntil = now + 700;
        player.seekTo(allowedTime, true);          // orqaga qaytarish — bekor
        noSeekHint("Videoni orqaga qaytarib bo'lmaydi");
        position.value = allowedTime;
        return;
      }
      allowedTime = Math.max(allowedTime, t);
    }

    position.value = t;
    const state = player.getPlayerState?.();
    const playingNow = state === window.YT?.PlayerState?.PLAYING;
    isPlaying.value = playingNow;
    if (playingNow) unsentWatched += Math.min(delta, 1);

    if (duration.value > 0) {
      maxPercent.value = Math.max(maxPercent.value, (position.value / duration.value) * 100);
    }
    if (playingNow && now - lastSentAt >= 5000) sendProgress();
  }, TICK_MS);
}

function sendProgress(finished = false) {
  if (!playing.value) return;
  lastSentAt = Date.now();
  const body = {
    positionSec: Math.round(position.value),
    durationSec: Math.round(duration.value),
    watchedDelta: Math.round(unsentWatched),
    ended: finished,
  };
  unsentWatched = 0;
  api(`/api/videos/${playing.value.id}/progress`, { method: "POST", body: JSON.stringify(body) })
    .catch(() => {});
}

// ── Boshqaruv ──
function togglePlay() {
  if (!player || !ready.value || ended.value) return;
  if (isPlaying.value) player.pauseVideo();
  else player.playVideo();
  wakeControls();
}
function toggleMute() {
  if (!player) return;
  if (muted.value || volume.value === 0) {
    muted.value = false;
    player.unMute();
    if (volume.value === 0) volume.value = 60;
    player.setVolume(volume.value);
  } else {
    muted.value = true;
    player.mute();
  }
}
watch(volume, (val) => {
  if (!player) return;
  player.setVolume(val);
  if (val > 0 && muted.value) { muted.value = false; player.unMute(); }
});

function replay() {
  if (!player) return;
  ended.value = false;
  allowedTime = 0;
  seekGuardUntil = Date.now() + 2000;
  player.seekTo(0, true);
  player.playVideo();
}

function noSeekHint(msg = "Videoni o'tkazib bo'lmaydi") {
  hint.value = typeof msg === "string" ? msg : "Videoni o'tkazib bo'lmaydi";
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { hint.value = ""; }, 2200);
}

function wakeControls() {
  showControls.value = true;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (isPlaying.value) showControls.value = false;
  }, 2800);
}

async function toggleFullscreen() {
  const el = stageEl.value;
  if (!el) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await el.requestFullscreen();
  } catch {}
}
function onFsChange() { isFullscreen.value = Boolean(document.fullscreenElement); }

function closePlayer() {
  sendProgress(livePercent.value >= 95);
  clearInterval(tickTimer);
  clearTimeout(idleTimer);
  clearTimeout(hintTimer);
  tickTimer = null;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  try { player?.destroy?.(); } catch {}
  player = null;
  playing.value = null;
  ended.value = false;
  load();
}

// Klaviatura bilan o'tkazishga urinish (o'q tugmalari) — bloklanadi
function onKeydown(e) {
  if (!playing.value) return;
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End",
                "0","1","2","3","4","5","6","7","8","9"];
  if (keys.includes(e.key)) {
    e.preventDefault();
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) || /^\d$/.test(e.key)) noSeekHint();
    return;
  }
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.key === "Escape" && !document.fullscreenElement) closePlayer();
}

async function load() {
  try { videos.value = await api("/api/videos"); } catch {}
  loading.value = false;
}

function onUnload() { if (playing.value) sendProgress(); }

onMounted(() => {
  load();
  window.addEventListener("beforeunload", onUnload);
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("fullscreenchange", onFsChange);
});
// Admin yangi video qo'shsa yoki o'chirsa — ro'yxat darrov yangilanadi
useLive(["videos"], load);
onUnmounted(() => {
  clearInterval(tickTimer);
  clearTimeout(idleTimer);
  clearTimeout(hintTimer);
  try { player?.destroy?.(); } catch {}
  window.removeEventListener("beforeunload", onUnload);
  window.removeEventListener("keydown", onKeydown);
  document.removeEventListener("fullscreenchange", onFsChange);
});
</script>

<style scoped>
.page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.head-stats { display: flex; gap: 8px; }
.hs { background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 12px; padding: 7px 13px; text-align: center; }
.hs b { display: block; font-size: 16px; font-weight: 800; line-height: 1; }
.hs span { font-size: 10px; color: hsl(var(--muted-fg)); }

.grade-filter { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.grade-chip { padding: 7px 16px; border-radius: 99px; font-size: 13px; font-weight: 500; border: 1.5px solid hsl(var(--border)); background: hsl(var(--card)); color: hsl(var(--muted-fg)); cursor: pointer; font-family: inherit; transition: all .15s; }
.grade-chip:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--primary)); }
.grade-chip--on { background: hsl(var(--primary)); color: white; border-color: hsl(var(--primary)); box-shadow: 0 2px 8px hsl(var(--primary)/.3); font-weight: 600; }

.video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
.video-card { overflow: hidden; cursor: pointer; transition: all .2s; }
.video-card:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(0,0,0,.1); }
.video-thumb { position: relative; aspect-ratio: 16/9; background: hsl(var(--muted)); overflow: hidden; }
.thumb-img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
.video-card:hover .thumb-img { transform: scale(1.04); }
.thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; }
.play-btn { width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,.92); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,.2); }
.grade-tag { position: absolute; top: 8px; right: 8px; font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 99px; background: hsl(var(--primary)); color: white; }
.done-tag { position: absolute; top: 8px; left: 8px; display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 99px; background: hsl(var(--success)); color: #fff; }
.thumb-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(0,0,0,.45); }
.thumb-progress-fill { height: 100%; background: hsl(var(--primary)); transition: width .4s; }

.video-info { padding: 12px 14px; }
.video-title { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.video-meta { display: flex; align-items: center; gap: 8px; margin-top: 5px; flex-wrap: wrap; }
.meta-pct { font-size: 11px; font-weight: 700; color: hsl(var(--primary)); }
.meta-new { font-size: 11px; font-weight: 600; color: hsl(var(--muted-fg)); }
.meta-resume { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; color: hsl(var(--muted-fg)); }

/* ── Pleyer ── */
.player-back { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0,0,0,.9); backdrop-filter: blur(4px); }
.player-box { width: 100%; max-width: 900px; }
.player-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.player-title { font-size: 15.5px; font-weight: 600; color: white; }
.player-sub { font-size: 12px; color: rgba(255,255,255,.55); margin-top: 2px; }
.player-close { background: transparent; border: none; color: rgba(255,255,255,.7); font-size: 20px; cursor: pointer; padding: 4px 10px; }
.player-close:hover { color: white; }

.stage {
  position: relative; aspect-ratio: 16/9; background: #000;
  border-radius: 12px; overflow: hidden; user-select: none;
}
.stage:fullscreen { border-radius: 0; aspect-ratio: auto; width: 100vw; height: 100vh; }
.media { position: absolute; inset: 0; overflow: hidden; }
/* YouTube API ichkaridagi div ni iframe bilan almashtiradi — shuning uchun
   o'lcham tashqi o'ramga emas, aynan iframe ga beriladi. */
.media :deep(iframe) {
  position: absolute; inset: 0;
  width: 100% !important; height: 100% !important;
  border: 0; display: block;
  pointer-events: none;          /* bosishlar manbaga o'tmaydi */
}
.media :deep(div) { width: 100%; height: 100%; }
.shield { position: absolute; inset: 0; z-index: 2; cursor: pointer; }

.stage-msg {
  position: absolute; inset: 0; z-index: 4;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  color: rgba(255,255,255,.8); font-size: 13px; background: #000;
}
.stage-msg--err { color: hsl(var(--warning)); text-align: center; padding: 0 24px; }
.spin { animation: rot 1s linear infinite; }
@keyframes rot { to { transform: rotate(360deg) } }

.pause-layer {
  position: absolute; inset: 0; z-index: 3;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  /* To'liq to'sadi: pauzada manba o'z sarlavhasi va tavsiyalarini chiqaradi */
  background: rgba(6,10,14,.94);
  backdrop-filter: blur(8px);
  cursor: pointer;
}
.pause-title { font-size: 14px; font-weight: 600; color: rgba(255,255,255,.9); text-align: center; padding: 0 24px; }
.pause-hint { font-size: 11.5px; color: rgba(255,255,255,.45); }
.big-play {
  width: 68px; height: 68px; border-radius: 50%;
  background: rgba(255,255,255,.95); color: hsl(var(--primary));
  display: flex; align-items: center; justify-content: center;
  padding-left: 4px; box-shadow: 0 8px 26px rgba(0,0,0,.4);
  transition: transform .18s;
}
.pause-layer:hover .big-play { transform: scale(1.07); }

.end-layer {
  position: absolute; inset: 0; z-index: 5;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  background: rgba(0,0,0,.92); color: #fff; text-align: center; padding: 20px;
}
.end-layer > svg { color: hsl(var(--success)); margin-bottom: 6px; }
.end-title { font-size: 17px; font-weight: 700; }
.end-sub { font-size: 12.5px; color: rgba(255,255,255,.6); }
.end-actions { display: flex; gap: 9px; margin-top: 14px; }
.end-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 8px 18px; border-radius: 99px; border: none; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600;
  background: hsl(var(--primary)); color: #fff;
}
.end-btn--ghost { background: transparent; border: 1px solid rgba(255,255,255,.3); color: #fff; }
.end-btn:hover { opacity: .9; }

/* Boshqaruv paneli */
.controls {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 6;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px 11px;
  background: linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,.35) 60%, transparent);
  transition: opacity .25s, transform .25s;
}
.stage--idle .controls { opacity: 0; transform: translateY(6px); pointer-events: none; }
.ctrl-btn {
  background: transparent; border: none; color: #fff; cursor: pointer;
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s; flex-shrink: 0;
}
.ctrl-btn:hover { background: rgba(255,255,255,.16); }
.ctrl-time { font-size: 11.5px; color: rgba(255,255,255,.85); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.ctrl-bar { flex: 1; min-width: 60px; display: flex; align-items: center; gap: 7px; cursor: not-allowed; }
.ctrl-bar-track { flex: 1; height: 5px; border-radius: 99px; background: rgba(255,255,255,.22); overflow: hidden; }
.ctrl-bar-fill { height: 100%; background: hsl(var(--primary)); border-radius: 99px; transition: width .25s linear; }
.bar-lock { color: rgba(255,255,255,.45); flex-shrink: 0; }
.ctrl-vol { width: 66px; accent-color: hsl(var(--primary)); cursor: pointer; flex-shrink: 0; }
@media (max-width: 560px) { .ctrl-vol { display: none; } }

.hint {
  position: absolute; top: 14px; left: 50%; transform: translateX(-50%); z-index: 7;
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(0,0,0,.82); color: #fff;
  font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 99px;
  border: 1px solid rgba(255,255,255,.15);
}
.hint-enter-active, .hint-leave-active { transition: opacity .25s, transform .25s; }
.hint-enter-from, .hint-leave-to { opacity: 0; transform: translate(-50%, -6px); }

.player-progress { margin-top: 12px; }
.pp-bar { height: 6px; border-radius: 99px; background: rgba(255,255,255,.18); overflow: hidden; }
.pp-fill { height: 100%; background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--chart-5))); border-radius: 99px; transition: width .5s; }
.pp-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 7px; }
.pp-status { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,.75); }
.pp-status--completed { color: hsl(142 60% 60%); }
.pp-status--half { color: hsl(38 90% 62%); }
.pp-pct { font-size: 12.5px; font-weight: 800; color: #fff; }

.empty-card { text-align: center; padding: 56px 24px; }
.empty-title { font-size: 15px; font-weight: 600; color: hsl(var(--muted-fg)); }
</style>
