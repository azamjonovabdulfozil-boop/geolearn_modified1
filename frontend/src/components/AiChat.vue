<template>
  <div class="ai-page fade-in">
    <div class="ai-header">
      <div>
        <h1 class="geo-page-title">{{ settings.t('ai_title') }}</h1>
        <p class="geo-page-sub">{{ settings.t('ai_sub') }}</p>
      </div>
      <div class="auto-tag">
        <Info :size="13" />
        <span>{{ settings.t('auto_lang') }}</span>
      </div>
    </div>

    <div class="chat-card geo-card">
      <!-- ── Yuqori panel: chat tarixi + yangi suhbat ── -->
      <div class="chat-topbar">
        <button class="topbar-btn" :title="settings.t('ai_history')" @click="historyOpen = true">
          <History :size="16" />
          <span class="topbar-btn-label">{{ settings.t('ai_history') }}</span>
          <span v-if="chats.length" class="topbar-count">{{ chats.length }}</span>
        </button>

        <p class="chat-title-text">{{ activeTitle }}</p>

        <button class="topbar-btn" :title="settings.t('ai_new_chat')" @click="startNewChat">
          <Plus :size="16" />
          <span class="topbar-btn-label">{{ settings.t('ai_new_chat') }}</span>
        </button>
      </div>

      <!-- ── Xabarlar ── -->
      <div ref="chatEl" class="chat-messages">
        <div v-if="loadingChat" class="chat-loading">
          <Loader2 :size="22" class="spin" />
        </div>

        <div v-else-if="!messages.length" class="chat-empty">
          <div class="chat-empty-icon">
            <Bot :size="34" style="color:hsl(var(--primary))" />
          </div>
          <p class="chat-empty-title">{{ settings.brandName }} AI</p>
          <p class="chat-empty-sub">{{ settings.t('ai_empty_sub') }}</p>
          <div class="suggestions">
            <button v-for="q in suggestions" :key="q" @click="send(q)" class="suggestion-chip">{{ q }}</button>
          </div>
        </div>

        <template v-else>
          <div v-for="(msg, i) in messages" :key="msg.createdAt ? msg.createdAt + i : i"
            class="message" :class="msg.role === 'user' ? 'message--user' : 'message--ai'">
            <div class="message-avatar" :class="msg.role === 'user' ? 'av-user' : 'av-ai'">
              <Bot v-if="msg.role === 'assistant'" :size="14" style="color:hsl(var(--primary))" />
              <User v-else :size="14" />
            </div>
            <div class="message-col" :class="msg.role === 'user' ? 'col-user' : 'col-ai'">
              <div class="message-bubble" :class="msg.role === 'user' ? 'bubble-user' : 'bubble-ai'">
                <span v-if="msg.role === 'user'" class="plain">{{ msg.content }}</span>
                <div v-else class="md" v-html="renderMarkdown(msg.content)"></div>
              </div>
              <p v-if="msg.meta?.offline" class="offline-note">
                <AlertTriangle :size="11" /> {{ settings.t('ai_offline_note') }}
              </p>
            </div>
          </div>
        </template>

        <div v-if="sending" class="message message--ai">
          <div class="message-avatar av-ai">
            <Bot :size="14" style="color:hsl(var(--primary))" />
          </div>
          <div class="message-bubble bubble-ai">
            <div class="typing-dots">
              <span v-for="d in [0,120,240]" :key="d" :style="`animation-delay:${d}ms`"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Kiritish ── -->
      <div class="chat-input-row">
        <input v-model="input" @keydown.enter.prevent="send()"
          :disabled="sending" class="geo-input chat-input"
          :placeholder="settings.t('ai_placeholder')" />
        <button @click="send()" :disabled="!input.trim() || sending" class="geo-btn-primary send-btn">
          <Send :size="16" />
        </button>
      </div>

      <!-- ── Chat tarixi paneli (yondan ochiladi) ── -->
      <div v-if="historyOpen" class="history-backdrop" @click="historyOpen = false"></div>
      <transition name="slide">
        <aside v-if="historyOpen" class="history-panel">
          <div class="history-head">
            <div class="history-head-title">
              <History :size="15" />
              <span>{{ settings.t('ai_history') }}</span>
            </div>
            <button class="icon-btn" :title="settings.t('ai_close')" @click="historyOpen = false">
              <X :size="16" />
            </button>
          </div>

          <button class="new-chat-btn" @click="startNewChat">
            <Plus :size="15" />
            <span>{{ settings.t('ai_new_chat') }}</span>
          </button>

          <div class="history-list">
            <div v-if="!chats.length" class="history-empty">
              <MessageSquare :size="26" />
              <p class="history-empty-title">{{ settings.t('ai_no_chats') }}</p>
              <p class="history-empty-sub">{{ settings.t('ai_no_chats_sub') }}</p>
            </div>

            <template v-else>
              <template v-for="group in groupedChats" :key="group.label">
                <p class="history-group">{{ group.label }}</p>
                <div v-for="c in group.items" :key="c.id"
                  class="history-item" :class="{ 'is-active': c.id === activeChatId }"
                  @click="openChat(c.id)">
                  <div class="history-item-main">
                    <p class="history-item-title">{{ c.title }}</p>
                    <p class="history-item-meta">{{ formatTime(c.updatedAt) }} · {{ c.messageCount }}</p>
                  </div>
                  <button class="icon-btn del-btn" :title="settings.t('ai_delete_chat')"
                    @click.stop="removeChat(c.id)">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </template>
            </template>
          </div>

          <button v-if="chats.length" class="clear-all-btn" @click="clearAll">
            <Trash2 :size="14" />
            <span>{{ settings.t('ai_clear_all') }}</span>
          </button>
        </aside>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import {
  Bot, User, Send, Info, History, Plus, X, Trash2,
  MessageSquare, Loader2, AlertTriangle,
} from "lucide-vue-next";
import { api } from "@/composables/api";
import { renderMarkdown } from "@/composables/markdown";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";

