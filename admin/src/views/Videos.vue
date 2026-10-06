<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Videolar</h1>
        <p class="geo-page-sub">{{ videos.length }} ta video · {{ totals.viewers }} ta ko'rish · o'rtacha {{ totals.avg }}% ko'rilgan</p>
      </div>
      <div class="head-right">
        <span class="live-chip"><span class="live-dot"></span>Jonli</span>
        <button @click="showCreate = true" class="geo-btn-primary">
          <Plus :size="16" /> Video qo'shish
        </button>
      </div>
    </div>

    <!-- Qo'shish oynasi -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreate" class="modal-back" @click.self="showCreate = false">
          <div class="modal-box geo-card">
            <div class="modal-head">
              <h2>Video qo'shish</h2>
              <button @click="showCreate = false" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </div>
            <div class="form-stack">
              <div class="form-field">
                <label>Sarlavha</label>
                <input v-model="form.title" class="geo-input" placeholder="Video sarlavhasi" />
              </div>
              <div class="form-field">
                <label>YouTube URL</label>
                <input v-model="form.url" class="geo-input" placeholder="https://youtube.com/watch?v=..." />
                <p v-if="form.url && !youtubeId(form.url)" class="field-err">
                  Havoladan video ID topilmadi — to'liq YouTube havolasini kiriting
                </p>
              </div>
              <div class="form-field">
                <label>Sinf</label>
                <div class="grade-grid">
                  <button v-for="g in grades.open" :key="g" type="button"
                    @click="form.grade = g" class="grade-btn" :class="{ 'grade-btn--on': form.grade === g }">{{ g }}</button>
                </div>
              </div>
              <div class="form-field">
                <label>Qaysi sinflar uchun</label>
                <SectionPicker v-model="form.section" />
              </div>
              <div class="modal-actions">
                <button @click="showCreate = false" class="geo-btn-outline flex-1">Bekor</button>
                <button @click="addVideo" :disabled="!form.title || !youtubeId(form.url) || creating" class="geo-btn-primary flex-1">
                  <Loader2 v-if="creating" :size="15" class="animate-spin" />
                  {{ creating ? '...' : "Qo'shish" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Yuklanmoqda -->
    <div v-if="loading" class="video-grid">
      <div v-for="i in 6" :key="i" class="geo-skeleton" style="height:260px;border-radius:1rem"></div>
    </div>

    <!-- Bo'sh -->
    <div v-else-if="!videos.length" class="geo-card empty-card">
      <div class="empty-icon-wrap"><Video :size="28" style="color:hsl(var(--muted-fg));opacity:.5" /></div>
      <p class="empty-title">Hali videolar yo'q</p>
      <p class="empty-sub">Birinchi videoni qo'shing</p>
    </div>

    <!-- Ro'yxat -->
    <div v-else class="video-grid">
      <div v-for="v in videos" :key="v.id" class="video-card geo-card">
        <div class="video-thumb" @click="playVideo(v)" title="Videoni ko'rish">
          <img :src="`https://img.youtube.com/vi/${youtubeId(v.youtubeUrl)}/hqdefault.jpg`"
            class="thumb-img" loading="lazy" />
          <div class="thumb-overlay">
            <div class="play-btn"><Play :size="18" style="color:hsl(var(--primary));margin-left:2px" /></div>
          </div>
          <span class="grade-tag">{{ v.grade }}-sinf<template v-if="v.section && v.section !== 'all'"> · {{ sectionFlag(v.section) }}</template></span>
          <button @click.stop="deleteVideo(v)" class="del-btn" title="O'chirish">
            <Trash2 :size="13" style="color:white" />
          </button>
          <div v-if="v.avgPercent" class="thumb-progress">
            <div class="thumb-progress-fill" :style="{ width: v.avgPercent + '%' }"></div>
          </div>
        </div>

        <div class="video-info">
          <p class="video-title" :title="v.title">{{ v.title }}</p>

          <div class="mini-stats">
            <span class="ms" title="Ko'rgan o'quvchilar"><Users :size="11" />{{ v.viewersCount || 0 }}</span>
            <span class="ms ms-ok" title="Oxirigacha ko'rganlar"><CheckCircle2 :size="11" />{{ v.completedCount || 0 }}</span>
            <span class="ms ms-half" title="Yarmidan oshirganlar"><PlayCircle :size="11" />{{ v.halfCount || 0 }}</span>
            <span class="ms" title="Jami ochilishlar"><Eye :size="11" />{{ v.viewsCount || 0 }}</span>
          </div>

          <WatchBar :percent="v.avgPercent || 0" :label="`O'rtacha ${v.avgPercent || 0}% ko'rilgan`" />

          <div class="video-actions">
            <button class="watch-btn" @click.stop="playVideo(v)"><Play :size="13" /> Ko'rish</button>
            <button class="viewers-btn" @click.stop="openViewers(v)">
              <Eye :size="13" /> Kim ko'rgan
            </button>
          </div>
          <p v-if="v.lastViewedAt" class="video-last">Oxirgi: {{ timeAgo(v.lastViewedAt) }}</p>
        </div>
      </div>
    </div>

    <!-- Pleyer -->
    <Teleport to="body">
      <div v-if="playing" class="player-back" @click.self="playing = null">
        <div class="player-box">
          <div class="player-head">
            <div>
              <p class="player-title">{{ playing.title }}</p>
              <p class="player-sub">
                {{ playing.grade }}-sinf · {{ playing.viewersCount || 0 }} o'quvchi ko'rgan ·
                o'rtacha {{ playing.avgPercent || 0 }}%
              </p>
            </div>
            <button @click="playing = null" class="player-close">✕</button>
          </div>
          <div class="player-frame">
            <iframe :src="`https://www.youtube.com/embed/${youtubeId(playing.youtubeUrl)}?autoplay=1&rel=0`"
              class="frame" allow="autoplay; encrypted-media" allowfullscreen></iframe>
          </div>
          <button class="player-viewers" @click="openViewers(playing); playing = null">
            <Eye :size="14" /> Kim qanchasini ko'rganini ko'rish
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Kim ko'rgan -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="viewersFor" class="modal-back" @click.self="closeViewers">
          <div class="modal-box modal-box--wide geo-card">
            <div class="modal-head">
              <div>
                <h2>Videoni kim ko'rgan</h2>
                <p class="modal-sub">{{ viewersFor.title }}</p>
              </div>
              <button @click="closeViewers" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </div>

            <div v-if="viewersLoading" class="viewers-loading">
              <Loader2 :size="18" class="animate-spin" /> Yuklanmoqda...
            </div>

            <template v-else>
              <div class="viewers-stats">
                <div class="stat"><b>{{ vd.summary?.viewers || 0 }}</b><span>o'quvchi ko'rgan</span></div>
                <div class="stat stat-ok"><b>{{ vd.summary?.completed || 0 }}</b><span>oxirigacha</span></div>
                <div class="stat stat-half"><b>{{ vd.summary?.half || 0 }}</b><span>yarmidan oshgan</span></div>
                <div class="stat"><b>{{ vd.summary?.avgPercent || 0 }}%</b><span>o'rtacha ko'rildi</span></div>
                <div class="stat"><b>{{ vd.summary?.coverage || 0 }}%</b><span>sinf qamrovi</span></div>
              </div>

              <div v-if="vd.students?.length" class="viewers-body">
                <p class="section-label">Ko'rganlar</p>
                <ul class="viewers-list">
                  <li v-for="st in vd.students" :key="st.userId" class="viewer-row">
                    <div class="viewer-avatar" :class="`va-${st.status}`">{{ initial(st.name) }}</div>
                    <div class="viewer-main">
                      <p class="viewer-name">
                        {{ st.name }}
                        <span v-if="st.className || st.grade" class="viewer-grade">{{ st.className || `${st.grade}-sinf` }}</span>
                        <span class="viewer-time">{{ timeAgo(st.lastViewedAt) }}</span>
                      </p>
                      <WatchBar :percent="st.percent" :status="st.status" :label="st.statusLabel" />
                      <p class="viewer-detail">
                        <span v-if="st.durationLabel">{{ st.positionLabel }} / {{ st.durationLabel }}</span>
                        <span v-if="st.views > 1">· {{ st.views }} marta ochgan</span>
                        <span v-if="st.watchedSec > 30">· {{ st.watchedLabel }} tomosha qilgan</span>
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <p v-else class="viewers-empty">Bu videoni hali hech kim ko'rmagan.</p>

              <div v-if="vd.notWatched?.length" class="notwatched">
                <p class="section-label section-label--warn">
                  Ko'rmaganlar ({{ vd.notWatched.length }})
                </p>
                <div class="nw-chips">
                  <span v-for="s in vd.notWatched" :key="s.userId" class="nw-chip">{{ s.name }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Plus, Video, Play, Trash2, Loader2, X, Eye, Users, CheckCircle2, PlayCircle } from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";
import { useGradesStore } from "@shared/stores/grades";
import { useSettingsStore } from "@shared/stores/settings";
import SectionPicker from "@shared/components/SectionPicker.vue";
import { sectionFlag } from "@shared/sections";

const settings = useSettingsStore();
const grades = useGradesStore();
import { youtubeId } from "@shared/composables/youtube";
import WatchBar from "@shared/components/charts/WatchBar.vue";

const videos = ref([]);
const loading = ref(true);
const showCreate = ref(false);
const creating = ref(false);
const form = ref({ title: "", url: "", grade: grades.fallback(7), section: settings.section });
const playing = ref(null);
const viewersFor = ref(null);
const viewersLoading = ref(false);
const viewersData = ref({ summary: null, students: [], notWatched: [] });
const vd = computed(() => viewersData.value ?? {});

const totals = computed(() => {
  const viewers = videos.value.reduce((s, v) => s + (v.viewsCount || 0), 0);
  const withViews = videos.value.filter(v => v.viewersCount > 0);
  const avg = withViews.length
    ? Math.round(withViews.reduce((s, v) => s + (v.avgPercent || 0), 0) / withViews.length)
    : 0;
  return { viewers, avg };
});

function playVideo(v) { playing.value = v; }

async function openViewers(v) {
  viewersFor.value = v;
  viewersLoading.value = true;
  viewersData.value = { summary: null, students: [], notWatched: [] };
  await loadViewers();
  viewersLoading.value = false;
}
async function loadViewers() {
  if (!viewersFor.value) return;
  try { viewersData.value = await api(`/api/videos/${viewersFor.value.id}/views`); } catch {}
}
function closeViewers() { viewersFor.value = null; }

function timeAgo(iso) {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hozir";
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.floor(h / 24)} kun oldin`;
}
function initial(name) { return (name || "?").trim().charAt(0).toUpperCase(); }

async function load() {
  try { videos.value = await api("/api/videos"); } catch {}
  loading.value = false;
}

// Kim ko'rayotgani darrov ko'rinsin
let timer = null;
async function refresh() {
  if (document.hidden) return;
  await load();
  if (viewersFor.value) await loadViewers();
}
onMounted(() => {
  load();
  timer = setInterval(refresh, 8000);
});
onUnmounted(() => clearInterval(timer));
useLive(["videos", "video_views", "users"], refresh);

async function addVideo() {
  creating.value = true;
  try {
    await api("/api/videos", {
      method: "POST",
      body: JSON.stringify({ title: form.value.title, youtubeUrl: form.value.url, grade: form.value.grade, section: form.value.section }),
    });
    showCreate.value = false;
    form.value = { title: "", url: "", grade: grades.fallback(7), section: settings.section };
    await load();
  } catch {}
  creating.value = false;
}

async function deleteVideo(v) {
  if (!confirm(`"${v.title}" o'chirilsinmi? Ko'rish statistikasi ham o'chadi.`)) return;
  try { await api(`/api/videos/${v.id}`, { method: "DELETE" }); await load(); } catch {}
}
</script>

<style scoped>
.page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.head-right { display: flex; align-items: center; gap: 10px; }
.live-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: hsl(var(--success)); background: hsl(var(--success)/.1); border: 1px solid hsl(var(--success)/.22); padding: 6px 11px; border-radius: 99px; }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: blink 1.7s infinite; }
@keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }

