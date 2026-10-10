<template>
  <div class="tank">
    <div class="tank-stage">
      <canvas ref="canvasEl" class="tank-canvas"></canvas>
      <div class="tank-hud">
        <span class="hud-lives">
          <Heart v-for="i in 3" :key="i" :size="15" class="hud-heart" :class="{ lost: i > lives }" fill="currentColor" />
        </span>
        <span class="hud-kills"><Crosshair :size="14" /> {{ kills }}</span>
      </div>
      <div v-if="lives <= 0" class="tank-dead">
        <Flame :size="40" />
        <span>Tankingiz yo'q qilindi</span>
      </div>
    </div>

    <div class="tank-controls">
      <div class="tank-pad">
        <button v-for="b in PAD" :key="b.dir" class="pad-btn" :class="b.cls" :aria-label="b.label"
          @pointerdown.prevent="hold(b.dir, true)" @pointerup.prevent="hold(b.dir, false)"
          @pointerleave="hold(b.dir, false)" @pointercancel="hold(b.dir, false)">
          <component :is="b.icon" :size="24" />
        </button>
      </div>
      <button class="fire-btn" aria-label="O'q otish"
        @pointerdown.prevent="firing = true" @pointerup.prevent="firing = false"
        @pointerleave="firing = false" @pointercancel="firing = false">
        <Crosshair :size="30" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Crosshair, Heart, Flame } from "lucide-vue-next";
import { makeRng, play } from "../../lib/gameKit";

// Tank jangi: o'yinchi maydonda dushman tanklarini yo'q qiladi.
// Xarita va dushmanlar `seed` dan yaratiladi — 1v1 da ikkala o'yinchida bir xil.
const props = defineProps({
  seed: { type: Number, default: 1 },
  active: { type: Boolean, default: false },
});
const emit = defineEmits(["score", "over"]);

const TILE = 32, GRID = 16, SIZE = TILE * GRID;
const HALF = 13;                         // tank yarim o'lchami
const EMPTY = 0, BRICK = 1, STEEL = 2;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // yuqori, o'ng, past, chap
const PLAYER_SPEED = 112, ENEMY_SPEED = 72, BULLET_SPEED = 340;
const MAX_ENEMIES = 4, SPAWN_EVERY = 2.2, POINTS = 10;
const SPAWNS = [[0, 0], [5, 0], [10, 0], [15, 0]];
const HOME = [7.5, 14.5];                // o'yinchi boshlanadigan joy (katak hisobida)

const PAD = [
  { dir: 0, cls: "pad-up", icon: ChevronUp, label: "Yuqoriga" },
  { dir: 3, cls: "pad-left", icon: ChevronLeft, label: "Chapga" },
  { dir: 2, cls: "pad-down", icon: ChevronDown, label: "Pastga" },
  { dir: 1, cls: "pad-right", icon: ChevronRight, label: "O'ngga" },
];

const canvasEl = ref(null);
const lives = ref(3);
const kills = ref(0);
const firing = ref(false);

let ctx = null, ground = null;
let rng = makeRng(props.seed);
let map = [];
let player = null;
let enemies = [], bullets = [], blasts = [];
let spawnTimer = 0, spawnIdx = 0;
let raf = 0, last = 0;
const held = [];                         // bosib turilgan yo'nalishlar (oxirgisi ustun)

const center = c => c * TILE + TILE / 2;
const tileAt = (px, py) => {
  const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return STEEL;
  return map[y][x];
};

