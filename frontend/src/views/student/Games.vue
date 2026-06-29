<template>
  <div class="fade-in">

    <!-- Join mode -->
    <template v-if="mode === 'join'">
      <div class="page-header">
        <h1 class="geo-page-title">O'yinlarga qo'shilish</h1>
        <p class="geo-page-sub">O'qituvchi beradigan kodni kiriting</p>
      </div>

      <div class="join-card geo-card">
        <div class="join-icon"><Gamepad2 :size="32" style="color:hsl(var(--primary))" /></div>
        <p class="join-title">O'yin kodini kiriting</p>
        <input v-model="gameCode" class="geo-input code-input" placeholder="MASALAN: 3E641B"
          maxlength="6" @input="e => gameCode = e.target.value.toUpperCase()" />
        <button @click="joinGame" :disabled="gameCode.length < 4 || joining" class="geo-btn-primary join-btn">
          <Loader2 v-if="joining" :size="15" class="animate-spin" />
          <LogIn v-else :size="15" />
          {{ joining ? "Qo'shilmoqda..." : "O'yinga qo'shilish" }}
        </button>
        <p v-if="joinError" class="join-error">{{ joinError }}</p>
      </div>
    </template>

    <!-- Waiting -->
    <template v-else-if="mode === 'waiting'">
      <div class="page-header">
        <h1 class="geo-page-title">{{ activeGame?.title }}</h1>
        <p class="geo-page-sub">
          <span v-if="activeGame?.topicIcon">{{ activeGame.topicIcon }}</span>
          {{ activeGame?.topicName }} · O'qituvchi o'yinni boshlaguncha kuting
        </p>
      </div>
      <div class="waiting-card geo-card">
        <div class="waiting-anim">
          <div class="w-ring"></div>
          <Gamepad2 :size="28" style="color:hsl(var(--primary))" />
        </div>
        <p class="waiting-title">O'qituvchini kutyapmiz...</p>
        <div v-if="waitingPlayers.length" class="players-box">
          <p class="players-label">Qo'shilganlar ({{ waitingPlayers.length }}):</p>
          <div class="players-chips">
            <span v-for="p in waitingPlayers" :key="p.userId" class="player-chip">
              <span class="pc-av">{{ p.name?.charAt(0) }}</span>{{ p.name }}
            </span>
          </div>
        </div>
        <button @click="leaveGame" class="geo-btn-outline"><X :size="14" /> Bekor qilish</button>
      </div>
    </template>

    <!-- Active quiz -->
    <template v-else-if="mode === 'active-quiz'">
      <div class="game-header">
        <div class="game-score-chip"><Star :size="13" />{{ gameScore }} ball</div>
        <div class="game-progress">
          <span class="gp-label">{{ currentQuizIdx + 1 }} / {{ activeGame?.questions?.length }}</span>
          <div class="gp-bar"><div class="gp-fill" :style="`width:${((currentQuizIdx+1)/activeGame?.questions?.length)*100}%`"></div></div>
        </div>
        <div class="timer-chip" :class="{ urgent: quizTime <= 5 }"><Clock :size="13" />{{ quizTime }}s</div>
      </div>

      <div class="question-card geo-card">
        <div v-if="currentQ?.imageUrl" class="q-image-wrap">
          <img :src="currentQ.imageUrl" :alt="currentQ.questionText" class="q-image" />
        </div>
        <p class="question-text">{{ currentQ?.questionText }}</p>
      </div>

      <!-- Flag-grid layout (when question shows flag thumbnails per option) -->
      <div v-if="currentQ?.layout === 'flag-grid'" class="flag-grid">
        <button v-for="(opt, i) in currentQ?.options" :key="i"
          @click="answerQuiz(i)" :disabled="quizAnswered"
          class="flag-btn"
          :class="{
            'flag-selected': quizSelected === i,
            'flag-correct': quizAnswered && i === currentQ?.correctIndex,
            'flag-wrong': quizAnswered && quizSelected === i && i !== currentQ?.correctIndex,
          }">
          <img :src="currentQ.optionImages?.[i]" :alt="opt" />
          <span>{{ opt }}</span>
        </button>
      </div>

      <!-- Standard 4-option text answers -->
      <div v-else class="answers-grid">
        <button v-for="(opt, i) in currentQ?.options" :key="i"
          @click="answerQuiz(i)" :disabled="quizAnswered"
          class="answer-btn"
          :class="{
            'answer-selected': quizSelected === i,
            'answer-correct': quizAnswered && i === currentQ?.correctIndex,
            'answer-wrong': quizAnswered && quizSelected === i && i !== currentQ?.correctIndex,
          }">
          <div class="ans-letter">{{ ['A','B','C','D'][i] }}</div>
          <span>{{ opt }}</span>
        </button>
      </div>

      <div v-if="quizAnswered" class="next-row">
        <button @click="nextQuiz" class="geo-btn-primary">
          {{ currentQuizIdx < (activeGame?.questions?.length ?? 0) - 1 ? 'Keyingi →' : "Natija" }}
        </button>
      </div>
    </template>

    <!-- Active bosh_qotirma -->
    <template v-else-if="mode === 'active-bt'">
      <div class="game-header">
        <div class="game-score-chip"><Star :size="13" />{{ gameScore }} ball</div>
        <div class="game-progress">
          <span class="gp-label">{{ currentBtIdx + 1 }} / {{ activeGame?.questions?.length }}</span>
          <div class="gp-bar"><div class="gp-fill" :style="`width:${((currentBtIdx+1)/activeGame?.questions?.length)*100}%`"></div></div>
        </div>
        <div class="timer-chip" :class="{ urgent: btTime <= 5 }"><Clock :size="13" />{{ btTime }}s</div>
      </div>

      <div class="bt-question geo-card">
        <div class="bt-topic">
          <span v-if="activeGame?.topicIcon">{{ activeGame.topicIcon }}</span>
          {{ activeGame?.topicName }}
        </div>
        <div v-if="currentBT?.imageUrl" class="bt-image-wrap">
          <img :src="currentBT.imageUrl" :alt="currentBT.questionText" class="bt-image" />
        </div>
        <p class="bt-text">{{ currentBT?.questionText }}</p>
      </div>

      <div class="bt-btns">
        <button @click="answerBt(true)" class="bt-btn bt-true"
          :class="{ 'bt-selected': btSelected === true, 'bt-disabled': btAnswered && btSelected !== true,
                    'bt-correct': btAnswered && currentBT?.isTrue === true,
                    'bt-wrong-bg': btAnswered && btSelected === true && currentBT?.isTrue !== true }"
          :disabled="btAnswered">
          <CheckCircle :size="26" /><span>To'g'ri</span>
        </button>
        <button @click="answerBt(false)" class="bt-btn bt-false"
          :class="{ 'bt-selected': btSelected === false, 'bt-disabled': btAnswered && btSelected !== false,
                    'bt-correct': btAnswered && currentBT?.isTrue === false,
                    'bt-wrong-bg': btAnswered && btSelected === false && currentBT?.isTrue !== false }"
          :disabled="btAnswered">
          <XCircle :size="26" /><span>Noto'g'ri</span>
        </button>
      </div>

      <div v-if="btAnswered && currentBT?.explanation" class="bt-explain geo-card">
        <strong>Tushuntirish:</strong> {{ currentBT.explanation }}
      </div>

      <div v-if="btAnswered" class="next-row">
        <button @click="nextBt" class="geo-btn-primary">
          {{ currentBtIdx < (activeGame?.questions?.length ?? 0) - 1 ? 'Keyingi →' : "Natija" }}
        </button>
      </div>
    </template>

    <!-- Result -->
    <template v-else-if="mode === 'result'">
      <div class="result-card geo-card">
        <div class="result-icon" :class="resultPct >= 60 ? 'result-ok' : 'result-bad'">
          <component :is="resultPct >= 60 ? CheckCircle : XCircle" :size="36" />
        </div>
        <p class="result-title">{{ resultPct >= 60 ? 'Barakalla! 🎉' : "Yana harakat qiling" }}</p>
        <div class="result-stats">
          <div class="result-stat"><span class="rs-val" style="color:hsl(var(--primary))">{{ gameScore }}</span><span class="rs-lbl">ball</span></div>
          <div class="rs-div"></div>
          <div class="result-stat"><span class="rs-val">{{ Math.round(resultPct) }}%</span><span class="rs-lbl">natija</span></div>
        </div>
        <div class="result-actions">
          <button @click="goJoin" class="geo-btn-outline"><Gamepad2 :size="14" /> Yangi o'yin</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from "vue";
