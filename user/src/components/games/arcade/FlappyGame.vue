<template>
  <div class="arcade">
    <div class="arcade-stage">
      <canvas ref="cv" class="arcade-canvas"></canvas>
      <div v-if="dead" class="arcade-over"><Bird :size="40" /><span>Qush charchadi</span></div>
    </div>
    <p class="arcade-hint">Bosing yoki Probel — qush qanot qoqadi. Ustunlar orasidan o'ting.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { Bird } from "lucide-vue-next";
import { makeRng, play } from "../../../lib/gameKit";
import { useArcade, drawLives } from "./useArcade";
import "./arcade.css";

// Uchar qush: ustunlar orasidagi tirqishdan uchib o'tish. 3 ta jon.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const W = 480, H = 520, GROUND = 470, GAP = 150, PIPE_W = 62;
const cv = ref(null);
const dead = ref(false);
let rng, bird, pipes, lives, score, time, started;

function reset() {
  rng = makeRng(props.seed);
  bird = { x: 130, y: 230, vy: 0, inv: 0 };
  pipes = []; lives = 3; score = 0; time = 0; started = false;
  dead.value = false;
}
function flap() {
  started = true;
  bird.vy = -300;
  play("flip");
}

function update(dt) {
  if (!started) { bird.y = 230 + Math.sin(performance.now() / 220) * 8; return; }
  time += dt;
  bird.vy += 900 * dt;
  bird.y += bird.vy * dt;
  if (bird.inv > 0) bird.inv -= dt;

  const speed = 150 + time * 3;
  if (!pipes.length || pipes.at(-1).x < W - 220) pipes.push({ x: W + 20, gapY: 110 + rng() * (GROUND - 220 - GAP), passed: false });
  for (const p of pipes) {
    p.x -= speed * dt;
    if (!p.passed && p.x + PIPE_W < bird.x) { p.passed = true; score += 10; emit("score", score); play("eat"); }
    const inX = bird.x + 14 > p.x && bird.x - 14 < p.x + PIPE_W;
    if (inX && bird.inv <= 0 && (bird.y - 12 < p.gapY || bird.y + 12 > p.gapY + GAP)) crash();
  }
  pipes = pipes.filter(p => p.x > -PIPE_W - 10);
  if (bird.y > GROUND - 12 || bird.y < -30) crash(true);
}
function crash(reposition = false) {
  if (bird.inv > 0 && !reposition) return;
  lives--; play("bad");
  if (lives <= 0) { dead.value = true; emit("over"); return; }
  // Keyingi tirqish balandligiga qaytaramiz va biroz himoya beramiz
  const next = pipes.find(p => p.x + PIPE_W > bird.x);
  bird.y = next ? next.gapY + GAP / 2 : 230;
  bird.vy = -120; bird.inv = 1.8;
}

function draw(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, "#4fc3f7"); g.addColorStop(1, "#b3e5fc");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
  for (const p of pipes) {
    for (const [y, h] of [[0, p.gapY], [p.gapY + GAP, GROUND - p.gapY - GAP]]) {
      const pg = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      pg.addColorStop(0, "#43a047"); pg.addColorStop(0.5, "#81c784"); pg.addColorStop(1, "#2e7d32");
      ctx.fillStyle = pg; ctx.fillRect(p.x, y, PIPE_W, h);
    }
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(p.x - 5, p.gapY - 20, PIPE_W + 10, 20);
    ctx.fillRect(p.x - 5, p.gapY + GAP, PIPE_W + 10, 20);
  }
  ctx.fillStyle = "#8d6e63"; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = "#7cb342"; ctx.fillRect(0, GROUND, W, 12);

  if (lives > 0 && (bird.inv <= 0 || Math.floor(bird.inv * 12) % 2 === 0)) {
    ctx.save(); ctx.translate(bird.x, bird.y);
    ctx.rotate(Math.max(-0.5, Math.min(1.1, bird.vy / 420)));
    ctx.fillStyle = "#ffca28"; ctx.beginPath(); ctx.ellipse(0, 0, 17, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffa000"; ctx.beginPath(); ctx.ellipse(-4, 3, 9, 6, -0.4 + Math.sin(performance.now() / 60) * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(8, -5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#212121"; ctx.beginPath(); ctx.arc(9.5, -5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ef6c00"; ctx.beginPath(); ctx.moveTo(15, -1); ctx.lineTo(26, 3); ctx.lineTo(15, 7); ctx.fill();
    ctx.restore();
  }
  drawLives(ctx, lives);
  if (!started && props.active) {
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.font = "bold 18px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Boshlash uchun bosing", W / 2, 150);
  }
}

useArcade(cv, {
  width: W, height: H, active: () => props.active && !dead.value, update, draw,
  onTap: flap, onKey: (k, down) => { if (down && (k === " " || k === "ArrowUp" || k === "w")) flap(); },
});
watch(() => props.seed, reset, { immediate: true });
</script>
