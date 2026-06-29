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
      <div ref="chatEl" class="chat-messages">
        <div v-if="!messages.length" class="chat-empty">
          <div class="chat-empty-icon">
            <Bot :size="36" style="color:hsl(var(--primary))" />
          </div>
          <p class="chat-empty-title">{{ settings.brandName }} AI</p>
          <p class="chat-empty-sub">{{ settings.t('ai_empty_sub') }}</p>
          <div class="suggestions">
            <button v-for="q in suggestions" :key="q" @click="send(q)" class="sugg-chip">{{ q }}</button>
          </div>
        </div>

        <div v-for="(msg, i) in messages" :key="i"
          class="msg" :class="msg.role === 'user' ? 'msg--user' : 'msg--ai'">
          <div class="msg-av" :class="msg.role === 'user' ? 'av-user' : 'av-ai'">
            <Bot v-if="msg.role === 'assistant'" :size="14" style="color:hsl(var(--primary))" />
            <User v-else :size="14" />
          </div>
          <div class="msg-bubble" :class="msg.role === 'user' ? 'b-user' : 'b-ai'">
            {{ msg.content }}
          </div>
        </div>

        <div v-if="sending" class="msg msg--ai">
          <div class="msg-av av-ai">
            <Bot :size="14" style="color:hsl(var(--primary))" />
          </div>
          <div class="msg-bubble b-ai">
            <div class="typing">
              <span v-for="d in [0,120,240]" :key="d" :style="`animation-delay:${d}ms`"></span>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-input-row">
        <input v-model="input" @keydown.enter.prevent="send()"
          :disabled="sending" class="geo-input chat-input"
          :placeholder="settings.t('ai_placeholder')" />
        <button @click="send()" :disabled="!input.trim() || sending" class="geo-btn-primary send-btn">
          <Send :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from "vue";
import { Bot, User, Send, Info } from "lucide-vue-next";
import { api } from "@/composables/api";
import { useSettingsStore } from "@/stores/settings";

const settings = useSettingsStore();
const messages = ref([]);
const input = ref("");
const sending = ref(false);
const chatEl = ref(null);

const suggestions = computed(() => settings.language === "ru"
  ? ["Природные ресурсы Узбекистана", "О мировых океанах", "Высочайшая гора Азии", "Что такое пустыня?", "О реке Нил"]
  : ["O'zbekistonning tabiiy boyliklari", "Dunyo okeanlar haqida", "Osiyo qit'asining eng baland tog'i", "Sahro nima?", "Nil daryosi haqida"]);

async function send(q) {
  const question = q ?? input.value.trim();
  if (!question || sending.value) return;
  messages.value.push({ role: "user", content: question });
  if (!q) input.value = "";
  sending.value = true;
  await nextTick();
  chatEl.value?.scrollTo({ top: chatEl.value.scrollHeight, behavior: "smooth" });
  try {
    const res = await api("/api/ai/ask", { method: "POST", body: JSON.stringify({ question, language: settings.language }) });
    messages.value.push({ role: "assistant", content: res.answer });
  } catch (e) {
    messages.value.push({ role: "assistant", content: e?.message || settings.t('ai_error') });
  }
  sending.value = false;
  await nextTick();
  chatEl.value?.scrollTo({ top: chatEl.value.scrollHeight, behavior: "smooth" });
}
</script>

<style scoped>
.ai-page { display: flex; flex-direction: column; height: calc(100vh - 72px); }
.ai-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 10px; }
.auto-tag { display: flex; align-items: center; gap: 6px; font-size: 12px; color: hsl(var(--muted-fg)); background: hsl(var(--muted)); padding: 6px 12px; border-radius: 99px; }
.chat-card { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
.chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; }
.chat-empty-icon { width: 72px; height: 72px; border-radius: 20px; background: hsl(var(--primary)/0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.chat-empty-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.chat-empty-sub { font-size: 13.5px; color: hsl(var(--muted-fg)); margin-bottom: 20px; }
.suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 520px; }
.sugg-chip { padding: 7px 14px; border-radius: 99px; border: 1.5px solid hsl(var(--border)); background: transparent; font-size: 13px; font-family: inherit; cursor: pointer; transition: all .15s; color: hsl(var(--fg)); }
.sugg-chip:hover { border-color: hsl(var(--primary)); background: hsl(var(--primary)/0.06); color: hsl(var(--primary)); }
.msg { display: flex; align-items: flex-start; gap: 10px; }
.msg--user { flex-direction: row-reverse; }
.msg-av { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.av-ai { background: hsl(var(--primary)/0.1); }
.av-user { background: hsl(var(--muted)); }
.msg-bubble { max-width: 75%; padding: 11px 15px; border-radius: 16px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.b-ai { background: hsl(var(--muted)); border-bottom-left-radius: 4px; }
.b-user { background: hsl(var(--primary)); color: white; border-bottom-right-radius: 4px; }
.typing { display: flex; gap: 4px; align-items: center; padding: 2px 0; }
.typing span { width: 7px; height: 7px; border-radius: 50%; background: hsl(var(--muted-fg)); animation: bounce .8s ease-in-out infinite; }
.chat-input-row { display: flex; gap: 10px; padding: 14px 16px; border-top: 1px solid hsl(var(--border)); }
.chat-input { flex: 1; }
.send-btn { width: 44px; height: 44px; padding: 0; border-radius: 12px; flex-shrink: 0; }
</style>
