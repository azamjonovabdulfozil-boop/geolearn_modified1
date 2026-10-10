<template>
  <div class="pen">
    <!-- Zarbalar tarixi -->
    <div class="pen-board">
      <div v-for="(p, i) in duel.players" :key="p.userId" class="pen-row" :class="{ mine: i === duel.me, shooting: state.shooterIdx === i && !finished }">
        <span class="pen-name">{{ i === duel.me ? "Siz" : p.name }}</span>
        <span class="pen-dots">
          <span v-for="(k, n) in kicksOf(i)" :key="n" class="pen-dot" :class="k">
            <Check v-if="k === 'goal'" :size="14" /><X v-else-if="k === 'miss'" :size="14" />
          </span>
        </span>
        <span class="pen-total">{{ state.score[i] }}</span>
      </div>
    </div>

    <div class="pen-stage">
      <canvas ref="canvasEl" class="pen-canvas"></canvas>

      <!-- Darvozaning 6 qismi -->
      <div v-if="canPick" class="pen-zones">
        <button v-for="z in 6" :key="z" class="pen-zone" :class="{ keeper: !iShoot }" @click="pick(z - 1)">
          <component :is="iShoot ? Crosshair : Hand" :size="30" class="pen-zone-mark" />
        </button>
      </div>
      <div v-else-if="state.phase === 'choose' && state.myPick != null && !finished" class="pen-zones pen-zones--picked">
        <span v-for="z in 6" :key="z" class="pen-zone pen-zone--static" :class="{ chosen: state.myPick === z - 1 }">
          <component :is="iShoot ? Crosshair : Hand" v-if="state.myPick === z - 1" :size="30" class="pen-zone-mark" />
        </span>
      </div>

      <Transition name="pen-banner">
        <div v-if="banner" class="pen-banner" :class="banner.tone">
          <span class="pen-banner-big">{{ banner.big }}</span>
          <span class="pen-banner-sub">{{ banner.sub }}</span>
        </div>
      </Transition>
    </div>

    <div class="pen-hint" :class="{ wait: !canPick }">
      <template v-if="finished">O'yin tugadi</template>
      <template v-else-if="!started">Tayyorlaning...</template>
      <template v-else-if="state.phase === 'reveal'">Keyingi zarbaga tayyorlaning...</template>
      <template v-else-if="canPick">
        <strong>{{ iShoot ? "Siz tepasiz" : "Siz darvozadasiz" }}</strong>
        — {{ iShoot ? "to'pni qayerga yo'llaysiz?" : "qaysi tomonga sakraysiz?" }}
      </template>
      <template v-else>Tanlandi — raqib o'ylayapti...</template>
    </div>
    <div v-if="started && state.phase === 'choose' && !finished" class="pen-timer">
      <div class="pen-timer-fill" :class="{ urgent: leftPct < 30 }" :style="{ width: leftPct + '%' }"></div>
    </div>
    <p class="pen-round">{{ roundLabel }}</p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Check, X, Crosshair, Hand } from "lucide-vue-next";
import { useDuelStore } from "../../stores/duel";
import { play } from "../../lib/gameKit";

// Penalti: bir o'yinchi tepadi, ikkinchisi darvozada. Ikkalasi yashirin
// ravishda darvozaning 6 qismidan birini tanlaydi, keyin zarba ko'rsatiladi.
const props = defineProps({ duel: { type: Object, required: true } });
const store = useDuelStore();

const W = 640, H = 420;
const GOAL = { x: 120, y: 78, w: 400, h: 164 };
const SPOT = { x: 320, y: 372 };
const CHOOSE_MS = 12000;

const canvasEl = ref(null);
const tick = ref(0);
const banner = ref(null);
let ctx = null, backdrop = null, raf = 0, tickTimer = null;
let anim = null;                 // { start, shot, dive, goal }
let shownRound = -1;
let sending = false;

const state = computed(() => props.duel.state);
const finished = computed(() => props.duel.status === "finished");
const started = computed(() => { tick.value; return store.now() >= props.duel.startsAt; });
const iShoot = computed(() => state.value.shooterIdx === props.duel.me);
const canPick = computed(() => started.value && !finished.value && state.value.phase === "choose" && state.value.myPick == null);