import { Gamepad2, LogIn, Clock, CheckCircle, XCircle, Star, X, Loader2 } from "lucide-vue-next";
import { api } from "@/composables/api";

const mode = ref("join");
const gameCode = ref("");
const joining = ref(false);
const joinError = ref("");
const activeGame = ref(null);
const waitingPlayers = ref([]);
let pollTimer = null;

const currentQuizIdx = ref(0);
const quizSelected = ref(null);
const quizAnswered = ref(false);
const quizTime = ref(20);
const gameScore = ref(0);
let quizTimerInt = null;

const currentBtIdx = ref(0);
const btSelected = ref(null);
const btAnswered = ref(false);
const btTime = ref(15);
let btTimerInt = null;

const resultPct = ref(0);

const currentQ = computed(() => activeGame.value?.questions?.[currentQuizIdx.value]);
const currentBT = computed(() => activeGame.value?.questions?.[currentBtIdx.value]);

async function joinGame() {
  joining.value = true; joinError.value = "";
  try {
    const g = await api(`/api/games/${gameCode.value}/join`, { method: "POST" });
    activeGame.value = g;
    if (g.status === "active") {
      if (g.gameType === "bosh_qotirma") { mode.value = "active-bt"; startBt(); }
      else { mode.value = "active-quiz"; startQuizTimer(); }
    } else { mode.value = "waiting"; startPolling(); }
  } catch (e) { joinError.value = e.message || "Kod noto'g'ri"; }
  joining.value = false;
}
function leaveGame() { clearInterval(pollTimer); mode.value = "join"; activeGame.value = null; gameCode.value = ""; }
function startPolling() {
  pollTimer = setInterval(async () => {
    try {
      const g = await api(`/api/games/${gameCode.value}`);
      if (g.status === "active") {
        clearInterval(pollTimer);
        activeGame.value = g;
        if (g.gameType === "bosh_qotirma") { startBt(); mode.value = "active-bt"; }
        else { startQuizTimer(); mode.value = "active-quiz"; }
      }
      waitingPlayers.value = g.players ?? [];
    } catch {}
  }, 2000);
}

