<template>
  <div class="room" :style="{ '--c1': game.colors[0], '--c2': game.colors[1] }">
    <!-- Hisob taxtasi -->
    <header class="room-head">
      <div class="side side--me">
        <span class="av"><img v-if="me.avatarUrl" :src="me.avatarUrl" alt="" /><template v-else>{{ initial(me.name) }}</template></span>
        <span class="side-text"><span class="side-name">Siz</span><span class="side-class">{{ me.className }}</span></span>
        <span class="side-score">{{ scores[0] }}</span>
      </div>
      <div class="mid">
        <span class="mid-emoji">{{ game.emoji }}</span>
        <span class="mid-title">{{ duel.title }}</span>
        <span v-if="duel.topic" class="mid-topic">{{ duel.topic.icon }} {{ duel.topic.name }}</span>
        <span v-else-if="isRace && running" class="mid-clock" :class="{ urgent: raceLeft <= 10 }">{{ clock(raceLeft) }}</span>
      </div>
      <div class="side side--opp">
        <span class="side-score">{{ scores[1] }}</span>
        <span class="side-text"><span class="side-name">{{ opp.name }}</span><span class="side-class">{{ opp.className }}</span></span>
        <span class="av av--opp"><img v-if="opp.avatarUrl" :src="opp.avatarUrl" alt="" /><template v-else>{{ initial(opp.name) }}</template></span>
      </div>
    </header>

    <div class="room-body">
      <QuizDuel v-if="duel.kind === 'quiz'" :duel="duel" />
      <PenaltyGame v-else-if="duel.kind === 'penalty'" :duel="duel" />
      <TicTacToe v-else-if="duel.kind === 'ttt'" :duel="duel" />
      <template v-else>
        <component :is="raceComponent" :seed="duel.state.seed" :active="running" @score="onScore" @over="onOver" />
        <p v-if="iAmDone && !finished" class="race-wait">
          Siz tugatdingiz — raqib hali o'ynayapti (uning hisobi: <strong>{{ duel.state.opp.score }}</strong>)
        </p>
      </template>

      <!-- 3, 2, 1 -->
      <Transition name="fade">
        <div v-if="countdown > 0 && !finished" class="overlay overlay--count">
          <p class="count-label">{{ game.rules }}</p>
          <span :key="countdown" class="count-num">{{ countdown }}</span>
        </div>
      </Transition>

      <!-- Natija -->
      <Transition name="fade">
        <div v-if="finished" class="overlay overlay--result">
          <div class="result" :class="outcome">
            <span class="result-emoji">{{ outcome === 'win' ? '🏆' : outcome === 'lose' ? '😔' : '🤝' }}</span>
            <p class="result-title">{{ outcome === 'win' ? "G'alaba!" : outcome === 'lose' ? "Bu safar yutqazdingiz" : "Durang" }}</p>
            <p class="result-sub">{{ reasonText }}</p>
            <div class="result-score">
              <span>{{ scores[0] }}</span><span class="result-colon">:</span><span>{{ scores[1] }}</span>
            </div>
            <p v-if="reward" class="result-reward">+{{ reward }} ball reytingga qo'shildi</p>
            <div class="result-actions">
              <button class="geo-btn-outline" @click="$emit('close')"><ArrowLeft :size="15" /> O'yinlarga</button>
              <button class="geo-btn-primary" :disabled="rematching" @click="rematch"><RotateCcw :size="15" /> Yana o'ynash</button>
            </div>
            <p v-if="rematchError" class="result-error">{{ rematchError }}</p>
          </div>
        </div>
      </Transition>
    </div>

    <button v-if="!finished" class="room-leave" @click="confirmLeave">
      <Flag :size="14" /> O'yinni tashlab chiqish
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ArrowLeft, RotateCcw, Flag } from "lucide-vue-next";
import { useDuelStore } from "../../stores/duel";
import { gameById } from "../../lib/games";
import { clock, play } from "../../lib/gameKit";
import QuizDuel from "./QuizDuel.vue";
import PenaltyGame from "./PenaltyGame.vue";
import TicTacToe from "./TicTacToe.vue";
import SnakeGame from "./SnakeGame.vue";
import TankGame from "./TankGame.vue";
import MemoryGame from "./MemoryGame.vue";

// 1v1 o'yin xonasi: hisob taxtasi, sanoq, o'yinning o'zi va natija.
const props = defineProps({ duel: { type: Object, required: true } });
defineEmits(["close"]);
const store = useDuelStore();

