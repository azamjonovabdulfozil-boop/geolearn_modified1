<template>
  <div class="voice" :class="{ mine }">
    <button class="voice-btn" @click="toggle" :aria-label="playing ? 'To\'xtatish' : 'Tinglash'">
      <Pause v-if="playing" :size="19" /><Play v-else :size="19" />
    </button>
    <div class="voice-main">
      <p v-if="title" class="voice-title">{{ title }}</p>
      <div class="voice-wave" @click="seek">
        <span v-for="(h, i) in BARS" :key="i" class="voice-bar" :class="{ on: i / BARS.length < progress }" :style="{ height: h + '%' }"></span>
      </div>
      <span class="voice-time">{{ label }}</span>
    </div>
    <audio ref="audioEl" :src="src" preload="none" @timeupdate="onTime" @ended="onEnded" @loadedmetadata="onMeta"></audio>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from "vue";
import { Play, Pause } from "lucide-vue-next";

// Ovozli xabar pleyeri. Brauzer yozgan webm faylda davomiylik bo'lmasligi
// mumkin — shuning uchun yozish paytida o'lchangan `duration` ishlatiladi.
const props = defineProps({
  src: { type: String, required: true },
  duration: { type: Number, default: null },
  mine: { type: Boolean, default: false },
  title: { type: String, default: "" },
});

// To'lqin shakli: manzildan olinadigan doimiy "tasodifiy" ustunlar
const BARS = (() => {
  let seed = 0;
  for (const ch of props.src) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: 30 }, () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return 22 + (seed % 78);
  });
})();

const audioEl = ref(null);
const playing = ref(false);
const current = ref(0);
const total = ref(props.duration || 0);

const progress = computed(() => (total.value ? Math.min(1, current.value / total.value) : 0));
const label = computed(() => {
  const s = Math.round(playing.value || current.value ? current.value : total.value);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
});

// Bir vaqtda faqat bitta ovozli xabar eshitiladi
function toggle() {
  const el = audioEl.value;
  if (playing.value) { el.pause(); playing.value = false; return; }
  document.querySelectorAll("audio").forEach(a => { if (a !== el) a.pause(); });
  el.play().then(() => { playing.value = true; }).catch(() => {});
  el.onpause = () => { playing.value = false; };
}
function onMeta() {
  const d = audioEl.value.duration;
  if (Number.isFinite(d) && d > 0) total.value = d;
}
function onTime() {
  current.value = audioEl.value.currentTime;
  if (!props.duration && Number.isFinite(audioEl.value.duration)) total.value = audioEl.value.duration;
}
function onEnded() {
  playing.value = false;
  current.value = 0;
}
function seek(e) {
  if (!total.value) return;
  const r = e.currentTarget.getBoundingClientRect();
  const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total.value;
  try { audioEl.value.currentTime = t; current.value = t; } catch {}
}
onUnmounted(() => audioEl.value?.pause());
</script>

<style scoped>
.voice { display: flex; align-items: center; gap: 10px; min-width: 210px; padding: 2px 0; }
.voice-btn {
  flex: none; width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer;
  background: hsl(var(--primary)); color: #fff; display: flex; align-items: center; justify-content: center;
}
.voice.mine .voice-btn { background: #fff; color: hsl(var(--primary)); }
.voice-main { flex: 1; min-width: 0; }
.voice-title { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.voice-wave { display: flex; align-items: center; gap: 2px; height: 26px; cursor: pointer; }
.voice-bar { flex: 1; min-width: 2px; border-radius: 2px; background: hsl(var(--primary) / .3); transition: background .1s; }
.voice-bar.on { background: hsl(var(--primary)); }
.voice.mine .voice-bar { background: rgba(255, 255, 255, .4); }
.voice.mine .voice-bar.on { background: #fff; }
.voice-time { font-size: 11.5px; opacity: .7; font-variant-numeric: tabular-nums; }
</style>