function startQuizTimer() {
  quizTime.value = 20;
  clearInterval(quizTimerInt);
  quizTimerInt = setInterval(() => {
    quizTime.value--;
    if (quizTime.value <= 0) { clearInterval(quizTimerInt); if (!quizAnswered.value) answerQuiz(-1); }
  }, 1000);
}
function answerQuiz(idx) {
  clearInterval(quizTimerInt);
  quizSelected.value = idx;
  quizAnswered.value = true;
  if (idx === currentQ.value?.correctIndex) gameScore.value += 10;
  try { api(`/api/games/${gameCode.value}/answer`, { method: "POST", body: JSON.stringify({ answer: idx }) }); } catch {}
}
function nextQuiz() {
  if (currentQuizIdx.value < (activeGame.value?.questions?.length ?? 0) - 1) {
    currentQuizIdx.value++; quizSelected.value = null; quizAnswered.value = false; startQuizTimer();
  } else {
    resultPct.value = (gameScore.value / ((activeGame.value?.questions?.length ?? 1) * 10)) * 100;
    mode.value = "result";
  }
}
function startBt() {
  btTime.value = 15; clearInterval(btTimerInt);
  btTimerInt = setInterval(() => {
    btTime.value--;
    if (btTime.value <= 0) { clearInterval(btTimerInt); if (!btAnswered.value) answerBt(null); }
  }, 1000);
}
function answerBt(val) {
  clearInterval(btTimerInt);
  btSelected.value = val;
  btAnswered.value = true;
  if (val === currentBT.value?.isTrue) gameScore.value += 10;
  try { api(`/api/games/${gameCode.value}/answer`, { method: "POST", body: JSON.stringify({ answer: val }) }); } catch {}
}
function nextBt() {
  if (currentBtIdx.value < (activeGame.value?.questions?.length ?? 0) - 1) {
    currentBtIdx.value++; btSelected.value = null; btAnswered.value = false; startBt();
  } else {
    resultPct.value = (gameScore.value / ((activeGame.value?.questions?.length ?? 1) * 10)) * 100;
    mode.value = "result";
  }
}
function goJoin() {
  mode.value = "join"; gameCode.value = ""; gameScore.value = 0;
  currentQuizIdx.value = 0; quizSelected.value = null; quizAnswered.value = false;
  currentBtIdx.value = 0; btSelected.value = null; btAnswered.value = false;
}

