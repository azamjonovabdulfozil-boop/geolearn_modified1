<template>
  <div class="arcade">
    <div class="arcade-panel typing" :class="{ locked: !active }" @click="inputEl?.focus()">
      <p class="label">Shu so'zni yozing</p>
      <p class="word">
        <span v-for="(ch, i) in word" :key="i" :class="{ ok: i < typed.length && same(typed[i], ch), bad: i < typed.length && !same(typed[i], ch) }">{{ ch }}</span>
      </p>
      <input ref="inputEl" v-model="typed" class="geo-input field" :disabled="!active" autocomplete="off" autocapitalize="off"
        autocorrect="off" spellcheck="false" placeholder="Bu yerga yozing..." @input="check" />
    </div>
    <div class="arcade-info">
      <span>So'zlar: <strong>{{ count }}</strong></span>
      <span>Katta-kichik harf farq qilmaydi</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from "vue";
import { makeRng, shuffle, play } from "../../../lib/gameKit";
import "./arcade.css";

// Tez yozish: geografiyaga oid so'zlarni xatosiz va tez terish.
const props = defineProps({ seed: { type: Number, default: 1 }, active: { type: Boolean, default: false } });
const emit = defineEmits(["score", "over"]);

const WORDS = [
  "Toshkent", "Samarqand", "Buxoro", "Xiva", "Andijon", "Namangan", "Nukus", "Termiz", "Qarshi", "Navoiy",
  "Amudaryo", "Sirdaryo", "Zarafshon", "Orol", "Qizilqum", "Chirchiq", "Chorvoq", "Aydarkul",
  "Yevrosiyo", "Afrika", "Antarktida", "Avstraliya", "Amerika", "okean", "materik", "orol", "daryo", "vulqon",
  "Everest", "Himolay", "Baykal", "Amazonka", "Nil", "Sahroi Kabir", "Kaspiy", "Alp", "Tinch okeani",
  "ekvator", "meridian", "kompas", "xarita", "iqlim", "shimol", "janub", "sharq", "poytaxt", "chegara",
];

const inputEl = ref(null);
const word = ref("");
const typed = ref("");
const count = ref(0);
let rng, queue = [], score = 0;

// Apostrof turlari va katta-kichik harf farq qilmaydi
const norm = s => s.toLocaleLowerCase().replace(/[ʻʼ’‘`]/g, "'");
const same = (a, b) => norm(a) === norm(b);

function nextWord() {
  if (!queue.length) queue = shuffle(WORDS, rng);
  word.value = queue.pop();
  typed.value = "";
}
function reset() {
  rng = makeRng(props.seed);
  queue = []; score = 0; count.value = 0;
  nextWord();
}
function check() {
  if (norm(typed.value) !== norm(word.value)) return;
  score += 8 + word.value.length; count.value++;
  emit("score", score); play("eat");
  nextWord();
}

watch(() => props.seed, reset, { immediate: true });
watch(() => props.active, (on) => { if (on) nextTick(() => inputEl.value?.focus()); });
</script>

<style scoped>
.typing { text-align: center; padding: 28px 20px; }
.label { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: hsl(var(--muted-fg)); }
.word { margin: 10px 0 18px; font-size: clamp(30px, 9vw, 46px); font-weight: 900; letter-spacing: .03em; white-space: pre-wrap; }
.word .ok { color: hsl(142 60% 38%); }
.word .bad { color: hsl(var(--destructive)); text-decoration: underline; }
.field { text-align: center; font-size: 20px; font-weight: 700; }
</style>