function buildMap() {
  map = Array.from({ length: GRID }, () => Array(GRID).fill(EMPTY));
  // Chap yarmi tasodifiy to'ldiriladi va o'ngga ko'zgu qilib ko'chiriladi
  for (let y = 2; y < GRID - 3; y++) {
    for (let x = 0; x < GRID / 2; x++) {
      const r = rng();
      const t = r < 0.3 ? BRICK : r < 0.345 ? STEEL : EMPTY;
      map[y][x] = t;
      map[y][GRID - 1 - x] = t;
    }
  }
  // Har ikkinchi qator ochiq yo'lak — tanklar tiqilib qolmasin
  for (let y = 3; y < GRID - 3; y += 3) for (let x = 0; x < GRID; x++) if (map[y][x] === BRICK && rng() < 0.75) map[y][x] = EMPTY;
  for (const x of [3, 7, 8, 12]) for (let y = 2; y < GRID - 3; y++) if (map[y][x] !== EMPTY && rng() < 0.7) map[y][x] = EMPTY;
  // O'yinchi uyi atrofi va dushmanlar chiqadigan joylar bo'sh
  for (let y = GRID - 3; y < GRID; y++) for (let x = 5; x <= 10; x++) map[y][x] = EMPTY;
  for (let x = 0; x < GRID; x++) { map[0][x] = EMPTY; map[1][x] = EMPTY; }
}

function makeTank(cx, cy, isPlayer) {
  return {
    x: cx * TILE + (Number.isInteger(cx) ? TILE / 2 : 0), y: cy * TILE + (Number.isInteger(cy) ? TILE / 2 : 0),
    dir: isPlayer ? 0 : 2, isPlayer, cooldown: isPlayer ? 0 : 0.6 + rng() * 0.8,
    ai: 0.4 + rng(), shield: isPlayer ? 2 : 0, spawn: isPlayer ? 0 : 0.5, tread: 0,
  };
}

function reset() {
  rng = makeRng(props.seed);
  buildMap();
  paintGround();
  player = makeTank(HOME[0], HOME[1], true);
  enemies = []; bullets = []; blasts = [];
  spawnTimer = 0.4; spawnIdx = 0;
  lives.value = 3; kills.value = 0;
  held.length = 0; firing.value = false;
}

/** Tank shu nuqtada tura oladimi? (devor, chegara, boshqa tanklar) */
function blocked(t, x, y) {
  const m = HALF - 0.5;
  if (x - m < 0 || y - m < 0 || x + m > SIZE || y + m > SIZE) return true;
  for (const [ox, oy] of [[-m, -m], [m, -m], [-m, m], [m, m]]) if (tileAt(x + ox, y + oy) !== EMPTY) return true;
  for (const o of [player, ...enemies]) {
    if (o === t || !o || o.dead) continue;
    if (Math.abs(o.x - x) < HALF * 2 - 1 && Math.abs(o.y - y) < HALF * 2 - 1) {
      // Ustma-ust tushib qolgan bo'lsa (masalan chiqish joyida) — ajralishiga yo'l beramiz
      if (Math.abs(o.x - t.x) < HALF * 2 - 1 && Math.abs(o.y - t.y) < HALF * 2 - 1) continue;
      return true;
    }
  }
  return false;
}

function moveTank(t, dir, speed, dt) {
  if (t.dir !== dir) {
    // Burilishda katak markaziga tekislaymiz — tor yo'laklarga oson kiradi
    const snap = v => Math.round((v - TILE / 2) / (TILE / 2)) * (TILE / 2) + TILE / 2;
    const nx = dir % 2 === 0 ? snap(t.x) : t.x, ny = dir % 2 === 1 ? snap(t.y) : t.y;
    if (!blocked(t, nx, ny)) { t.x = nx; t.y = ny; }
    t.dir = dir;
  }
  const [dx, dy] = DIRS[dir];
  const nx = t.x + dx * speed * dt, ny = t.y + dy * speed * dt;
  if (blocked(t, nx, ny)) return false;
  t.x = nx; t.y = ny;
  t.tread += speed * dt;
  return true;
}

function shoot(t) {
  const [dx, dy] = DIRS[t.dir];
  bullets.push({ x: t.x + dx * (HALF + 3), y: t.y + dy * (HALF + 3), dir: t.dir, mine: t.isPlayer });
  t.cooldown = t.isPlayer ? 0.42 : 1.1 + rng() * 1.2;
  if (t.isPlayer) play("shoot");
}

function blast(x, y, big = false) {
  blasts.push({ x, y, t: 0, life: big ? 0.5 : 0.22, r: big ? 26 : 9 });
}

