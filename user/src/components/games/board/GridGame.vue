<template>
  <div class="gg">
    <div class="gg-status" :class="{ mine: canMove }">
      <template v-if="finished">O'yin tugadi</template>
      <template v-else-if="!started">Tayyorlaning...</template>
      <template v-else-if="myTurn"><strong>Sizning navbatingiz</strong> — {{ state.gravity ? "ustunni tanlang" : "katakni tanlang" }}</template>
      <template v-else>Raqib o'ylayapti...</template>
    </div>

    <div class="gg-board" :class="[state.gravity ? 'drop' : 'flat', { locked: !canMove }]"
      :style="{ '--cols': state.cols, '--rows': state.rows }">
      <button v-for="(v, i) in state.board" :key="i" class="gg-cell"
        :class="{ win: state.line?.includes(i), last: state.last === i, free: canMove && (state.gravity ? columnFree(i) : v == null) }"
        :disabled="!canMove || (state.gravity ? !columnFree(i) : v != null)" @click="place(i)">
        <span v-if="v != null" class="gg-stone" :class="v === duel.me ? 'me' : 'opp'"></span>
      </button>
    </div>

    <div v-if="started && !finished" class="gg-timer">
      <div class="gg-timer-fill" :class="{ urgent: leftPct < 30 }" :style="{ width: leftPct + '%' }"></div>
    </div>
    <p class="gg-legend">
      <span class="gg-dot me"></span> Siz
      <span class="gg-dot opp"></span> {{ duel.players[duel.me === 0 ? 1 : 0].name }}
      · {{ state.k }} tasini bir qatorga tering
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useDuelStore } from "../../../stores/duel";
import { play } from "../../../lib/gameKit";

// Katakli taxta o'yinlari: "To'rt qator" (tosh ustunning pastiga tushadi) va "Besh qator".
const props = defineProps({ duel: { type: Object, required: true } });
const store = useDuelStore();
const TURN_MS = 25000;

const tick = ref(0);
let timer = null;
let sending = false;

const state = computed(() => props.duel.state);
const finished = computed(() => props.duel.status === "finished");
const started = computed(() => { tick.value; return store.now() >= props.duel.startsAt; });
const myTurn = computed(() => state.value.turnIdx === props.duel.me);
const canMove = computed(() => started.value && !finished.value && myTurn.value);
const leftPct = computed(() => {
  tick.value;
  return Math.max(0, Math.min(100, ((state.value.turnEndsAt - store.now()) / TURN_MS) * 100));
});
/** Ustunda hali bo'sh joy bormi? (eng yuqori katagi bo'sh bo'lsa — bor) */
const columnFree = i => state.value.board[i % state.value.cols] == null;

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
.gg { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.gg-status { font-size: 16px; min-height: 26px; text-align: center; color: hsl(var(--muted-fg)); }
.gg-status.mine { color: hsl(var(--fg)); }
.gg-board {
  width: 100%; display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: 5px; padding: 12px; border-radius: 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, .3);
}
.gg-board.drop { max-width: 520px; background: linear-gradient(160deg, #1e5bd8, #123a94); gap: 7px; }
.gg-board.flat { max-width: 500px; background: linear-gradient(160deg, #d7a45a, #b07a35); gap: 3px; }
.gg-cell { aspect-ratio: 1; min-width: 0; padding: 0; border: none; display: flex; align-items: center; justify-content: center; }
.drop .gg-cell { border-radius: 50%; background: #0c2766; box-shadow: inset 0 3px 6px rgba(0, 0, 0, .5); }
.flat .gg-cell { border-radius: 4px; background: rgba(255, 255, 255, .16); }
.gg-cell.free { cursor: pointer; }
.drop .gg-cell.free:hover { background: #173a8f; }
.flat .gg-cell.free:hover { background: rgba(255, 255, 255, .42); }
.gg-stone { width: 86%; height: 86%; border-radius: 50%; animation: gg-in .22s ease-out; }
.gg-stone.me { background: radial-gradient(circle at 35% 30%, #ff8a80, #d32f2f); }
.gg-stone.opp { background: radial-gradient(circle at 35% 30%, #fff59d, #f9a825); }
.flat .gg-stone.me { background: radial-gradient(circle at 35% 30%, #616161, #111); }
.flat .gg-stone.opp { background: radial-gradient(circle at 35% 30%, #fff, #cfd8dc); }
.drop .gg-stone { animation-name: gg-drop; }
@keyframes gg-in { from { transform: scale(.3); opacity: 0; } }
@keyframes gg-drop { from { transform: translateY(-260%); } }
.gg-cell.last .gg-stone { box-shadow: 0 0 0 3px rgba(255, 255, 255, .75); }
.gg-cell.win .gg-stone { box-shadow: 0 0 0 4px #69f0ae, 0 0 16px #69f0ae; }
.gg-timer { width: 100%; max-width: 500px; height: 6px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
.gg-timer-fill { height: 100%; background: hsl(var(--primary)); transition: width .2s linear; }
.gg-timer-fill.urgent { background: hsl(var(--destructive)); }
.gg-legend { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center; font-size: 13px; color: hsl(var(--muted-fg)); }
.gg-dot { width: 13px; height: 13px; border-radius: 50%; margin-left: 6px; }
.gg-dot.me { background: #d32f2f; }
.gg-dot.opp { background: #f9a825; }
</style>
