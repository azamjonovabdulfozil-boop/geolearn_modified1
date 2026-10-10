<template>
  <div class="arcade">
    <div class="arcade-stage">
      <canvas ref="cv" class="arcade-canvas"></canvas>
      <div v-if="dead" class="arcade-over"><Apple :size="40" /><span>Savat sindi</span></div>
    </div>
    <p class="arcade-hint">Savatni suring (yoki ← →). Mevalarni tuting (+10), toshlardan qoching.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { Apple } from "lucide-vue-next";
import { makeRng, play } from "../../../lib/gameKit";
import { useArcade, drawLives } from "./useArcade";
import "./arcade.css";

// Mevalarni tutish: yuqoridan tushayotgan mevalarni savatga yig'ish.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const W = 480, H = 520;
const FRUITS = [["#e53935", "#43a047"], ["#fb8c00", "#558b2f"], ["#fdd835", "#7cb342"], ["#8e24aa", "#2e7d32"]];
const cv = ref(null);
const dead = ref(false);
let rng, basket, items, lives, score, spawnT, time, usePointer;

function reset() {
  rng = makeRng(props.seed);
  basket = { x: W / 2 };
  items = []; lives = 3; score = 0; spawnT = 0.4; time = 0; usePointer = false;
  dead.value = false;
}

function update(dt) {
  time += dt;
  if (keys.has("ArrowLeft") || keys.has("a")) { basket.x -= 400 * dt; usePointer = false; }
  if (keys.has("ArrowRight") || keys.has("d")) { basket.x += 400 * dt; usePointer = false; }
  if (usePointer) basket.x += (pointer.x - basket.x) * Math.min(1, dt * 16);
  basket.x = Math.max(44, Math.min(W - 44, basket.x));

  spawnT -= dt;
  if (spawnT <= 0) {
    const rock = rng() < 0.2;
    items.push({ x: 24 + rng() * (W - 48), y: -20, vy: 150 + rng() * 80 + time * 3.2, rock, kind: Math.floor(rng() * FRUITS.length), spin: rng() * 6 });
    spawnT = Math.max(0.3, 0.8 - time * 0.008);
  }
  for (const it of items) {
    it.y += it.vy * dt;
    if (it.y > H - 74 && it.y < H - 40 && Math.abs(it.x - basket.x) < 46) {
      it.gone = true;
      if (it.rock) { lives--; play("bad"); if (lives <= 0) { dead.value = true; emit("over"); } }
      else { score += 10; emit("score", score); play("eat"); }
    }
  }
  items = items.filter(it => !it.gone && it.y < H + 30);
}

function draw(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#81d4fa"); g.addColorStop(0.75, "#c8e6c9"); g.addColorStop(1, "#66bb6a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Daraxt shoxlari
  ctx.fillStyle = "#2e7d32";
  for (let x = -20; x < W + 40; x += 70) { ctx.beginPath(); ctx.arc(x, 0, 52, 0, Math.PI); ctx.fill(); }

  for (const it of items) {
    ctx.save(); ctx.translate(it.x, it.y);
    if (it.rock) {
      ctx.rotate(it.spin + it.y / 60);
      ctx.fillStyle = "#616161"; ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(-8, -12); ctx.lineTo(8, -13); ctx.lineTo(15, 2); ctx.lineTo(5, 13); ctx.lineTo(-9, 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#9e9e9e"; ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(0, -2); ctx.lineTo(8, -13); ctx.fill();
    } else {
      const [body, leaf] = FRUITS[it.kind];
      const gr = ctx.createRadialGradient(-5, -6, 2, 0, 0, 15);
      gr.addColorStop(0, "rgba(255,255,255,.8)"); gr.addColorStop(0.3, body); gr.addColorStop(1, body);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(2, -20); ctx.stroke();
      ctx.fillStyle = leaf; ctx.beginPath(); ctx.ellipse(8, -18, 7, 3.4, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Savat
  const x = basket.x, y = H - 62;
  ctx.fillStyle = "#8d6e63"; ctx.beginPath(); ctx.moveTo(x - 46, y); ctx.lineTo(x + 46, y); ctx.lineTo(x + 34, y + 36); ctx.lineTo(x - 34, y + 36); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 12, y); ctx.lineTo(x + i * 9, y + 36); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x - 41, y + 14); ctx.lineTo(x + 41, y + 14); ctx.moveTo(x - 37, y + 26); ctx.lineTo(x + 37, y + 26); ctx.stroke();
  ctx.fillStyle = "#6d4c41"; ctx.fillRect(x - 48, y - 5, 96, 7);
  drawLives(ctx, lives);
}

const { pointer, keys } = useArcade(cv, { width: W, height: H, active: () => props.active && !dead.value, update, draw, onTap: () => { usePointer = true; } });
watch(() => pointer.x, () => { if (pointer.moved) usePointer = true; });
watch(() => props.seed, reset, { immediate: true });
</script>