function update(dt) {
  // O'yinchi
  if (player.shield > 0) player.shield -= dt;
  if (player.cooldown > 0) player.cooldown -= dt;
  if (held.length) moveTank(player, held.at(-1), PLAYER_SPEED, dt);
  if (firing.value && player.cooldown <= 0) shoot(player);

  // Dushmanlar chiqishi
  spawnTimer -= dt;
  if (spawnTimer <= 0 && enemies.length < MAX_ENEMIES) {
    const [sx, sy] = SPAWNS[spawnIdx++ % SPAWNS.length];
    const e = makeTank(sx, sy, false);
    if (!blocked(e, e.x, e.y)) enemies.push(e);
    spawnTimer = SPAWN_EVERY;
  }

  // Dushmanlar: asosan o'yinchiga qarab yuradi, ba'zan tasodifiy
  for (const e of enemies) {
    if (e.spawn > 0) { e.spawn -= dt; continue; }
    e.ai -= dt; e.cooldown -= dt;
    const moved = moveTank(e, e.dir, ENEMY_SPEED, dt);
    if (!moved || e.ai <= 0) {
      const dx = player.x - e.x, dy = player.y - e.y;
      let dir;
      if (rng() < 0.55) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      else dir = Math.floor(rng() * 4);
      if (!moved && dir === e.dir) dir = (dir + 1 + Math.floor(rng() * 3)) % 4;
      moveTank(e, dir, 0, dt);
      e.ai = 0.5 + rng() * 1.3;
    }
    if (e.cooldown <= 0) {
      const [fx, fy] = DIRS[e.dir];
      const ahead = (player.x - e.x) * fx + (player.y - e.y) * fy > 0;
      const lined = fx ? Math.abs(player.y - e.y) < 14 : Math.abs(player.x - e.x) < 14;
      if ((ahead && lined) || rng() < 0.3) shoot(e); else e.cooldown = 0.35;
    }
  }

  // O'qlar
  for (const b of bullets) {
    const [dx, dy] = DIRS[b.dir];
    b.x += dx * BULLET_SPEED * dt; b.y += dy * BULLET_SPEED * dt;
    if (b.x < 0 || b.y < 0 || b.x > SIZE || b.y > SIZE) { b.dead = true; continue; }

    const tx = Math.floor(b.x / TILE), ty = Math.floor(b.y / TILE);
    const tile = map[ty]?.[tx];
    if (tile === BRICK) { map[ty][tx] = EMPTY; paintGround(); b.dead = true; blast(b.x, b.y); continue; }
    if (tile === STEEL) { b.dead = true; blast(b.x, b.y); continue; }

    if (b.mine) {
      const e = enemies.find(e => e.spawn <= 0 && Math.abs(e.x - b.x) < HALF + 2 && Math.abs(e.y - b.y) < HALF + 2);
      if (e) {
        e.dead = true; b.dead = true;
        blast(e.x, e.y, true); play("boom");
        kills.value++;
        emit("score", kills.value * POINTS);
      }
    } else if (Math.abs(player.x - b.x) < HALF + 2 && Math.abs(player.y - b.y) < HALF + 2) {
      b.dead = true;
      if (player.shield <= 0) hitPlayer();
    }
  }
  // O'q o'qqa tegsa — ikkalasi yo'qoladi
  for (const a of bullets) {
    if (a.dead || !a.mine) continue;
    const o = bullets.find(o => !o.mine && !o.dead && Math.abs(o.x - a.x) < 7 && Math.abs(o.y - a.y) < 7);
    if (o) { a.dead = o.dead = true; blast(a.x, a.y); }
  }
  bullets = bullets.filter(b => !b.dead);
  enemies = enemies.filter(e => !e.dead);
}

function hitPlayer() {
  blast(player.x, player.y, true);
  play("boom");
  lives.value--;
  if (lives.value <= 0) { emit("over"); return; }
  const fresh = makeTank(HOME[0], HOME[1], true);
  // Uy band bo'lsa ham (dushman kirib olgan) qalqon himoya qiladi
  Object.assign(player, fresh, { shield: 2.5 });
}