const leftPct = computed(() => {
  tick.value;
  return Math.max(0, Math.min(100, ((state.value.phaseEndsAt - store.now()) / CHOOSE_MS) * 100));
});
const roundLabel = computed(() => {
  const s = state.value;
  const n = Math.floor(s.round / 2) + 1;
  return n <= s.kicksPerSide ? `${n}-zarba / ${s.kicksPerSide}` : `Qo'shimcha zarba (${n - s.kicksPerSide})`;
});

/** O'yinchining zarbalari: gol / o'tmadi / hali tepilmagan. */
function kicksOf(i) {
  const s = state.value;
  const done = s.history.filter(h => h.shooterIdx === i).map(h => (h.goal ? "goal" : "miss"));
  // Qo'shimcha zarbalarda qator hozirgi juftlikkacha uzayadi
  const total = Math.max(s.kicksPerSide, finished.value ? 0 : Math.floor(s.round / 2) + 1);
  while (done.length < total) done.push("todo");
  return done;
}

async function pick(zone) {
  if (sending || !canPick.value) return;
  sending = true;
  play("click");
  try { await store.move({ zone }); } catch {}
  sending = false;
}

// Zarba natijasi kelganda — animatsiyani boshlaymiz
watch(() => state.value.last, (last) => {
  if (!last || last.round === shownRound) return;
  shownRound = last.round;
  anim = { start: performance.now(), ...last };
  banner.value = null;
  setTimeout(() => play("kick"), 380);
  setTimeout(() => {
    const mineShot = last.shooterIdx === props.duel.me;
    const goodForMe = mineShot ? last.goal : !last.goal;
    play(goodForMe ? "good" : "bad");
    banner.value = {
      tone: last.goal ? "goal" : "save",
      big: last.goal ? "GOOOL!" : "QAYTARDI!",
      sub: last.goal
        ? (mineShot ? "Siz gol urdingiz" : `${props.duel.players[last.shooterIdx].name} gol urdi`)
        : (mineShot ? "Darvozabon to'pni ushladi" : "Siz to'pni qaytardingiz"),
    };
  }, 1000);
}, { immediate: true });

watch(() => state.value.phase, (phase) => {
  if (phase === "choose") { anim = null; banner.value = null; }
});

// ── Chizish ──
const zoneCenter = z => ({ x: GOAL.x + (z % 3 + 0.5) * (GOAL.w / 3), y: GOAL.y + (Math.floor(z / 3) + 0.5) * (GOAL.h / 2) });
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const clamp01 = t => Math.max(0, Math.min(1, t));

