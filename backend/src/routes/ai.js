import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { read, write } from "../lib/db.js";
import { askAI, aiProviderStatus } from "../lib/ai.js";
import { detectLanguage, buildMessages } from "../lib/aiPrompt.js";
import {
  listChats, getChat, createChat, appendMessages,
  renameChat, deleteChat, deleteAllChats,
} from "../lib/chats.js";

const router = Router();

// ── Offline zaxira javob (hech bir provayder ishlamaganda) ────────────────
function localGeoAnswer(question, language) {
  const q = question.toLowerCase();
  const uz = language !== "ru";
  const facts = [
    { keys: ["poytaxt", "столица", "toshkent", "ташкент"],
      uz: "O'zbekiston poytaxti — Toshkent shahri. U mamlakatning eng yirik shahri va Markaziy Osiyodagi eng katta shaharlardan biri hisoblanadi.",
      ru: "Столица Узбекистана — город Ташкент, крупнейший город страны и один из самых больших в Центральной Азии." },
    { keys: ["everest", "эверест", "jomolungma", "eng baland cho'qqi", "высочайшая вершина"],
      uz: "Jomolungma (Everest) — dunyodagi eng baland cho'qqi, balandligi taxminan 8 849 metr. U Himolay tog'larida, Nepal va Xitoy chegarasida joylashgan.",
      ru: "Джомолунгма (Эверест) — высочайшая вершина мира, примерно 8 849 метров. Находится в Гималаях на границе Непала и Китая." },
    { keys: ["orol", "арал"],
      uz: "Orol dengizi — Amudaryo va Sirdaryo suvining sug'orishga ko'plab olinishi natijasida 1960-yillardan boshlab qurib borgan ko'l. Bu XX asrning eng yirik ekologik falokatlaridan biri hisoblanadi.",
      ru: "Аральское море начало высыхать с 1960-х годов из-за забора воды Амударьи и Сырдарьи на орошение. Это одна из крупнейших экологических катастроф XX века." },
    { keys: ["amudaryo", "амударь"],
      uz: "Amudaryo — Markaziy Osiyodagi eng sersuv daryo, uzunligi taxminan 2 400 km. Panj va Vaxsh daryolarining qo'shilishidan hosil bo'ladi.",
      ru: "Амударья — самая полноводная река Центральной Азии, длина примерно 2 400 км. Образуется слиянием Пянджа и Вахша." },
    { keys: ["sirdaryo", "сырдарь"],
      uz: "Sirdaryo — Markaziy Osiyodagi eng uzun daryo, uzunligi taxminan 2 200 km. Norin va Qoradaryo daryolarining qo'shilishidan boshlanadi.",
      ru: "Сырдарья — самая длинная река Центральной Азии, примерно 2 200 км. Начинается слиянием Нарына и Карадарьи." },
    { keys: ["sahro", "cho'l", "пустын", "qizilqum", "кызылкум"],
      uz: "Cho'l — yog'in juda kam bo'ladigan, o'simlik qoplami siyrak quruq iqlimli hudud. O'zbekistondagi eng yirik cho'l — Qizilqum, u Amudaryo va Sirdaryo oralig'ida joylashgan.",
      ru: "Пустыня — сухая территория с малым количеством осадков и редкой растительностью. Крупнейшая пустыня Узбекистана — Кызылкум, между Амударьёй и Сырдарьёй." },
    { keys: ["nil", "нил"],
      uz: "Nil — Afrikadagi va dunyodagi eng uzun daryolardan biri, uzunligi taxminan 6 650 km. Misr va Sudan uchun asosiy suv manbai hisoblanadi.",
      ru: "Нил — одна из длиннейших рек мира, примерно 6 650 км. Главный источник воды для Египта и Судана." },
    { keys: ["okean", "океан"],
      uz: "Dunyo okeani Yer yuzasining taxminan 71 foizini qoplaydi. Asosiy okeanlar: Tinch, Atlantika, Hind, Shimoliy Muz va Janubiy okean. Eng kattasi va chuquri — Tinch okeani.",
      ru: "Мировой океан покрывает примерно 71% поверхности Земли. Основные океаны: Тихий, Атлантический, Индийский, Северный Ледовитый и Южный. Самый крупный и глубокий — Тихий." },
    { keys: ["materik", "qit'a", "матери", "контин"],
      uz: "Yerda oltita qit'a ajratiladi: Yevrosiyo, Afrika, Shimoliy Amerika, Janubiy Amerika, Avstraliya va Antarktida. Eng kattasi — Yevrosiyo.",
      ru: "На Земле выделяют шесть материков: Евразия, Африка, Северная Америка, Южная Америка, Австралия и Антарктида. Крупнейший — Евразия." },
    { keys: ["iqlim", "климат"],
      uz: "O'zbekiston iqlimi keskin kontinental: yozi issiq va quruq, qishi nisbatan sovuq. Yillik yog'in miqdori tekisliklarda taxminan 100-200 mm ni tashkil etadi.",
      ru: "Климат Узбекистана резко континентальный: жаркое сухое лето и относительно холодная зима. Годовое количество осадков на равнинах примерно 100-200 мм." },
    { keys: ["tabiiy boylik", "ресурс", "qazilma", "ископаем"],
      uz: "O'zbekistonning asosiy tabiiy boyliklari: tabiiy gaz, oltin, mis, uran, ko'mir, neft, marmar va tuz konlari. Oltin qazib olish bo'yicha mamlakat dunyoda oldingi o'rinlardan birida turadi.",
      ru: "Основные природные ресурсы Узбекистана: природный газ, золото, медь, уран, уголь, нефть, мрамор и соль. По добыче золота страна входит в число мировых лидеров." },
  ];
  const found = facts.find(f => f.keys.some(k => q.includes(k)));
  if (found) return uz ? found.uz : found.ru;
  return uz
    ? `Hozir AI xizmatiga ulanib bo'lmadi, shuning uchun to'liq javob bera olmayapman. Savolingizni ("${question}") biroz keyinroq qayta yuboring yoki uni aniqroq shaklda yozing.`
    : `Сейчас не удалось подключиться к AI-сервису, поэтому полный ответ дать не могу. Повторите вопрос («${question}») чуть позже или сформулируйте его точнее.`;
}

