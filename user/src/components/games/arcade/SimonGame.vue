<template>
  <div class="arcade">
    <div class="arcade-panel simon" :class="{ locked: !active || showing }">
      <button v-for="i in 4" :key="i" class="pad" :class="[`p${i}`, { lit: lit === i - 1 }]" @pointerdown.prevent="press(i - 1)"></button>
      <div class="center">
        <span class="center-num">{{ level }}</span>
        <span class="center-lbl">{{ showing ? "Eslab qoling" : "Takrorlang" }}</span>
      </div>
    </div>
    <div class="arcade-info">
      <span>Bosqich: <strong>{{ level }}</strong></span>
      <span>Xatolar: <strong>{{ mistakes }} / 3</strong></span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from "vue";
import { makeRng, play } from "../../../lib/gameKit";
import "./arcade.css";

// Ketma-ketlikni esla: yongan ranglar tartibini takrorlash. Har bosqichda bitta rang qo'shiladi.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const lit = ref(-1);
const showing = ref(true);
const level = ref(1);
const mistakes = ref(0);
let rng, seq = [], pos = 0, score = 0, timers = [];

const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
const clear = () => { timers.forEach(clearTimeout); timers = []; };

function flash(i, ms = 320) {
  lit.value = i;
  later(() => { if (lit.value === i) lit.value = -1; }, ms);
}
function show() {
  clear();
  showing.value = true; pos = 0;
  const step = Math.max(330, 620 - seq.length * 22);
  seq.forEach((c, n) => later(() => { flash(c, step * 0.6); play("tick"); }, 500 + n * step));
  later(() => { showing.value = false; }, 500 + seq.length * step);
}
function reset() {
  clear();
  rng = makeRng(props.seed);
  seq = [Math.floor(rng() * 4), Math.floor(rng() * 4)];
  score = 0; level.value = 1; mistakes.value = 0; lit.value = -1; showing.value = true;
  if (props.active) show();
}
function press(i) {
  if (!props.active || showing.value) return;
  flash(i, 180);
  if (seq[pos] !== i) {
    play("bad");
    mistakes.value++;
    if (mistakes.value >= 3) { emit("over"); showing.value = true; return; }
    // Xato — shu ketma-ketlik qaytadan ko'rsatiladi
    later(show, 500);
    showing.value = true;
    return;
  }
  play("click");
  pos++;
  if (pos === seq.length) {
    score += seq.length * 5; emit("score", score);
    level.value++;
    seq.push(Math.floor(rng() * 4));
    showing.value = true;
    later(() => { play("good"); show(); }, 350);
  }
}

watch(() => props.seed, reset, { immediate: true });
watch(() => props.active, (on) => { if (on) show(); else clear(); });
onUnmounted(clear);
</script>

<style scoped>
.simon {
  position: relative; aspect-ratio: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-radius: 50%; padding: 22px;
  background: #1c2331; border: none;
}
.simon.locked { opacity: 1; }
.pad { border: none; cursor: pointer; opacity: .42; transition: opacity .08s, transform .08s; touch-action: none; }
.pad.lit { opacity: 1; transform: scale(1.03); filter: brightness(1.25) drop-shadow(0 0 18px currentColor); }
.p1 { background: #43a047; color: #43a047; border-radius: 100% 12px 12px 12px; }
.p2 { background: #e53935; color: #e53935; border-radius: 12px 100% 12px 12px; }
.p3 { background: #fdd835; color: #fdd835; border-radius: 12px 12px 12px 100%; }
.p4 { background: #1e88e5; color: #1e88e5; border-radius: 12px 12px 100% 12px; }
.center {
  position: absolute; left: 50%; top: 50%; width: 34%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1c2331; color: #fff; pointer-events: none;
  box-shadow: 0 0 0 6px #1c2331;
}
.center-num { font-size: clamp(26px, 8vw, 44px); font-weight: 900; line-height: 1; }
.center-lbl { font-size: clamp(9px, 2.4vw, 12px); opacity: .75; text-transform: uppercase; letter-spacing: .05em; }
</style>
