// Yuklangan darslik (PDF) mavzularidan o'yin savollari.
// Viktorina — mavzu matnidan yasalgan 4 variantli savollar;
// Bosh qotirma — o'sha savol + bitta javob: "to'g'rimi yoki yo'q?".
import { getLessonById, getTopicsByLesson, getTopicById } from "./db.js";
import { buildQuestionPool } from "./testGen.js";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const validQuiz = (q) =>
  Array.isArray(q?.options) && q.options.length >= 2 &&
  Number.isInteger(q.correctIndex) && q.options[q.correctIndex] != null &&
  String(q.questionText || q.question || "").trim();

/** Bitta mavzudan variantli savollar: matndan yasalgan + oldin saqlangan testlar. */
function topicPool(topic) {
  const content = String(topic.content || "").trim();
  const fromText = content.length >= 60 ? buildQuestionPool(topic.title, content, 40) : [];
  const saved = [...(topic.tests ?? []), ...(topic.openTests ?? []), ...(topic.closedTests ?? [])].filter(validQuiz);
  return [...fromText, ...saved].filter(validQuiz).map(q => ({
    questionText: String(q.questionText || q.question).trim(),
    options: q.options.map(String),
    correctIndex: q.correctIndex,
    topicTitle: topic.title,
  }));
}

/** Savollarni mavzular bo'yicha navbatma-navbat aralashtiradi (bitta mavzu ustun bo'lmasin). */
function interleave(pools) {
  const queues = pools.map(p => shuffle(p));
  const out = [];
  const seen = new Set();
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      const item = q.shift();
      if (!item) continue;
      added = true;
      const key = item.questionText.toLowerCase().slice(0, 90);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function toQuiz(q) {
  const correct = q.options[q.correctIndex];
  const options = shuffle(q.options).slice(0, 4);
  if (!options.includes(correct)) options[Math.floor(Math.random() * options.length)] = correct;
  return { questionText: q.questionText, options, correctIndex: options.indexOf(correct), topicTitle: q.topicTitle };
}

function toTrueFalse(q) {
  const correct = q.options[q.correctIndex];
  const wrong = q.options.filter((_, i) => i !== q.correctIndex);
  const isTrue = Math.random() < 0.5 || !wrong.length;
  const answer = isTrue ? correct : wrong[Math.floor(Math.random() * wrong.length)];
  return {
    questionText: `${q.questionText}\nJavob: «${answer}». Bu to'g'rimi?`,
    isTrue,
    explanation: isTrue ? "" : `To'g'ri javob: ${correct}`,
    topicTitle: q.topicTitle,
  };
}

/**
 * @returns {{ questions: object[], lesson: object, topic: object|null }}
 */
export function lessonGameQuestions({ lessonId, topicId = null, gameType = "quiz", count = 10 }) {
  const lesson = getLessonById(Number(lessonId));
  if (!lesson) throw new Error("Darslik topilmadi");

  let topics = getTopicsByLesson(lesson.id);
  let topic = null;
  if (topicId) {
    topic = getTopicById(Number(topicId));
    if (!topic || topic.lessonId !== lesson.id) throw new Error("Mavzu shu darslikka tegishli emas");
    topics = [topic];
  }
  if (!topics.length) throw new Error("Darslikda mavzular yo'q — avval PDF yuklang yoki mavzu qo'shing");

  const pool = interleave(topics.map(topicPool));
  if (pool.length < 3) {
    throw new Error("Darslik matnidan yetarli savol chiqmadi — mavzular matni juda qisqa");
  }

  const convert = gameType === "bosh_qotirma" ? toTrueFalse : toQuiz;
  const questions = pool.slice(0, count).map((q, i) => ({ id: i + 1, ...convert(q) }));
  return { questions, lesson, topic };
}