const settings = useSettingsStore();
const auth = useAuthStore();

const messages = ref([]);
const chats = ref([]);
const activeChatId = ref(null);
const input = ref("");
const sending = ref(false);
const loadingChat = ref(true);
const historyOpen = ref(false);
const chatEl = ref(null);

const STORAGE_KEY = computed(() => `geo_ai_chat_${auth.user?.id ?? "anon"}`);

const suggestions = computed(() => settings.language === "ru"
  ? ["Природные ресурсы Узбекистана", "О мировом океане", "Высочайшая гора Азии", "Что такое пустыня?", "О реке Нил"]
  : ["O'zbekistonning tabiiy boyliklari", "Dunyo okeani haqida", "Osiyoning eng baland tog'i", "Sahro nima?", "Nil daryosi haqida"]);

const activeTitle = computed(() => {
  const c = chats.value.find(x => x.id === activeChatId.value);
  return c?.title || settings.t('ai_new_chat');
});

// ── Sanaga qarab guruhlash (eng yangisi yuqorida) ─────────────────────────
const groupedChats = computed(() => {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

  const groups = [
    { label: settings.t('ai_today'), items: [] },
    { label: settings.t('ai_yesterday'), items: [] },
    { label: settings.t('ai_earlier'), items: [] },
  ];
  for (const c of chats.value) {
    const d = new Date(c.updatedAt);
    if (d >= startOfToday) groups[0].items.push(c);
    else if (d >= startOfYesterday) groups[1].items.push(c);
    else groups[2].items.push(c);
  }
  return groups.filter(g => g.items.length);
});

function formatTime(iso) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d >= today) return d.toLocaleTimeString(settings.language === "ru" ? "ru-RU" : "uz-UZ", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString(settings.language === "ru" ? "ru-RU" : "uz-UZ", { day: "2-digit", month: "2-digit" });
}

