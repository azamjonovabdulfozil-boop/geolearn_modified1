import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "@shared/composables/api";
import { subscribeLive } from "@shared/composables/live";
import { play } from "../lib/gameKit";

// Jamoaviy o'yin holati: men a'zo bo'lgan xona va menga kelgan takliflar.
// Server har o'zgarishda "team" hodisasini yuboradi; ulanish uzilsa ham
// ishlashi uchun holat vaqti-vaqti bilan qayta so'raladi.
export const useTeamStore = defineStore("team", () => {
  const room = ref(null);
  const invites = ref([]);      // menga kelgan takliflar
  const note = ref("");         // qisqa xabar: "Sardor sizni jamoadan chiqardi" ...
  const offset = ref(0);        // server soati − mening soatim (ms)
  let dismissed = null;         // yopilgan natija ekrani (server uni yana bir muddat qaytaradi)
  let pollTimer = null, noteTimer = null, stopLive = null;

  const active = computed(() => room.value?.status === "active");
  const now = () => Date.now() + offset.value;

  function setRoom(r) {
    if (r?.serverNow) offset.value = r.serverNow - Date.now();
    if (r && r.status === "finished" && r.id === dismissed) return;
    const wasActive = room.value?.status === "active" && room.value?.id === r?.id;
    if (r?.status === "finished" && wasActive) {
      const w = r.result?.winner;
      play(w == null ? "tick" : w === r.myTeam ? "win" : "lose");
    }
    room.value = r;
  }
  function say(text) {
    if (!text) return;
    note.value = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note.value = ""; }, 5000);
  }

  function onEvent(e) {
    if ("room" in e) { setRoom(e.room); schedule(); }
    if (e.invite) {
      if (e.invite.serverNow) offset.value = e.invite.serverNow - Date.now();
      if (!invites.value.some(i => i.id === e.invite.id)) play("invite");
      invites.value = [...invites.value.filter(i => i.id !== e.invite.id), e.invite];
    }
    if (e.inviteClosed) invites.value = invites.value.filter(i => i.id !== e.inviteClosed);
    if (e.note) say(e.note);
  }

  async function refresh() {
    try {
      const data = await api("/api/teams/mine");
      setRoom(data.room);
      invites.value = data.invites ?? [];
    } catch {}
  }
  function schedule() {
    clearTimeout(pollTimer);
    const delay = active.value ? 2500 : room.value?.status === "lobby" ? 4000 : 15000;
    pollTimer = setTimeout(async () => { await refresh(); schedule(); }, delay);
  }

  function start() {
    stop();
    stopLive = subscribeLive("team", onEvent);
    refresh().then(schedule);
  }
  function stop() {
    clearTimeout(pollTimer);
    stopLive?.();
    stopLive = null;
  }

  const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body ?? {}) });

  async function create(game) {
    dismissed = null;
    setRoom(await post("/api/teams", { game }));
    schedule();
  }
  async function invite(userId, role) {
    setRoom(await post(`/api/teams/${room.value.id}/invite`, { userId, role }));
  }
  async function accept(id) {
    dismissed = null;
    const r = await post(`/api/teams/invites/${id}/accept`);
    invites.value = invites.value.filter(i => i.id !== id);
    setRoom(r);
    schedule();
  }
  async function decline(id) {
    invites.value = invites.value.filter(i => i.id !== id);
    try { await post(`/api/teams/invites/${id}/decline`); } catch {}
  }
  async function kick(userId) {
    setRoom(await post(`/api/teams/${room.value.id}/kick`, { userId }));
  }
  async function leave() {
    const r = room.value;
    if (!r) return;
    if (r.status === "lobby") room.value = null;
    try { await post(`/api/teams/${r.id}/leave`); } catch {}
  }
  async function begin() {
    setRoom(await post(`/api/teams/${room.value.id}/start`));
    schedule();
  }
  async function report(score, done = false) {
    if (!room.value) return;
    setRoom(await post(`/api/teams/${room.value.id}/move`, { score, done }));
  }
  /** Natija ekranini yopish. */
  function dismiss() {
    if (room.value?.status === "finished") { dismissed = room.value.id; room.value = null; }
  }

  return { room, invites, note, active, now, start, stop, refresh, create, invite, accept, decline, kick, leave, begin, report, dismiss };
});