onUnmounted(() => { clearInterval(pollTimer); clearInterval(quizTimerInt); clearInterval(btTimerInt); });
</script>

<style scoped>
.page-header { margin-bottom: 24px; }

/* Join */
.join-card { padding:36px 28px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;max-width:420px;margin:0 auto; }
.join-icon { width:72px;height:72px;border-radius:20px;background:hsl(var(--primary)/0.1);display:flex;align-items:center;justify-content:center; }
.join-title { font-size:17px;font-weight:700; }
.code-input { text-align:center;font-size:22px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;max-width:260px;font-family:'JetBrains Mono','Menlo',monospace; }
.join-btn { padding:.6rem 2rem; }
.join-error { font-size:13px;color:hsl(0 60% 46%);background:hsl(0 70% 50%/0.08);padding:8px 16px;border-radius:10px; }

/* Waiting */
.waiting-card { padding:36px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px; }
.waiting-anim { position:relative;width:64px;height:64px;display:flex;align-items:center;justify-content:center; }
.w-ring { position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:hsl(var(--primary));animation:spin 1s linear infinite; }
.waiting-title { font-size:15px;font-weight:600; }
.players-box { width:100%;background:hsl(var(--muted));border-radius:14px;padding:14px 16px;text-align:left; }
.players-label { font-size:12.5px;font-weight:700;margin-bottom:10px;color:hsl(var(--muted-fg)); }
.players-chips { display:flex;flex-wrap:wrap;gap:6px; }
.player-chip { display:flex;align-items:center;gap:6px;font-size:12.5px;padding:4px 10px;border-radius:99px;background:hsl(var(--card)); }
.pc-av { width:20px;height:20px;border-radius:50%;background:hsl(var(--primary));color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center; }

/* Game header */
.game-header { display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap; }
.game-score-chip { display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:700;padding:6px 14px;border-radius:99px;background:hsl(45 90% 50%/0.12);color:hsl(38 70% 30%); }
.game-progress { flex:1;display:flex;align-items:center;gap:10px;min-width:140px; }
.gp-label { font-size:12px;font-weight:700;color:hsl(var(--muted-fg));white-space:nowrap; }
.gp-bar { flex:1;height:8px;background:hsl(var(--border));border-radius:99px;overflow:hidden; }
.gp-fill { height:100%;background:linear-gradient(90deg, hsl(var(--primary)), hsl(172 70% 38%));border-radius:99px;transition:width .4s; }
.timer-chip { display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;padding:5px 12px;border-radius:99px;background:hsl(var(--muted));transition:all .3s; }
.urgent { background:hsl(0 70% 50%/0.12);color:hsl(0 60% 46%);animation:pulse 1s infinite; }