async function scrollToBottom(smooth = true) {
  await nextTick();
  chatEl.value?.scrollTo({ top: chatEl.value.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

// ── Yuklash ───────────────────────────────────────────────────────────────
async function loadChats() {
  try { chats.value = await api("/api/ai/chats"); } catch { chats.value = []; }
}

async function loadChat(id) {
  if (!id) { messages.value = []; activeChatId.value = null; return; }
  try {
    const chat = await api(`/api/ai/chats/${id}`);
    activeChatId.value = chat.id;
    messages.value = chat.messages ?? [];
    localStorage.setItem(STORAGE_KEY.value, String(chat.id));
  } catch {
    // Suhbat o'chirilgan bo'lsa — toza boshlaymiz
    activeChatId.value = null;
    messages.value = [];
    localStorage.removeItem(STORAGE_KEY.value);
  }
}

onMounted(async () => {
  loadingChat.value = true;
  await loadChats();
  const saved = Number(localStorage.getItem(STORAGE_KEY.value)) || null;
  const target = chats.value.some(c => c.id === saved) ? saved : (chats.value[0]?.id ?? null);
  await loadChat(target);
  loadingChat.value = false;
  scrollToBottom(false);
});

// ── Amallar ───────────────────────────────────────────────────────────────
function startNewChat() {
  activeChatId.value = null;
  messages.value = [];
  input.value = "";
  localStorage.removeItem(STORAGE_KEY.value);
  historyOpen.value = false;
}

async function openChat(id) {
  if (id === activeChatId.value) { historyOpen.value = false; return; }
  loadingChat.value = true;
  historyOpen.value = false;
  await loadChat(id);
  loadingChat.value = false;
  scrollToBottom(false);
}

async function removeChat(id) {
  if (!confirm(settings.t('ai_delete_chat_confirm'))) return;
  try { await api(`/api/ai/chats/${id}`, { method: "DELETE" }); } catch {}
  await loadChats();
  if (id === activeChatId.value) startNewChat();
}

async function clearAll() {
  if (!confirm(settings.t('ai_clear_all_confirm'))) return;
  try { await api("/api/ai/chats", { method: "DELETE" }); } catch {}
  chats.value = [];
  startNewChat();
}

async function send(q) {
  const question = q ?? input.value.trim();
  if (!question || sending.value) return;

  messages.value.push({ role: "user", content: question, createdAt: new Date().toISOString() });
  if (!q) input.value = "";
  sending.value = true;
  scrollToBottom();

  try {
    const res = await api("/api/ai/ask", {
      method: "POST",
      body: JSON.stringify({ question, language: settings.language, chatId: activeChatId.value }),
    });
    messages.value.push({
      role: "assistant",
      content: res.answer,
      createdAt: new Date().toISOString(),
      meta: { offline: res.offline, provider: res.provider },
    });
    if (res.chatId) {
      activeChatId.value = res.chatId;
      localStorage.setItem(STORAGE_KEY.value, String(res.chatId));
    }
    await loadChats();
  } catch (e) {
    messages.value.push({
      role: "assistant",
      content: e?.message || settings.t('ai_error'),
      createdAt: new Date().toISOString(),
      meta: { offline: true },
    });
  }

  sending.value = false;
  scrollToBottom();
}
</script>

<style scoped>
.ai-page { display: flex; flex-direction: column; height: calc(100vh - 72px); }
.ai-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 10px; }
.auto-tag { display: flex; align-items: center; gap: 6px; font-size: 12px; color: hsl(var(--muted-fg)); background: hsl(var(--muted)); padding: 6px 12px; border-radius: 99px; }

.chat-card { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; position: relative; }

/* ── Yuqori panel ── */
.chat-topbar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
}
.topbar-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 10px;
  border: 1.5px solid hsl(var(--border));
  background: transparent; color: hsl(var(--fg));
  font-size: 13px; font-family: inherit; font-weight: 500;
  cursor: pointer; transition: all .15s; flex-shrink: 0;
}
.topbar-btn:hover { border-color: hsl(var(--primary)); background: hsl(var(--primary)/0.06); color: hsl(var(--primary)); }
.topbar-count {
  background: hsl(var(--primary)/0.12); color: hsl(var(--primary));
  border-radius: 99px; padding: 1px 7px; font-size: 11px; font-weight: 700;
}
.chat-title-text {
  flex: 1; min-width: 0; text-align: center;
  font-size: 13.5px; font-weight: 600; color: hsl(var(--muted-fg));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ── Xabarlar ── */
.chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.chat-loading { flex: 1; display: flex; align-items: center; justify-content: center; color: hsl(var(--muted-fg)); }
.spin { animation: spin 1s linear infinite; }

.chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; }
.chat-empty-icon { width: 68px; height: 68px; border-radius: 20px; background: hsl(var(--primary)/0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.chat-empty-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.chat-empty-sub { font-size: 13.5px; color: hsl(var(--muted-fg)); margin-bottom: 20px; }
.suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 520px; }
.suggestion-chip { padding: 7px 14px; border-radius: 99px; border: 1.5px solid hsl(var(--border)); background: transparent; font-size: 13px; font-family: inherit; cursor: pointer; transition: all .15s; color: hsl(var(--fg)); }
.suggestion-chip:hover { border-color: hsl(var(--primary)); background: hsl(var(--primary)/0.06); color: hsl(var(--primary)); }

.message { display: flex; align-items: flex-start; gap: 10px; }
.message--user { flex-direction: row-reverse; }
.message-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.av-ai { background: hsl(var(--primary)/0.1); }
.av-user { background: hsl(var(--muted)); }
.message-col { display: flex; flex-direction: column; gap: 4px; max-width: 78%; min-width: 0; }
.col-user { align-items: flex-end; }
.col-ai { align-items: flex-start; }
.message-bubble { padding: 11px 15px; border-radius: 16px; font-size: 14px; line-height: 1.65; }
.bubble-ai { background: hsl(var(--muted)); border-bottom-left-radius: 4px; }
.bubble-user { background: hsl(var(--primary)); color: white; border-bottom-right-radius: 4px; }
.plain { white-space: pre-wrap; }
.offline-note { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: hsl(var(--warning)); padding: 0 4px; }

/* Markdown */
.md :deep(p) { margin: 0 0 8px; }
.md :deep(p:last-child) { margin-bottom: 0; }
.md :deep(p.md-h) { font-weight: 700; margin-top: 4px; }
.md :deep(ul), .md :deep(ol) { margin: 4px 0 8px; padding-left: 22px; }
.md :deep(ul) { list-style: disc; }
.md :deep(ol) { list-style: decimal; }
.md :deep(li) { margin-bottom: 4px; }
.md :deep(strong) { font-weight: 700; }
.md :deep(code) { background: hsl(var(--fg)/0.07); padding: 1px 5px; border-radius: 5px; font-size: 12.5px; }
.md :deep(.md-table-wrap) { overflow-x: auto; margin: 6px 0 8px; }
.md :deep(table) { border-collapse: collapse; font-size: 13px; min-width: 100%; }
.md :deep(th), .md :deep(td) { border: 1px solid hsl(var(--border)); padding: 6px 10px; text-align: left; }
.md :deep(th) { font-weight: 700; background: hsl(var(--fg)/0.04); }

.typing-dots { display: flex; gap: 4px; align-items: center; padding: 2px 0; }
.typing-dots span { width: 7px; height: 7px; border-radius: 50%; background: hsl(var(--muted-fg)); animation: bounce .8s ease-in-out infinite; }

.chat-input-row { display: flex; gap: 10px; padding: 14px 16px; border-top: 1px solid hsl(var(--border)); flex-shrink: 0; }
.chat-input { flex: 1; }
.send-btn { width: 44px; height: 44px; padding: 0; border-radius: 12px; flex-shrink: 0; }

/* ── Chat tarixi paneli ── */
.history-backdrop { position: absolute; inset: 0; background: hsl(0 0% 0% / .32); z-index: 20; }
.history-panel {
  position: absolute; top: 0; left: 0; bottom: 0;
  width: min(300px, 82%);
  background: hsl(var(--card));
  border-right: 1px solid hsl(var(--border));
  box-shadow: 4px 0 24px hsl(0 0% 0% / .12);
  display: flex; flex-direction: column;
  z-index: 21;
}
.history-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 14px 12px; border-bottom: 1px solid hsl(var(--border));
}
.history-head-title { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 700; }
.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 8px;
  border: none; background: transparent; color: hsl(var(--muted-fg));
  cursor: pointer; transition: all .15s; flex-shrink: 0;
}
.icon-btn:hover { background: hsl(var(--muted)); color: hsl(var(--fg)); }

