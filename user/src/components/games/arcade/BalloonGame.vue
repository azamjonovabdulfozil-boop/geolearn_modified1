<template>
  <div class="arcade">
    <div class="arcade-stage">
      <canvas ref="cv" class="arcade-canvas"></canvas>
    </div>
    <p class="arcade-hint">Rangli sharlarni yoring (+10). Qora sharga tegmang — u −20.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { makeRng, play } from "../../../lib/gameKit";
import { useArcade } from "./useArcade";
import "./arcade.css";

// Sharlarni yorish: pastdan ko'tarilayotgan sharlarni bosib yorish.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const W = 480, H = 520;
const COLORS = ["#e53935", "#1e88e5", "#43a047", "#fdd835", "#8e24aa", "#fb8c00"];
const cv = ref(null);
let rng, balloons, pops, score, spawnT, time;

function reset() {
  rng = makeRng(props.seed);
  balloons = []; pops = []; score = 0; spawnT = 0.2; time = 0;
}

function update(dt) {
  time += dt;
  spawnT -= dt;
  if (spawnT <= 0) {
    const bad = rng() < 0.16;
    balloons.push({ x: 40 + rng() * (W - 80), y: H + 40, r: 24 + rng() * 10, vy: 90 + rng() * 80 + time * 2.5, sway: rng() * 6, bad, color: bad ? "#212121" : COLORS[Math.floor(rng() * COLORS.length)] });
    spawnT = Math.max(0.22, 0.6 - time * 0.006);
  }
  for (const b of balloons) { b.y -= b.vy * dt; b.x += Math.sin(time * 2 + b.sway) * 22 * dt; }
  balloons = balloons.filter(b => b.y > -60 && !b.gone);
  for (const p of pops) p.t -= dt;
  pops = pops.filter(p => p.t > 0);
}

function tap({ x, y }) {
  const b = [...balloons].reverse().find(b => Math.hypot((b.x - x) / 1, (b.y - y) / 1.2) <= b.r);
  if (!b) return;
  b.gone = true;
  score = Math.max(0, score + (b.bad ? -20 : 10));
  emit("score", score);
  play(b.bad ? "bad" : "eat");
  pops.push({ x: b.x, y: b.y, r: b.r, t: 0.3, color: b.color, text: b.bad ? "−20" : "+10" });
}

function draw(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#4fc3f7"); g.addColorStop(1, "#e1f5fe");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (const [x, y, s] of [[80, 90, 1], [330, 60, 1.3], [220, 200, 0.8]]) {
    ctx.beginPath(); ctx.arc(x, y, 22 * s, 0, 7); ctx.arc(x + 26 * s, y - 8 * s, 28 * s, 0, 7); ctx.arc(x + 56 * s, y, 22 * s, 0, 7); ctx.fill();
  }
  for (const b of balloons) {
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(b.x, b.y + b.r * 1.2); ctx.quadraticCurveTo(b.x + 8, b.y + b.r * 1.8, b.x - 3, b.y + b.r * 2.5); ctx.stroke();
    const gr = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.45, 2, b.x, b.y, b.r * 1.25);
    gr.addColorStop(0, "rgba(255,255,255,.85)"); gr.addColorStop(0.25, b.color); gr.addColorStop(1, b.color);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.moveTo(b.x - 4, b.y + b.r * 1.18); ctx.lineTo(b.x + 4, b.y + b.r * 1.18); ctx.lineTo(b.x, b.y + b.r * 1.34); ctx.fill();
    if (b.bad) {
      ctx.strokeStyle = "#ff5252"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(b.x - 7, b.y - 7); ctx.lineTo(b.x + 7, b.y + 7); ctx.moveTo(b.x + 7, b.y - 7); ctx.lineTo(b.x - 7, b.y + 7); ctx.stroke();
    }
  }
  ctx.font = "bold 18px Inter, sans-serif"; ctx.textAlign = "center";
  for (const p of pops) {
    const k = 1 - p.t / 0.3;
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * p.r * k, p.y + Math.sin(a) * p.r * k); ctx.lineTo(p.x + Math.cos(a) * p.r * (k + 0.5), p.y + Math.sin(a) * p.r * (k + 0.5)); ctx.stroke(); }
    ctx.fillStyle = "#263238"; ctx.fillText(p.text, p.x, p.y - k * 24);
  }
  ctx.globalAlpha = 1;
}

useArcade(cv, { width: W, height: H, active: () => props.active, update, draw, onTap: tap });
watch(() => props.seed, reset, { immediate: true });
</script>
