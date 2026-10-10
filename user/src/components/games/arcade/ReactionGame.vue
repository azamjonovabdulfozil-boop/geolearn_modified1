<template>
  <div class="arcade">
    <button class="arcade-panel pad" :class="[phase, { locked: !active }]" @pointerdown.prevent="tap">
      <component :is="icon" :size="54" />
      <span class="pad-title">{{ title }}</span>
      <span class="pad-sub">{{ sub }}</span>
    </button>
    <div class="arcade-info">
      <span>Urinishlar: <strong>{{ rounds }}</strong></span>
      <span>Eng yaxshi: <strong>{{ best ? best + ' ms' : '—' }}</strong></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from "vue";
import { Hourglass, Zap, TriangleAlert, Timer } from "lucide-vue-next";
import { makeRng, play } from "../../../lib/gameKit";
import "./arcade.css";

// Reaksiya tezligi: maydon yashil bo'lishi bilan bosish. Qancha tez — shuncha ko'p ochko.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const phase = ref("wait");       // wait → go → result | early
const rounds = ref(0);
const best = ref(0);
const lastMs = ref(0);
let rng, score, goAt = 0, timer = null;

const icon = computed(() => ({ wait: Hourglass, go: Zap, early: TriangleAlert, result: Timer }[phase.value]));
const title = computed(() => ({ wait: "Kuting...", go: "BOSING!", early: "Shoshildingiz!", result: `${lastMs.value} ms` }[phase.value]));
const sub = computed(() => ({
  wait: "Yashil bo'lishi bilan bosing", go: "Hozir!", early: "Yashil bo'lmasdan bosdingiz: −10",
  result: lastMs.value < 280 ? "Chaqmoqdek tez!" : lastMs.value < 400 ? "Yaxshi" : "Tezroq bo'lishi mumkin",
}[phase.value]));

function arm() {
  clearTimeout(timer);
  phase.value = "wait";
  timer = setTimeout(() => { phase.value = "go"; goAt = performance.now(); }, 900 + rng() * 2400);
}
function reset() {
  rng = makeRng(props.seed);
  score = 0; rounds.value = 0; best.value = 0;
  clearTimeout(timer);
  phase.value = "wait";
  if (props.active) arm();
}
function tap() {
  if (!props.active) return;
  if (phase.value === "wait") {
    clearTimeout(timer);
    phase.value = "early";
    score = Math.max(0, score - 10); emit("score", score); play("bad");
    timer = setTimeout(arm, 900);
  } else if (phase.value === "go") {
    const ms = Math.round(performance.now() - goAt);
    lastMs.value = ms; rounds.value++;
    if (!best.value || ms < best.value) best.value = ms;
    // 200 ms va undan tez — 40 ochko, 600 ms dan sekin — 5 ochko
    score += Math.max(5, Math.min(40, Math.round(40 - (ms - 200) / 11.5)));
    emit("score", score); play("good");
    phase.value = "result";
    timer = setTimeout(arm, 800);
  }
}

watch(() => props.seed, reset, { immediate: true });
watch(() => props.active, (on) => { if (on) arm(); else clearTimeout(timer); });
onUnmounted(() => clearTimeout(timer));
</script>

<style scoped>
.pad {
  height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
  border: none; color: #fff; touch-action: none; user-select: none; transition: background .08s;
}
.pad.wait { background: linear-gradient(160deg, #e53935, #b71c1c); }
.pad.go { background: linear-gradient(160deg, #43a047, #1b5e20); }
.pad.early { background: linear-gradient(160deg, #fb8c00, #e65100); }
.pad.result { background: linear-gradient(160deg, #1e88e5, #0d47a1); }
.pad-title { font-size: 38px; font-weight: 900; line-height: 1.1; }
.pad-sub { font-size: 15px; opacity: .9; }
</style>