/** Stadion, maydon va darvoza to'ri bir marta chiziladi. */
function paintBackdrop() {
  backdrop = document.createElement("canvas");
  backdrop.width = W; backdrop.height = H;
  const g = backdrop.getContext("2d");

  // Tribuna
  const sky = g.createLinearGradient(0, 0, 0, 150);
  sky.addColorStop(0, "#0b1626"); sky.addColorStop(1, "#1d3350");
  g.fillStyle = sky; g.fillRect(0, 0, W, 150);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tones = ["#e53935", "#fdd835", "#1e88e5", "#f5f5f5", "#43a047", "#fb8c00", "#8e24aa", "#90a4ae"];
  for (let row = 0; row < 9; row++) {
    for (let x = 4; x < W; x += 9) {
      g.fillStyle = tones[Math.floor(rnd() * tones.length)];
      g.globalAlpha = 0.5 + rnd() * 0.4;
      g.beginPath(); g.arc(x + rnd() * 4, 12 + row * 13 + rnd() * 3, 3.2, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
  const dark = g.createLinearGradient(0, 0, 0, 150);
  dark.addColorStop(0, "rgba(5,10,20,.55)"); dark.addColorStop(1, "rgba(5,10,20,.05)");
  g.fillStyle = dark; g.fillRect(0, 0, W, 150);
  // Reklama taxtalari
  const boards = ["#c62828", "#1565c0", "#f9a825", "#2e7d32", "#6a1b9a"];
  for (let i = 0; i < 5; i++) { g.fillStyle = boards[i]; g.fillRect(i * (W / 5), 128, W / 5 - 2, 24); }
  g.fillStyle = "rgba(255,255,255,.85)"; g.font = "bold 13px Inter, sans-serif"; g.textAlign = "center";
  ["GEOLEARN", "1 GA 1", "PENALTI", "GEOLEARN", "DO'STLAR"].forEach((t, i) => g.fillText(t, i * (W / 5) + W / 10, 145));

  // Maydon
  const grass = g.createLinearGradient(0, 152, 0, H);
  grass.addColorStop(0, "#2f9e44"); grass.addColorStop(1, "#1f7a31");
  g.fillStyle = grass; g.fillRect(0, 152, W, H - 152);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? "rgba(255,255,255,.045)" : "rgba(0,0,0,.05)";
    const y0 = 152 + (H - 152) * (i / 6) ** 1.5, y1 = 152 + (H - 152) * ((i + 1) / 6) ** 1.5;
    g.fillRect(0, y0, W, y1 - y0);
  }
  // Chiziqlar: darvoza chizig'i, darvozabon maydoni, penalti nuqtasi
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, GOAL.y + GOAL.h); g.lineTo(W, GOAL.y + GOAL.h); g.stroke();
  g.beginPath(); g.moveTo(60, GOAL.y + GOAL.h); g.lineTo(20, 318); g.lineTo(620, 318); g.lineTo(580, GOAL.y + GOAL.h); g.stroke();
  g.fillStyle = "rgba(255,255,255,.9)";
  g.beginPath(); g.ellipse(SPOT.x, SPOT.y + 14, 7, 3, 0, 0, Math.PI * 2); g.fill();

  // To'r (ichki tomoni torayib boradi)
  const inset = 26;
  g.fillStyle = "rgba(8,18,30,.42)";
  g.fillRect(GOAL.x, GOAL.y, GOAL.w, GOAL.h);
  g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = 1;
  for (let i = 0; i <= 20; i++) {
    const x = GOAL.x + (GOAL.w * i) / 20, xi = GOAL.x + inset + ((GOAL.w - inset * 2) * i) / 20;
    g.beginPath(); g.moveTo(x, GOAL.y); g.lineTo(xi, GOAL.y + inset * 0.7); g.lineTo(xi, GOAL.y + GOAL.h - 6); g.stroke();
  }
  for (let j = 0; j <= 9; j++) {
    const y = GOAL.y + inset * 0.7 + ((GOAL.h - inset * 0.7 - 6) * j) / 9;
    g.beginPath(); g.moveTo(GOAL.x + inset, y); g.lineTo(GOAL.x + GOAL.w - inset, y); g.stroke();
    g.beginPath(); g.moveTo(GOAL.x, GOAL.y + (GOAL.h * j) / 9); g.lineTo(GOAL.x + inset, y); g.stroke();
    g.beginPath(); g.moveTo(GOAL.x + GOAL.w, GOAL.y + (GOAL.h * j) / 9); g.lineTo(GOAL.x + GOAL.w - inset, y); g.stroke();
  }
  // Ustunlar
  g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 9; g.lineCap = "round";
  g.beginPath(); g.moveTo(GOAL.x + 3, GOAL.y + GOAL.h + 2); g.lineTo(GOAL.x + 3, GOAL.y + 3); g.lineTo(GOAL.x + GOAL.w + 3, GOAL.y + 3); g.lineTo(GOAL.x + GOAL.w + 3, GOAL.y + GOAL.h + 2); g.stroke();
  g.strokeStyle = "#f7f7f7"; g.lineWidth = 7;
  g.beginPath(); g.moveTo(GOAL.x, GOAL.y + GOAL.h); g.lineTo(GOAL.x, GOAL.y); g.lineTo(GOAL.x + GOAL.w, GOAL.y); g.lineTo(GOAL.x + GOAL.w, GOAL.y + GOAL.h); g.stroke();
}

function drawKeeper(cx, cy, angle, reach) {
  ctx.save();
  // Soya
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.beginPath(); ctx.ellipse(cx, GOAL.y + GOAL.h + 4, 34, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // Oyoqlar
  ctx.strokeStyle = "#1b1b1b"; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(-8, 22); ctx.lineTo(-13, 54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, 22); ctx.lineTo(13, 54); ctx.stroke();
  ctx.strokeStyle = "#f5f5f5"; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-13, 46); ctx.lineTo(-13, 54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13, 46); ctx.lineTo(13, 54); ctx.stroke();
  // Qo'llar: sakrash paytida yuqoriga cho'ziladi
  const armY = lerp(2, -40, reach), armX = lerp(27, 15, reach);
  ctx.strokeStyle = "#ff9800"; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(-15, -14); ctx.lineTo(-armX, armY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(15, -14); ctx.lineTo(armX, armY); ctx.stroke();
  ctx.fillStyle = "#fafafa";
  ctx.beginPath(); ctx.arc(-armX, armY - 3, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(armX, armY - 3, 8, 0, Math.PI * 2); ctx.fill();
  // Tana
  const jersey = ctx.createLinearGradient(-18, -24, 18, 24);
  jersey.addColorStop(0, "#ffb300"); jersey.addColorStop(1, "#f57c00");
  ctx.fillStyle = jersey;
  ctx.beginPath();
  ctx.moveTo(-9, -24); ctx.arcTo(18, -24, 18, 24, 9); ctx.arcTo(18, 24, -18, 24, 9);
  ctx.arcTo(-18, 24, -18, -24, 9); ctx.arcTo(-18, -24, 18, -24, 9);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(-18, 12, 36, 4);
  ctx.fillStyle = "#fff"; ctx.font = "bold 15px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillText("1", 0, 2);
  // Bosh
  ctx.fillStyle = "#e0ac7e";
  ctx.beginPath(); ctx.arc(0, -36, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3e2723";
  ctx.beginPath(); ctx.arc(0, -39, 12, Math.PI, 0); ctx.fill();
  ctx.restore();
}

function drawBall(x, y, r, spin) {
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath(); ctx.ellipse(x, Math.max(y + r + 2, lerp(GOAL.y + GOAL.h + 4, SPOT.y + 16, clamp01((r - 9) / 8))), r * 0.9, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#cfd8dc");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#212121";
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36);
  }
  ctx.closePath(); ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, r * 0.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

function frame(ts) {
  raf = requestAnimationFrame(frame);
  ctx.drawImage(backdrop, 0, 0);

  const idle = Math.sin(ts / 420) * 7;
  let keeper = { x: SPOT.x + idle, y: GOAL.y + GOAL.h - 58, angle: 0, reach: 0 };
  let ball = { x: SPOT.x, y: SPOT.y, r: 17, spin: 0 };
  let ballBehind = false;

  if (anim) {
    const t = ts - anim.start;
    const fly = easeOut(clamp01((t - 380) / 520));
    const after = clamp01((t - 900) / 600);
    const target = zoneCenter(anim.shot);
    // Darvozabon: ushlasa — to'p tomonga, aks holda o'zi tanlagan tomonga
    const kz = zoneCenter(anim.goal ? anim.dive : anim.shot);
    const col = (anim.goal ? anim.dive : anim.shot) % 3;
    const d = easeOut(clamp01((t - 420) / 480));
    keeper = {
      x: lerp(SPOT.x, kz.x, d),
      y: lerp(GOAL.y + GOAL.h - 58, kz.y + (col === 1 ? 26 : 8), d),
      angle: (col - 1) * 1.15 * d,
      reach: d,
    };
    ball = {
      x: lerp(SPOT.x, target.x, fly),
      y: lerp(SPOT.y, target.y, fly) - Math.sin(Math.PI * fly) * 22,
      r: lerp(17, 9, fly),
      spin: t / 60,
    };
    if (after > 0) {
      if (anim.goal) {
        // To'r ichiga tushadi
        ball.y = lerp(target.y, GOAL.y + GOAL.h - 14, easeOut(after));
        ball.r = 8.5;
        ballBehind = true;
      } else {
        // Darvozabondan qaytadi
        const side = col === 1 ? (anim.shot % 2 ? 1 : -1) : col - 1;
        ball.x = target.x + side * 90 * after;
        ball.y = target.y + 150 * after * after - 30 * Math.sin(Math.PI * after);
        ball.r = lerp(9, 13, after);
      }
    }
  }

  if (ballBehind) drawBall(ball.x, ball.y, ball.r, ball.spin);
  drawKeeper(keeper.x, keeper.y, keeper.angle, keeper.reach);
  if (!ballBehind) drawBall(ball.x, ball.y, ball.r, ball.spin);
}

onMounted(() => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = canvasEl.value;
  c.width = W * dpr; c.height = H * dpr;
  ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  paintBackdrop();
  raf = requestAnimationFrame(frame);
  tickTimer = setInterval(() => { tick.value++; }, 200);
});
onUnmounted(() => {
  cancelAnimationFrame(raf);
  clearInterval(tickTimer);
});
</script>

<style scoped>
.pen { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.pen-board { width: 100%; max-width: 640px; display: flex; flex-direction: column; gap: 6px; }
.pen-row {
  display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-radius: 12px;
  background: hsl(var(--card)); border: 1px solid hsl(var(--border)); transition: border-color .2s, box-shadow .2s;
}
.pen-row.shooting { border-color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--primary) / .15); }
.pen-name { flex: none; width: 96px; font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pen-row.mine .pen-name { color: hsl(var(--primary)); }
.pen-dots { flex: 1; display: flex; flex-wrap: wrap; gap: 5px; }
.pen-dot {
  width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 900; border: 2px dashed hsl(var(--border));
}
.pen-dot.goal { border: none; background: hsl(142 60% 40% / .2); color: hsl(142 60% 32%); }
.pen-dot.miss { border: none; background: hsl(var(--destructive) / .16); color: hsl(var(--destructive)); }
.pen-total { font-size: 20px; font-weight: 900; min-width: 22px; text-align: right; }

.pen-stage {
  position: relative; width: 100%; max-width: 640px; aspect-ratio: 640 / 420;
  border-radius: 18px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, .35);
}
.pen-canvas { display: block; width: 100%; height: 100%; }
.pen-zones {
  position: absolute; left: 18.75%; top: 18.57%; width: 62.5%; height: 39.05%;
  display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr);
}
.pen-zone {
  display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;
  background: rgba(255, 255, 255, .06); border: 1.5px dashed rgba(255, 255, 255, .55);
  transition: background .12s, transform .12s;
}
.pen-zone:hover { background: rgba(255, 235, 59, .32); }
.pen-zone.keeper:hover { background: rgba(100, 200, 255, .32); }
.pen-zone:active { transform: scale(.95); }
.pen-zone-mark { color: #fff; opacity: 0; transition: opacity .12s; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .5)); }
.pen-zone:hover .pen-zone-mark { opacity: 1; }
.pen-zones--picked { pointer-events: none; }
.pen-zone--static { cursor: default; border-color: transparent; background: none; }
.pen-zone--static.chosen { background: rgba(255, 255, 255, .2); border: 2px solid rgba(255, 255, 255, .9); border-radius: 8px; }
.pen-zone--static.chosen .pen-zone-mark { opacity: 1; }
@media (hover: none) { .pen-zone .pen-zone-mark { opacity: .55; } }

.pen-banner {
  position: absolute; left: 0; right: 0; bottom: 9%; display: flex; flex-direction: column; align-items: center;
  color: #fff; text-shadow: 0 3px 10px rgba(0, 0, 0, .6); pointer-events: none;
}
.pen-banner-big { font-size: clamp(30px, 9vw, 58px); font-weight: 900; letter-spacing: .04em; line-height: 1; }
.pen-banner.goal .pen-banner-big { color: #ffeb3b; }
.pen-banner.save .pen-banner-big { color: #81d4fa; }
.pen-banner-sub { margin-top: 4px; font-size: clamp(12px, 3vw, 16px); font-weight: 700; }
.pen-banner-enter-active { transition: transform .35s cubic-bezier(.2, 1.5, .4, 1), opacity .2s; }
.pen-banner-enter-from { transform: scale(.4); opacity: 0; }
.pen-banner-leave-active { transition: opacity .2s; }
.pen-banner-leave-to { opacity: 0; }

.pen-hint { font-size: 15px; text-align: center; min-height: 24px; }
.pen-hint.wait { color: hsl(var(--muted-fg)); }
.pen-timer { width: 100%; max-width: 640px; height: 6px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
.pen-timer-fill { height: 100%; background: hsl(var(--primary)); transition: width .25s linear; }
.pen-timer-fill.urgent { background: hsl(var(--destructive)); }
.pen-round { font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: hsl(var(--muted-fg)); }
</style>
