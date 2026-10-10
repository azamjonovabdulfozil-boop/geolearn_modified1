<template>
  <div class="rps">
    <div class="rps-arena">
      <div class="rps-side">
        <span class="rps-hand" :class="[handClass(0), { shake: waitingReveal }]">
          <component :is="handIcon(myShown)" :size="64" />
        </span>
        <span class="rps-name">Siz</span>
      </div>
      <span class="rps-vs">{{ centerText }}</span>
      <div class="rps-side">
        <span class="rps-hand opp" :class="[handClass(1), { shake: waitingReveal }]">
          <component :is="handIcon(oppShown)" :size="64" />
        </span>
        <span class="rps-name">{{ opp.name }}</span>
      </div>
    </div>

    <div class="rps-status">
      <template v-if="finished">O'yin tugadi</template>
      <template v-else-if="!started">Tayyorlaning...</template>
      <template v-else-if="state.phase === 'reveal'">{{ revealText }}</template>
      <template v-else-if="state.myPick != null">Tanlandi — raqib o'ylayapti...</template>
      <template v-else><strong>Tanlang:</strong> tosh, qog'oz yoki qaychi</template>
    </div>

    <div class="rps-picks">
      <button v-for="(p, i) in PICKS" :key="i" class="rps-pick" :class="{ chosen: state.myPick === i }" :disabled="!canPick" @click="pick(i)">
        <component :is="p.icon" :size="34" />
        <span>{{ p.label }}</span>
        <small>{{ p.beats }}</small>
      </button>
    </div>

    <div v-if="started && state.phase === 'choose' && !finished" class="rps-timer">
      <div class="rps-timer-fill" :class="{ urgent: leftPct < 30 }" :style="{ width: leftPct + '%' }"></div>
    </div>
    <p class="rps-round">{{ state.round }}-raund · {{ state.target }} ta g'alabagacha</p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Gem, FileText, Scissors, CircleHelp } from "lucide-vue-next";
import { useDuelStore } from "../../../stores/duel";
import { play } from "../../../lib/gameKit";

// Tosh-qaychi-qog'oz: ikkala o'yinchi yashirin tanlaydi, keyin natija ochiladi.
const props = defineProps({ duel: { type: Object, required: true } });
const store = useDuelStore();
const CHOOSE_MS = 8000;
const PICKS = [
  { label: "Tosh", icon: Gem, beats: "qaychini yengadi" },
  { label: "Qog'oz", icon: FileText, beats: "toshni yengadi" },
  { label: "Qaychi", icon: Scissors, beats: "qog'ozni yengadi" },
];

const tick = ref(0);
let timer = null;
let sending = false;

const state = computed(() => props.duel.state);
const me = computed(() => props.duel.me);
const opp = computed(() => props.duel.players[me.value === 0 ? 1 : 0]);
const finished = computed(() => props.duel.status === "finished");
const started = computed(() => { tick.value; return store.now() >= props.duel.startsAt; });
const canPick = computed(() => started.value && !finished.value && state.value.phase === "choose" && state.value.myPick == null);
const waitingReveal = computed(() => state.value.phase === "choose" && state.value.myPick != null && !finished.value);
const leftPct = computed(() => {
  tick.value;
  return Math.max(0, Math.min(100, ((state.value.phaseEndsAt - store.now()) / CHOOSE_MS) * 100));
});

const last = computed(() => state.value.last);
const myShown = computed(() => (last.value ? last.value.picks[me.value] : state.value.myPick));
const oppShown = computed(() => (last.value ? last.value.picks[me.value === 0 ? 1 : 0] : null));
const handIcon = p => (p == null ? CircleHelp : PICKS[p].icon);
/** Raund natijasiga qarab qo'l rangi: yutgan / yutqazgan. `side`: 0 — men, 1 — raqib. */
function handClass(side) {
  const l = last.value;
  if (!l || l.winner == null) return null;
  const mine = l.winner === me.value;
  return (side === 0 ? mine : !mine) ? "won" : "lost";
}
const revealText = computed(() => {
  const l = last.value;
  if (!l) return "";
  if (l.winner == null) return "Durang — ikkalangiz bir xil tanladingiz";
  return l.winner === me.value ? "Bu raund sizniki!" : "Bu raundni raqib oldi";
});
const centerText = computed(() => `${state.value.wins[me.value]} : ${state.value.wins[me.value === 0 ? 1 : 0]}`);

async function pick(i) {
  if (sending || !canPick.value) return;
  sending = true;
  play("click");
  try { await store.move({ pick: i }); } catch {}
  sending = false;
}

watch(() => last.value?.round, (r) => {
  if (r == null || !last.value) return;
  play(last.value.winner == null ? "tick" : last.value.winner === me.value ? "good" : "bad");
});

onMounted(() => { timer = setInterval(() => { tick.value++; }, 200); });
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.rps { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.rps-arena {
  width: 100%; max-width: 520px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding: 24px 16px; border-radius: 22px;
  background: linear-gradient(160deg, #263238, #102027); color: #fff; box-shadow: 0 16px 40px rgba(0, 0, 0, .3);
}
.rps-side { display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 0; }
.rps-hand {
  width: clamp(92px, 26vw, 128px); aspect-ratio: 1; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, #26c6da, #00838f); border: 4px solid rgba(255, 255, 255, .25); transition: background .2s, transform .2s;
}
.rps-hand.opp { background: linear-gradient(160deg, #ffb74d, #ef6c00); }
.rps-hand.won { transform: scale(1.1); box-shadow: 0 0 0 5px #69f0ae, 0 0 26px rgba(105, 240, 174, .7); }
.rps-hand.lost { filter: grayscale(.8) brightness(.7); transform: scale(.92); }
.rps-hand.shake { animation: rps-shake .5s ease-in-out infinite; }
@keyframes rps-shake { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.rps-name { max-width: 100%; font-size: 13px; font-weight: 700; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rps-vs { font-size: clamp(26px, 8vw, 40px); font-weight: 900; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rps-status { font-size: 16px; min-height: 26px; text-align: center; }
.rps-picks { width: 100%; max-width: 520px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.rps-pick {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 6px; border-radius: 18px; cursor: pointer;
  border: 2px solid hsl(var(--border)); background: hsl(var(--card)); color: hsl(var(--fg)); font-size: 16px; font-weight: 800; transition: transform .1s, border-color .12s;
}
.rps-pick small { font-size: 11px; font-weight: 500; color: hsl(var(--muted-fg)); }
.rps-pick:not(:disabled):hover { border-color: hsl(var(--primary)); transform: translateY(-3px); }
.rps-pick:disabled { cursor: default; opacity: .55; }
.rps-pick.chosen { opacity: 1; border-color: hsl(var(--primary)); background: hsl(var(--primary-light)); }
.rps-timer { width: 100%; max-width: 520px; height: 6px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
.rps-timer-fill { height: 100%; background: hsl(var(--primary)); transition: width .2s linear; }
.rps-timer-fill.urgent { background: hsl(var(--destructive)); }
.rps-round { font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: hsl(var(--muted-fg)); }
</style>
