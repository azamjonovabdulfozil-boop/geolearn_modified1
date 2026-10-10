import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { read, write, userClassName, getUserById, updateUser } from "../lib/db.js";
import { findProfanity, maskWord } from "../lib/profanity.js";
import { addStrike, clearStrikes, warningText } from "../lib/moderation.js";
import { askAI, aiProviderStatus } from "../lib/ai.js";
import { detectLanguage, buildMessages } from "../lib/aiPrompt.js";
import { processAttachments, withFileTexts } from "../lib/aiFiles.js";
import { teacherSystemAddon } from "../lib/aiTeacherContext.js";
import { synthesize, transcribe } from "../lib/aiVoice.js";
import { join } from "path";
import { AI_IMAGE_DIR, isImageName, imageMime, imageUrlToDataUrl, generateImage, ensureImage } from "../lib/aiImages.js";
import {
  listChats, getChat, createChat, appendMessages,
  renameChat, deleteChat, deleteAllChats,
  getChatById, setChatLocked, removeChatAdmin, removeUserChatsAdmin,
} from "../lib/chats.js";

const router = Router();

// ── Offline zaxira javob (hech bir provayder ishlamaganda) ────────────────
// Ilgari bu yerda kalit so'zlar bo'yicha tayyor javoblar bor edi, lekin ular
// boshqa savolga ham chiqib ketardi ("Avstraliya poytaxti?" → "Toshkent").
// Noto'g'ri javobdan ko'ra "hozir javob bera olmayman" degani to'g'riroq.
function localGeoAnswer(question, language) {
  return language === "ru"
    ? "Сейчас AI-помощник недоступен, поэтому я не могу ответить на вопрос. Чтобы не дать неверный ответ, я ничего не выдумываю. Попробуйте ещё раз чуть позже или спросите учителя."
    : "Hozir AI yordamchi ishlamayapti, shuning uchun savolingizga javob bera olmayman. Noto'g'ri javob bermaslik uchun taxmin qilmayman. Birozdan so'ng qayta urinib ko'ring yoki o'qituvchingizdan so'rang.";
}