// ── Chizish ──
/** Yer va devorlar alohida kanvasga chiziladi (har kadrda qayta chizmaslik uchun). */
function paintGround() {
  ground ??= document.createElement("canvas");
  ground.width = SIZE; ground.height = SIZE;
  const g = ground.getContext("2d");
  g.fillStyle = "#3b3a2e";
  g.fillRect(0, 0, SIZE, SIZE);
  const noise = makeRng(7);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${noise() < 0.5 ? "255,240,200" : "0,0,0"},${0.03 + noise() * 0.05})`;
    g.fillRect(noise() * SIZE, noise() * SIZE, 2 + noise() * 3, 2 + noise() * 3);
  }
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const t = map[y][x], px = x * TILE, py = y * TILE;
      if (t === BRICK) {
        g.save();
        g.beginPath(); g.rect(px, py, TILE, TILE); g.clip();   // g'ishtlar katakdan chiqib ketmasin
        g.fillStyle = "#6e2f1c"; g.fillRect(px, py, TILE, TILE);
        g.fillStyle = "#b5532f";
        const bw = TILE / 2, bh = TILE / 4;
        for (let r = 0; r < 4; r++) {
          const off = r % 2 ? -bw / 2 : 0;
          for (let c = 0; c < 3; c++) g.fillRect(px + off + c * bw + 1, py + r * bh + 1, bw - 2, bh - 2);
        }
        g.restore();
      } else if (t === STEEL) {
        g.fillStyle = "#8d98a3"; g.fillRect(px, py, TILE, TILE);
        g.fillStyle = "#c9d2da"; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        g.fillStyle = "#a3aeb9"; g.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        g.fillStyle = "#eef2f5"; g.fillRect(px + 2, py + 2, TILE - 4, 2);
      }
    }
  }
}

const D = 10.5;   // tank chizmasining asosiy o'lchami (HALF ga masshtablanadi)
function drawTank(t) {
  const col = t.isPlayer ? ["#f2c12e", "#b98a0d", "#7a5a05"] : ["#c7ccd1", "#8a939b", "#525a61"];
  ctx.save();
  ctx.translate(t.x, t.y);
  if (t.spawn > 0) {
    // Paydo bo'lish effekti
    const k = 1 - t.spawn / 0.5;
    ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 4 + k * 14, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.rotate((t.dir * Math.PI) / 2);
  ctx.scale(HALF / 10.5, HALF / 10.5);
  // Zanjirlar
  ctx.fillStyle = "#1d1d1d";
  ctx.fillRect(-D, -D, 6, D * 2);
  ctx.fillRect(D - 6, -D, 6, D * 2);
  ctx.fillStyle = "#4a4a4a";
  const off = (t.tread % 5 + 5) % 5;
  for (let y = -D - 5 + off; y < D; y += 5) {
    if (y < -D) continue;
    ctx.fillRect(-D, y, 6, 1.6);
    ctx.fillRect(D - 6, y, 6, 1.6);
  }
  // Korpus
  ctx.fillStyle = col[1]; ctx.fillRect(-D + 5, -D + 2, D * 2 - 10, D * 2 - 4);
  ctx.fillStyle = col[0]; ctx.fillRect(-D + 6, -D + 3, D * 2 - 12, D * 2 - 8);
  // Stvol va minora
  ctx.fillStyle = col[2]; ctx.fillRect(-1.8, -D - 4, 3.6, D + 2);
  ctx.fillStyle = col[1];
  ctx.beginPath(); ctx.arc(0, 0.5, 5.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col[0];
  ctx.beginPath(); ctx.arc(-0.8, -0.3, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (t.shield > 0) {
    ctx.strokeStyle = `rgba(120,220,255,${0.45 + Math.sin(performance.now() / 70) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(t.x, t.y, HALF + 5, 0, Math.PI * 2); ctx.stroke();
  }
}

