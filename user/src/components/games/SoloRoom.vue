<template>
  <div class="solo" :style="{ '--c1': game.colors[0], '--c2': game.colors[1] }">
    <header class="solo-head">
      <button class="solo-back" @click="$emit('close')"><ArrowLeft :size="16" /> O'yinlar</button>
      <span class="solo-title"><component :is="game.icon" :size="18" /> {{ game.title }} <span class="solo-tag">mashq</span></span>
      <span class="solo-stats">
        <span class="solo-score">{{ score }}</span>
        <span class="solo-clock" :class="{ urgent: left <= 10 && running }">{{ clock(left) }}</span>
      </span>
    </header>

    <div class="solo-body">
      <component :is="arcade.component" v-bind="arcade.props" :key="round" :seed="seed" :active="running" @score="score = $event" @over="finish" />

      <Transition name="fade">
        <div v-if="countdown > 0" class="overlay">
          <p class="overlay-rules">{{ game.rules }}</p>
          <span :key="countdown" class="overlay-num">{{ countdown }}</span>
        </div>
        <div v-else-if="over" class="overlay">
          <div class="solo-result">
            <span class="solo-result-icon"><Target :size="38" /></span>
            <p class="solo-result-title">Natija: {{ score }}</p>
            <p class="solo-result-sub">Eng yaxshi natijangiz: {{ best }}</p>
            <div class="solo-result-actions">
              <button class="geo-btn-outline" @click="$emit('close')"><ArrowLeft :size="15" /> Orqaga</button>
              <button class="geo-btn-primary" @click="restart"><RotateCcw :size="15" /> Yana</button>
            </div>
            <button class="solo-invite" @click="$emit('invite')"><Swords :size="14" /> Do'stni shu o'yinga chaqirish</button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ArrowLeft, RotateCcw, Swords, Target } from "lucide-vue-next";
import { gameById } from "../../lib/games";
import { clock, play } from "../../lib/gameKit";
import { ARCADE, DURATION } from "../../lib/arcade";

// Yolg'iz mashq: do'st kerak emas, natija faqat shu qurilmada saqlanadi.
const props = defineProps({ gameId: { type: String, required: true } });
defineEmits(["close", "invite"]);

const COUNT_MS = 3000;

const game = computed(() => gameById(props.gameId));
const arcade = computed(() => ARCADE[props.gameId]);
const bestKey = computed(() => `geo_best_${props.gameId}`);

const round = ref(0);
const seed = ref(1);
const score = ref(0);
const over = ref(false);
const best = ref(0);
const now = ref(Date.now());
let startAt = 0;
let timer = null;
let lastCount = 0;

const countdown = computed(() => Math.max(0, Math.ceil((startAt - now.value) / 1000)));
const left = computed(() => Math.max(0, (DURATION[props.gameId] ?? 60) - Math.max(0, now.value - startAt) / 1000));
const running = computed(() => !over.value && countdown.value === 0 && left.value > 0);

function restart() {
  seed.value = Math.floor(Math.random() * 2 ** 31) + 1;
  round.value++;
  score.value = 0;
  over.value = false;
  startAt = Date.now() + COUNT_MS;
  now.value = Date.now();
}
function finish() {
  if (over.value) return;
  over.value = true;
  if (score.value > best.value) {
    best.value = score.value;
    try { localStorage.setItem(bestKey.value, String(best.value)); } catch {}
    play("win");
  }
}

onMounted(() => {
  try { best.value = Number(localStorage.getItem(bestKey.value)) || 0; } catch {}
  restart();
  timer = setInterval(() => {
    now.value = Date.now();
    if (countdown.value !== lastCount) {
      if (countdown.value > 0) play("tick");
      lastCount = countdown.value;
    }
    if (!over.value && countdown.value === 0 && left.value <= 0) finish();
  }, 200);
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.solo { display: flex; flex-direction: column; gap: 16px; }
.solo-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-radius: 20px; color: #fff;
  background: linear-gradient(135deg, var(--c1), var(--c2)); box-shadow: 0 12px 30px rgba(0, 0, 0, .2);
}
.solo-back { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 12px; border: none; cursor: pointer; background: rgba(0, 0, 0, .25); color: #fff; font-size: 13px; font-weight: 700; }
.solo-title { display: inline-flex; align-items: center; gap: 7px; min-width: 0; font-size: 15px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.solo-tag { margin-left: 4px; padding: 1px 8px; border-radius: 99px; background: rgba(255, 255, 255, .22); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
.solo-stats { display: flex; align-items: center; gap: 8px; }
.solo-score { font-size: 24px; font-weight: 900; font-variant-numeric: tabular-nums; }
.solo-clock { padding: 2px 10px; border-radius: 99px; background: rgba(0, 0, 0, .3); font-weight: 800; font-variant-numeric: tabular-nums; }
.solo-clock.urgent { background: #d32f2f; }
.solo-body { position: relative; min-height: 300px; }
.overlay {
  position: absolute; inset: -6px; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 22px; background: hsl(var(--bg) / .86); backdrop-filter: blur(5px);
}
.overlay-rules { max-width: 420px; padding: 0 20px; text-align: center; font-size: 14px; color: hsl(var(--muted-fg)); }
.overlay-num { margin-top: 10px; font-size: 110px; font-weight: 900; line-height: 1; color: hsl(var(--primary)); animation: pop .9s ease-out; }
@keyframes pop { 0% { transform: scale(2.2); opacity: 0; } 30% { transform: scale(1); opacity: 1; } 100% { transform: scale(.85); opacity: .5; } }
.solo-result { width: min(380px, 92%); padding: 26px 22px; text-align: center; border-radius: 24px; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); box-shadow: 0 24px 60px rgba(0, 0, 0, .25); }
.solo-result-icon { width: 72px; height: 72px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: hsl(var(--primary-light)); color: hsl(var(--primary)); }
.solo-result-title { margin-top: 6px; font-size: 26px; font-weight: 900; }
.solo-result-sub { font-size: 14px; color: hsl(var(--muted-fg)); }
.solo-result-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
.solo-result-actions button { justify-content: center; }
.solo-invite { margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; border: none; background: none; cursor: pointer; font-size: 13px; font-weight: 700; color: hsl(var(--primary)); }
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 520px) { .solo-back span, .solo-tag { display: none; } }
</style>
