<template>
  <div class="arcade">
    <div class="arcade-stage">
      <canvas ref="cv" class="arcade-canvas"></canvas>
    </div>
    <p class="arcade-hint">Nishonni bosing. Markazga tegsa — 10 ochko, chetiga — 5. Bo'sh joyga otsangiz −2.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { makeRng, play } from "../../../lib/gameKit";
import { useArcade } from "./useArcade";
import "./arcade.css";

// Nishonga otish: tirda chiqib-yo'qolib turadigan harakatlanuvchi nishonlar.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const W = 520, H = 440;
const cv = ref(null);
let rng, targets, marks, score, spawnT, time;

function reset() {
  rng = makeRng(props.seed);
  targets = []; marks = []; score = 0; spawnT = 0.3; time = 0;
}

function update(dt) {
  time += dt;
  spawnT -= dt;
  if (spawnT <= 0 && targets.length < 4) {
    const row = Math.floor(rng() * 3);
    const dir = rng() < 0.5 ? 1 : -1;
    const r = 30 - row * 5;                       // orqa qatordagilar kichikroq
    targets.push({ x: dir === 1 ? -r : W + r, y: 120 + row * 95, r, vx: dir * (90 + rng() * 90 + time * 1.5), life: 0, hit: 0 });
    spawnT = Math.max(0.35, 0.9 - time * 0.008);
  }
  for (const t of targets) {
    t.x += t.vx * dt; t.life += dt;
    if (t.hit) t.hit += dt;
  }
  targets = targets.filter(t => t.x > -60 && t.x < W + 60 && t.hit < 0.25);
  for (const m of marks) m.t -= dt;
  marks = marks.filter(m => m.t > 0);
}

function shoot({ x, y }) {
  play("shoot");
  // Eng oldingi (keyin chizilgan) nishondan boshlab tekshiramiz
  const t = [...targets].reverse().find(t => !t.hit && Math.hypot(t.x - x, t.y - y) <= t.r);
  let gain = -2;
  if (t) { t.hit = 0.001; gain = Math.hypot(t.x - x, t.y - y) <= t.r * 0.38 ? 10 : 5; play("good"); }
  score = Math.max(0, score + gain);
  emit("score", score);
  marks.push({ x, y, t: 0.7, text: gain > 0 ? `+${gain}` : String(gain), good: gain > 0 });
}

function draw(ctx) {
  // Tir: devor, peshtaxta
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#3e2723"); g.addColorStop(1, "#5d4037");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i % 2 ? "#4e342e" : "#6d4c41"; ctx.fillRect(0, 150 + i * 95, W, 14);
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(0, 164 + i * 95, W, 5);
  }
  ctx.fillStyle = "#b71c1c"; ctx.fillRect(0, 0, W, 34);
  for (let x = 0; x < W; x += 40) { ctx.fillStyle = (x / 40) % 2 ? "#fff" : "#e53935"; ctx.beginPath(); ctx.moveTo(x, 34); ctx.lineTo(x + 20, 56); ctx.lineTo(x + 40, 34); ctx.fill(); }

  for (const t of targets) {
    const k = t.hit ? 1 - t.hit / 0.25 : 1;
    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(k, k);
    ctx.fillStyle = "#3e2723"; ctx.fillRect(-3, t.r - 2, 6, 34);
    ["#fff", "#e53935", "#fff", "#e53935", "#ffd54f"].forEach((c, i) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, t.r * (1 - i * 0.2), 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
  ctx.font = "bold 20px Inter, sans-serif"; ctx.textAlign = "center";
  for (const m of marks) {
    ctx.globalAlpha = Math.min(1, m.t / 0.4);
    ctx.fillStyle = m.good ? "#b9f6ca" : "#ff8a80";
    ctx.fillText(m.text, m.x, m.y - (0.7 - m.t) * 40);
  }
  ctx.globalAlpha = 1;

  // Mo'ljal
  if (pointer.moved) {
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 13, 0, Math.PI * 2);
    ctx.moveTo(pointer.x - 20, pointer.y); ctx.lineTo(pointer.x - 6, pointer.y);
    ctx.moveTo(pointer.x + 6, pointer.y); ctx.lineTo(pointer.x + 20, pointer.y);
    ctx.moveTo(pointer.x, pointer.y - 20); ctx.lineTo(pointer.x, pointer.y - 6);
    ctx.moveTo(pointer.x, pointer.y + 6); ctx.lineTo(pointer.x, pointer.y + 20);
    ctx.stroke();
  }
}

const { pointer } = useArcade(cv, { width: W, height: H, active: () => props.active, update, draw, onTap: shoot });
watch(() => props.seed, reset, { immediate: true });
</script>
