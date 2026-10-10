<template>
  <div class="snake">
    <div class="snake-stage" ref="stageEl"
      @touchstart.passive="onTouchStart" @touchmove.prevent="onTouchMove">
      <canvas ref="canvasEl" class="snake-canvas"></canvas>
      <div v-if="dead" class="snake-dead">
        <span class="snake-dead-emoji">💥</span>
        <span>Ilon urildi!</span>
      </div>
    </div>

    <div class="snake-pad">
      <button class="pad-btn pad-up" @pointerdown.prevent="turn(0, -1)" aria-label="Yuqoriga"><ChevronUp :size="24" /></button>
      <button class="pad-btn pad-left" @pointerdown.prevent="turn(-1, 0)" aria-label="Chapga"><ChevronLeft :size="24" /></button>
      <button class="pad-btn pad-down" @pointerdown.prevent="turn(0, 1)" aria-label="Pastga"><ChevronDown :size="24" /></button>
      <button class="pad-btn pad-right" @pointerdown.prevent="turn(1, 0)" aria-label="O'ngga"><ChevronRight :size="24" /></button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-vue-next";
import { makeRng, play } from "../../lib/gameKit";

// Ilon o'yini. Olmalar ketma-ketligi `seed` dan olinadi — 1v1 da ikkala
// o'yinchida bir xil. `active` yoqilganda boshlanadi, o'chganda to'xtaydi.
const props = defineProps({
  seed: { type: Number, default: 1 },
  active: { type: Boolean, default: false },
});
const emit = defineEmits(["score", "over"]);

const COLS = 18, ROWS = 18, CELL = 30;
const W = COLS * CELL, H = ROWS * CELL;
const START_MS = 170, MIN_MS = 85, POINTS = 10;

const canvasEl = ref(null);
const stageEl = ref(null);
const dead = ref(false);

let ctx = null;
let rng = makeRng(props.seed);
let snake = [];
let dir = { x: 1, y: 0 };
let queue = [];              // navbatdagi burilishlar (tez bosilganda yo'qolmasin)
let apple = null;
let eaten = 0;
let stepMs = START_MS;
let acc = 0, last = 0, raf = 0;
let prev = [];               // silliq harakat uchun oldingi holat

function reset() {
  rng = makeRng(props.seed);
  const y = Math.floor(ROWS / 2);
  snake = [{ x: 5, y }, { x: 4, y }, { x: 3, y }];
  prev = snake.map(s => ({ ...s }));
  dir = { x: 1, y: 0 };
  queue = [];
  eaten = 0;
  stepMs = START_MS;
  acc = 0;
  dead.value = false;
  placeApple();
}

function placeApple() {
  // Urug'dan olingan katak band bo'lsa — keyingisiga o'tamiz
  for (let i = 0; i < 400; i++) {
    const c = { x: Math.floor(rng() * COLS), y: Math.floor(rng() * ROWS) };
    if (!snake.some(s => s.x === c.x && s.y === c.y)) { apple = c; return; }
  }
  apple = null;
}

function turn(x, y) {
  const from = queue.at(-1) ?? dir;
  if (from.x === -x && from.y === -y) return;     // orqaga burilib bo'lmaydi
  if (from.x === x && from.y === y) return;
  if (queue.length < 3) queue.push({ x, y });
}

function step() {
  if (queue.length) dir = queue.shift();
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  const hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
  const willGrow = apple && head.x === apple.x && head.y === apple.y;
  // Dum shu qadamda siljiydi — o'sha katakka kirish mumkin
  const body = willGrow ? snake : snake.slice(0, -1);
  if (hitWall || body.some(s => s.x === head.x && s.y === head.y)) {
    dead.value = true;
    play("boom");
    emit("over");
    return;
  }
  prev = snake.map(s => ({ ...s }));
  snake.unshift(head);
  if (willGrow) {
    prev.push({ ...prev.at(-1) });
    eaten++;
    stepMs = Math.max(MIN_MS, START_MS - eaten * 4);
    play("eat");
    emit("score", eaten * POINTS);
    placeApple();
  } else {
    snake.pop();
  }
}

