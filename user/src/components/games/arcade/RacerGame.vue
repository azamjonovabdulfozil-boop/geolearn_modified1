<template>
  <div class="arcade">
    <div class="arcade-stage">
      <canvas ref="cv" class="arcade-canvas"></canvas>
      <div v-if="dead" class="arcade-over"><Car :size="40" /><span>Mashina urildi</span></div>
    </div>
    <p class="arcade-hint">Ekranning chap yoki o'ng tomonini bosing (yoki ← →) — mashina yo'lak almashtiradi.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { Car } from "lucide-vue-next";
import { makeRng, play } from "../../../lib/gameKit";
import { useArcade, roundRect, drawLives } from "./useArcade";
import "./arcade.css";

// Poyga: uch yo'lakli yo'lda boshqa mashinalarni quvib o'tish.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const W = 420, H = 560, ROAD_X = 60, LANE = 100;
const CAR_COLORS = ["#1e88e5", "#8e24aa", "#fb8c00", "#00897b", "#6d4c41"];
const cv = ref(null);
const dead = ref(false);
let rng, car, traffic, lives, score, dist, time, spawnT;

const laneX = l => ROAD_X + l * LANE + LANE / 2;
function reset() {
  rng = makeRng(props.seed);
  car = { lane: 1, x: laneX(1), inv: 0 };
  traffic = []; lives = 3; score = 0; dist = 0; time = 0; spawnT = 0.8;
  dead.value = false;
}
function steer(dir) {
  car.lane = Math.max(0, Math.min(2, car.lane + dir));
  play("click");
}

function update(dt) {
  time += dt;
  const speed = 260 + time * 7;
  dist += speed * dt;
  car.x += (laneX(car.lane) - car.x) * Math.min(1, dt * 14);
  if (car.inv > 0) car.inv -= dt;

  spawnT -= dt;
  if (spawnT <= 0) {
    // Bir vaqtda uchala yo'lak ham yopilib qolmasligi kerak
    const busy = new Set(traffic.filter(t => t.y < 160).map(t => t.lane));
    const free = [0, 1, 2].filter(l => !busy.has(l));
    if (free.length > 1) traffic.push({ lane: free[Math.floor(rng() * free.length)], y: -90, color: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], passed: false });
    spawnT = Math.max(0.42, 1.0 - time * 0.011);
  }
  for (const t of traffic) {
    t.y += speed * 0.62 * dt;
    if (!t.passed && t.y > H - 70) { t.passed = true; score += 10; emit("score", score); }
    if (car.inv <= 0 && t.lane === car.lane && t.y + 78 > H - 138 && t.y < H - 56 && Math.abs(laneX(t.lane) - car.x) < 50) {
      lives--; car.inv = 1.6; t.y = H + 200; play("boom");
      if (lives <= 0) { dead.value = true; emit("over"); }
    }
  }
  traffic = traffic.filter(t => t.y < H + 100);
}

function drawCar(ctx, x, y, color, mine) {
  ctx.fillStyle = "rgba(0,0,0,.28)"; roundRect(ctx, x - 25, y + 4, 54, 80, 12); ctx.fill();
  ctx.fillStyle = "#1c1c1c";
  for (const [dx, dy] of [[-29, 10], [23, 10], [-29, 52], [23, 52]]) { roundRect(ctx, x + dx, y + dy, 7, 18, 3); ctx.fill(); }
  ctx.fillStyle = color; roundRect(ctx, x - 25, y, 50, 78, 12); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.2)"; roundRect(ctx, x - 21, y + 4, 8, 70, 4); ctx.fill();
  ctx.fillStyle = "#263238"; roundRect(ctx, x - 18, y + (mine ? 18 : 44), 36, 16, 5); ctx.fill();
  ctx.fillStyle = "#37474f"; roundRect(ctx, x - 18, y + (mine ? 46 : 16), 36, 12, 5); ctx.fill();
  ctx.fillStyle = mine ? "#fff59d" : "#ef5350";
  ctx.fillRect(x - 21, y + (mine ? 1 : 73), 9, 4); ctx.fillRect(x + 12, y + (mine ? 1 : 73), 9, 4);
}

function draw(ctx) {
  ctx.fillStyle = "#4caf50"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#43a047";
  for (let i = 0; i < 9; i++) { const y = ((i * 80 + dist) % (H + 80)) - 40; ctx.fillRect(8, y, 36, 26); ctx.fillRect(W - 44, y + 34, 36, 26); }
  ctx.fillStyle = "#455a64"; ctx.fillRect(ROAD_X, 0, LANE * 3, H);
  ctx.fillStyle = "#eceff1"; ctx.fillRect(ROAD_X - 5, 0, 5, H); ctx.fillRect(ROAD_X + LANE * 3, 0, 5, H);
  ctx.fillStyle = "rgba(255,255,255,.75)";
  for (const lx of [ROAD_X + LANE, ROAD_X + LANE * 2]) for (let i = -1; i < 9; i++) ctx.fillRect(lx - 3, ((i * 80 + dist) % (H + 80)) - 40, 6, 42);

  for (const t of traffic) drawCar(ctx, laneX(t.lane), t.y, t.color, false);
  if (lives > 0 && (car.inv <= 0 || Math.floor(car.inv * 12) % 2 === 0)) drawCar(ctx, car.x, H - 134, "#e53935", true);
  drawLives(ctx, lives);
}

useArcade(cv, {
  width: W, height: H, active: () => props.active && !dead.value, update, draw,
  onTap: ({ x }) => steer(x < car.x ? -1 : 1),
  onKey: (k, down) => { if (!down) return; if (k === "ArrowLeft" || k === "a") steer(-1); if (k === "ArrowRight" || k === "d") steer(1); },
});
watch(() => props.seed, reset, { immediate: true });
</script>
