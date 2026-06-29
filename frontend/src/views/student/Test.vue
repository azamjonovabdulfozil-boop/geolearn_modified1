<template>
  <div class="fade-in">
    <!-- Back header -->
    <div class="back-header">
      <RouterLink :to="lessonId ? `/student/lessons/${lessonId}/topics` : '/student/lessons'" class="back-btn">
        <ArrowLeft :size="16" />
      </RouterLink>
      <div class="flex-1">
        <h1 class="geo-page-title">{{ topicTitle }}</h1>
        <p class="geo-page-sub">{{ mode === 'closed' ? 'Yopiq test — yozma savollar' : 'Ochiq test — ABC variantli' }}</p>
      </div>
    </div>

    <!-- Closed (written) mode: just show questions list -->
    <div v-if="mode === 'closed'">
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 6" :key="i" class="geo-skeleton" style="height:60px"></div>
      </div>
      <div v-else-if="!questions.length" class="geo-card empty-card">
        <FileQuestion :size="34" style="opacity:.4;display:block;margin:0 auto 12px;color:hsl(var(--muted-fg))" />
        <p class="empty-title">Yopiq testlar yo'q</p>
      </div>
      <ol v-else class="written-list">
        <li v-for="(q, i) in questions" :key="i" class="written-item geo-card">
          <span class="written-num">{{ i + 1 }}</span>
          <p class="written-text">{{ stripNum(q.questionText || q.question) }}</p>
        </li>
      </ol>
    </div>

    <template v-else>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div class="geo-skeleton" style="height:12px;width:60%"></div>
      <div class="geo-skeleton" style="height:120px"></div>
      <div v-for="i in 4" :key="i" class="geo-skeleton" style="height:56px"></div>
    </div>

    <!-- No tests -->
    <div v-else-if="!questions.length" class="geo-card empty-card">
      <FileQuestion :size="34" style="opacity:.4;display:block;margin:0 auto 12px;color:hsl(var(--muted-fg))" />
      <p class="empty-title">Bu mavzu uchun testlar yo'q</p>
      <p class="empty-sub">O'qituvchi hali test yaratmagan</p>
    </div>

    <!-- Result -->
    <div v-else-if="finished" class="result-card geo-card">
      <div class="result-icon" :class="percentage >= 60 ? 'result-ok' : 'result-bad'">
        <component :is="percentage >= 60 ? CheckCircle : XCircle" :size="36" />
      </div>
      <p class="result-title">{{ percentage >= 60 ? 'Barakalla! 🎉' : "Qayta urinib ko'ring" }}</p>
      <div class="result-stats">
        <div class="result-stat">
          <span class="rs-val" style="color:hsl(var(--primary))">{{ correctCount }}</span>
          <span class="rs-lbl">ta to'g'ri</span>
        </div>
        <div class="rs-divider"></div>
        <div class="result-stat">
          <span class="rs-val">{{ questions.length }}</span>
          <span class="rs-lbl">jami savol</span>
        </div>
        <div class="rs-divider"></div>
        <div class="result-stat">
          <span class="rs-val" style="color:hsl(45 85%42%)">{{ Math.round(percentage) }}%</span>
          <span class="rs-lbl">natija</span>
        </div>
      </div>
      <p v-if="earnedPoints" class="earned-points">
        <Star :size="16" style="color:hsl(45 85%42%)" />
        +{{ earnedPoints }} ball qo'shildi
      </p>
      <div class="result-actions">
        <button @click="restart" class="geo-btn-outline">
          <RotateCcw :size="15" /> Qayta boshlash
        </button>
        <RouterLink :to="lessonId ? `/student/lessons/${lessonId}/topics` : '/student/lessons'"
          class="geo-btn-primary">
          <ArrowLeft :size="15" /> Darslarga qaytish
        </RouterLink>
      </div>
    </div>

    <!-- Active test -->
    <div v-else>
      <!-- Progress bar -->
      <div class="progress-row">
        <span class="progress-label">{{ currentIdx + 1 }} / {{ questions.length }}</span>
        <div class="progress-track">
          <div class="progress-fill" :style="`width:${((currentIdx + 1) / questions.length) * 100}%`"></div>
        </div>
        <div class="timer-badge" :class="timeLeft <= 5 ? 'timer-urgent' : ''">
          <Clock :size="13" />
          {{ timeLeft }}s
        </div>
      </div>

      <!-- Question card -->
      <div class="question-card geo-card">
        <p class="question-text">{{ currentQ.questionText || currentQ.question }}</p>
      </div>

      <!-- Answers -->
      <div class="answers-grid">
        <button v-for="(opt, i) in currentQ.options" :key="i"
          @click="selectAnswer(i)"
          class="answer-btn"
          :class="{
            'answer-selected': selected === i,
            'answer-correct': answered && i === currentQ.correctIndex,
            'answer-wrong': answered && selected === i && i !== currentQ.correctIndex
          }"
          :disabled="answered">
          <div class="ans-letter">{{ ['A','B','C','D'][i] }}</div>
          <span class="ans-text">{{ opt }}</span>
        </button>
      </div>

      <!-- Next button -->
      <div v-if="answered" class="next-row">
        <button @click="nextQuestion" class="geo-btn-primary next-btn">
          {{ currentIdx < questions.length - 1 ? 'Keyingi savol →' : "Natijani ko'rish" }}
        </button>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { ArrowLeft, Clock, CheckCircle, XCircle, Star, RotateCcw, FileQuestion } from "lucide-vue-next";
