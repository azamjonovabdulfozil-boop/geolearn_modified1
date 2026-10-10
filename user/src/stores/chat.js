import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "@shared/composables/api";
import { subscribeLive } from "@shared/composables/live";
import { play } from "../lib/gameKit";

// Chat bo'yicha umumiy holat: o'qilmagan xabarlar soni (yon paneldagi belgi)
// va boshqa sahifada turganda chiqadigan "yangi xabar" bildirishnomalari.
export const useChatStore = defineStore("chat", () => {
  const unread = ref(0);
  const toasts = ref([]);        // { id, peerId, name, avatarUrl, text }
  const openPeerId = ref(null);  // hozir ochiq turgan suhbat (Chat.vue o'rnatadi)
  let stopLive = null;
  let myId = null;

  async function refreshUnread() {
    try { unread.value = (await api("/api/chat/unread")).unread ?? 0; } catch {}
  }

  function preview(m) {
    if (m.text) return m.text;
    return { image: "📷 Rasm", voice: "🎤 Ovozli xabar", audio: "🎵 Audio", video: "🎬 Video", file: "📎 " + (m.file?.name ?? "Fayl") }[m.kind] ?? "Xabar";
  }

  function onEvent(e) {
    if (e.type !== "new" || e.message?.to !== myId) return;
    // Suhbat ochiq va sahifa ko'rinib turgan bo'lsa — Chat.vue o'zi "o'qildi" qiladi
    if (openPeerId.value === e.peerId && document.visibilityState === "visible") return;
    unread.value++;
    play("message");
    const toast = { id: e.message.id, peerId: e.peerId, name: e.from?.name ?? "Do'stingiz", avatarUrl: e.from?.avatarUrl ?? null, text: preview(e.message) };
    toasts.value = [...toasts.value.slice(-2), toast];
    setTimeout(() => dismiss(toast.id), 6000);
  }
  function dismiss(id) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  function start(userId) {
    stop();
    myId = userId;
    stopLive = subscribeLive("chat", onEvent);
    refreshUnread();
  }
  function stop() {
    stopLive?.();
    stopLive = null;
    toasts.value = [];
  }

  return { unread, toasts, openPeerId, start, stop, refreshUnread, dismiss, preview };
});
