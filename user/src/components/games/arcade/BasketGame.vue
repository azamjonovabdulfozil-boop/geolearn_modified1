<template>
  <div class="arcade">
    <div class="arcade-stage">
      <canvas ref="cv" class="arcade-canvas"></canvas>
    </div>
    <p class="arcade-hint">Kuch chizig'i yashil qismga kelganda bosing (yoki Probel). Aniq o'rtasi — 30 ochko.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { makeRng, play } from "../../../lib/gameKit";
import { useArcade, roundRect } from "./useArcade";
import "./arcade.css";

// Basketbol: kuch o'lchagichi to'g'ri joyga kelganda to'pni savatga otish.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const W = 480, H = 520, START = { x: 110, y: 420 };
const cv = ref(null);
let rng, hoop, power, dir, shot, score, streak, banner, speed;

function newHoop() {
  hoop = { x: 300 + rng() * 120, y: 150 + rng() * 110 };
  // Savat uzoqroq bo'lsa — ko'proq kuch kerak; yashil qism joyi shunga qarab o'zgaradi
  power = { v: 0, sweet: 0.35 + ((hoop.x - 300) / 120) * 0.35 + rng() * 0.1, zone: Math.max(0.09, 0.16 - streak * 0.012) };
}
function reset() {
  rng = makeRng(props.seed);
  score = 0; streak = 0; dir = 1; shot = null; banner = null; speed = 0.9;
  newHoop();
}

function shoot() {
  if (shot) return;
  const off = power.v - power.sweet;
  const made = Math.abs(off) <= power.zone / 2;
  const perfect = Math.abs(off) <= power.zone / 6;
  // To'p savatga (yoki xato bo'lsa — yoniga) qarab yoy bo'ylab uchadi
  shot = { t: 0, made, perfect, tx: hoop.x + (made ? 0 : off * 320), ty: hoop.y };
  play("kick");
}

function update(dt) {
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (!shot) {
    power.v += dir * speed * dt;
    if (power.v >= 1) { power.v = 1; dir = -1; }
    if (power.v <= 0) { power.v = 0; dir = 1; }
    return;
  }
  shot.t += dt * 1.35;
  if (shot.t >= 1.25) {
    if (shot.made) {
      const gain = shot.perfect ? 30 : 20;
      score += gain; streak++; speed = Math.min(1.9, speed + 0.07);
      emit("score", score); play("good");
      banner = { text: shot.perfect ? `Ajoyib! +${gain}` : `+${gain}`, t: 0.9, good: true };
    } else {
      streak = 0; play("bad");
      banner = { text: "O'tmadi", t: 0.7, good: false };
    }
    shot = null;
    newHoop();
  }
}

function ballPos() {
  if (!shot) return { x: START.x, y: START.y, r: 20 };
  const t = Math.min(1, shot.t);
  const x = START.x + (shot.tx - START.x) * t;
  const y = START.y + (shot.ty - START.y) * t - Math.sin(Math.PI * t) * 170;
  // Savatdan o'tgach pastga tushadi
  return { x, y: shot.t > 1 ? shot.ty + (shot.t - 1) * 320 : y, r: 20 - t * 4 };
}

function draw(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1a237e"); g.addColorStop(1, "#3949ab");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#c98a45"; ctx.fillRect(0, 440, W, 80);
  ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 442); ctx.lineTo(W, 442); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(110, 470, 70, 16, 0, 0, Math.PI * 2); ctx.stroke();

  // Shchit va halqa
  ctx.fillStyle = "#eceff1"; roundRect(ctx, hoop.x + 30, hoop.y - 78, 12, 100, 3); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.92)"; roundRect(ctx, hoop.x + 20, hoop.y - 70, 14, 74, 3); ctx.fill();
  ctx.strokeStyle = "#e53935"; ctx.lineWidth = 3; ctx.strokeRect(hoop.x + 22, hoop.y - 44, 10, 30);
  const b = ballPos();
  const behind = shot && shot.made && shot.t > 0.98;
  const drawBall = () => {
    const gr = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, 2, b.x, b.y, b.r);
    gr.addColorStop(0, "#ffb74d"); gr.addColorStop(1, "#e65100");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(b.x - b.r, b.y); ctx.lineTo(b.x + b.r, b.y); ctx.moveTo(b.x, b.y - b.r); ctx.lineTo(b.x, b.y + b.r); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x - b.r * 0.9, b.y, b.r * 0.8, -0.9, 0.9); ctx.arc(b.x + b.r * 0.9, b.y, b.r * 0.8, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
  };
  if (!behind) drawBall();
  // To'r
  ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1.4;
  for (let i = 0; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(hoop.x - 26 + i * 8.6, hoop.y); ctx.lineTo(hoop.x - 16 + i * 5.4, hoop.y + 34); ctx.stroke(); }
  if (behind) drawBall();
  ctx.strokeStyle = "#ff7043"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(hoop.x, hoop.y, 27, 7, 0, 0, Math.PI * 2); ctx.stroke();

  // Kuch o'lchagichi
  const bx = 40, by = 478, bw = W - 80;
  ctx.fillStyle = "rgba(0,0,0,.45)"; roundRect(ctx, bx, by, bw, 18, 9); ctx.fill();
  ctx.fillStyle = "#66bb6a"; roundRect(ctx, bx + (power.sweet - power.zone / 2) * bw, by, power.zone * bw, 18, 4); ctx.fill();
  ctx.fillStyle = "#fdd835"; ctx.fillRect(bx + (power.sweet - power.zone / 6) * bw, by, (power.zone / 3) * bw, 18);
  ctx.fillStyle = "#fff"; ctx.fillRect(bx + power.v * bw - 3, by - 5, 6, 28);

  if (banner) {
    ctx.globalAlpha = Math.min(1, banner.t * 3);
    ctx.fillStyle = banner.good ? "#ffeb3b" : "#ff8a80"; ctx.font = "900 34px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(banner.text, W / 2, 80);
    ctx.globalAlpha = 1;
  }
  if (streak >= 2) { ctx.fillStyle = "#fff"; ctx.font = "bold 14px Inter, sans-serif"; ctx.textAlign = "left"; ctx.fillText(`Ketma-ket: ${streak}`, 14, 26); }
}

useArcade(cv, {
  width: W, height: H, active: () => props.active, update, draw,
  onTap: shoot, onKey: (k, down) => { if (down && k === " ") shoot(); },
});
watch(() => props.seed, reset, { immediate: true });
</script>