// ── Chizish ──
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(t) {
  // Maydon: shaxmat nusxa o'tloq
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#a7d948" : "#b3e054";
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  if (apple) {
    const cx = apple.x * CELL + CELL / 2, cy = apple.y * CELL + CELL / 2;
    const pulse = 1 + Math.sin(performance.now() / 180) * 0.06;
    ctx.fillStyle = "rgba(0,0,0,.16)";
    ctx.beginPath(); ctx.ellipse(cx, cy + 10, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, 13);
    g.addColorStop(0, "#ff8a80"); g.addColorStop(1, "#d32f2f");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy + 1, 10.5 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 2, cy - 14); ctx.stroke();
    ctx.fillStyle = "#43a047";
    ctx.beginPath(); ctx.ellipse(cx + 6, cy - 12, 5, 2.6, -0.5, 0, Math.PI * 2); ctx.fill();
  }

  // Ilon: kataklar orasida silliq siljiydi
  const k = dead.value ? 1 : Math.min(1, t);
  for (let i = snake.length - 1; i >= 0; i--) {
    const a = prev[i] ?? snake[i], b = snake[i];
    const x = (a.x + (b.x - a.x) * k) * CELL, y = (a.y + (b.y - a.y) * k) * CELL;
    const head = i === 0;
    const pad = head ? 1.5 : 3;
    const shade = 46 - Math.min(16, (i / Math.max(1, snake.length)) * 16);
    ctx.fillStyle = dead.value ? "#8d8d8d" : `hsl(214 78% ${shade}%)`;
    roundRect(x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, head ? 11 : 9);
    ctx.fill();
    if (!head) continue;

    // Ko'zlar harakat yo'nalishiga qaraydi
    const cx = x + CELL / 2, cy = y + CELL / 2;
    const px = -dir.y, py = dir.x;
    for (const s of [-1, 1]) {
      const ex = cx + dir.x * 4 + px * 6 * s, ey = cy + dir.y * 4 + py * 6 * s;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(ex, ey, 4.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#12233f";
      ctx.beginPath(); ctx.arc(ex + dir.x * 1.6, ey + dir.y * 1.6, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function frame(ts) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(100, ts - (last || ts));
  last = ts;
  if (props.active && !dead.value) {
    acc += dt;
    while (acc >= stepMs && !dead.value) { acc -= stepMs; step(); }
  }
  draw(acc / stepMs);
}

// ── Boshqaruv ──
const KEYS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
};
function onKey(e) {
  const k = KEYS[e.key];
  if (!k) return;
  e.preventDefault();
  turn(k[0], k[1]);
}
let touch = null;
function onTouchStart(e) {
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}
function onTouchMove(e) {
  if (!touch) return;
  const dx = e.touches[0].clientX - touch.x, dy = e.touches[0].clientY - touch.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
  if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0); else turn(0, Math.sign(dy));
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}

watch(() => props.seed, reset);

onMounted(() => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = canvasEl.value;
  c.width = W * dpr; c.height = H * dpr;
  ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  reset();
  window.addEventListener("keydown", onKey);
  raf = requestAnimationFrame(frame);
});
onUnmounted(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener("keydown", onKey);
});
</script>

<style scoped>
.snake { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.snake-stage {
  position: relative; width: 100%; max-width: 520px; aspect-ratio: 1; touch-action: none;
  border-radius: 18px; overflow: hidden; border: 6px solid #5a8f29;
  box-shadow: 0 14px 34px rgba(0, 0, 0, .28), inset 0 0 0 2px rgba(255, 255, 255, .25);
}
.snake-canvas { display: block; width: 100%; height: 100%; }
.snake-dead {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  background: rgba(20, 30, 10, .55); color: #fff; font-size: 20px; font-weight: 800;
}
.snake-dead-emoji { font-size: 46px; }

.snake-pad { display: grid; grid-template-columns: repeat(3, 58px); grid-template-rows: repeat(2, 54px); gap: 6px; }
.pad-btn {
  display: flex; align-items: center; justify-content: center; border: none; border-radius: 16px; cursor: pointer;
  background: hsl(var(--card)); color: hsl(var(--fg)); border: 1px solid hsl(var(--border));
  box-shadow: 0 4px 0 hsl(var(--border)); touch-action: none; user-select: none;
}
.pad-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 hsl(var(--border)); }
.pad-up { grid-column: 2; grid-row: 1; }
.pad-left { grid-column: 1; grid-row: 2; }
.pad-down { grid-column: 2; grid-row: 2; }
.pad-right { grid-column: 3; grid-row: 2; }
@media (hover: hover) and (pointer: fine) { .snake-pad { display: none; } }
</style>