const RACE = { snake: SnakeGame, tank: TankGame, memory: MemoryGame };
const REPORT_MS = 700;     // ochko serverga shundan tez-tez yuborilmaydi

const tick = ref(0);
const rematching = ref(false);
const rematchError = ref("");
let timer = null;
let lastCount = 0;

const game = computed(() => gameById(props.duel.game));
const me = computed(() => props.duel.players[props.duel.me]);
const opp = computed(() => props.duel.players[props.duel.me === 0 ? 1 : 0]);
const finished = computed(() => props.duel.status === "finished");
const isRace = computed(() => props.duel.kind === "race");
const raceComponent = computed(() => RACE[props.duel.game]);
const initial = name => (name || "?").charAt(0).toUpperCase();

const countdown = computed(() => {
  tick.value;
  return Math.max(0, Math.ceil((props.duel.startsAt - store.now()) / 1000));
});

/** [mening hisobim, raqibniki] — o'yin turiga qarab. */
const scores = computed(() => {
  const s = props.duel.state, i = props.duel.me, o = i === 0 ? 1 : 0;
  if (!s) return [0, 0];
  if (props.duel.kind === "penalty") return [s.score[i], s.score[o]];
  if (props.duel.kind === "ttt") return [s.wins[i], s.wins[o]];
  return [Math.max(s.me.score, localScore.value), s.opp.score];
});

const outcome = computed(() => {
  const w = props.duel.result?.winnerId;
  if (w == null) return "draw";
  return w === me.value.userId ? "win" : "lose";
});
const reward = computed(() => props.duel.result?.rewards?.[me.value.userId] ?? 0);
const reasonText = computed(() => {
  const r = props.duel.result?.reason;
  if (r === "left") return outcome.value === "win" ? `${opp.value.name} o'yinni tashlab chiqdi` : "Siz o'yinni tashlab chiqdingiz";
  if (r === "absent") return outcome.value === "win" ? `${opp.value.name} bilan aloqa uzildi` : outcome.value === "lose" ? "Aloqa uzilib qoldi" : "Ikkala o'yinchi ham chiqib ketdi";
  return `${me.value.name} — ${opp.value.name}`;
});

// ── Race o'yinlari (ilon, tank, xotira): ochkoni serverga yetkazish ──
const localScore = ref(0);
const localDone = ref(false);
let lastSent = 0, sendTimer = null, doneSent = false;

const raceLeft = computed(() => {
  tick.value;
  return isRace.value ? Math.max(0, (props.duel.state.endsAt - store.now()) / 1000) : 0;
});
const iAmDone = computed(() => localDone.value || props.duel.state?.me?.done);
const running = computed(() => {
  tick.value;
  return isRace.value && !finished.value && !iAmDone.value && countdown.value === 0 && raceLeft.value > 0;
});

function send(done = false) {
  clearTimeout(sendTimer);
  lastSent = Date.now();
  if (done) doneSent = true;
  store.move({ score: localScore.value, done }).catch(() => { if (done) doneSent = false; });
}
function onScore(n) {
  localScore.value = n;
  if (doneSent) return;
  const wait = REPORT_MS - (Date.now() - lastSent);
  if (wait <= 0) send();
  else { clearTimeout(sendTimer); sendTimer = setTimeout(() => send(), wait); }
}
function onOver() {
  localDone.value = true;
  send(true);
}

function confirmLeave() {
  if (window.confirm("O'yinni tashlab chiqsangiz, raqibingiz g'olib bo'ladi. Chiqasizmi?")) store.leave();
}

async function rematch() {
  rematching.value = true;
  rematchError.value = "";
  try {
    await store.invite({ opponentId: opp.value.userId, game: props.duel.game, topicId: props.duel.topic?.id });
  } catch (e) {
    rematchError.value = e.message || "Taklif yuborilmadi";
  }
  rematching.value = false;
}

onMounted(() => {
  timer = setInterval(() => {
    tick.value++;
    if (countdown.value !== lastCount) {
      if (countdown.value > 0 && countdown.value <= 3) play("tick");
      lastCount = countdown.value;
    }
    // Vaqt tugadi — yakuniy ochkoni yuboramiz
    if (isRace.value && !finished.value && !doneSent && countdown.value === 0 && raceLeft.value <= 0) onOver();
    // Server qayta ulanishda "tugatdim"ni yo'qotgan bo'lsa — qaytadan yuboramiz
    if (isRace.value && !finished.value && localDone.value && !doneSent) send(true);
  }, 200);
});
onUnmounted(() => { clearInterval(timer); clearTimeout(sendTimer); });
</script>

