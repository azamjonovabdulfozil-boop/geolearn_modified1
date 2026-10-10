<template>
  <div class="arcade">
    <div class="arcade-panel grid" :class="{ locked: !active }">
      <button v-for="(n, i) in cells" :key="`${board}-${i}`" class="cell" :class="{ done: n < next, wrong: wrong === i }"
        :disabled="n < next" @pointerdown.prevent="pick(n, i)">{{ n }}</button>
    </div>
    <div class="arcade-info">
      <span>Keyingi raqam: <strong>{{ next }}</strong></span>
      <span>Jadvallar: <strong>{{ board }}</strong></span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { makeRng, shuffle, play } from "../../../lib/gameKit";
import "./arcade.css";

// Raqamlar tartibi (Shulte jadvali): 1 dan 16 gacha raqamlarni tartib bilan topish.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const SIZE = 16;
const cells = ref([]);
const next = ref(1);
const board = ref(0);
const wrong = ref(-1);
let rng, score;

function deal() {
  cells.value = shuffle(Array.from({ length: SIZE }, (_, i) => i + 1), rng);
  next.value = 1;
}
function reset() {
  rng = makeRng(props.seed);
  score = 0; board.value = 0; wrong.value = -1;
  deal();
}
function pick(n, i) {
  if (!props.active) return;
  if (n !== next.value) {
    wrong.value = i;
    setTimeout(() => { if (wrong.value === i) wrong.value = -1; }, 250);
    score = Math.max(0, score - 3); emit("score", score); play("bad");
    return;
  }
  next.value++;
  score += 5; play("click");
  if (next.value > SIZE) { score += 30; board.value++; play("good"); deal(); }
  emit("score", score);
}

watch(() => props.seed, reset, { immediate: true });
</script>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.cell {
  aspect-ratio: 1; border-radius: 14px; border: 2px solid hsl(var(--border)); cursor: pointer; touch-action: none;
  background: hsl(var(--muted)); color: hsl(var(--fg)); font-size: clamp(20px, 6vw, 30px); font-weight: 800; transition: transform .08s, background .12s;
}
.cell:not(:disabled):active { transform: scale(.94); }
.cell.done { background: hsl(var(--primary)); border-color: hsl(var(--primary)); color: #fff; opacity: .35; cursor: default; }
.cell.wrong { background: hsl(var(--destructive) / .25); border-color: hsl(var(--destructive)); }
</style>