import { api } from "@/composables/api";

const route = useRoute();
const topicId = Number(route.params.id);
const mode = route.query.mode === "closed" ? "closed" : "open";

function stripNum(s) { return String(s || "").replace(/^\s*\d+\.\s*/, ""); }

const topicTitle = ref("Test");
const lessonId = ref(null);
const questions = ref([]);
const loading = ref(true);
const currentIdx = ref(0);
const selected = ref(null);
const answered = ref(false);
const finished = ref(false);
const correctCount = ref(0);
const earnedPoints = ref(0);
const timeLeft = ref(20);
const answers = ref([]);
let timer = null;

const currentQ = computed(() => questions.value[currentIdx.value] ?? {});
const percentage = computed(() => questions.value.length ? (correctCount.value / questions.value.length) * 100 : 0);

function startTimer() {
  timeLeft.value = 20;
  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft.value--;
    if (timeLeft.value <= 0) {
      clearInterval(timer);
      if (!answered.value) selectAnswer(-1);
    }
  }, 1000);
}

function selectAnswer(idx) {
  if (answered.value) return;
  clearInterval(timer);
  selected.value = idx;
  answers.value[currentIdx.value] = idx;
  answered.value = true;
  if (idx === currentQ.value.correctIndex) correctCount.value++;
}

