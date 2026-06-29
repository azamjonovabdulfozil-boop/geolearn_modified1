<template>
  <div class="fade-in">
    <div class="page-header">
      <h1 class="geo-page-title">Videolar</h1>
      <p class="geo-page-sub">Sinf bo'yicha geografiya videolari</p>
    </div>

    <!-- Grade filter -->
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
          <img :src="`https://img.youtube.com/vi/${getYoutubeId(v.youtubeUrl)}/hqdefault.jpg`"
            class="thumb-img" loading="lazy" />
          <div class="thumb-overlay">
            <div class="play-btn"><Play :size="18" style="color:hsl(var(--primary));margin-left:2px" /></div>
          </div>
          <span class="grade-tag">{{ v.grade }}-sinf</span>
        </div>
        <div class="video-info">
          <p class="video-title">{{ v.title }}</p>
        </div>
      </div>
    </div>

    <!-- Player modal -->
    <Teleport to="body">
      <div v-if="playing" class="player-back" @click.self="playing = null">
        <div class="player-box">
          <div class="player-head">
            <p class="player-title">{{ playing.title }}</p>
            <button @click="playing = null" class="player-close">✕</button>
          </div>
          <div class="player-frame">
            <iframe :src="`https://www.youtube.com/embed/${getYoutubeId(playing.youtubeUrl)}?autoplay=1`"
              class="frame" allow="autoplay; encrypted-media" allowfullscreen></iframe>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { Video, Play } from "lucide-vue-next";
import { api } from "@/composables/api";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const videos = ref([]);
const loading = ref(true);
const playing = ref(null);
const activeGrade = ref(auth.user?.grade ?? 0);

const grades = computed(() => {
  const gs = [...new Set(videos.value.map(v => v.grade))].sort((a, b) => a - b);
  return [0, ...gs];
});
const filtered = computed(() =>
  activeGrade.value === 0 ? videos.value : videos.value.filter(v => v.grade === activeGrade.value)
);

function getYoutubeId(url) {
  return url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] ?? "";
}
function openVideo(v) { playing.value = v; }

onMounted(async () => {
  try { videos.value = await api("/api/videos"); } catch {}
  loading.value = false;
});
</script>

<style scoped>
.page-header { margin-bottom: 18px; }

.grade-filter { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
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
.video-info { padding: 12px 14px; }
.video-title { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Player */
.player-back { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0,0,0,.85); }
.player-box { width: 100%; max-width: 800px; }
.player-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.player-title { font-size: 15px; font-weight: 600; color: white; }
.player-close { background: transparent; border: none; color: rgba(255,255,255,.7); font-size: 20px; cursor: pointer; padding: 4px 8px; }
.player-close:hover { color: white; }
.player-frame { aspect-ratio: 16/9; border-radius: 12px; overflow: hidden; }
.frame { width: 100%; height: 100%; border: none; }

.empty-card { text-align: center; padding: 56px 24px; }
.empty-title { font-size: 15px; font-weight: 600; color: hsl(var(--muted-fg)); }
</style>
