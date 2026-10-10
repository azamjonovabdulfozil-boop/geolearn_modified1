<template>
  <div class="arcade">
    <div class="arcade-panel whack" :class="{ locked: !active }">
      <button v-for="(h, i) in holes" :key="i" class="hole" @pointerdown.prevent="hit(i)">
        <span class="mole" :class="[h.kind, { up: h.up, bonk: h.bonk }]">
          <component :is="h.kind === 'bomb' ? Bomb : Rat" :size="34" />
        </span>
        <span class="dirt"></span>
      </button>
    </div>
    <p class="arcade-hint">Chiqqan ko'rsichqonni tez bosing (+10). Bombaga tegmang — u −15.</p>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from "vue";
import { Rat, Bomb } from "lucide-vue-next";
import { makeRng, play } from "../../../lib/gameKit";
import "./arcade.css";

// Ko'rsichqon: teshiklardan chiqib turadigan ko'rsichqonlarni urish.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const holes = ref([]);
let rng, score, timer = null, elapsed = 0;

function reset() {
  rng = makeRng(props.seed);
  holes.value = Array.from({ length: 9 }, () => ({ up: false, kind: "mole", bonk: false, until: 0 }));
  score = 0; elapsed = 0;
}
function tick() {
  if (!props.active) return;
  elapsed += 0.1;
  const now = elapsed;
  for (const h of holes.value) if (h.up && now > h.until) h.up = false;
  // Vaqt o'tgan sari tezroq va ko'proq chiqadi
  const chance = 0.14 + Math.min(0.2, elapsed * 0.004);
  if (rng() < chance) {
    const free = holes.value.filter(h => !h.up);
    if (free.length > 3) {
      const h = free[Math.floor(rng() * free.length)];
      h.kind = rng() < 0.18 ? "bomb" : "mole";
      h.up = true; h.bonk = false;
      h.until = now + Math.max(0.55, 1.15 - elapsed * 0.012);
    }
  }
}
function hit(i) {
  const h = holes.value[i];
  if (!props.active || !h.up) return;
  h.up = false; h.bonk = true;
  score = Math.max(0, score + (h.kind === "bomb" ? -15 : 10));
  emit("score", score);
  play(h.kind === "bomb" ? "boom" : "eat");
}

watch(() => props.seed, reset, { immediate: true });
timer = setInterval(tick, 100);
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.whack { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; background: linear-gradient(160deg, #7cb342, #558b2f); border: none; }
.hole { position: relative; aspect-ratio: 1; border: none; background: none; cursor: pointer; overflow: hidden; border-radius: 50%; padding: 0; touch-action: none; }
.dirt { position: absolute; left: 6%; right: 6%; bottom: 4%; height: 40%; border-radius: 50%; background: radial-gradient(ellipse at 50% 30%, #3e2723, #1b0f0b); }
.mole {
  position: absolute; left: 20%; right: 20%; bottom: 22%; aspect-ratio: 1; border-radius: 46% 46% 30% 30%;
  display: flex; align-items: center; justify-content: center; color: #fff;
  background: linear-gradient(160deg, #a1887f, #6d4c41); transform: translateY(120%); transition: transform .12s ease-out; z-index: 1;
}
.mole.bomb { background: linear-gradient(160deg, #546e7a, #263238); color: #ff8a80; border-radius: 50%; }
.mole.up { transform: translateY(0); }
.mole.bonk { transition: transform .08s; }
</style>
