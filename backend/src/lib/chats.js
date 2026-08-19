// ── AI chat sessiyalari (data/ai_chats.json) ──────────────────────────────
import { read, write } from "./db.js";

const STORE = "ai_chats";
const MAX_MESSAGES_PER_CHAT = 400;

function all() { return read(STORE); }
function saveAll(list) { write(STORE, list); }

function nextId(list) {
  return list.length === 0 ? 1 : Math.max(...list.map(c => c.id ?? 0)) + 1;
}

export function makeTitle(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "Yangi suhbat";
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

/** Foydalanuvchining barcha suhbatlari — eng yangisi birinchi. */
export function listChats(userId) {
  return all()
    .filter(c => c.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(c => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages?.length ?? 0,
      lastMessage: c.messages?.length ? c.messages[c.messages.length - 1].content.slice(0, 120) : "",
    }));
}

export function getChat(userId, id) {
  const chat = all().find(c => c.id === Number(id));
  if (!chat || chat.userId !== userId) return null;
  return chat;
}

export function createChat(userId, title = "Yangi suhbat") {
  const list = all();
  const now = new Date().toISOString();
  const chat = { id: nextId(list), userId, title, createdAt: now, updatedAt: now, messages: [] };
  saveAll([...list, chat]);
  return chat;
}

/** Suhbatga xabarlar qo'shadi. chatId bo'lmasa yangi suhbat ochadi. */
export function appendMessages(userId, chatId, messages) {
  const list = all();
  let idx = list.findIndex(c => c.id === Number(chatId) && c.userId === userId);

  if (idx === -1) {
    const now = new Date().toISOString();
    const firstUser = messages.find(m => m.role === "user");
    list.push({
      id: nextId(list),
      userId,
      title: makeTitle(firstUser?.content),
      createdAt: now,
      updatedAt: now,
      messages: [],
    });
    idx = list.length - 1;
  }

  const chat = list[idx];
  const now = new Date().toISOString();
  for (const m of messages) {
    chat.messages.push({ role: m.role, content: m.content, createdAt: now, ...(m.meta ? { meta: m.meta } : {}) });
  }
  // Sarlavha hali standart bo'lsa — birinchi savoldan yasaymiz
  if (!chat.title || chat.title === "Yangi suhbat") {
    const firstUser = chat.messages.find(m => m.role === "user");
    if (firstUser) chat.title = makeTitle(firstUser.content);
  }
  if (chat.messages.length > MAX_MESSAGES_PER_CHAT) {
    chat.messages = chat.messages.slice(-MAX_MESSAGES_PER_CHAT);
  }
  chat.updatedAt = now;

  saveAll(list);
  return chat;
}

export function renameChat(userId, id, title) {
  const list = all();
  const idx = list.findIndex(c => c.id === Number(id) && c.userId === userId);
  if (idx === -1) return null;
  list[idx].title = makeTitle(title);
  list[idx].updatedAt = new Date().toISOString();
  saveAll(list);
  return list[idx];
}

export function deleteChat(userId, id) {
  const list = all();
  const next = list.filter(c => !(c.id === Number(id) && c.userId === userId));
  if (next.length === list.length) return false;
  saveAll(next);
  return true;
}

export function deleteAllChats(userId) {
  saveAll(all().filter(c => c.userId !== userId));
}
