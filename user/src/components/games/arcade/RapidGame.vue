<template>
  <div class="arcade">
    <div class="arcade-panel rapid" :class="{ locked: !active }">
      <p class="hint">{{ def.hint }}</p>
      <p class="prompt" :class="{ big: q.big }" :style="q.color ? { color: q.color } : null">{{ q.prompt }}</p>
      <div class="options" :class="{ two: q.options.length === 2, wide: q.wide }">
        <button v-for="(opt, i) in q.options" :key="`${count}-${i}`" class="opt" :class="mark(i)" :disabled="picked !== null" @pointerdown.prevent="answer(i)">
          {{ opt }}
        </button>
      </div>
      <p class="note">{{ picked !== null && q.note ? q.note : "" }}</p>
    </div>
    <div class="arcade-info">
      <span>To'g'ri: <strong>{{ right }}</strong></span>
      <span>Xato: <strong>{{ wrong }}</strong></span>
      <span v-if="streak >= 3">Ketma-ket: <strong>{{ streak }}</strong></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from "vue";
import { makeRng, play } from "../../../lib/gameKit";
import { RAPID } from "../../../lib/rapid";
import "./arcade.css";

// Tez javob o'yinlari uchun umumiy maydon: savol + variantlar. Qaysi o'yin ekanini `mode` belgilaydi
// (tez hisob, rang va so'z, harflarni tartibla, qit'ani top ...). To'g'ri javob +10 (ketma-ket bo'lsa
// qo'shimcha), xato −5.
const props = defineProps({
  seed: { type: Number, default: 1 },
  active: { type: Boolean, default: false },
  mode: { type: String, required: true },
});
const emit = defineEmits(["score", "over"]);

const def = computed(() => RAPID[props.mode]);
const q = ref({ prompt: "", options: [] });
const picked = ref(null);
const right = ref(0);
const wrong = ref(0);
const streak = ref(0);
const count = ref(0);
let rng, score = 0, timer = null;

function next() {
  picked.value = null;
  count.value++;
  q.value = def.value.make(rng, right.value);
}
function reset() {
  clearTimeout(timer);
  rng = makeRng(props.seed);
  score = 0; right.value = 0; wrong.value = 0; streak.value = 0; count.value = 0;
  next();
}
function answer(i) {
  if (!props.active || picked.value !== null) return;
  picked.value = i;
  const ok = i === q.value.answer;
  if (ok) {
    right.value++; streak.value++;
    score += 10 + Math.min(10, Math.floor(streak.value / 3) * 2);
    play("eat");
  } else {
    wrong.value++; streak.value = 0;
    score = Math.max(0, score - 5);
    play("bad");
  }
  emit("score", score);
  // Xato javobda to'g'risini ko'rib olish uchun biroz ko'proq kutamiz
  timer = setTimeout(next, ok ? 260 : 900);
}
function mark(i) {
  if (picked.value === null) return null;
  return { right: i === q.value.answer, wrong: i === picked.value && i !== q.value.answer, dim: true };
}

watch(() => [props.seed, props.mode], reset, { immediate: true });
onUnmounted(() => clearTimeout(timer));
</script>

<style scoped>
.rapid { text-align: center; padding: 22px 18px; }
.hint { font-size: 12.5px; font-weight: 700; color: hsl(var(--muted-fg)); }
.prompt { margin: 14px 0 18px; font-size: 22px; font-weight: 800; min-height: 1.3em; }
.prompt.big { font-size: clamp(30px, 9vw, 46px); font-weight: 900; letter-spacing: .02em; line-height: 1.15; }
.options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.options.wide:not(.two) { grid-template-columns: 1fr 1fr; }
.opt {
  min-height: 62px; padding: 10px 12px; border-radius: 16px; border: 2px solid hsl(var(--border)); cursor: pointer; touch-action: none;
  background: hsl(var(--muted)); color: hsl(var(--fg)); font-size: clamp(16px, 4.6vw, 21px); font-weight: 800; transition: transform .08s, border-color .1s, background .1s;
}
.opt:not(:disabled):hover { border-color: hsl(var(--primary)); }
.opt:not(:disabled):active { transform: scale(.96); }
.opt:disabled { cursor: default; }
.opt.dim:not(.right):not(.wrong) { opacity: .45; }
.opt.right { border-color: hsl(142 60% 40%); background: hsl(142 60% 40% / .18); }
.opt.wrong { border-color: hsl(var(--destructive)); background: hsl(var(--destructive) / .15); }
.note { min-height: 20px; margin-top: 10px; font-size: 13px; color: hsl(var(--muted-fg)); }
</style>