/* Quiz */
.question-card { padding:24px;margin-bottom:14px;text-align:center; }
.q-image-wrap { display:flex;justify-content:center;margin-bottom:18px; }
.q-image { max-width:280px; width:100%; aspect-ratio:3/2; object-fit:contain; border-radius:12px; box-shadow:0 8px 24px -8px rgba(0,0,0,.25); background:#fff; padding:6px; }
.question-text { font-size:17px;font-weight:600;line-height:1.55; }

.answers-grid { display:grid;gap:10px;margin-bottom:16px; }
@media (min-width: 640px) { .answers-grid { grid-template-columns:1fr 1fr; } }
.answer-btn { display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;border:2px solid hsl(var(--border));background:hsl(var(--card));text-align:left;cursor:pointer;font-family:inherit;transition:all .15s;color:hsl(var(--fg));font-size:14px;font-weight:500; }
.answer-btn:hover:not(:disabled) { border-color:hsl(var(--primary)/.5);background:hsl(var(--primary)/0.04); }
.answer-selected { border-color:hsl(var(--primary));background:hsl(var(--primary)/0.07); }
.answer-correct { border-color:hsl(142 60% 36%);background:hsl(142 60% 36%/0.09); }
.answer-wrong { border-color:hsl(0 70% 50%);background:hsl(0 70% 50%/0.08); }
.ans-letter { width:30px;height:30px;border-radius:8px;background:hsl(var(--muted));font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s; }
.answer-selected .ans-letter { background:hsl(var(--primary));color:white; }
.answer-correct .ans-letter { background:hsl(142 60% 36%);color:white; }
.answer-wrong .ans-letter { background:hsl(0 70% 50%);color:white; }

/* Flag-grid quiz */
.flag-grid { display:grid; gap:12px; margin-bottom:16px; grid-template-columns:1fr 1fr; }
.flag-btn { display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px;border-radius:14px;border:2px solid hsl(var(--border));background:hsl(var(--card));cursor:pointer;font-family:inherit;transition:all .15s; }
.flag-btn img { width:100%; max-width:160px; aspect-ratio:3/2; object-fit:cover; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,.18); }
.flag-btn span { font-size:13px;font-weight:600; }
.flag-btn:hover:not(:disabled) { border-color:hsl(var(--primary)/.5); transform:translateY(-2px); }
.flag-selected { border-color:hsl(var(--primary));background:hsl(var(--primary)/0.06); }
.flag-correct { border-color:hsl(142 60% 36%);background:hsl(142 60% 36%/0.1); }
.flag-wrong { border-color:hsl(0 70% 50%);background:hsl(0 70% 50%/0.08); }

.next-row { display:flex;justify-content:flex-end; }

/* Bosh qotirma */
.bt-question { padding:32px 24px;margin-bottom:16px;text-align:center; }
.bt-image-wrap { display:flex;justify-content:center;margin-bottom:18px; }
.bt-image { max-width:280px;width:100%;aspect-ratio:3/2;object-fit:contain;border-radius:12px;box-shadow:0 8px 24px -8px rgba(0,0,0,.35);background:#fff;padding:6px; }
.bt-topic { font-size:12px;font-weight:700;color:hsl(var(--muted-fg));margin-bottom:14px;text-transform:uppercase;letter-spacing:.05em; }
.bt-text { font-size:19px;font-weight:700;line-height:1.5; }
.bt-btns { display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px; }
.bt-btn { display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 16px;border-radius:16px;border:2.5px solid transparent;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s; }
.bt-true { background:hsl(142 60% 36%/0.1);color:hsl(142 55% 26%);border-color:hsl(142 60% 36%/0.3); }
.bt-true:hover:not(:disabled) { background:hsl(142 60% 36%/0.18);border-color:hsl(142 60% 36%); }
.bt-false { background:hsl(0 70% 50%/0.08);color:hsl(0 60% 40%);border-color:hsl(0 70% 50%/0.28); }
.bt-false:hover:not(:disabled) { background:hsl(0 70% 50%/0.15);border-color:hsl(0 70% 50%); }
.bt-selected { transform:scale(1.03);box-shadow:0 6px 20px rgba(0,0,0,.1); }
.bt-disabled { opacity:.45; }
.bt-correct { box-shadow:0 0 0 3px hsl(142 60% 36% / .35); }
.bt-wrong-bg { box-shadow:0 0 0 3px hsl(0 70% 50% / .35); }
.bt-explain { padding:14px 18px;margin-bottom:14px;font-size:13.5px;line-height:1.5;background:hsl(var(--muted)); }

/* Result */
.result-card { padding:36px 28px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:20px; }
.result-icon { width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center; }
.result-ok { background:hsl(142 60% 36%/0.12);color:hsl(142 55% 32%); }
.result-bad { background:hsl(0 70% 50%/0.1);color:hsl(0 60% 46%); }
.result-title { font-size:22px;font-weight:800; }
.result-stats { display:flex;align-items:center;gap:20px;padding:16px 24px;background:hsl(var(--muted));border-radius:16px; }
.result-stat { display:flex;flex-direction:column;align-items:center;gap:3px; }
.rs-val { font-size:1.8rem;font-weight:800;line-height:1; }
.rs-lbl { font-size:12px;color:hsl(var(--muted-fg)); }
.rs-div { width:1px;height:40px;background:hsl(var(--border)); }
.result-actions { display:flex;gap:10px;flex-wrap:wrap;justify-content:center; }
</style>