/* Oynalar */
.modal-back { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,.45); backdrop-filter: blur(4px); }
.modal-box { width: 100%; max-width: 440px; padding: 24px; max-height: 88vh; overflow-y: auto; }
.modal-box--wide { max-width: 620px; }
.modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 18px; }
.modal-head h2 { font-size: 17px; font-weight: 700; }
.modal-sub { font-size: 12.5px; color: hsl(var(--muted-fg)); margin-top: 2px; }
.form-stack { display: flex; flex-direction: column; gap: 16px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field label { font-size: 13px; font-weight: 600; }
.field-err { font-size: 11px; color: hsl(var(--destructive)); }
.grade-grid { display: grid; grid-template-columns: repeat(6,1fr); gap: 6px; }
.grade-btn { padding: 9px 4px; border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; border: 1.5px solid hsl(var(--border)); background: transparent; color: hsl(var(--muted-fg)); transition: all .15s; font-family: inherit; }
.grade-btn:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--primary)); }
.grade-btn--on { background: hsl(var(--primary)); color: white; border-color: hsl(var(--primary)); }
.modal-actions { display: flex; gap: 10px; padding-top: 4px; }
.flex-1 { flex: 1; }
.p-1 { padding: 4px; }

/* Ro'yxat */
.video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.video-card { overflow: hidden; display: flex; flex-direction: column; }
.video-thumb { position: relative; aspect-ratio: 16/9; background: hsl(var(--muted)); overflow: hidden; cursor: pointer; }
.thumb-img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
.video-card:hover .thumb-img { transform: scale(1.04); }
.thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.18); display: flex; align-items: center; justify-content: center; }
.play-btn { width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.92); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,.2); }
.grade-tag { position: absolute; top: 8px; right: 8px; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; background: hsl(var(--primary)); color: #fff; }
.del-btn { position: absolute; top: 8px; left: 8px; width: 28px; height: 28px; border-radius: 8px; background: rgba(0,0,0,0.55); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .2s; }
.video-card:hover .del-btn { opacity: 1; }
.thumb-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(0,0,0,.45); }
.thumb-progress-fill { height: 100%; background: #ff0033; transition: width .4s; }

.video-info { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 9px; flex: 1; }
.video-title { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mini-stats { display: flex; gap: 6px; flex-wrap: wrap; }
.ms { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; color: hsl(var(--muted-fg)); background: hsl(var(--muted)); padding: 2px 7px; border-radius: 99px; }
.ms-ok { color: hsl(var(--success)); background: hsl(var(--success)/.12); }
.ms-half { color: hsl(var(--warning)); background: hsl(var(--warning)/.12); }
.video-actions { display: flex; gap: 7px; margin-top: auto; }
.watch-btn, .viewers-btn {
  display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px;
  border-radius: 99px; font-family: inherit; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all .15s; flex: 1; justify-content: center;
}
.watch-btn { border: none; background: hsl(var(--primary)); color: #fff; }
.watch-btn:hover { opacity: .88; }
.viewers-btn { border: 1.5px solid hsl(var(--border)); background: transparent; color: hsl(var(--muted-fg)); }
.viewers-btn:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--primary)); }
.video-last { font-size: 10.5px; color: hsl(var(--muted-fg)); }

