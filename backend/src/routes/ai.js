import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { read, write } from "../lib/db.js";

const router = Router();
const LOVABLE_MODEL = "google/gemini-3-flash-preview";

// ── AI Models — bepul/API-keysiz provayderlar ──────────────────────────────
const FREE_MODELS = [
  {
    name: "Mistral 7B (HF)",
    endpoint: "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
    type: "hf",
  },
  {
    name: "Zephyr 7B (HF)",
    endpoint: "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
    type: "hf",
  },
  {
    name: "Llama 3.2 (HF)",
    endpoint: "https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct",
    type: "hf",
  },
  {
    name: "Gemma 2 (HF)",
    endpoint: "https://api-inference.huggingface.co/models/google/gemma-2-2b-it",
    type: "hf",
  },
  {
    name: "Phi-3 Mini (HF)",
    endpoint: "https://api-inference.huggingface.co/models/microsoft/Phi-3-mini-4k-instruct",
    type: "hf",
  },
  {
    name: "Pollinations AI",
    endpoint: "https://text.pollinations.ai",
    type: "pollinations",
  },
];

async function callHuggingFace(endpoint, prompt, hfToken) {
  const headers = { "Content-Type": "application/json" };
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 1500, temperature: 0.7, return_full_text: false },
    }),
    signal: AbortSignal.timeout(18000),
  });
  if (!resp.ok) throw new Error(`HF error ${resp.status}`);
  const data = await resp.json();
  if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text.trim();
  if (data?.error) throw new Error(data.error);
  throw new Error("HF: javob yo'q");
}

async function callPollinations(prompt) {
  const encoded = encodeURIComponent(prompt);
  const resp = await fetch(`https://text.pollinations.ai/${encoded}`, {
    signal: AbortSignal.timeout(18000),
  });
  if (!resp.ok) throw new Error(`Pollinations error ${resp.status}`);
  const text = await resp.text();
  return text.trim();
}

async function getAIAnswer(question, language) {
  const systemHint = language === "ru"
    ? "Ты — AI-помощник платформы GeoLearn по географии. Отвечай ПОДРОБНО: минимум 17-18 полных предложений, с определениями, примерами, фактами и пояснениями. Не ограничивайся одним предложением."
    : "Sen GeoLearn platformasining geografiya bo'yicha AI yordamchisisiz. BATAFSIL javob ber: kamida 17-18 ta to'liq gap, ta'rif, misollar, faktlar va izohlar bilan. Hech qachon bitta gap bilan cheklanma.";
  const prompt = `${systemHint}\n\nSavol: ${question}\n\nJavobni 17-18 ta gapdan kam qilma.`;

  // Avval environment API key bo'lsa ishlatamiz
  const lovableKey = process.env.LOVABLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const hfToken = process.env.HF_TOKEN; // ixtiyoriy

  if (lovableKey) {
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": lovableKey },
        body: JSON.stringify({ model: LOVABLE_MODEL, messages: [{ role: "user", content: prompt }], max_tokens: 2000, temperature: 0.45 }),
        signal: AbortSignal.timeout(25000),
      });
      if (resp.ok) {
        const d = await resp.json();
        return d?.choices?.[0]?.message?.content?.trim() || null;
      }
    } catch {}
  }

  if (openaiKey) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 1800 }),
        signal: AbortSignal.timeout(25000),
      });
      if (resp.ok) {
        const d = await resp.json();
        return d?.choices?.[0]?.message?.content?.trim() || null;
      }
    } catch {}
  }

  // Bepul modellarni navbatma-navbat sinash
  for (const model of FREE_MODELS) {
    try {
      let answer;
      if (model.type === "hf") {
        answer = await callHuggingFace(model.endpoint, prompt, hfToken);
      } else if (model.type === "pollinations") {
        answer = await callPollinations(prompt);
      }
      if (answer && answer.length > 10) {
        console.log(`✅ AI javob berdi: ${model.name}`);
        return answer;
      }
    } catch (e) {
      console.log(`⚠️ ${model.name} xato: ${e.message}`);
    }
  }

  return null;
}

