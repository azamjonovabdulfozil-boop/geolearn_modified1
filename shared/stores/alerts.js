import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "@shared/composables/api";
import { useLive } from "@shared/composables/live";

// O'quvchi AI ga so'kinib yozganda keladigan xabarlar (faqat admin panel).
// Yangi xabar kelsa — `fresh` ga tushadi va Layout uni toast qilib ko'rsatadi.
export const useAlertsStore = defineStore("alerts", () => {
  const items = ref([]);
  const fresh = ref([]);
  let loaded = false;
  let started = false;

  const unread = computed(() => items.value.filter(a => !a.reviewed));

  async function load() {
    try {
      const data = await api("/api/ai/alerts");
      const known = new Set(items.value.map(a => a.id));
      const incoming = (data.items ?? []).filter(a => !a.reviewed && !known.has(a.id));
      if (loaded && incoming.length) fresh.value = [...incoming, ...fresh.value].slice(0, 4);
      items.value = data.items ?? [];
      loaded = true;
    } catch {}
  }

  /** Bir marta ishga tushiriladi: yuklaydi va real vaqtda kuzatadi. */
  function start() {
    if (started) return;
    started = true;
    load();
    useLive(["ai_logs"], load, { delay: 150 });
  }

  function dismiss(id) { fresh.value = fresh.value.filter(a => a.id !== id); }

  async function review(id) {
    items.value = items.value.map(a => (id === "all" || a.id === id ? { ...a, reviewed: true } : a));
    dismiss(id);
    if (id === "all") fresh.value = [];
    try { await api(`/api/ai/alerts/${id}/review`, { method: "PUT" }); } catch { load(); }
  }

  return { items, unread, fresh, start, load, review, dismiss };
});
