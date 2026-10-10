<template>
  <div class="ttt">
    <div class="ttt-status" :class="{ mine: myTurn && state.phase === 'play' }">
      <template v-if="finished">O'yin tugadi</template>
      <template v-else-if="!started">Tayyorlaning...</template>
      <template v-else-if="state.phase === 'between'">
        {{ state.roundWinner == null ? "Durang!" : state.roundWinner === duel.me ? "Bu raund sizniki! 🎉" : "Bu raundni raqib oldi" }}
      </template>
      <template v-else-if="myTurn"><strong>Sizning navbatingiz</strong> — {{ mySign }} qo'ying</template>
      <template v-else>Raqib o'ylayapti...</template>
    </div>

    <div class="ttt-board" :class="{ locked: !canMove }">
      <button v-for="(v, i) in state.board" :key="i" class="ttt-cell"
        :class="{ win: state.line?.includes(i), free: v == null && canMove }"
        :disabled="v != null || !canMove" @click="place(i)">
        <svg v-if="v === 0" viewBox="0 0 100 100" class="ttt-x">
          <line x1="22" y1="22" x2="78" y2="78" /><line x1="78" y1="22" x2="22" y2="78" />
        </svg>
        <svg v-else-if="v === 1" viewBox="0 0 100 100" class="ttt-o"><circle cx="50" cy="50" r="30" /></svg>
        <span v-else-if="canMove" class="ttt-ghost">{{ mySign }}</span>
      </button>
    </div>

    <div v-if="started && state.phase === 'play' && !finished" class="ttt-timer">
      <div class="ttt-timer-fill" :class="{ urgent: leftPct < 30 }" :style="{ width: leftPct + '%' }"></div>
    </div>
    <p class="ttt-round">{{ state.round }}-raund · 2 ta g'alabagacha · durang: {{ state.draws }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useDuelStore } from "../../stores/duel";
import { play } from "../../lib/gameKit";

// X-O: taklif qilgan o'yinchi — X (0), qabul qilgan — O (1).
const props = defineProps({ duel: { type: Object, required: true } });
const store = useDuelStore();
const TURN_MS = 20000;

const tick = ref(0);
let timer = null;
let sending = false;

const state = computed(() => props.duel.state);
const finished = computed(() => props.duel.status === "finished");
const started = computed(() => { tick.value; return store.now() >= props.duel.startsAt; });
const myTurn = computed(() => state.value.turnIdx === props.duel.me);
const canMove = computed(() => started.value && !finished.value && state.value.phase === "play" && myTurn.value);
const mySign = computed(() => (props.duel.me === 0 ? "✕" : "◯"));
const leftPct = computed(() => {
  tick.value;
  return Math.max(0, Math.min(100, ((state.value.turnEndsAt - store.now()) / TURN_MS) * 100));
});

async function place(cell) {
  if (sending || !canMove.value) return;
  sending = true;
  play("click");
  try { await store.move({ cell }); } catch {}
  sending = false;
}

onMounted(() => { timer = setInterval(() => { tick.value++; }, 200); });
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.ttt { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.ttt-status { font-size: 16px; min-height: 26px; text-align: center; color: hsl(var(--muted-fg)); }
.ttt-status.mine { color: hsl(var(--fg)); }
.ttt-board {
  width: 100%; max-width: 380px; aspect-ratio: 1; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: 10px;
  padding: 14px; border-radius: 24px;
  background: linear-gradient(145deg, #2a1838, #170c22); box-shadow: 0 16px 40px rgba(0, 0, 0, .35);
}
.ttt-cell {
  min-width: 0; min-height: 0; display: flex; align-items: center; justify-content: center; border: none; border-radius: 16px; padding: 0;
  background: linear-gradient(145deg, #3d2552, #2c1a3d); box-shadow: inset 0 2px 0 rgba(255, 255, 255, .08), 0 4px 0 rgba(0, 0, 0, .35);
  transition: transform .12s, background .15s;
}
.ttt-cell.free { cursor: pointer; }
.ttt-cell.free:hover { background: linear-gradient(145deg, #4d3066, #38214d); }
.ttt-cell.free:active { transform: scale(.95); }
.ttt-cell.win { background: linear-gradient(145deg, #7b5a12, #4d3806); box-shadow: 0 0 22px rgba(255, 213, 79, .55); }
.ttt-cell svg { width: 74%; height: 74%; fill: none; stroke-width: 13; stroke-linecap: round; }
.ttt-x { stroke: #ff5c8a; filter: drop-shadow(0 0 7px rgba(255, 92, 138, .7)); }
.ttt-o { stroke: #4dd0e1; filter: drop-shadow(0 0 7px rgba(77, 208, 225, .7)); }
.ttt-x line { stroke-dasharray: 80; stroke-dashoffset: 80; animation: ttt-draw .22s ease-out forwards; }
.ttt-x line:last-child { animation-delay: .12s; }
.ttt-o circle { stroke-dasharray: 190; stroke-dashoffset: 190; animation: ttt-draw .32s ease-out forwards; transform: rotate(-90deg); transform-origin: 50% 50%; }
@keyframes ttt-draw { to { stroke-dashoffset: 0; } }
.ttt-ghost { font-size: 40px; font-weight: 900; color: rgba(255, 255, 255, .0); transition: color .12s; }
.ttt-cell.free:hover .ttt-ghost { color: rgba(255, 255, 255, .18); }
.ttt-timer { width: 100%; max-width: 380px; height: 6px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
.ttt-timer-fill { height: 100%; background: hsl(var(--primary)); transition: width .2s linear; }
.ttt-timer-fill.urgent { background: hsl(var(--destructive)); }
.ttt-round { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: hsl(var(--muted-fg)); }
</style>
