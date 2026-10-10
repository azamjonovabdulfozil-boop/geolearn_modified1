import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "@shared/composables/api";
import { subscribeLive, reconnectLive } from "@shared/composables/live";
import { play } from "../lib/gameKit";

// 1 ga 1 o'yinlar holati: menga kelgan takliflar va hozirgi o'yinim.
// Server har bir o'zgarishda shaxsiy "duel" hodisasini yuboradi; ulanish
// uzilib qolsa ham ishlashi uchun holat vaqti-vaqti bilan qayta so'raladi
// (bu so'rov serverga "men shu yerdaman" belgisi ham bo'ladi).
const CLOSED = ["declined", "cancelled", "expired"];

export const useDuelStore = defineStore("duel", () => {
  const incoming = ref([]);     // menga kelgan takliflar
  const current = ref(null);    // men chaqirgan / o'ynayotgan / hozirgina tugagan o'yin
  const offset = ref(0);        // server soati − mening soatim (ms)
  let pollTimer = null;
  let stopLive = null;

  const active = computed(() => current.value?.status === "active");

  /** Server vaqti bo'yicha "hozir" (taymerlar ikkala o'yinchida bir xil yurishi uchun). */
  function now() {
    return Date.now() + offset.value;
  }

  function apply(view) {
    if (!view?.id) return;
    if (view.serverNow) offset.value = view.serverNow - Date.now();

    const wasIncoming = incoming.value.some(d => d.id === view.id);
    if (view.status === "pending" && view.me === 1) {
      incoming.value = [...incoming.value.filter(d => d.id !== view.id), view];
      if (!wasIncoming) play("invite");
      return;
    }
    incoming.value = incoming.value.filter(d => d.id !== view.id);

    if (view.status === "pending") { current.value = view; return; }
    if (view.status === "active") {
      const starting = current.value?.id !== view.id || current.value?.status !== "active";
      current.value = view;
      if (starting) schedule();
      return;
    }
    // Tugagan yoki yopilgan: faqat o'zim ko'rib turgan o'yin bo'lsa ko'rsatamiz
    if (current.value?.id === view.id) {
      const justFinished = current.value.status === "active" && view.status === "finished";
      current.value = view;
      if (justFinished) {
        const mine = view.players[view.me]?.userId;
        play(view.result?.winnerId == null ? "tick" : view.result.winnerId === mine ? "win" : "lose");
      }
    }
  }

  async function refresh() {
    try {
      const data = await api("/api/duels/mine");
      incoming.value = data.incoming ?? [];
      if (data.current) apply(data.current);
      else if (current.value && ["pending", "active"].includes(current.value.status)) {
        // Server bu o'yinni yopgan (tugagan, rad etilgan) — yakuniy holatni olamiz
        try { apply(await api(`/api/duels/${current.value.id}`)); }
        catch { current.value = null; }
      }
    } catch {}
  }

  function schedule() {
    clearTimeout(pollTimer);
    // O'yin paytida tez-tez (jonli hisob va "shu yerdaman" belgisi), aks holda sekin
    const delay = active.value ? 2000 : current.value?.status === "pending" ? 3000 : 12000;
    pollTimer = setTimeout(async () => { await refresh(); schedule(); }, delay);
  }

  /** O'quvchi saytga kirganda bir marta chaqiriladi. */
  function start() {
    stop();
    reconnectLive();
    stopLive = subscribeLive("duel", apply);
    refresh().then(schedule);
  }
  function stop() {
    clearTimeout(pollTimer);
    stopLive?.();
    stopLive = null;
  }

  async function invite({ opponentId, game, topicId }) {
    const view = await api("/api/duels", { method: "POST", body: JSON.stringify({ opponentId, game, topicId }) });
    apply(view);
    schedule();
    return view;
  }
  async function accept(id) {
    const view = await api(`/api/duels/${id}/accept`, { method: "POST" });
    apply(view);
    return view;
  }
  async function decline(id) {
    incoming.value = incoming.value.filter(d => d.id !== id);
    try { await api(`/api/duels/${id}/decline`, { method: "POST" }); } catch {}
  }
  async function cancel() {
    const d = current.value;
    if (!d) return;
    current.value = null;
    try { await api(`/api/duels/${d.id}/cancel`, { method: "POST" }); } catch {}
  }
  /** O'yinni tashlab chiqish (raqib g'olib bo'ladi). */
  async function leave() {
    const d = current.value;
    if (!d) return;
    try { apply(await api(`/api/duels/${d.id}/leave`, { method: "POST" })); } catch {}
  }
  /** Yurish. Javobda serverning shu yurishga bahosi qaytadi. */
  async function move(body) {
    const d = current.value;
    if (!d) return null;
    const reply = await api(`/api/duels/${d.id}/move`, { method: "POST", body: JSON.stringify(body) });
    if (reply?.duel) apply(reply.duel);
    return reply;
  }
  /** Natija ekranini yopish. */
  function clear() {
    if (current.value && (current.value.status === "finished" || CLOSED.includes(current.value.status))) {
      current.value = null;
    }
  }

  return { incoming, current, active, now, start, stop, refresh, invite, accept, decline, cancel, leave, move, clear };
});