async function nextQuestion() {
  if (currentIdx.value < questions.value.length - 1) {
    currentIdx.value++;
    selected.value = null;
    answered.value = false;
    startTimer();
  } else {
    finished.value = true;
    try {
      const res = await api(`/api/topics/${topicId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: answers.value,
          timeTaken: (questions.value.length * 20) - timeLeft.value,
        }),
      });
      earnedPoints.value = res?.pointsEarned ?? 0;
    } catch {}
  }
}

function restart() {
  currentIdx.value = 0;
  selected.value = null;
  answered.value = false;
  finished.value = false;
  correctCount.value = 0;
  earnedPoints.value = 0;
  answers.value = [];
  startTimer();
}

onMounted(async () => {
  try {
    const topic = await api(`/api/topics/${topicId}`);
    topicTitle.value = topic.title;
    lessonId.value = topic.lessonId ?? null;
    const tests = await api(`/api/topics/${topicId}/tests?mode=${mode}`);
    questions.value = tests.map((q, i) => ({ ...q, id: q.id ?? i + 1, questionText: q.questionText || q.question }));
  } catch {}
  loading.value = false;
  if (mode === "open" && questions.value.length) startTimer();
});

onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.back-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
.back-btn { width: 36px; height: 36px; border-radius: 10px; background: hsl(var(--card)); border: 1.5px solid hsl(var(--border)); display: flex; align-items: center; justify-content: center; color: hsl(var(--fg)); text-decoration: none; transition: background .15s; flex-shrink: 0; }
.back-btn:hover { background: hsl(var(--muted)); }
.flex-1 { flex: 1; min-width: 0; }

/* Progress */
.progress-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.progress-label { font-size: 12.5px; font-weight: 700; color: hsl(var(--muted-fg)); white-space: nowrap; }
.progress-track { flex: 1; height: 7px; background: hsl(var(--border)); border-radius: 99px; overflow: hidden; }
.progress-fill { height: 100%; background: hsl(var(--primary)); border-radius: 99px; transition: width .4s ease; }
.timer-badge { display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; padding: 4px 10px; border-radius: 99px; background: hsl(var(--muted)); white-space: nowrap; transition: background .3s, color .3s; }
.timer-urgent { background: hsl(0 70% 50%/0.1); color: hsl(0 60% 46%); animation: pulse 1s ease-in-out infinite; }

/* Question */
.question-card { padding: 24px; margin-bottom: 14px; }
.question-text { font-size: 17px; font-weight: 600; line-height: 1.55; }

/* Answers */
.answers-grid { display: grid; gap: 10px; margin-bottom: 16px; }
@media (min-width: 640px) { .answers-grid { grid-template-columns: 1fr 1fr; } }

.answer-btn {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 2px solid hsl(var(--border));
  background: hsl(var(--card));
  text-align: left;
  cursor: pointer; font-family: inherit;
  transition: all .15s;
  color: hsl(var(--fg));
}
.answer-btn:hover:not(:disabled) {
  border-color: hsl(var(--primary)/.5);
  background: hsl(var(--primary)/0.04);
}
.answer-btn:disabled { cursor: default; }
.answer-selected { border-color: hsl(var(--primary)); background: hsl(var(--primary)/0.06); }
.answer-correct { border-color: hsl(142 60% 36%); background: hsl(142 60% 36%/0.07); }
.answer-wrong { border-color: hsl(0 70% 50%); background: hsl(0 70% 50%/0.07); }

.ans-letter {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: hsl(var(--muted));
  font-size: 13px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background .15s, color .15s;
}
.answer-selected .ans-letter { background: hsl(var(--primary)); color: white; }
.answer-correct .ans-letter { background: hsl(142 60% 36%); color: white; }
.answer-wrong .ans-letter { background: hsl(0 70% 50%); color: white; }
.ans-text { font-size: 14px; font-weight: 500; }

/* Next */
.next-row { display: flex; justify-content: flex-end; }
.next-btn { padding: .65rem 1.5rem; }

/* Result */
.result-card { padding: 36px 28px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 20px; }
.result-icon { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.result-ok { background: hsl(142 60% 36%/0.12); color: hsl(142 55% 32%); }
.result-bad { background: hsl(0 70% 50%/0.1); color: hsl(0 60% 46%); }
.result-title { font-size: 22px; font-weight: 800; }
.result-stats { display: flex; align-items: center; gap: 20px; padding: 16px 24px; background: hsl(var(--muted)); border-radius: 16px; }
.result-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.rs-val { font-size: 1.8rem; font-weight: 800; line-height: 1; }
.rs-lbl { font-size: 12px; color: hsl(var(--muted-fg)); }
.rs-divider { width: 1px; height: 40px; background: hsl(var(--border)); }
.earned-points { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; padding: 8px 18px; border-radius: 99px; background: hsl(45 90% 50%/0.1); color: hsl(38 70% 30%); }
.result-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

/* Empty */
.empty-card { text-align: center; padding: 56px 24px; }
.empty-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: hsl(var(--muted-fg)); }
.space-y-3 > * + * { margin-top: 10px; }

.written-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.written-item { display: flex; gap: 14px; align-items: flex-start; padding: 16px 18px; }
.written-num {
  flex-shrink: 0;
  min-width: 32px; height: 32px; padding: 0 10px;
  border-radius: 10px;
  background: linear-gradient(135deg, hsl(38 90% 50%/.2), hsl(38 90% 50%/.08));
  color: hsl(28 80% 36%);
  font-size: 13px; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center;
}
.written-text { font-size: 14.5px; line-height: 1.6; font-weight: 500; margin: 4px 0 0; }
</style>
