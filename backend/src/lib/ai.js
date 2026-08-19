// ── AI provayderlar zanjiri ────────────────────────────────────────────────
// Barcha provayderlar OpenAI-mos (/chat/completions) API'dan foydalanadi,
// shuning uchun bitta callChat() funksiyasi hammasiga yetarli.
// Zanjir: birinchi ishlagan provayder javobni qaytaradi.

// Bitta modelga ajratilgan vaqt va butun zanjir uchun umumiy budjet.
// Budjet tugasa — qolgan provayderlar sinalmaydi va oflayn zaxira javob qaytadi,
// aks holda foydalanuvchi bir necha daqiqa kutib qolishi mumkin.
const CALL_TIMEOUT_MS = 25000;
const TOTAL_BUDGET_MS = 60000;

const PROVIDERS = [
  {
    name: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    envKey: "OPENAI_API_KEY",
    models: ["gpt-4o-mini"],
  },
  {
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    envKey: "OPENROUTER_API_KEY",
    models: ["deepseek/deepseek-chat-v3-0324:free", "meta-llama/llama-3.3-70b-instruct:free"],
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
  },
  {
    // Tezkor zaxira. Llama modellari o'zbek tilida DeepSeek'chalik aniq emas,
    // shuning uchun sifat bo'yicha oldingi provayderlardan keyin turadi.
    name: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    envKey: "GROQ_API_KEY",
    models: ["llama-3.3-70b-versatile"],
  },
  {
    name: "Pollinations",
    url: "https://text.pollinations.ai/openai",
    envKey: null, // kalitsiz, oxirgi zaxira
    models: ["openai"],
  },
];

// Kvota tugagan / kalit noto'g'ri bo'lgan provayderni jarayon davomida
// qayta-qayta urinib vaqt yo'qotmaslik uchun o'chirib qo'yamiz.
const disabledProviders = new Map();

function isFatalStatus(status) {
  return status === 401 || status === 402 || status === 403 || status === 429;
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

/**
 * Provayderlarni navbatma-navbat sinab, birinchi muvaffaqiyatli javobni qaytaradi.
 * @returns {Promise<{answer:string, provider:string, model:string}|null>}
 */
export async function askAI(messages) {
  const errors = [];
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (const provider of PROVIDERS) {
    if (provider.envKey && !process.env[provider.envKey]) continue;      // kalit yo'q
    if (disabledProviders.has(provider.name)) continue;                   // kvota tugagan

    for (const model of provider.models) {
      const remaining = deadline - Date.now();
      if (remaining < 5000) {
        console.log("⏱️  AI vaqt budjeti tugadi — qolgan provayderlar sinalmadi");
        errors.push("vaqt budjeti tugadi");
        return null;
      }

      try {
        const answer = await callChat(provider, model, messages, Math.min(CALL_TIMEOUT_MS, remaining));
        console.log(`✅ AI javob berdi: ${provider.name} / ${model}`);
        return { answer, provider: provider.name, model };
      } catch (e) {
        errors.push(e.message);
        console.log(`⚠️  ${provider.name} / ${model} — ${e.message}`);
        if (isFatalStatus(e.status)) {
          // Kalit/kvota muammosi — bu provayderning boshqa modellarini sinamaymiz
          disabledProviders.set(provider.name, e.message);
          break;
        }
      }
    }
  }

  console.error("❌ Hech bir AI provayder javob bermadi:", errors.join(" | "));
  return null;
}

export function aiProviderStatus() {
  return PROVIDERS.map(p => ({
    name: p.name,
    configured: p.envKey ? Boolean(process.env[p.envKey]) : true,
    disabledReason: disabledProviders.get(p.name) ?? null,
  }));
}