/* Pleyer */
.player-back { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0,0,0,.86); }
.player-box { width: 100%; max-width: 860px; }
.player-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.player-title { font-size: 15px; font-weight: 600; color: #fff; }
.player-sub { font-size: 12px; color: rgba(255,255,255,.6); margin-top: 2px; }
.player-close { background: transparent; border: none; color: rgba(255,255,255,.7); font-size: 20px; cursor: pointer; padding: 4px 8px; }
.player-close:hover { color: #fff; }
.player-frame { aspect-ratio: 16/9; border-radius: 12px; overflow: hidden; background: #000; }
.frame { width: 100%; height: 100%; border: none; }
.player-viewers { margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 99px; border: 1px solid rgba(255,255,255,.3); background: transparent; color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.player-viewers:hover { background: rgba(255,255,255,.12); }

/* Kim ko'rgan */
.viewers-loading { display: flex; align-items: center; gap: 8px; justify-content: center; padding: 26px; font-size: 13.5px; color: hsl(var(--muted-fg)); }
.viewers-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(88px, 1fr)); gap: 8px; margin-bottom: 16px; }
.viewers-stats .stat { background: hsl(var(--muted)); border-radius: 12px; padding: 9px 11px; display: flex; flex-direction: column; gap: 2px; }
.viewers-stats .stat b { font-size: 17px; font-weight: 800; line-height: 1; }
.viewers-stats .stat span { font-size: 10px; color: hsl(var(--muted-fg)); line-height: 1.3; }
.stat-ok b { color: hsl(var(--success)); }
.stat-half b { color: hsl(var(--warning)); }

.section-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: hsl(var(--muted-fg)); margin-bottom: 8px; }
.section-label--warn { color: hsl(var(--warning)); }
.viewers-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 340px; overflow-y: auto; }
.viewer-row { display: flex; gap: 11px; padding: 10px 11px; border-radius: 13px; background: hsl(var(--muted)/.5); }
.viewer-avatar { width: 34px; height: 34px; border-radius: 50%; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: hsl(var(--muted-fg)); }
.va-completed { background: hsl(var(--success)); }
.va-half { background: hsl(var(--warning)); }
.va-started { background: hsl(var(--chart-5)); }
.viewer-main { flex: 1; min-width: 0; }
.viewer-name { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.viewer-grade { font-size: 10px; font-weight: 700; color: hsl(var(--primary)); background: hsl(var(--primary)/.1); padding: 1px 6px; border-radius: 99px; }
.viewer-time { margin-left: auto; font-size: 10.5px; color: hsl(var(--muted-fg)); font-weight: 500; }
.viewer-detail { font-size: 10.5px; color: hsl(var(--muted-fg)); margin-top: 5px; display: flex; gap: 4px; flex-wrap: wrap; }
.viewers-empty { text-align: center; padding: 22px 8px; font-size: 13.5px; color: hsl(var(--muted-fg)); }

.notwatched { margin-top: 16px; padding-top: 14px; border-top: 1px dashed hsl(var(--border)); }
.nw-chips { display: flex; flex-wrap: wrap; gap: 6px; max-height: 160px; overflow-y: auto; }
.nw-chip { font-size: 11.5px; padding: 4px 10px; border-radius: 99px; background: hsl(var(--warning)/.1); color: hsl(var(--warning)); font-weight: 600; }

/* Bo'sh */
.empty-card { text-align: center; padding: 60px 24px; }
.empty-icon-wrap { width: 60px; height: 60px; border-radius: 16px; background: hsl(var(--muted)); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
.empty-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: hsl(var(--muted-fg)); }
</style>
