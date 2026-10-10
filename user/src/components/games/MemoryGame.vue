<template>
  <div class="memory">
    <div class="memory-grid" :class="{ locked: !active }">
      <button v-for="(card, i) in cards" :key="i" class="card"
        :class="{ open: card.open || card.done, done: card.done }"
        :disabled="!active || card.open || card.done || busy" @click="flip(i)">
        <span class="card-inner">
          <span class="card-face card-back">
            <Globe :size="30" class="card-globe" />
          </span>
          <span class="card-face card-front">
            <img v-if="!failed[card.code]" :src="`https://flagcdn.com/w160/${card.code}.png`" :alt="card.name" draggable="false" @error="failed[card.code] = true" />
            <span class="card-name" :class="{ big: failed[card.code] }">{{ card.name }}</span>
          </span>
        </span>
      </button>
    </div>
    <p class="memory-info">Topildi: <strong>{{ pairs }}</strong> / {{ PAIRS }} · Urinishlar: {{ tries }}</p>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from "vue";
import { Globe } from "lucide-vue-next";
import { makeRng, shuffle, play } from "../../lib/gameKit";

// Xotira o'yini: bir xil bayroqlar juftini topish. Kartalar joylashuvi
// `seed` dan olinadi — 1v1 da ikkala o'yinchida bir xil.
const props = defineProps({
  seed: { type: Number, default: 1 },
  active: { type: Boolean, default: false },
});
const emit = defineEmits(["score", "over"]);

const PAIRS = 8;
const FLAGS = [
  ["uz", "O'zbekiston"], ["kz", "Qozog'iston"], ["kg", "Qirg'iziston"], ["tj", "Tojikiston"], ["tm", "Turkmaniston"],
  ["tr", "Turkiya"], ["jp", "Yaponiya"], ["kr", "Koreya"], ["cn", "Xitoy"], ["in", "Hindiston"],
  ["de", "Germaniya"], ["fr", "Fransiya"], ["it", "Italiya"], ["es", "Ispaniya"], ["gb", "Britaniya"],
  ["us", "AQSH"], ["ca", "Kanada"], ["br", "Braziliya"], ["ar", "Argentina"], ["mx", "Meksika"],
  ["eg", "Misr"], ["za", "JAR"], ["au", "Avstraliya"], ["sa", "Saudiya"], ["se", "Shvetsiya"], ["ch", "Shveysariya"],
];

const cards = ref([]);
const pairs = ref(0);
const tries = ref(0);
const busy = ref(false);
const failed = reactive({});      // bayroq rasmi yuklanmagan davlatlar — nomi katta yoziladi
let first = null;

function reset() {
  const rng = makeRng(props.seed);
  const picked = shuffle(FLAGS, rng).slice(0, PAIRS);
  cards.value = shuffle([...picked, ...picked], rng).map(([code, name]) => ({ code, name, open: false, done: false }));
  pairs.value = 0; tries.value = 0; busy.value = false; first = null;
}

function flip(i) {
  const card = cards.value[i];
  if (!props.active || busy.value || card.open || card.done) return;
  card.open = true;
  play("flip");
  if (first == null) { first = i; return; }

  tries.value++;
  const a = cards.value[first];
  first = null;
  if (a.code === card.code) {
    a.done = card.done = true;
    pairs.value++;
    play("eat");
    emit("score", pairs.value);
    if (pairs.value === PAIRS) emit("over");
    return;
  }
  busy.value = true;
  setTimeout(() => { a.open = card.open = false; busy.value = false; }, 750);
}

watch(() => props.seed, reset, { immediate: true });
</script>

<style scoped>
.memory { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.memory-grid {
  width: 100%; max-width: 520px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  padding: 14px; border-radius: 20px;
  background: linear-gradient(145deg, #12407c, #0a2548); box-shadow: 0 14px 34px rgba(0, 0, 0, .3);
}
.memory-grid.locked { filter: saturate(.7); }
.card { aspect-ratio: 3 / 4; border: none; background: none; padding: 0; cursor: pointer; perspective: 700px; }
.card:disabled { cursor: default; }
.card-inner { position: relative; display: block; width: 100%; height: 100%; transition: transform .38s cubic-bezier(.4, 1.3, .5, 1); transform-style: preserve-3d; }
.card.open .card-inner { transform: rotateY(180deg); }
.card-face {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  border-radius: 12px; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden;
}
.card-back {
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, .07) 0 8px, transparent 8px 16px),
    linear-gradient(145deg, #2f8df0, #1456b0);
  border: 2px solid rgba(255, 255, 255, .35); box-shadow: 0 4px 0 rgba(0, 0, 0, .25);
}
.card:not(:disabled):hover .card-back { filter: brightness(1.12); }
.card-globe { color: rgba(255, 255, 255, .9); filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .35)); }
.card-front { transform: rotateY(180deg); background: #fff; border: 2px solid #dfe6ee; padding: 6px; }
.card-front img { width: 82%; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 6px; box-shadow: 0 1px 4px rgba(0, 0, 0, .25); }
.card-name { font-size: clamp(9px, 2.3vw, 12px); font-weight: 700; color: #1c2b3a; text-align: center; line-height: 1.1; }
.card-name.big { font-size: clamp(11px, 3vw, 16px); font-weight: 800; }
.card.done .card-front { border-color: #43a047; box-shadow: 0 0 0 3px rgba(67, 160, 71, .35); animation: card-pop .35s; }
@keyframes card-pop { 50% { transform: rotateY(180deg) scale(1.08); } }
.memory-info { font-size: 14px; color: hsl(var(--muted-fg)); }
</style>