.new-chat-btn {
  display: flex; align-items: center; justify-content: center; gap: 7px;
  margin: 12px; padding: 9px 12px; border-radius: 10px;
  border: 1.5px dashed hsl(var(--border)); background: transparent;
  color: hsl(var(--fg)); font-size: 13px; font-family: inherit; font-weight: 600;
  cursor: pointer; transition: all .15s;
}
.new-chat-btn:hover { border-color: hsl(var(--primary)); color: hsl(var(--primary)); background: hsl(var(--primary)/0.05); }

.history-list { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
.history-group {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
  color: hsl(var(--muted-fg)); padding: 10px 8px 6px;
}
.history-item {
  display: flex; align-items: center; gap: 6px;
  padding: 9px 10px; border-radius: 10px; cursor: pointer;
  transition: background .15s;
}
.history-item:hover { background: hsl(var(--muted)); }
.history-item.is-active { background: hsl(var(--primary)/0.1); }
.history-item.is-active .history-item-title { color: hsl(var(--primary)); }
.history-item-main { flex: 1; min-width: 0; }
.history-item-title { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.history-item-meta { font-size: 11px; color: hsl(var(--muted-fg)); margin-top: 2px; }
.del-btn { opacity: 0; }
.history-item:hover .del-btn, .history-item.is-active .del-btn { opacity: 1; }
.del-btn:hover { color: hsl(var(--destructive)); background: hsl(var(--destructive) / .1); }

.history-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 16px; color: hsl(var(--muted-fg)); gap: 6px; }
.history-empty-title { font-size: 13.5px; font-weight: 600; color: hsl(var(--fg)); margin-top: 6px; }
.history-empty-sub { font-size: 12px; }

.clear-all-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin: 8px 12px 12px; padding: 8px; border-radius: 10px;
  border: none; background: transparent; color: hsl(var(--muted-fg));
  font-size: 12.5px; font-family: inherit; cursor: pointer; transition: all .15s;
}
.clear-all-btn:hover { background: hsl(var(--destructive) / .1); color: hsl(var(--destructive)); }

.slide-enter-active, .slide-leave-active { transition: transform .22s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(-100%); }

@media (max-width: 640px) {
  .topbar-btn-label { display: none; }
  .topbar-btn { padding: 7px 10px; }
  .message-col { max-width: 88%; }
}
</style>
