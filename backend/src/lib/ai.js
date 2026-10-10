// ── AI provayderlar zanjiri ────────────────────────────────────────────────
// Barcha provayderlar OpenAI-mos (/chat/completions) API'dan foydalanadi,
// shuning uchun bitta callChat() funksiyasi hammasiga yetarli.
// Zanjir: birinchi ishlagan provayder javobni qaytaradi.

// Bitta modelga ajratilgan vaqt va butun zanjir uchun umumiy budjet.
// Budjet tugasa — qolgan provayderlar sinalmaydi va oflayn zaxira javob qaytadi,
// aks holda foydalanuvchi bir necha daqiqa kutib qolishi mumkin.
const CALL_TIMEOUT_MS = 25000;
const TOTAL_BUDGET_MS = 90000;

const PROVIDERS = [
  {
    name: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    envKey: "OPENAI_API_KEY",
    models: ["gpt-4o-mini"],
    visionModels: ["gpt-4o-mini"],
  },
  {
    // Google Gemini — bepul tarifi katta, o'zbek tilida yaxshi javob beradi.
    // Kalit: https://aistudio.google.com/apikey
    name: "Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    envKey: "GEMINI_API_KEY",
    // "-latest" nomlari Google tomonidan eng yangi modelga yo'naltiriladi —
    // aniq versiya eskirib o'chirilsa ham AI ishlayveradi.
    models: ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"],
    visionModels: ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"],
  },
  {
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    envKey: "OPENROUTER_API_KEY",
    models: ["deepseek/deepseek-chat-v3-0324:free", "meta-llama/llama-3.3-70b-instruct:free"],
    visionModels: ["google/gemma-3-27b-it:free", "meta-llama/llama-4-maverick:free"],
  },
  {
    name: "HuggingFace",
    url: "https://router.huggingface.co/v1/chat/completions",
    envKey: "HF_TOKEN",
    // Faqat o'zbek tilida ishonchli javob beradigan modellar.
    // Qwen2.5-72B va Llama-3.3-70B sinovda O'zbekiston geografiyasi bo'yicha
    // xato faktlar berdi (masalan Zarafshonni Farg'ona vodiysiga joylashtirdi),
    // shuning uchun ular zanjirdan chiqarildi — noto'g'ri javobdan ko'ra
    // "hozir javob bera olmayman" degani yaxshiroq.
    models: [
      "deepseek-ai/DeepSeek-V3-0324",
      "deepseek-ai/DeepSeek-V3.1",
    ],
    // Rasmni ko'ra oladigan modellar (sinovda o'zbekcha to'g'ri javob berdi)
    visionModels: [
      "Qwen/Qwen3-VL-235B-A22B-Instruct",
      "meta-llama/Llama-4-Scout-17B-16E-Instruct",
      "google/gemma-3-27b-it",
    ],
  },
  {
    // Tezkor zaxira. Llama modellari o'zbek tilida DeepSeek'chalik aniq emas,
    // shuning uchun sifat bo'yicha oldingi provayderlardan keyin turadi.
    name: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    envKey: "GROQ_API_KEY",
    models: ["llama-3.3-70b-versatile"],
    visionModels: ["meta-llama/llama-4-scout-17b-16e-instruct"],
  },
];

// Kvota tugagan / kalit noto'g'ri bo'lgan provayderni qayta-qayta urinib vaqt
// yo'qotmaslik uchun vaqtincha o'chirib qo'yamiz. Muddat o'tgach yana sinaladi —
// balans to'ldirilsa yoki limit yangilansa, serverni qayta ishga tushirish shart emas.
const DISABLE_MS = 10 * 60 * 1000;
const disabledProviders = new Map(); // name -> { reason, until }
// Tashxis uchun: har bir provayderning oxirgi xatosi va oxirgi muvaffaqiyatli javobi
const lastError = new Map();         // name -> { model, message, at }
const lastOk = new Map();            // name -> { model, at }

function isFatalStatus(status) {
  return status === 401 || status === 402 || status === 403 || status === 429;
}