function localGeoAnswer(question, language) {
  const q = question.toLowerCase();
  const uz = language !== "ru";
  const facts = [
    { keys: ["poytaxt", "столица", "toshkent", "ташкент"], uz: "O'zbekiston poytaxti — Toshkent shahri.", ru: "Столица Узбекистана — город Ташкент." },
    { keys: ["everest", "эверест", "baland", "высота"], uz: "Everest — dunyodagi eng baland cho'qqi, balandligi taxminan 8 849 metr.", ru: "Эверест — самая высокая вершина мира, около 8 849 метров." },
    { keys: ["sahro", "cho'l", "пустын"], uz: "Sahro yoki cho'l — yog'in juda kam bo'ladigan, o'simlik qoplami siyrak va quruq iqlimli hudud.", ru: "Пустыня — это очень сухая территория с малым количеством осадков и редкой растительностью." },
    { keys: ["nil", "нил"], uz: "Nil Afrikadagi eng uzun daryolardan biri bo'lib, Misr va Sudan hududlari uchun juda muhim suv manbai hisoblanadi.", ru: "Нил — одна из длиннейших рек Африки и важный источник воды для Египта и Судана." },
    { keys: ["okean", "океан"], uz: "Dunyo okeani Yer yuzasining katta qismini qoplaydi; asosiy okeanlar: Tinch, Atlantika, Hind, Shimoliy Muz va Janubiy okean.", ru: "Мировой океан покрывает большую часть Земли; основные океаны: Тихий, Атлантический, Индийский, Северный Ледовитый и Южный." },
    { keys: ["tabiiy boylik", "ресурс"], uz: "Tabiiy boyliklar — foydali qazilmalar, suv, yer, o'rmon, iqlim va biologik resurslar kabi tabiat ne'matlaridir.", ru: "Природные ресурсы — это полезные ископаемые, вода, земля, леса, климатические и биологические ресурсы." },
  ];
  const found = facts.find(f => f.keys.some(k => q.includes(k)));
  if (found) return uz ? found.uz : found.ru;
  return uz
    ? `Bu geografiya savoliga qisqa javob: "${question}" mavzusida asosiy tushuncha joylashuv, tabiiy sharoit, resurslar va inson faoliyati bilan bog'liq. Savolni biroz aniqroq yozsangiz, yanada konkret javob beraman.`
    : `Краткий ответ по географии: тема "${question}" связана с расположением, природными условиями, ресурсами и деятельностью человека. Уточните вопрос — отвечу конкретнее.`;
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

// ── POST /api/ai/ask  &  /api/ai/chat ─────────────────────────────────────
router.post(["/ai/ask", "/ai/chat"], requireAuth, async (req, res) => {
  const question = (req.body?.question ?? req.body?.message ?? "").toString().trim();
  const language = (req.body?.language ?? "uz").toString();
  if (!question) return res.status(400).json({ error: "Savol kerak" });

  try {
    const answer = await getAIAnswer(question, language);

    if (!answer) {
      const fallback = localGeoAnswer(question, language);
      writeLog({ userId: req.user.id, userName: req.user.name, role: req.user.role, question, answer: fallback, success: false });
      return res.json({ answer: fallback, reply: fallback, offline: true });
    }

    writeLog({ userId: req.user.id, userName: req.user.name, role: req.user.role, question, answer, success: true });
    res.json({ answer, reply: answer });
  } catch (e) {
    const msg = e?.message || "AI xatosi";
    writeLog({ userId: req.user.id, userName: req.user.name, role: req.user.role, question, answer: msg, success: false });
    res.status(500).json({ error: msg });
  }
});

// ── GET /api/ai/logs — faqat teacher ──────────────────────────────────────
router.get("/ai/logs", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Ruxsat yo'q" });
  const logs = read("ai_logs").reverse(); // eng yangi birinchi
  res.json(logs);
});

// ── DELETE /api/ai/logs — loglarni tozalash ────────────────────────────────
router.delete("/ai/logs", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Ruxsat yo'q" });
  write("ai_logs", []);
  res.json({ success: true });
});

export default router;
