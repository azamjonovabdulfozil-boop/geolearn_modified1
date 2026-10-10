<template>
  <div class="arcade">
    <div class="arcade-stage">
      <canvas ref="cv" class="arcade-canvas"></canvas>
      <div v-if="dead" class="arcade-over"><CircleDot :size="40" /><span>To'plar tugadi</span></div>
    </div>
    <p class="arcade-hint">Taxtachani sichqoncha yoki barmoq bilan suring (yoki ← →) va g'ishtlarni sindiring.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { CircleDot } from "lucide-vue-next";
import { play } from "../../../lib/gameKit";
import { useArcade, roundRect, drawLives } from "./useArcade";
import "./arcade.css";

// G'isht sindirish: to'pni taxtacha bilan qaytarib, barcha g'ishtlarni urish.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const W = 480, H = 520, COLS = 8, ROWS = 5, BW = 54, BH = 20, GAP = 5, TOP = 60;
const ROW_COLORS = ["#ef5350", "#ffa726", "#ffee58", "#66bb6a", "#42a5f5"];
const cv = ref(null);
const dead = ref(false);
let paddle, ball, bricks, lives, score, level, usePointer;

function buildBricks() {
  bricks = [];
  const left = (W - (COLS * BW + (COLS - 1) * GAP)) / 2;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    // Urug'ga qarab ba'zi g'ishtlar tushirib qoldiriladi — har o'yinda naqsh boshqacha
    if ((props.seed + r * 7 + c * 13 + level * 3) % 9 === 0) continue;
    bricks.push({ x: left + c * (BW + GAP), y: TOP + r * (BH + GAP), color: ROW_COLORS[r] });
  }
}
function serve() {
  ball = { x: paddle.x, y: H - 60, vx: (props.seed % 2 ? 1 : -1) * 150, vy: -(250 + level * 25), stuck: 0.6 };
}
function reset() {
  paddle = { x: W / 2, w: 92 };
  lives = 3; score = 0; level = 0; usePointer = false;
  dead.value = false;
  buildBricks(); serve();
}

function update(dt) {
  if (keys.has("ArrowLeft") || keys.has("a")) { paddle.x -= 420 * dt; usePointer = false; }
  if (keys.has("ArrowRight") || keys.has("d")) { paddle.x += 420 * dt; usePointer = false; }
  if (usePointer) paddle.x = pointer.x;
  paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x));

  if (ball.stuck > 0) { ball.stuck -= dt; ball.x = paddle.x; return; }
  // Katta tezlikda g'isht ichidan o'tib ketmasligi uchun kichik qadamlar
  const steps = 3;
  for (let i = 0; i < steps; i++) {
    ball.x += (ball.vx * dt) / steps; ball.y += (ball.vy * dt) / steps;
    if (ball.x < 8) { ball.x = 8; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - 8) { ball.x = W - 8; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < 8) { ball.y = 8; ball.vy = Math.abs(ball.vy); }
    if (ball.vy > 0 && ball.y > H - 44 && ball.y < H - 28 && Math.abs(ball.x - paddle.x) < paddle.w / 2 + 6) {
      // Taxtachaning qayeriga tegsa — shunga qarab burchak o'zgaradi
      const speed = Math.hypot(ball.vx, ball.vy) * 1.01;
      const a = ((ball.x - paddle.x) / (paddle.w / 2)) * 1.05;
      ball.vx = Math.sin(a) * speed; ball.vy = -Math.cos(a) * speed;
      ball.y = H - 44;
      play("click");
    }
    const b = bricks.find(b => ball.x > b.x - 7 && ball.x < b.x + BW + 7 && ball.y > b.y - 7 && ball.y < b.y + BH + 7);
    if (b) {
      bricks.splice(bricks.indexOf(b), 1);
      const fromSide = ball.x < b.x || ball.x > b.x + BW;
      if (fromSide) ball.vx = -ball.vx; else ball.vy = -ball.vy;
      score += 10; emit("score", score); play("eat");
      break;
    }
  }
  if (!bricks.length) { level++; score += 50; emit("score", score); buildBricks(); serve(); play("good"); }
  if (ball.y > H + 20) {
    lives--; play("bad");
    if (lives <= 0) { dead.value = true; emit("over"); } else serve();
  }
}

function draw(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0d1b3d"); g.addColorStop(1, "#1b2a5a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const b of bricks) {
    ctx.fillStyle = b.color; roundRect(ctx, b.x, b.y, BW, BH, 5); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(b.x + 3, b.y + 2, BW - 6, 4);
  }
  ctx.fillStyle = "#eceff1"; roundRect(ctx, paddle.x - paddle.w / 2, H - 38, paddle.w, 12, 6); ctx.fill();
  ctx.fillStyle = "#26c6da"; roundRect(ctx, paddle.x - paddle.w / 2 + 4, H - 35, paddle.w - 8, 4, 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.shadowColor = "#80deea"; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  drawLives(ctx, lives);
}

const { pointer, keys } = useArcade(cv, { width: W, height: H, active: () => props.active && !dead.value, update, draw, onTap: () => { usePointer = true; } });
watch(() => pointer.x, () => { if (pointer.moved) usePointer = true; });
watch(() => props.seed, reset, { immediate: true });
</script>
