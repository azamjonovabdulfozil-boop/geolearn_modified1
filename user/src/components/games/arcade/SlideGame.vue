<template>
  <div class="arcade">
    <div class="arcade-panel board" :class="{ locked: !active }">
      <button v-for="(n, i) in tiles" :key="i" class="tile" :class="{ blank: n === 0, home: n !== 0 && n === i + 1, movable: canSlide(i) }"
        :disabled="n === 0" @pointerdown.prevent="slide(i)">{{ n || "" }}</button>
    </div>
    <div class="arcade-info">
      <span>Yechilgan: <strong>{{ solved }}</strong></span>
      <span>Yurishlar: <strong>{{ moves }}</strong></span>
    </div>
    <p class="arcade-hint">Bo'sh katak yonidagi raqamni bosing. Raqamlarni 1 dan 8 gacha tartibga keltiring.</p>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { makeRng, play } from "../../../lib/gameKit";
import "./arcade.css";

// Sirpanchiq boshqotirma (3x3): raqamlarni surib tartibga keltirish. Har yechilgan jadval — 100 ochko.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const N = 3;
const tiles = ref([]);
const solved = ref(0);
const moves = ref(0);
let rng, score;

const neighbors = i => {
  const x = i % N, y = Math.floor(i / N), out = [];
  if (x > 0) out.push(i - 1);
  if (x < N - 1) out.push(i + 1);
  if (y > 0) out.push(i - N);
  if (y < N - 1) out.push(i + N);
  return out;
};
const blankAt = () => tiles.value.indexOf(0);
const canSlide = i => tiles.value[i] !== 0 && neighbors(i).includes(blankAt());
const isSolved = () => tiles.value.every((n, i) => n === (i + 1) % (N * N));

/** Yechilgan holatdan tasodifiy yurishlar bilan aralashtiramiz — har doim yechimi bor. */
function deal() {
  const t = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  let blank = 8, prev = -1;
  const steps = 14 + solved.value * 6;
  for (let s = 0; s < steps; s++) {
    const opts = neighbors(blank).filter(i => i !== prev);
    const pick = opts[Math.floor(rng() * opts.length)];
    [t[blank], t[pick]] = [t[pick], t[blank]];
    prev = blank; blank = pick;
  }
  tiles.value = t;
  if (isSolved()) deal();
}
function reset() {
  rng = makeRng(props.seed);
  score = 0; solved.value = 0; moves.value = 0;
  deal();
}
function slide(i) {
  if (!props.active || !canSlide(i)) return;
  const b = blankAt();
  const t = [...tiles.value];
  [t[b], t[i]] = [t[i], t[b]];
  tiles.value = t;
  moves.value++;
  play("click");
  if (isSolved()) {
    solved.value++; score += 100; emit("score", score); play("good");
    setTimeout(deal, 350);
  }
}

watch(() => props.seed, reset, { immediate: true });
</script>

<style scoped>
.board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 400px; background: linear-gradient(160deg, #37474f, #263238); border: none; }
.tile {
  aspect-ratio: 1; border: none; border-radius: 14px; font-size: clamp(30px, 10vw, 48px); font-weight: 900; touch-action: none;
  color: #fff; background: linear-gradient(160deg, #26a69a, #00796b); box-shadow: 0 5px 0 #004d40; transition: transform .1s, filter .1s;
}
.tile.home { background: linear-gradient(160deg, #66bb6a, #2e7d32); box-shadow: 0 5px 0 #1b5e20; }
.tile.movable { cursor: pointer; filter: brightness(1.12); }
.tile.movable:active { transform: translateY(4px); box-shadow: 0 1px 0 #004d40; }
.tile.blank { background: rgba(0, 0, 0, .25); box-shadow: none; }
</style>