<style scoped>
.room { display: flex; flex-direction: column; gap: 16px; }
.room-head {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px;
  padding: 14px 18px; border-radius: 22px; color: #fff;
  background:
    radial-gradient(circle at 50% -40%, rgba(255, 255, 255, .25), transparent 60%),
    linear-gradient(135deg, var(--c1), var(--c2));
  box-shadow: 0 14px 34px rgba(0, 0, 0, .22);
}
.side { display: flex; align-items: center; gap: 10px; min-width: 0; }
.side--opp { justify-content: flex-end; text-align: right; }
.av {
  flex: none; width: 44px; height: 44px; border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 17px;
  background: rgba(255, 255, 255, .95); color: var(--c2); border: 3px solid rgba(255, 255, 255, .55);
}
.av img { width: 100%; height: 100%; object-fit: cover; }
.av--opp { background: rgba(0, 0, 0, .35); color: #fff; }
.side-text { display: flex; flex-direction: column; min-width: 0; }
.side-name { font-size: 14px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.side-class { font-size: 11px; opacity: .8; }
.side-score { font-size: 34px; font-weight: 900; line-height: 1; min-width: 38px; text-align: center; font-variant-numeric: tabular-nums; text-shadow: 0 2px 8px rgba(0, 0, 0, .3); }
.mid { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 0 6px; }
.mid-emoji { font-size: 26px; line-height: 1; }
.mid-title { font-size: 12px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; white-space: nowrap; }
.mid-topic { font-size: 11px; opacity: .85; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mid-clock { font-size: 17px; font-weight: 900; font-variant-numeric: tabular-nums; padding: 0 10px; border-radius: 99px; background: rgba(0, 0, 0, .3); }
.mid-clock.urgent { background: #d32f2f; animation: pulse .6s infinite alternate; }
@keyframes pulse { to { transform: scale(1.08); } }

.room-body { position: relative; min-height: 300px; }
.race-wait { margin-top: 14px; text-align: center; font-size: 14px; color: hsl(var(--muted-fg)); }

.overlay {
  position: absolute; inset: -6px; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 22px; background: hsl(var(--bg) / .86); backdrop-filter: blur(5px);
}
.count-label { max-width: 420px; padding: 0 20px; text-align: center; font-size: 14px; color: hsl(var(--muted-fg)); }
.count-num { margin-top: 10px; font-size: 110px; font-weight: 900; line-height: 1; color: hsl(var(--primary)); animation: count-pop .9s ease-out; }
@keyframes count-pop { 0% { transform: scale(2.2); opacity: 0; } 30% { transform: scale(1); opacity: 1; } 100% { transform: scale(.85); opacity: .5; } }

.result {
  width: min(400px, 92%); padding: 28px 24px; text-align: center; border-radius: 26px;
  background: hsl(var(--card)); border: 1px solid hsl(var(--border)); box-shadow: 0 24px 60px rgba(0, 0, 0, .25);
}
.result-emoji { font-size: 64px; line-height: 1; display: inline-block; animation: result-in .6s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes result-in { from { transform: scale(0) rotate(-30deg); } }
.result-title { margin-top: 8px; font-size: 26px; font-weight: 900; }
.result.win .result-title { color: hsl(38 90% 45%); }
.result.lose .result-title { color: hsl(var(--muted-fg)); }
.result-sub { margin-top: 2px; font-size: 13px; color: hsl(var(--muted-fg)); }
.result-score { margin: 14px 0 6px; display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 44px; font-weight: 900; font-variant-numeric: tabular-nums; }
.result-colon { opacity: .35; }
.result-reward { display: inline-block; padding: 3px 14px; border-radius: 99px; font-size: 13px; font-weight: 800; background: hsl(38 90% 48% / .16); color: hsl(38 80% 34%); }
.result-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
.result-actions button { justify-content: center; }
.result-error { margin-top: 10px; font-size: 13px; color: hsl(var(--destructive)); }

.room-leave {
  align-self: center; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 99px;
  border: none; background: none; color: hsl(var(--muted-fg)); font-size: 13px; cursor: pointer;
}
.room-leave:hover { color: hsl(var(--destructive)); background: hsl(var(--destructive) / .08); }
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 560px) {
  .room-head { padding: 12px; gap: 6px; }
  .av { width: 34px; height: 34px; font-size: 14px; }
  .side-score { font-size: 26px; min-width: 28px; }
  .side-class, .mid-topic { display: none; }
  .mid-title { font-size: 10px; }
}
</style>