function isDisabled(name) {
  const d = disabledProviders.get(name);
  if (!d) return false;
  if (Date.now() >= d.until) { disabledProviders.delete(name); return false; }
  return true;
}

async function callChat(provider, model, messages, timeoutMs = CALL_TIMEOUT_MS) {
  const key = provider.envKey ? process.env[provider.envKey] : null;
  const headers = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;

  const resp = await fetch(provider.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!resp.ok) {
    let detail = "";
    try { detail = (await resp.text()).slice(0, 200); } catch {}
    const err = new Error(`${provider.name} ${resp.status}: ${detail}`);
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim().length < 2) {
    throw new Error(`${provider.name}: bo'sh javob`);
  }
  return text.trim();
}

// Kalitsiz provayder band bo'lsa (402/429) yoki kechiksa — biroz kutib qayta urinamiz.
async function callWithRetry(provider, model, messages, deadline) {
  const attempts = 1 + (provider.retries ?? 0);
  for (let i = 0; ; i++) {
    const remaining = deadline - Date.now();
    try {
      return await callChat(provider, model, messages, Math.min(provider.timeoutMs ?? CALL_TIMEOUT_MS, remaining));
    } catch (e) {
      const retryable = !e.status || e.status === 402 || e.status === 429 || e.status >= 500;
      if (i + 1 >= attempts || !retryable || deadline - Date.now() < 10000) throw e;
      await new Promise(r => setTimeout(r, 3000 * (i + 1)));
    }
  }
}

/**
 * Provayderlarni navbatma-navbat sinab, birinchi muvaffaqiyatli javobni qaytaradi.
 * @returns {Promise<{answer:string, provider:string, model:string}|null>}
 */
export async function askAI(messages) {
  const errors = [];
  // Rasm biriktirilgan bo'lsa — faqat rasmni ko'ra oladigan modellar
  const vision = messages.some(m => Array.isArray(m.content));
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (const provider of PROVIDERS) {
    if (provider.envKey && !process.env[provider.envKey]) continue;      // kalit yo'q
    if (isDisabled(provider.name)) {                                      // kvota tugagan
      errors.push(`${provider.name}: vaqtincha o'chirilgan`);
      continue;
    }

    const models = vision ? (provider.visionModels ?? []) : provider.models;
    for (const model of models) {
      const remaining = deadline - Date.now();
      if (remaining < 5000) {
        console.log("⏱️  AI vaqt budjeti tugadi — qolgan provayderlar sinalmadi");
        errors.push("vaqt budjeti tugadi");
        return null;
      }

      try {
        const answer = await callWithRetry(provider, model, messages, deadline);
        lastOk.set(provider.name, { model, at: new Date().toISOString() });
        console.log(`✅ AI javob berdi: ${provider.name} / ${model}`);
        return { answer, provider: provider.name, model };
      } catch (e) {
        errors.push(e.message);
        lastError.set(provider.name, { model, message: e.message.slice(0, 300), at: new Date().toISOString() });
        console.log(`⚠️  ${provider.name} / ${model} — ${e.message}`);
        if (isFatalStatus(e.status) && !provider.neverDisable) {
          // Kalit/kvota muammosi — bu provayderning boshqa modellarini sinamaymiz
          disabledProviders.set(provider.name, { reason: e.message, until: Date.now() + DISABLE_MS });
          break;
        }
      }
    }
  }

  if (errors.length === 0) errors.push("hech bir provayder kaliti sozlanmagan");
  console.error("❌ Hech bir AI provayder javob bermadi:", errors.join(" | "));
  return null;
}

export function aiProviderStatus() {
  return PROVIDERS.map(p => ({
    name: p.name,
    configured: p.envKey ? Boolean(process.env[p.envKey]) : true,
    disabledReason: isDisabled(p.name) ? disabledProviders.get(p.name).reason : null,
    lastError: lastError.get(p.name) ?? null,
    lastOk: lastOk.get(p.name) ?? null,
  }));
}