function draw(dt) {
  ctx.drawImage(ground, 0, 0);
  if (lives.value > 0) drawTank(player);
  for (const e of enemies) drawTank(e);

  for (const b of bullets) {
    ctx.fillStyle = b.mine ? "#fff3b0" : "#ffb199";
    ctx.shadowColor = b.mine ? "#ffd54f" : "#ff5722"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  for (const x of blasts) {
    x.t += dt;
    const k = Math.min(1, x.t / x.life);
    const g = ctx.createRadialGradient(x.x, x.y, 0, x.x, x.y, x.r * (0.4 + k));
    g.addColorStop(0, `rgba(255,255,220,${1 - k})`);
    g.addColorStop(0.45, `rgba(255,160,40,${0.9 * (1 - k)})`);
    g.addColorStop(1, "rgba(180,40,10,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x.x, x.y, x.r * (0.4 + k), 0, Math.PI * 2); ctx.fill();
  }
  blasts = blasts.filter(x => x.t < x.life);
}

function frame(ts) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - (last || ts)) / 1000);
  last = ts;
  if (props.active && lives.value > 0) update(dt);
  draw(dt);
}

// ── Boshqaruv ──
function hold(dir, on) {
  const i = held.indexOf(dir);
  if (i !== -1) held.splice(i, 1);
  if (on) held.push(dir);
}
const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };
function onKey(e) {
  const down = e.type === "keydown";
  if (e.key === " " || e.code === "Space") { e.preventDefault(); firing.value = down; return; }
  const dir = KEYS[e.key];
  if (dir == null) return;
  e.preventDefault();
  if (!down || !e.repeat) hold(dir, down);
}
function onBlur() { held.length = 0; firing.value = false; }

watch(() => props.seed, reset);

onMounted(() => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = canvasEl.value;
  c.width = SIZE * dpr; c.height = SIZE * dpr;
  ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  reset();
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("blur", onBlur);
  raf = requestAnimationFrame(frame);
});
onUnmounted(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("keyup", onKey);
  window.removeEventListener("blur", onBlur);
});
</script>

<style scoped>
.tank { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.tank-stage {
  position: relative; width: 100%; max-width: 520px; aspect-ratio: 1;
  border-radius: 16px; overflow: hidden; border: 6px solid #23231b;
  box-shadow: 0 14px 34px rgba(0, 0, 0, .35), inset 0 0 0 2px rgba(255, 255, 255, .08);
}
.tank-canvas { display: block; width: 100%; height: 100%; image-rendering: auto; }
.tank-hud {
  position: absolute; top: 8px; left: 8px; right: 8px; display: flex; justify-content: space-between; pointer-events: none;
  font-weight: 800; font-size: 14px; color: #fff; text-shadow: 0 1px 3px rgba(0, 0, 0, .8);
}
.hud-lives, .hud-kills { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; background: rgba(0, 0, 0, .45); }
.hud-heart { color: #ff5252; margin-right: 2px; }
.hud-heart.lost { color: rgba(255, 255, 255, .25); }
.tank-dead {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  background: rgba(15, 10, 5, .62); color: #fff; font-size: 19px; font-weight: 800;
}
.tank-dead-emoji { font-size: 46px; }

.tank-controls { width: 100%; max-width: 520px; display: flex; align-items: center; justify-content: space-between; padding: 0 6px; }
.tank-pad { display: grid; grid-template-columns: repeat(3, 58px); grid-template-rows: repeat(2, 54px); gap: 6px; }
.pad-btn, .fire-btn {
  display: flex; align-items: center; justify-content: center; border-radius: 16px; cursor: pointer;
  background: hsl(var(--card)); color: hsl(var(--fg)); border: 1px solid hsl(var(--border));
  box-shadow: 0 4px 0 hsl(var(--border)); touch-action: none; user-select: none; -webkit-user-select: none;
}
.pad-btn:active, .fire-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 hsl(var(--border)); }
.pad-up { grid-column: 2; grid-row: 1; }
.pad-left { grid-column: 1; grid-row: 2; }
.pad-down { grid-column: 2; grid-row: 2; }
.pad-right { grid-column: 3; grid-row: 2; }
.fire-btn {
  width: 92px; height: 92px; border-radius: 50%; border: none; color: #fff;
  background: radial-gradient(circle at 35% 30%, #ff7961, #d32f2f); box-shadow: 0 6px 0 #8e1c1c, 0 12px 22px rgba(211, 47, 47, .35);
}
.fire-btn:active { box-shadow: 0 2px 0 #8e1c1c; }
@media (hover: hover) and (pointer: fine) { .tank-controls { display: none; } }
</style>
