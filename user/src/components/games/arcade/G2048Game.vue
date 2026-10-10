<template>
  <div class="arcade">
    <div class="arcade-panel board" :class="{ locked: !active }"
      @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
      <div v-for="(v, i) in cells" :key="i" class="tile" :class="v ? `v${Math.min(v, 2048)}` : 'empty'">{{ v || "" }}</div>
      <div v-if="stuck" class="arcade-over"><Grid2x2 :size="38" /><span>Yurish qolmadi</span></div>
    </div>
    <div class="arcade-pad">
      <button class="up" @pointerdown.prevent="move(0, -1)" aria-label="Yuqoriga"><ChevronUp :size="24" /></button>
      <button class="left" @pointerdown.prevent="move(-1, 0)" aria-label="Chapga"><ChevronLeft :size="24" /></button>
      <button class="down" @pointerdown.prevent="move(0, 1)" aria-label="Pastga"><ChevronDown :size="24" /></button>
      <button class="right" @pointerdown.prevent="move(1, 0)" aria-label="O'ngga"><ChevronRight :size="24" /></button>
    </div>
    <p class="arcade-hint">Strelkalar yoki barmoq bilan suring. Bir xil raqamlar qo'shiladi.</p>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Grid2x2 } from "lucide-vue-next";
import { makeRng, play } from "../../../lib/gameKit";
import "./arcade.css";

// 2048: bir xil raqamli kataklarni qo'shib, katta raqam yig'ish. Ochko — qo'shilgan raqamlar yig'indisi.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const N = 4;
const cells = ref(Array(N * N).fill(0));
const stuck = ref(false);
let rng, score;

function spawn() {
  const free = cells.value.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  if (free.length) cells.value[free[Math.floor(rng() * free.length)]] = rng() < 0.9 ? 2 : 4;
}
function reset() {
  rng = makeRng(props.seed);
  cells.value = Array(N * N).fill(0);
  score = 0; stuck.value = false;
  spawn(); spawn();
}

/** Bitta qatorni chapga suradi va qo'shadi. */
function slide(line) {
  const nums = line.filter(Boolean);
  const out = [];
  let gained = 0;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] === nums[i + 1]) { out.push(nums[i] * 2); gained += nums[i] * 2; i++; }
    else out.push(nums[i]);
  }
  while (out.length < N) out.push(0);
  return { out, gained };
}
function canMove() {
  const c = cells.value;
  if (c.includes(0)) return true;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = c[y * N + x];
    if ((x + 1 < N && c[y * N + x + 1] === v) || (y + 1 < N && c[(y + 1) * N + x] === v)) return true;
  }
  return false;
}
function move(dx, dy) {
  if (!props.active || stuck.value) return;
  const before = cells.value.join(",");
  const next = Array(N * N).fill(0);
  let gained = 0;
  for (let a = 0; a < N; a++) {
    // Har bir qator/ustunni surish yo'nalishi bo'yicha o'qiymiz
    const idx = Array.from({ length: N }, (_, b) => {
      const k = dx + dy > 0 ? N - 1 - b : b;
      return dx ? a * N + k : k * N + a;
    });
    const r = slide(idx.map(i => cells.value[i]));
    gained += r.gained;
    idx.forEach((i, b) => { next[i] = r.out[b]; });
  }
  if (next.join(",") === before) return;
  cells.value = next;
  spawn();
  if (gained) { score += gained; emit("score", score); play("eat"); } else play("click");
  if (!canMove()) { stuck.value = true; emit("over"); }
}

const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
function onKey(e) {
  const k = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (!k || !props.active || /^(input|textarea)$/i.test(e.target?.tagName ?? "")) return;
  e.preventDefault();
  move(k[0], k[1]);
}
let touch = null;
function onTouchStart(e) { touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
function onTouchEnd(e) {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0); else move(0, Math.sign(dy));
}

watch(() => props.seed, reset, { immediate: true });
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<style scoped>
.board { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #bbada0; border: none; touch-action: none; overflow: hidden; }
.board.locked { opacity: 1; }
.tile {
  aspect-ratio: 1; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  font-size: clamp(20px, 6.4vw, 34px); font-weight: 900; color: #776e65; background: #cdc1b4; transition: background .1s;
}
.v2 { background: #eee4da; } .v4 { background: #ede0c8; }
.v8 { background: #f2b179; color: #fff; } .v16 { background: #f59563; color: #fff; }
.v32 { background: #f67c5f; color: #fff; } .v64 { background: #f65e3b; color: #fff; }
.v128 { background: #edcf72; color: #fff; font-size: clamp(18px, 5.6vw, 30px); }
.v256 { background: #edcc61; color: #fff; font-size: clamp(18px, 5.6vw, 30px); }
.v512 { background: #edc850; color: #fff; font-size: clamp(18px, 5.6vw, 30px); }
.v1024, .v2048 { background: #edc22e; color: #fff; font-size: clamp(15px, 4.6vw, 24px); }
@media (hover: hover) and (pointer: fine) { .arcade-pad { display: none; } }
</style>