// ── Rasm yaratish: AI javobidagi [[RASM: ...]] belgilari ─────────────────
const IMAGE_TAG = /\[\[\s*RASM\s*:\s*([^\]]+?)\s*\]\]/gi;
// AI belgini qo'ymay qolsa ham — savolning o'zidan rasm so'ralganini bilamiz
const IMAGE_REQUEST = /(rasm|surat|tasvir)\S*\s+(\S+\s+)?(chiz|yarat|ko'rsat|ko‘rsat|tashla|ber|yubor)|chizib\s+ber|нарису|картин\S*\s+(\S+\s+)?(созда|покаж|сгенер)|изображени\S*\s+(\S+\s+)?(созда|покаж|сгенер)|\b(draw|generate (an? )?image|picture of)\b/i;

/** Javobdagi belgilarni yaratilgan rasmlar bilan almashtiradi. */
async function renderImageTags(answer, question, language) {
  const prompts = [...answer.matchAll(IMAGE_TAG)].map(m => m[1]).slice(0, 2);
  const text = answer.replace(IMAGE_TAG, "").trim();
  if (!prompts.length && IMAGE_REQUEST.test(question)) prompts.push(question);
  if (!prompts.length) return { text, images: [] };

  const urls = (await Promise.all(prompts.map(generateImage))).filter(Boolean);
  if (!urls.length) {
    const note = language === "ru"
      ? "*Не удалось создать изображение — попробуйте ещё раз чуть позже.*"
      : "*Rasm yaratib bo'lmadi — birozdan so'ng qayta urinib ko'ring.*";
    return { text: [note, text].filter(Boolean).join("\n\n"), images: [] };
  }
  const md = urls.map(u => `![rasm](${u})`);
  return { text: [...md, text].filter(Boolean).join("\n\n"), images: urls };
}

/** Suhbatdagi oxirgi rasm(lar) — "bu qaysi joy?" kabi keyingi savollar uchun. */
function recentImages(history) {
  for (const m of [...history].reverse().slice(0, 6)) {
    if (m.role !== "user") continue;
    const urls = (m.meta?.attachments ?? []).filter(a => a.kind === "image" && a.url).map(a => a.url);
    if (urls.length) {
      return urls.slice(0, 2).map(url => ({ url, dataUrl: imageUrlToDataUrl(url) })).filter(i => i.dataUrl);
    }
  }
  return [];
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

// ── So'kinish: ogohlantirish + o'qituvchiga xabar, 3-chisida avtomatik blok ──
const AI_FLAG = /\[\[\s*HAQORAT\s*\]\]/i;

/**
 * So'kinishni qayd qiladi: o'quvchiga ogohlantirish, suhbatga yozish,
 * o'qituvchi uchun log (admin panelda darhol xabar chiqadi).
 * @param detectedBy "filter" (so'zlar ro'yxati) yoki AI provayder nomi
 */
function flagProfanity(user, question, language, existing, badWords, detectedBy) {
  const { warnings, blocked } = addStrike(user.id);
  const answer = warningText(warnings, language, blocked);
  const chat = appendMessages(user.id, existing?.id ?? null, [
    { role: "user", content: maskText(question) },
    { role: "assistant", content: answer, meta: { provider: "moderation", warning: true } },
  ]);
  writeLog({
    userId: user.id, userName: user.name, role: user.role,
    question, answer, success: false, provider: "moderation", chatId: chat.id,
    flagged: true, badWords, warningNo: warnings, reviewed: false, autoBlocked: blocked,
    detectedBy: detectedBy === "filter" ? "filter" : "ai",
  });
  return { answer, reply: answer, warning: true, warnings, blocked, provider: "moderation", chatId: chat.id, chatTitle: chat.title };
}

/** Suhbat tarixida so'kinishlarni yulduzcha bilan yopadi. */
function maskText(text) {
  return text.split(/(\s+)/).map(part => (findProfanity(part).length ? maskWord(part) : part)).join("");
}

/**
 * Filtr qo'shilishidan (yoki so'zlar ro'yxati kengayishidan) oldin yozilgan
 * savollarni ham tekshiradi — o'qituvchi ularni ham ko'rsin.
 * Server ishga tushganda bir marta bajariladi.
 */
function flagPastLogs() {
  const logs = read("ai_logs");
  let changed = 0;
  for (const l of logs) {
    if (l.flagged || l.role !== "student") continue;
    const bad = findProfanity(l.question);
    if (!bad.length) continue;
    Object.assign(l, { flagged: true, retro: true, reviewed: false, badWords: bad.map(maskWord) });
    changed++;
  }
  if (changed) {
    write("ai_logs", logs);
    console.log(`🛡  AI loglarda ${changed} ta avval o'tib ketgan so'kinish belgilandi`);
  }
}
flagPastLogs();

// ── POST /api/ai/ask & /api/ai/chat — savol berish ────────────────────────
router.post(["/ai/ask", "/ai/chat"], requireAuth, async (req, res) => {
  const fallbackLang = (req.body?.language ?? "uz").toString();
  const chatId = req.body?.chatId ?? null;
  const hasFiles = Array.isArray(req.body?.attachments) && req.body.attachments.length > 0;
  let question = (req.body?.question ?? req.body?.message ?? "").toString().trim();
  if (question.length > 4000) return res.status(400).json({ error: "Savol juda uzun (maks. 4000 belgi)" });

  // Admin bloklagan bo'lsa — AI dan foydalanib bo'lmaydi
  if (req.user.aiBlocked) {
    return res.status(403).json({
      error: req.user.blockedAuto
        ? "AI yordamchi siz uchun bloklangan (haqoratli so'zlar uchun 3 ta ogohlantirish). Blokni o'qituvchi ochadi."
        : "AI yordamchi siz uchun o'qituvchi tomonidan bloklangan",
      blocked: true,
    });
  }

  // Biriktirilgan fayllar: hujjatlardan matn, rasmlar — vision modelga, ovoz — matnga
  let files = { texts: [], images: [], audios: [], meta: [] };
  if (hasFiles) {
    try { files = await processAttachments(req.body.attachments); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }

  // Ovozli xabar → matn; u savolning o'zi bo'ladi (yozilgan matn bo'lsa — qo'shiladi)
  let transcript = "";
  if (files.audios.length) {
    try {
      const lang = fallbackLang === "ru" ? "ru" : "uz";
      transcript = (await Promise.all(files.audios.map(a => transcribe(a.buf, lang)))).join(" ").trim();
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    question = [question, transcript].filter(Boolean).join("\n").slice(0, 4000);
  }

  // Faqat fayl yuborilgan bo'lsa — standart so'rov
  if (!question && hasFiles) {
    question = fallbackLang === "ru" ? "Проанализируй прикреплённый файл и кратко объясни его содержание." : "Biriktirilgan faylni tahlil qilib, mazmunini qisqacha tushuntirib ber.";
  }
  if (!question) return res.status(400).json({ error: "Savol kerak" });

  const language = detectLanguage(question, fallbackLang);

  // Suhbat tarixini kontekst sifatida yuklaymiz
  const existing = chatId ? getChat(req.user.id, chatId) : null;
  const history = existing?.messages ?? [];
  if (existing?.locked) {
    return res.status(403).json({ error: "Bu suhbat o'qituvchi tomonidan bloklangan. Yangi suhbat boshlang.", locked: true });
  }

  // O'quvchi so'kinib yozsa — AI ga yubormaymiz: ogohlantiramiz va o'qituvchiga xabar beramiz
  const badWords = req.user.role === "student" ? findProfanity(question) : [];
  if (badWords.length) {
    return res.json(flagProfanity(req.user, question, language, existing, badWords.map(maskWord), "filter"));
  }

  const fileText = files.texts.length ? withFileTexts("", files.texts).trim() : "";
  const userMeta = files.meta.length
    ? { attachments: files.meta, ...(fileText ? { fileText: fileText.slice(0, 20000) } : {}), ...(transcript ? { transcript } : {}) }
    : null;

  try {
    const images = files.images.length ? files.images : recentImages(history);
    // Faqat admin (o'qituvchi): AI platforma ma'lumotlarini (reyting, natijalar) ko'radi
    let extra = "";
    if (req.user.role === "teacher") {
      try { extra = teacherSystemAddon(language); } catch (e) { console.log("Admin konteksti xatosi:", e.message); }
    }
    const result = await askAI(buildMessages(history, withFileTexts(question, files.texts), language, 10, images, extra));
    // 2-himoya: ro'yxatda yo'q so'kinishni AI o'zi aniqlasa — [[HAQORAT]] belgisini qaytaradi
    if (result?.answer && AI_FLAG.test(result.answer)) {
      if (req.user.role === "student") {
        return res.json(flagProfanity(req.user, question, language, existing, ["AI aniqladi"], result.provider));
      }
      result.answer = language === "ru" ? "Пожалуйста, пишите корректно." : "Iltimos, odob bilan yozing.";
    }
    const offline = !result;
    let answer;
    if (result) {
      answer = (await renderImageTags(result.answer, question, language)).text;
    } else if (files.images.length) {
      answer = language === "ru"
        ? "Сейчас не удалось проанализировать изображение — сервисы AI недоступны. Попробуйте отправить его ещё раз чуть позже."
        : "Hozir rasmni tahlil qilib bo'lmadi — AI xizmatlari javob bermadi. Birozdan so'ng rasmni qayta yuboring.";
    } else {
      // AI ishlamasa ham rasm so'rovini bajarishga harakat qilamiz
      const drawn = IMAGE_REQUEST.test(question) ? await renderImageTags("", question, language) : null;
      answer = drawn?.images.length ? drawn.text : localGeoAnswer(question, language);
    }

    const chat = appendMessages(req.user.id, existing?.id ?? null, [
      { role: "user", content: question, ...(userMeta ? { meta: userMeta } : {}) },
      { role: "assistant", content: answer, meta: { provider: result?.provider ?? "offline", offline } },
    ]);

    writeLog({
      userId: req.user.id, userName: req.user.name, role: req.user.role,
      question, answer, success: !offline,
      provider: result?.provider ?? "offline", chatId: chat.id,
      ...(files.meta.length ? { attachments: files.meta } : {}),
    });

    res.json({
      answer,
      reply: answer,            // eski mijozlar bilan moslik
      offline,
      provider: result?.provider ?? "offline",
      chatId: chat.id,
      chatTitle: chat.title,
      ...(transcript ? { transcript, question } : {}),
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

// ── POST /api/ai/tts { text, language } — javobni ovozda o'qib berish (mp3) ──
router.post("/ai/tts", requireAuth, async (req, res) => {
  const text = String(req.body?.text ?? "");
  if (!text.trim()) return res.status(400).json({ error: "Matn kerak" });
  try {
    const audio = await synthesize(text, req.body?.language);
    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "private, max-age=86400");
    res.send(audio);
  } catch (e) {
    console.log("⚠️  TTS:", e.message);
    res.status(502).json({ error: "Ovozga aylantirib bo'lmadi" });
  }
});

// ── GET /api/ai/images/:name — chatdagi rasmlar ──────────────────────────
// <img> teg token yubora olmaydi, shuning uchun ochiq; nomlar tasodifiy va taxmin qilib bo'lmaydi.
router.get("/ai/images/:name", async (req, res) => {
  const name = req.params.name;
  if (!isImageName(name) || !(await ensureImage(name))) return res.status(404).end();
  res.type(imageMime(name));
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(join(AI_IMAGE_DIR, name), err => { if (err && !res.headersSent) res.status(404).end(); });
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
  if (getChat(req.user.id, req.params.id)?.locked) {
    return res.status(403).json({ error: "Bu suhbat o'qituvchi tomonidan bloklangan — uni o'chirib bo'lmaydi" });
  }
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
  const users = new Map(read("users").map(u => [u.id, u]));
  res.json(read("ai_logs").reverse().map(l => withUser(l, users)));
});

// ── So'kinish haqidagi xabarlar (faqat teacher) ───────────────────────────
function withUser(l, users) {
  const u = users.get(l.userId);
  return {
    ...l, className: u ? userClassName(u) : null, grade: u?.grade ?? null, avatarUrl: u?.avatarUrl ?? null,
    aiWarnings: u?.aiWarnings ?? 0, aiBlocked: Boolean(u?.aiBlocked),
  };
}

// ── Admin: o'quvchi chatlarini boshqarish ─────────────────────────────────
function teacherOnly(req, res) {
  if (req.user.role === "teacher") return true;
  res.status(403).json({ error: "Ruxsat yo'q" });
  return false;
}
const removeLogs = (pred) => {
  const logs = read("ai_logs");
  const next = logs.filter(l => !pred(l));
  if (next.length !== logs.length) write("ai_logs", next);
  return logs.length - next.length;
};

// GET /api/ai/admin/users/:userId/chats — o'quvchining suhbatlari va AI holati
router.get("/ai/admin/users/:userId/chats", requireAuth, (req, res) => {
  if (!teacherOnly(req, res)) return;
  const userId = Number(req.params.userId);
  const u = getUserById(userId);
  if (!u) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
  const flagged = new Map();
  for (const l of read("ai_logs")) if (l.userId === userId && l.flagged) flagged.set(l.chatId, (flagged.get(l.chatId) || 0) + 1);
  res.json({
    user: { id: u.id, name: u.name, aiBlocked: Boolean(u.aiBlocked), aiWarnings: u.aiWarnings ?? 0 },
    chats: listChats(userId).map(c => ({ ...c, flagged: flagged.get(c.id) ?? 0 })),
  });
});

// GET /api/ai/admin/chats/:id — suhbatning to'liq matni
router.get("/ai/admin/chats/:id", requireAuth, (req, res) => {
  if (!teacherOnly(req, res)) return;
  const chat = getChatById(req.params.id);
  if (!chat) return res.status(404).json({ error: "Suhbat topilmadi" });
  res.json(chat);
});

// PUT /api/ai/admin/chats/:id/lock { locked } — suhbatni bloklash / ochish
router.put("/ai/admin/chats/:id/lock", requireAuth, (req, res) => {
  if (!teacherOnly(req, res)) return;
  const chat = setChatLocked(req.params.id, req.body?.locked !== false);
  if (!chat) return res.status(404).json({ error: "Suhbat topilmadi" });
  res.json({ success: true, locked: chat.locked });
});

// DELETE /api/ai/admin/chats/:id — suhbat va uning loglarini o'chirish
router.delete("/ai/admin/chats/:id", requireAuth, (req, res) => {
  if (!teacherOnly(req, res)) return;
  const id = Number(req.params.id);
  if (!removeChatAdmin(id)) return res.status(404).json({ error: "Suhbat topilmadi" });
  removeLogs(l => l.chatId === id);
  res.json({ success: true });
});

// DELETE /api/ai/admin/users/:userId/chats — o'quvchining barcha suhbatlari va loglari
router.delete("/ai/admin/users/:userId/chats", requireAuth, (req, res) => {
  if (!teacherOnly(req, res)) return;
  const userId = Number(req.params.userId);
  const chats = removeUserChatsAdmin(userId);
  const logs = removeLogs(l => l.userId === userId);
  res.json({ success: true, chats, logs });
});

// PUT /api/ai/admin/users/:userId/block { blocked } — o'quvchiga AI ni yopish / ochish
router.put("/ai/admin/users/:userId/block", requireAuth, (req, res) => {
  if (!teacherOnly(req, res)) return;
  const u = getUserById(Number(req.params.userId));
  if (!u || u.role !== "student") return res.status(404).json({ error: "O'quvchi topilmadi" });
  const blocked = req.body?.blocked !== false;
  // Blok ochilganda chat ham ochiladi va ogohlantirishlar sanog'i nolga tushadi
  if (blocked) updateUser(u.id, { aiBlocked: true, aiBlockedAt: new Date().toISOString(), blockedAuto: false });
  else clearStrikes(u.id);
  res.json({ success: true, blocked });
});

// DELETE /api/ai/logs/:id — bitta savolni o'chirish (suhbatdan ham olib tashlanadi)
router.delete("/ai/logs/:id", requireAuth, (req, res) => {
  if (!teacherOnly(req, res)) return;
  const id = Number(req.params.id);
  const log = read("ai_logs").find(l => l.id === id);
  if (!log) return res.status(404).json({ error: "Topilmadi" });
  removeLogs(l => l.id === id);
  // Suhbatdan shu savol va unga berilgan javobni ham olib tashlaymiz
  const chats = read("ai_chats");
  const chat = chats.find(c => c.id === log.chatId);
  if (chat) {
    const i = chat.messages.findIndex((m, k) => m.role === "user" && chat.messages[k + 1]?.role === "assistant"
      && chat.messages[k + 1].content === log.answer);
    if (i !== -1) {
      chat.messages.splice(i, 2);
      write("ai_chats", chat.messages.length ? chats : chats.filter(c => c.id !== chat.id));
    }
  }
  res.json({ success: true });
});

// GET /api/ai/alerts → { unread, items } — yangilari birinchi
router.get("/ai/alerts", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Ruxsat yo'q" });
  const users = new Map(read("users").map(u => [u.id, u]));
  const items = read("ai_logs").filter(l => l.flagged).reverse().map(l => withUser(l, users));
  res.json({ unread: items.filter(l => !l.reviewed).length, items });
});

// PUT /api/ai/alerts/:id/review  yoki  /api/ai/alerts/all/review — "ko'rildi"
router.put("/ai/alerts/:id/review", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Ruxsat yo'q" });
  const all = req.params.id === "all";
  const id = Number(req.params.id);
  const logs = read("ai_logs");
  let changed = 0;
  for (const l of logs) {
    if (l.flagged && !l.reviewed && (all || l.id === id)) { l.reviewed = true; l.reviewedAt = new Date().toISOString(); changed++; }
  }
  if (changed) write("ai_logs", logs);
  res.json({ success: true, changed });
});

router.delete("/ai/logs", requireAuth, (req, res) => {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Ruxsat yo'q" });
  write("ai_logs", []);
  res.json({ success: true });
});

export default router;
