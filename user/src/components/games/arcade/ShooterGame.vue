<template>
  <div class="arcade">
    <div class="arcade-stage">
      <canvas ref="cv" class="arcade-canvas"></canvas>
      <div v-if="dead" class="arcade-over"><Rocket :size="40" /><span>Kemangiz urib tushirildi</span></div>
    </div>
    <p class="arcade-hint">Kemani sichqoncha yoki barmoq bilan suring (yoki ← →). O'q o'zi otiladi.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { Rocket } from "lucide-vue-next";
import { makeRng, play } from "../../../lib/gameKit";
import { useArcade, drawLives } from "./useArcade";
import "./arcade.css";

// Kosmik otishma: yuqoridan tushayotgan dushman kemalari va asteroidlarni urib tushirish.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const W = 480, H = 560;
const cv = ref(null);
const dead = ref(false);
let rng, ship, bullets, foes, sparks, stars, lives, score, fireT, spawnT, time, usePointer;

function reset() {
  rng = makeRng(props.seed);
  ship = { x: W / 2, y: H - 54, inv: 0 };
  bullets = []; foes = []; sparks = [];
  stars = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 20 + Math.random() * 60 }));
  lives = 3; score = 0; fireT = 0; spawnT = 0.6; time = 0; usePointer = false;
  dead.value = false;
}

function boom(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 140;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.45, color });
  }
}

function update(dt) {
  time += dt;
  if (keys.has("ArrowLeft") || keys.has("a")) { ship.x -= 330 * dt; usePointer = false; }
  if (keys.has("ArrowRight") || keys.has("d")) { ship.x += 330 * dt; usePointer = false; }
  if (usePointer) ship.x += (pointer.x - ship.x) * Math.min(1, dt * 14);
  ship.x = Math.max(22, Math.min(W - 22, ship.x));
  if (ship.inv > 0) ship.inv -= dt;

  fireT -= dt;
  if (fireT <= 0) { bullets.push({ x: ship.x, y: ship.y - 20 }); fireT = 0.22; }
  for (const b of bullets) b.y -= 520 * dt;
  bullets = bullets.filter(b => b.y > -10 && !b.hit);

  // Vaqt o'tgan sari dushmanlar tezroq va ko'proq chiqadi
  spawnT -= dt;
  if (spawnT <= 0) {
    const big = rng() < 0.25;
    foes.push({ x: 26 + rng() * (W - 52), y: -24, r: big ? 22 : 15, hp: big ? 2 : 1, vy: 70 + rng() * 60 + time * 2.2, wob: rng() * 6, big });
    spawnT = Math.max(0.28, 0.95 - time * 0.012);
  }
  for (const f of foes) {
    f.y += f.vy * dt;
    f.x += Math.sin(time * 2 + f.wob) * 28 * dt;
    for (const b of bullets) {
      if (!b.hit && Math.abs(b.x - f.x) < f.r && Math.abs(b.y - f.y) < f.r) {
        b.hit = true; f.hp--;
        if (f.hp <= 0) { f.gone = true; score += f.big ? 20 : 10; emit("score", score); boom(f.x, f.y, f.big ? "#ffb74d" : "#ef5350"); play("boom"); }
      }
    }
    const crash = !f.gone && ship.inv <= 0 && Math.hypot(f.x - ship.x, f.y - ship.y) < f.r + 16;
    if (crash || (!f.gone && f.y > H + 20)) {
      f.gone = true;
      if (crash) { boom(ship.x, ship.y, "#90caf9"); hit(); }
    }
  }
  foes = foes.filter(f => !f.gone);
  for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt; }
  sparks = sparks.filter(s => s.t > 0);
  for (const s of stars) { s.y += s.s * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }
}
function hit() {
  lives--; ship.inv = 1.6; play("bad");
  if (lives <= 0) { dead.value = true; emit("over"); }
}

function draw(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#070b1f"); g.addColorStop(1, "#1a1140");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.75)";
  for (const s of stars) ctx.fillRect(s.x, s.y, s.s > 55 ? 2 : 1, s.s > 55 ? 2 : 1);

  for (const f of foes) {
    ctx.save(); ctx.translate(f.x, f.y);
    if (f.big) {
      // Asteroid
      ctx.fillStyle = "#8d6e63"; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = f.r * (0.8 + ((i * 7 + Math.floor(f.wob * 10)) % 5) * 0.06); ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#6d4c41"; ctx.beginPath(); ctx.arc(-5, -3, 5, 0, Math.PI * 2); ctx.arc(7, 6, 3.5, 0, Math.PI * 2); ctx.fill();
    } else {
      // Dushman kemasi
      ctx.fillStyle = "#ef5350"; ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(-15, -10); ctx.lineTo(0, -4); ctx.lineTo(15, -10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffcdd2"; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  ctx.fillStyle = "#fff59d"; ctx.shadowColor = "#ffee58"; ctx.shadowBlur = 8;
  for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
  ctx.shadowBlur = 0;

  if (lives > 0 && (ship.inv <= 0 || Math.floor(ship.inv * 12) % 2 === 0)) {
    ctx.save(); ctx.translate(ship.x, ship.y);
    ctx.fillStyle = "#ff9800"; ctx.beginPath(); ctx.moveTo(-6, 18); ctx.lineTo(0, 28 + Math.random() * 8); ctx.lineTo(6, 18); ctx.fill();
    ctx.fillStyle = "#42a5f5"; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(18, 18); ctx.lineTo(0, 10); ctx.lineTo(-18, 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e3f2fd"; ctx.beginPath(); ctx.ellipse(0, -2, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  for (const s of sparks) { ctx.globalAlpha = Math.max(0, s.t / 0.45); ctx.fillStyle = s.color; ctx.fillRect(s.x - 2, s.y - 2, 4, 4); }
  ctx.globalAlpha = 1;
  drawLives(ctx, lives);
}

const { pointer, keys } = useArcade(cv, {
  width: W, height: H, active: () => props.active && !dead.value, update, draw,
  onTap: () => { usePointer = true; },
});
watch(() => pointer.x, () => { if (pointer.moved) usePointer = true; });
watch(() => props.seed, reset, { immediate: true });
</script>
