<template>
  <div class="arcade">
    <div class="arcade-stage">
      <canvas ref="cv" class="arcade-canvas"></canvas>
      <div v-if="dead" class="arcade-over"><Footprints :size="40" /><span>Yugurish tugadi</span></div>
    </div>
    <p class="arcade-hint">Bosing yoki Probel — sakrash. Havoda yana bir marta bossangiz — ikkinchi sakrash.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { Footprints } from "lucide-vue-next";
import { makeRng, play } from "../../../lib/gameKit";
import { useArcade, roundRect, drawLives } from "./useArcade";
import "./arcade.css";

// To'siqlardan sakrash: sayohatchi cho'lda yuguradi, tosh va kaktuslardan sakrab o'tadi.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const W = 560, H = 320, GROUND = 258;
const cv = ref(null);
const dead = ref(false);
let rng, hero, obstacles, lives, score, dist, time, nextGap;

function reset() {
  rng = makeRng(props.seed);
  hero = { x: 90, y: GROUND, vy: 0, jumps: 0, inv: 0 };
  obstacles = []; lives = 3; score = 0; dist = 0; time = 0; nextGap = 260;
  dead.value = false;
}
function jump() {
  if (hero.jumps >= 2) return;
  hero.vy = hero.jumps === 0 ? -470 : -400;
  hero.jumps++;
  play("flip");
}

function update(dt) {
  time += dt;
  const speed = 230 + time * 6;
  dist += speed * dt;
  hero.vy += 1350 * dt;
  hero.y = Math.min(GROUND, hero.y + hero.vy * dt);
  if (hero.y >= GROUND) { hero.vy = 0; hero.jumps = 0; }
  if (hero.inv > 0) hero.inv -= dt;

  const last = obstacles.at(-1);
  if (!last || W - last.x > nextGap) {
    const tall = rng() < 0.4;
    obstacles.push({ x: W + 30, w: tall ? 22 : 34, h: tall ? 52 : 28, tall, passed: false });
    nextGap = 230 + rng() * 240;
  }
  for (const o of obstacles) {
    o.x -= speed * dt;
    if (!o.passed && o.x + o.w < hero.x - 14) { o.passed = true; score += 10; emit("score", score); }
    const hit = hero.inv <= 0 && hero.x + 13 > o.x && hero.x - 13 < o.x + o.w && hero.y > GROUND - o.h + 4;
    if (hit) {
      lives--; hero.inv = 1.5; play("bad");
      if (lives <= 0) { dead.value = true; emit("over"); }
    }
  }
  obstacles = obstacles.filter(o => o.x > -60);
}

function draw(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, "#ffcc80"); g.addColorStop(1, "#ffe0b2");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
  ctx.fillStyle = "#fff3e0"; ctx.beginPath(); ctx.arc(450, 70, 34, 0, Math.PI * 2); ctx.fill();
  // Uzoqdagi qumtepalar (sekinroq siljiydi)
  ctx.fillStyle = "#ffb74d";
  for (let i = -1; i < 4; i++) {
    const x = i * 220 - ((dist * 0.25) % 220);
    ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.quadraticCurveTo(x + 110, GROUND - 90, x + 220, GROUND); ctx.fill();
  }
  ctx.fillStyle = "#e0a25a"; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = "#c98a45";
  for (let i = 0; i < 12; i++) ctx.fillRect(((i * 60 - dist) % (W + 60) + W + 60) % (W + 60) - 30, GROUND + 14 + (i % 3) * 14, 22, 3);

  for (const o of obstacles) {
    if (o.tall) {
      ctx.fillStyle = "#2e7d32"; roundRect(ctx, o.x + 6, GROUND - o.h, 10, o.h, 5); ctx.fill();
      roundRect(ctx, o.x, GROUND - o.h + 16, 6, 18, 3); ctx.fill();
      roundRect(ctx, o.x + 16, GROUND - o.h + 10, 6, 20, 3); ctx.fill();
    } else {
      ctx.fillStyle = "#757575"; ctx.beginPath(); ctx.moveTo(o.x, GROUND); ctx.lineTo(o.x + 8, GROUND - o.h); ctx.lineTo(o.x + 26, GROUND - o.h + 5); ctx.lineTo(o.x + o.w, GROUND); ctx.fill();
      ctx.fillStyle = "#9e9e9e"; ctx.beginPath(); ctx.moveTo(o.x + 8, GROUND - o.h); ctx.lineTo(o.x + 16, GROUND - 8); ctx.lineTo(o.x + 26, GROUND - o.h + 5); ctx.fill();
    }
  }

  if (lives > 0 && (hero.inv <= 0 || Math.floor(hero.inv * 12) % 2 === 0)) {
    const run = hero.y >= GROUND ? Math.sin(dist / 14) : 0.6;
    ctx.save(); ctx.translate(hero.x, hero.y);
    ctx.strokeStyle = "#37474f"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-3, -18); ctx.lineTo(-3 + run * 10, -1); ctx.moveTo(3, -18); ctx.lineTo(3 - run * 10, -1); ctx.stroke();
    ctx.fillStyle = "#00897b"; roundRect(ctx, -11, -44, 22, 28, 7); ctx.fill();
    ctx.strokeStyle = "#00897b"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-9, -38); ctx.lineTo(-15 - run * 6, -24); ctx.moveTo(9, -38); ctx.lineTo(15 + run * 6, -24); ctx.stroke();
    ctx.fillStyle = "#ffcc80"; ctx.beginPath(); ctx.arc(0, -54, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5d4037"; ctx.beginPath(); ctx.arc(0, -58, 10, Math.PI, 0); ctx.fill(); ctx.fillRect(-13, -59, 26, 3);
    ctx.restore();
  }
  drawLives(ctx, lives);
}

useArcade(cv, {
  width: W, height: H, active: () => props.active && !dead.value, update, draw,
  onTap: jump, onKey: (k, down) => { if (down && (k === " " || k === "ArrowUp" || k === "w")) jump(); },
});
watch(() => props.seed, reset, { immediate: true });
</script>
