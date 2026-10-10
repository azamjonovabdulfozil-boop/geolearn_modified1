<template>
  <div class="qd">
    <!-- Men tugatdim, raqib hali javob beryapti -->
    <div v-if="state.me.done && !feedback" class="qd-wait geo-card">
      <div class="qd-wait-icon"><Hourglass :size="44" /></div>
      <p class="qd-wait-title">Siz savollarni tugatdingiz!</p>
      <p class="qd-wait-sub">Sizning ballingiz: <strong>{{ state.me.score }}</strong> · to'g'ri javoblar: {{ state.me.correct }} / {{ state.total }}</p>
      <p class="qd-wait-sub">Raqib {{ Math.min(state.opp.idx + 1, state.total) }}-savolda...</p>
    </div>

    <template v-else-if="question">
      <div class="qd-top">
        <span class="qd-count">{{ shownIdx + 1 }} / {{ state.total }}</span>
        <div class="qd-bar"><div class="qd-bar-fill" :class="{ urgent: leftSec <= 5 }" :style="{ width: leftPct + '%' }"></div></div>
        <span class="qd-time" :class="{ urgent: leftSec <= 5 }">{{ leftSec }}s</span>
      </div>

      <div class="qd-question geo-card">
        <div v-if="question.imageUrl" class="qd-img-wrap">
          <img :src="question.imageUrl" :alt="question.questionText" class="qd-img" />
        </div>
        <p class="qd-text">{{ question.questionText }}</p>
      </div>

      <!-- To'g'ri / Noto'g'ri -->
      <div v-if="isBt" class="qd-tf">
        <button v-for="opt in TF" :key="String(opt.value)" class="qd-tf-btn" :class="[opt.cls, markTf(opt.value)]"
          :disabled="locked" @click="answer(opt.value)">
          <component :is="opt.icon" :size="26" /><span>{{ opt.label }}</span>
        </button>
      </div>

      <!-- Bayroqli variantlar -->
      <div v-else-if="question.layout === 'flag-grid'" class="qd-flags">
        <button v-for="(opt, i) in question.options" :key="i" class="qd-flag" :class="mark(i)" :disabled="locked" @click="answer(i)">
          <img :src="question.optionImages?.[i]" :alt="opt" /><span>{{ opt }}</span>
        </button>
      </div>

      <!-- Oddiy 4 variant -->
      <div v-else class="qd-options">
        <button v-for="(opt, i) in question.options" :key="i" class="qd-opt" :class="mark(i)" :disabled="locked" @click="answer(i)">
          <span class="qd-letter">{{ "ABCD"[i] }}</span><span>{{ opt }}</span>
        </button>
      </div>

      <div v-if="feedback" class="qd-feedback" :class="feedback.correct ? 'ok' : 'no'">
        <template v-if="feedback.correct">To'g'ri! <strong>+{{ feedback.points }}</strong> ball</template>
        <template v-else>{{ picked === null ? "Vaqt tugadi" : "Noto'g'ri" }}</template>
        <span v-if="feedback.explanation" class="qd-explain">{{ feedback.explanation }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { CheckCircle, XCircle, Hourglass } from "lucide-vue-next";
import { useDuelStore } from "../../stores/duel";
import { play } from "../../lib/gameKit";

// Bilimlar jangi / Bosh qotirma: ikkala o'yinchiga bir xil savollar.
// To'g'ri javobni faqat server biladi — javob yuborilgach natija qaytadi.
const props = defineProps({ duel: { type: Object, required: true } });
const store = useDuelStore();

const FEEDBACK_MS = 1400;
const TF = [
  { value: true, label: "To'g'ri", cls: "yes", icon: CheckCircle },
  { value: false, label: "Noto'g'ri", cls: "nope", icon: XCircle },
];

const tick = ref(0);
const question = ref(null);     // ekrandagi savol (natija ko'rsatilayotganda eski savol turadi)
const shownIdx = ref(0);
const picked = ref(undefined);  // undefined — hali javob berilmagan, null — vaqt tugadi
const feedback = ref(null);
let startedAt = 0;
let timer = null;
let feedbackTimer = null;

const state = computed(() => props.duel.state);
const isBt = computed(() => state.value.type === "bosh_qotirma");
const locked = computed(() => picked.value !== undefined || props.duel.status !== "active" || store.now() < props.duel.startsAt);

const leftSec = computed(() => {
  tick.value;
  if (picked.value !== undefined) return 0;
  const left = state.value.perQuestionSec - (store.now() - startedAt) / 1000;
  return Math.max(0, Math.min(state.value.perQuestionSec, Math.ceil(left)));
});
const leftPct = computed(() => {
  tick.value;
  if (picked.value !== undefined) return 0;
  const left = state.value.perQuestionSec * 1000 - (store.now() - startedAt);
  return Math.max(0, Math.min(100, (left / (state.value.perQuestionSec * 1000)) * 100));
});

/** Serverdagi navbatdagi savolni ekranga chiqaradi. */
function showCurrent() {
  feedback.value = null;
  picked.value = undefined;
  question.value = state.value.question;
  shownIdx.value = state.value.me.idx;
  startedAt = state.value.qStartedAt;
}

async function answer(value) {
  if (picked.value !== undefined) return;
  picked.value = value;
  let reply = null;
  try { reply = await store.move({ answer: value }); } catch {}
  feedback.value = reply ?? { correct: false, points: 0 };
  play(feedback.value.correct ? "good" : "bad");
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(showCurrent, FEEDBACK_MS);
}

function mark(i) {
  if (!feedback.value) return { chosen: picked.value === i };
  return { right: i === feedback.value.correctIndex, wrong: picked.value === i && i !== feedback.value.correctIndex, dim: true };
}
function markTf(v) {
  if (!feedback.value) return { chosen: picked.value === v };
  return { right: v === feedback.value.isTrue, wrong: picked.value === v && v !== feedback.value.isTrue, dim: true };
}

// Server savolni o'tkazib yuborgan bo'lsa (masalan sahifa osilib qolgan) — yetib olamiz
watch(() => state.value.me.idx, (idx) => {
  if (picked.value === undefined && idx !== shownIdx.value) showCurrent();
});

onMounted(() => {
  showCurrent();
  timer = setInterval(() => {
    tick.value++;
    // Vaqt tugadi — javobsiz yuboramiz
    if (question.value && picked.value === undefined && props.duel.status === "active"
      && store.now() - startedAt >= state.value.perQuestionSec * 1000) answer(null);
  }, 200);
});
onUnmounted(() => { clearInterval(timer); clearTimeout(feedbackTimer); });
</script>

<style scoped>
.qd { width: 100%; max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.qd-top { display: flex; align-items: center; gap: 12px; }
.qd-count { font-size: 13px; font-weight: 800; color: hsl(var(--muted-fg)); white-space: nowrap; }
.qd-bar { flex: 1; height: 8px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
.qd-bar-fill { height: 100%; border-radius: 99px; background: hsl(var(--primary)); transition: width .2s linear; }
.qd-bar-fill.urgent { background: hsl(var(--destructive)); }
.qd-time { min-width: 34px; text-align: right; font-size: 14px; font-weight: 800; }
.qd-time.urgent { color: hsl(var(--destructive)); }

.qd-question { padding: 22px; text-align: center; }
.qd-img-wrap { display: flex; justify-content: center; margin-bottom: 14px; }
.qd-img { max-height: 150px; max-width: 100%; border-radius: 10px; box-shadow: 0 4px 14px rgba(0, 0, 0, .18); }
.qd-text { font-size: 18px; font-weight: 700; line-height: 1.45; }

.qd-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.qd-opt, .qd-flag, .qd-tf-btn {
  border: 2px solid hsl(var(--border)); background: hsl(var(--card)); color: hsl(var(--card-fg));
  border-radius: 16px; cursor: pointer; font-size: 15px; font-weight: 600; transition: transform .12s, border-color .15s, background .15s, opacity .15s;
}
.qd-opt { display: flex; align-items: center; gap: 12px; padding: 14px 16px; text-align: left; }
.qd-opt:not(:disabled):hover, .qd-flag:not(:disabled):hover { border-color: hsl(var(--primary)); transform: translateY(-2px); }
.qd-letter {
  flex: none; width: 30px; height: 30px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  background: hsl(var(--muted)); font-size: 13px; font-weight: 800;
}
.qd-flags { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.qd-flag { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; }
.qd-flag img { height: 64px; max-width: 100%; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, .2); }
.qd-tf { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.qd-tf-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 12px; font-size: 16px; font-weight: 800; }
.qd-tf-btn.yes { color: hsl(142 60% 34%); }
.qd-tf-btn.nope { color: hsl(var(--destructive)); }
.qd-tf-btn:not(:disabled):hover { transform: translateY(-2px); border-color: currentColor; }

.chosen { border-color: hsl(var(--primary)); }
.dim:not(.right):not(.wrong) { opacity: .5; }
.right { border-color: hsl(142 60% 40%) !important; background: hsl(142 60% 40% / .14) !important; }
.wrong { border-color: hsl(var(--destructive)) !important; background: hsl(var(--destructive) / .12) !important; }
button:disabled { cursor: default; }

.qd-feedback { text-align: center; font-size: 16px; font-weight: 700; padding: 10px 14px; border-radius: 14px; }
.qd-feedback.ok { background: hsl(142 60% 40% / .14); color: hsl(142 60% 30%); }
.qd-feedback.no { background: hsl(var(--destructive) / .12); color: hsl(var(--destructive)); }
.qd-explain { display: block; margin-top: 4px; font-size: 13px; font-weight: 500; color: hsl(var(--fg)); }

.qd-wait { padding: 36px 20px; text-align: center; }
.qd-wait-icon { display: inline-flex; color: hsl(var(--primary)); animation: qd-spin 2.4s ease-in-out infinite; }
@keyframes qd-spin { 50% { transform: rotate(180deg); } }
.qd-wait-title { margin-top: 10px; font-size: 19px; font-weight: 800; }
.qd-wait-sub { margin-top: 6px; font-size: 14px; color: hsl(var(--muted-fg)); }
@media (max-width: 520px) { .qd-options { grid-template-columns: 1fr; } }
</style>
