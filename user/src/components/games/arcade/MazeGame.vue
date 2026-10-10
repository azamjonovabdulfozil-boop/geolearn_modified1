<template>
  <div class="arcade">
    <div class="arcade-stage" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
      <canvas ref="cv" class="arcade-canvas"></canvas>
    </div>
    <div class="arcade-pad">
      <button class="up" @pointerdown.prevent="step(0, -1)" aria-label="Yuqoriga"><ChevronUp :size="24" /></button>
      <button class="left" @pointerdown.prevent="step(-1, 0)" aria-label="Chapga"><ChevronLeft :size="24" /></button>
      <button class="down" @pointerdown.prevent="step(0, 1)" aria-label="Pastga"><ChevronDown :size="24" /></button>
      <button class="right" @pointerdown.prevent="step(1, 0)" aria-label="O'ngga"><ChevronRight :size="24" /></button>
    </div>
    <p class="arcade-hint">Strelkalar yoki barmoq bilan suring. Bayroqchaga yeting — labirint kattalashadi.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-vue-next";
import { makeRng, play } from "../../../lib/gameKit";
import { useArcade } from "./useArcade";
import "./arcade.css";

// Labirint: chiqish joyidagi bayroqchaga yetish. Har yechilgan labirint — 50 ochko va keyingisi kattaroq.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const S = 480;
const cv = ref(null);
let rng, n, walls, me, draw_me, score, level;

/** Chuqurlik bo'yicha qidiruv bilan labirint: walls[y][x] = { r, d } (o'ng va past devor). */
function build() {
  n = Math.min(13, 7 + level);
  walls = Array.from({ length: n }, () => Array.from({ length: n }, () => ({ r: true, d: true, seen: false })));
  const stack = [[0, 0]];
  walls[0][0].seen = true;
  while (stack.length) {
    const [x, y] = stack.at(-1);
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => walls[y + dy]?.[x + dx] && !walls[y + dy][x + dx].seen);
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy] = opts[Math.floor(rng() * opts.length)];
    if (dx === 1) walls[y][x].r = false;
    if (dx === -1) walls[y][x - 1].r = false;
    if (dy === 1) walls[y][x].d = false;
    if (dy === -1) walls[y - 1][x].d = false;
    walls[y + dy][x + dx].seen = true;
    stack.push([x + dx, y + dy]);
  }
  me = { x: 0, y: 0 };
  draw_me = { x: 0, y: 0 };
}
function reset() {
  rng = makeRng(props.seed);
  score = 0; level = 0;
  build();
}
function open(x, y, dx, dy) {
  if (dx === 1) return x < n - 1 && !walls[y][x].r;
  if (dx === -1) return x > 0 && !walls[y][x - 1].r;
  if (dy === 1) return y < n - 1 && !walls[y][x].d;
  return y > 0 && !walls[y - 1][x].d;
}
function step(dx, dy) {
  if (!props.active || !open(me.x, me.y, dx, dy)) return;
  me.x += dx; me.y += dy;
  play("click");
  if (me.x === n - 1 && me.y === n - 1) {
    score += 50; level++; emit("score", score); play("good");
    build();
  }
}

function draw(ctx, dt) {
  const c = S / n;
  ctx.fillStyle = "#102a43"; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#1c4466"; ctx.fillRect(2, 2, S - 4, S - 4);
  // Bayroqcha (chiqish)
  const fx = (n - 0.5) * c, fy = (n - 0.5) * c;
  ctx.strokeStyle = "#eceff1"; ctx.lineWidth = Math.max(2, c * 0.07);
  ctx.beginPath(); ctx.moveTo(fx - c * 0.2, fy + c * 0.3); ctx.lineTo(fx - c * 0.2, fy - c * 0.32); ctx.stroke();
  ctx.fillStyle = "#ff5252"; ctx.beginPath(); ctx.moveTo(fx - c * 0.2, fy - c * 0.32); ctx.lineTo(fx + c * 0.3, fy - c * 0.16); ctx.lineTo(fx - c * 0.2, fy); ctx.fill();

  ctx.strokeStyle = "#9fd3ff"; ctx.lineWidth = Math.max(2.5, c * 0.09); ctx.lineCap = "round";
  ctx.beginPath();
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (walls[y][x].r && x < n - 1) { ctx.moveTo((x + 1) * c, y * c); ctx.lineTo((x + 1) * c, (y + 1) * c); }
    if (walls[y][x].d && y < n - 1) { ctx.moveTo(x * c, (y + 1) * c); ctx.lineTo((x + 1) * c, (y + 1) * c); }
  }
  ctx.stroke();
  ctx.strokeRect(1.5, 1.5, S - 3, S - 3);

  draw_me.x += (me.x - draw_me.x) * Math.min(1, dt * 22);
  draw_me.y += (me.y - draw_me.y) * Math.min(1, dt * 22);
  const px = (draw_me.x + 0.5) * c, py = (draw_me.y + 0.5) * c;
  const g = ctx.createRadialGradient(px - c * 0.1, py - c * 0.12, 1, px, py, c * 0.32);
  g.addColorStop(0, "#fff59d"); g.addColorStop(1, "#ffb300");
  ctx.fillStyle = g; ctx.shadowColor = "#ffca28"; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(px, py, c * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
useArcade(cv, {
  width: S, height: S, active: () => props.active, draw,
  onKey: (k, down) => { if (down && DIRS[k]) step(...DIRS[k]); },
});
let touch = null;
function onTouchStart(e) { touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
function onTouchEnd(e) {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) step(Math.sign(dx), 0); else step(0, Math.sign(dy));
}

watch(() => props.seed, reset, { immediate: true });
</script>

<style scoped>
@media (hover: hover) and (pointer: fine) { .arcade-pad { display: none; } }
</style>