// ── Log yozish ─────────────────────────────────────────────────────────────
function writeLog(entry) {
  const logs = read("ai_logs");
  const item = {
    id: logs.length === 0 ? 1 : Math.max(...logs.map(l => l.id)) + 1,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  write("ai_logs", [...logs, item]);
  return item;
}

// ── POST /api/ai/ask & /api/ai/chat — savol berish ────────────────────────
router.post(["/ai/ask", "/ai/chat"], requireAuth, async (req, res) => {
  const question = (req.body?.question ?? req.body?.message ?? "").toString().trim();
  const fallbackLang = (req.body?.language ?? "uz").toString();
  const chatId = req.body?.chatId ?? null;

  if (!question) return res.status(400).json({ error: "Savol kerak" });
  if (question.length > 4000) return res.status(400).json({ error: "Savol juda uzun (maks. 4000 belgi)" });

  const language = detectLanguage(question, fallbackLang);

  // Suhbat tarixini kontekst sifatida yuklaymiz
  const existing = chatId ? getChat(req.user.id, chatId) : null;
  const history = existing?.messages ?? [];

  try {
    const result = await askAI(buildMessages(history, question, language));
    const offline = !result;
    const answer = result?.answer ?? localGeoAnswer(question, language);

    const chat = appendMessages(req.user.id, existing?.id ?? null, [
      { role: "user", content: question },
      { role: "assistant", content: answer, meta: { provider: result?.provider ?? "offline", offline } },
    ]);

    writeLog({
      userId: req.user.id, userName: req.user.name, role: req.user.role,
      question, answer, success: !offline,
      provider: result?.provider ?? "offline", chatId: chat.id,
    });

    res.json({
      answer,
      reply: answer,            // eski mijozlar bilan moslik
      offline,
      provider: result?.provider ?? "offline",
      chatId: chat.id,
      chatTitle: chat.title,
    });
  } catch (e) {
    const msg = e?.message || "AI xatosi";
    writeLog({
      userId: req.user.id, userName: req.user.name, role: req.user.role,
      question, answer: msg, success: false,
    });
    res.status(500).json({ error: msg });
  }
});

// ── Chat sessiyalari ──────────────────────────────────────────────────────
router.get("/ai/chats", requireAuth, (req, res) => {
  res.json(listChats(req.user.id));
});

router.post("/ai/chats", requireAuth, (req, res) => {
  const title = (req.body?.title ?? "").toString().trim();
  res.json(createChat(req.user.id, title || "Yangi suhbat"));
});

router.get("/ai/chats/:id", requireAuth, (req, res) => {
  const chat = getChat(req.user.id, req.params.id);
  if (!chat) return res.status(404).json({ error: "Suhbat topilmadi" });
  res.json(chat);
});

router.patch("/ai/chats/:id", requireAuth, (req, res) => {
  const title = (req.body?.title ?? "").toString().trim();
  if (!title) return res.status(400).json({ error: "Sarlavha kerak" });
  const chat = renameChat(req.user.id, req.params.id, title);
  if (!chat) return res.status(404).json({ error: "Suhbat topilmadi" });
  res.json(chat);
});

router.delete("/ai/chats/:id", requireAuth, (req, res) => {
  if (!deleteChat(req.user.id, req.params.id)) {
    return res.status(404).json({ error: "Suhbat topilmadi" });
  }
  res.json({ success: true });
});

router.delete("/ai/chats", requireAuth, (req, res) => {
  deleteAllChats(req.user.id);
  res.json({ success: true });
});

// ── GET /api/ai/status — provayderlar holati (faqat teacher) ──────────────
router.get("/ai/status", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Ruxsat yo'q" });
  res.json({ providers: aiProviderStatus() });
});

// ── GET /api/ai/logs — faqat teacher ──────────────────────────────────────
router.get("/ai/logs", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Ruxsat yo'q" });
  res.json(read("ai_logs").reverse());
});

router.delete("/ai/logs", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Ruxsat yo'q" });
  write("ai_logs", []);
  res.json({ success: true });
});

export default router;
