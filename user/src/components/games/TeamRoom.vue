<template>
  <div class="tr" :style="{ '--c1': game.colors[0], '--c2': game.colors[1] }">
    <!-- Sarlavha: o'yin va jamoalar hisobi -->
    <header class="tr-head">
      <div class="tr-total" :class="{ mine: room.myTeam === 0 }">
        <span class="tr-total-name">{{ teamName(0) }}</span>
        <span class="tr-total-num">{{ lobby ? room.teams[0].length : room.totals[0] }}</span>
      </div>
      <div class="tr-mid">
        <component :is="game.icon" :size="26" />
        <span class="tr-mid-title">{{ game.title }}</span>
        <span v-if="playing" class="tr-clock" :class="{ urgent: left <= 10 }">{{ clock(left) }}</span>
        <span v-else class="tr-mid-sub">{{ lobby ? "Jamoalar yig'ilmoqda" : "Jamoaviy bellashuv" }}</span>
      </div>
      <div class="tr-total right" :class="{ mine: room.myTeam === 1 }">
        <span class="tr-total-name">{{ teamName(1) }}</span>
        <span class="tr-total-num">{{ lobby ? room.teams[1].length : room.totals[1] }}</span>
      </div>
    </header>

    <!-- ── Xona: jamoalarni yig'ish ── -->
    <template v-if="lobby">
      <div class="tr-teams">
        <section v-for="t in 2" :key="t" class="tr-team" :class="{ mine: room.myTeam === t - 1 }">
          <h3 class="tr-team-title">
            <Shield :size="16" /> {{ teamName(t - 1) }}
            <span class="tr-count">{{ room.teams[t - 1].length }} / {{ room.maxTeam }}</span>
          </h3>
          <div v-for="m in room.teams[t - 1]" :key="m.userId" class="tr-member">
            <span class="tr-av"><img v-if="m.avatarUrl" :src="m.avatarUrl" alt="" /><template v-else>{{ initial(m.name) }}</template></span>
            <span class="tr-member-text">
              <span class="tr-member-name">{{ m.name }}<template v-if="m.userId === myId"> (siz)</template></span>
              <span class="tr-member-sub">{{ m.className }}</span>
            </span>
            <span v-if="m.leader" class="tr-badge"><Crown :size="12" /> Sardor</span>
            <button v-else-if="iLead && room.myTeam === t - 1" class="tr-x" title="Jamoadan chiqarish" @click="act(() => team.kick(m.userId))"><X :size="15" /></button>
          </div>
          <div v-for="inv in room.invites.filter(i => i.team === t - 1)" :key="inv.id" class="tr-member pending">
            <span class="tr-av tr-av--wait"><Hourglass :size="16" /></span>
            <span class="tr-member-text">
              <span class="tr-member-name">{{ inv.name }}</span>
              <span class="tr-member-sub">{{ inv.leader ? "sardorlikka chaqirildi" : "taklif yuborildi" }} — javob kutilmoqda</span>
            </span>
            <button v-if="canCancel(inv)" class="tr-x" title="Taklifni bekor qilish" @click="act(() => team.kick(inv.userId))"><X :size="15" /></button>
          </div>
          <p v-if="!room.teams[t - 1].length && !room.invites.some(i => i.team === t - 1)" class="tr-empty">
            {{ isOwner ? "Raqib jamoaning sardorini chaqiring" : "Hali hech kim yo'q" }}
          </p>
        </section>
      </div>

      <!-- O'yinchi chaqirish -->
      <section v-if="iLead" class="tr-invite geo-card">
        <div class="tr-modes">
          <button v-if="isOwner" class="tr-mode" :class="{ active: mode === 'leader' }" :disabled="!canInviteLeader" @click="mode = 'leader'">
            <Crown :size="14" /> Raqib sardor
          </button>
          <button class="tr-mode" :class="{ active: mode === 'player' }" @click="mode = 'player'">
            <UserPlus :size="14" /> O'z jamoamga o'yinchi
          </button>
        </div>
        <p class="tr-invite-hint">
          {{ mode === 'leader' ? "Raqib jamoani boshqaradigan do'stingizni toping — u o'z o'yinchilarini o'zi yig'adi." : "Jamoangizga qo'shmoqchi bo'lgan o'yinchini ismi va sinfi bo'yicha toping." }}
        </p>
        <div class="tr-search">
          <div class="tr-search-field">
            <Search :size="15" class="tr-search-icon" />
            <input v-model="qName" class="geo-input tr-search-input" placeholder="Ism" @input="searchSoon" />
          </div>
          <input v-model="qClass" class="geo-input tr-class" placeholder="Sinf: 7-A" maxlength="8" @input="searchSoon" />
        </div>
        <div class="tr-results">
          <div v-for="f in results" :key="f.id" class="tr-member">
            <span class="tr-av" :class="{ online: f.online }"><img v-if="f.avatarUrl" :src="f.avatarUrl" alt="" /><template v-else>{{ initial(f.name) }}</template></span>
            <span class="tr-member-text">
              <span class="tr-member-name">{{ f.name }}</span>
              <span class="tr-member-sub">{{ f.className || '—' }} · {{ inRoom(f.id) ? "xonada" : f.busy ? "boshqa o'yinda" : f.online ? "saytda" : "saytda emas" }}</span>
            </span>
            <button class="tr-add" :disabled="busy || !f.online || f.busy || inRoom(f.id) || (mode === 'leader' && !canInviteLeader)" @click="invite(f)">
              <component :is="mode === 'leader' ? Crown : UserPlus" :size="14" /> Chaqirish
            </button>
          </div>
          <p v-if="!results.length" class="tr-empty">{{ searching ? "Qidirilmoqda..." : qName || qClass ? "Bunday o'quvchi topilmadi" : "Ism yoki sinfni yozing" }}</p>
        </div>
      </section>
      <p v-else class="tr-wait-note"><Hourglass :size="15" /> Sardorlar jamoalarni yig'yapti — o'yin boshlanishini kuting</p>

      <p v-if="error" class="tr-error">{{ error }}</p>
      <div class="tr-actions">
        <button class="geo-btn-outline" @click="confirmLeave"><LogOut :size="15" /> {{ isOwner ? "Xonani yopish" : "Xonadan chiqish" }}</button>
        <button v-if="isOwner" class="geo-btn-primary" :disabled="busy || !room.teams[1].length" @click="act(() => team.begin())">
          <Play :size="15" /> O'yinni boshlash
        </button>
      </div>
      <p v-if="isOwner && !room.teams[1].length" class="tr-hint">Boshlash uchun raqib sardor taklifni qabul qilishi kerak</p>
      <p class="tr-hint">Jamoa ochkosi — eng yaxshi natijalar yig'indisi (kichik jamoadagi o'yinchilar soni bo'yicha), shuning uchun jamoalar teng bo'lmasa ham adolatli.</p>
    </template>

    <!-- ── O'yin ── -->
    <template v-else>
      <div class="tr-play">
        <div class="tr-game">
          <component :is="arcade.component" v-bind="arcade.props" :seed="room.seed" :active="running" @score="onScore" @over="onOver" />
          <p v-if="iAmDone && !finished" class="tr-wait-note"><Hourglass :size="15" /> Siz tugatdingiz — jamoadoshlaringiz hali o'ynayapti</p>

          <Transition name="fade">
            <div v-if="countdown > 0 && !finished" class="tr-overlay">
              <p class="tr-rules">{{ game.rules }}</p>
              <span :key="countdown" class="tr-count-num">{{ countdown }}</span>
            </div>
          </Transition>
          <Transition name="fade">
            <div v-if="finished" class="tr-overlay">
              <div class="tr-result" :class="outcome">
                <span class="tr-result-icon"><component :is="outcome === 'win' ? Trophy : outcome === 'lose' ? Frown : Handshake" :size="42" /></span>
                <p class="tr-result-title">{{ outcome === 'win' ? "Jamoangiz g'olib!" : outcome === 'lose' ? "Bu safar raqib jamoa yutdi" : "Durang" }}</p>
                <div class="tr-result-score"><span>{{ room.totals[room.myTeam] }}</span><span class="colon">:</span><span>{{ room.totals[other] }}</span></div>
                <p v-if="room.counted && room.teams[0].length !== room.teams[1].length" class="tr-result-sub">Har jamoadan eng yaxshi {{ room.counted }} ta natija hisoblandi</p>
                <p v-if="reward" class="tr-reward">+{{ reward }} ball reytingga qo'shildi</p>
                <button class="geo-btn-primary" @click="team.dismiss()"><ArrowLeft :size="15" /> O'yinlarga qaytish</button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Jonli jadval -->
        <aside class="tr-board">
          <section v-for="t in 2" :key="t" class="tr-team" :class="{ mine: room.myTeam === t - 1 }">
            <h3 class="tr-team-title"><Shield :size="15" /> {{ teamName(t - 1) }} <span class="tr-count">{{ room.totals[t - 1] }}</span></h3>
            <div v-for="m in sorted(t - 1)" :key="m.userId" class="tr-row" :class="{ me: m.userId === myId }">
              <span class="tr-row-name">{{ m.name }}</span>
              <Check v-if="m.done" :size="13" class="tr-row-done" />
              <span class="tr-row-score">{{ m.userId === myId ? Math.max(m.score, localScore) : m.score }}</span>
            </div>
          </section>
        </aside>
      </div>
      <button v-if="!finished" class="tr-leave" @click="confirmLeave"><Flag :size="14" /> O'yindan chiqish</button>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import {
  Shield, Crown, X, Hourglass, UserPlus, Search, LogOut, Play, Trophy, Frown, Handshake, ArrowLeft, Check, Flag,
} from "lucide-vue-next";
import { api } from "@shared/composables/api";
import { useAuthStore } from "@shared/stores/auth";
import { useTeamStore } from "../../stores/team";
import { gameById } from "../../lib/games";
import { ARCADE } from "../../lib/arcade";
import { clock, play } from "../../lib/gameKit";

// Jamoaviy o'yin xonasi: avval ikki sardor jamoa yig'adi, keyin hamma bir vaqtda
// bitta o'yinni o'ynaydi va jamoalar ochkosi solishtiriladi.
const props = defineProps({ room: { type: Object, required: true } });
const auth = useAuthStore();
const team = useTeamStore();

const REPORT_MS = 900;
const myId = computed(() => auth.user?.id);
const game = computed(() => gameById(props.room.game));
const arcade = computed(() => ARCADE[props.room.game]);
const lobby = computed(() => props.room.status === "lobby");
const finished = computed(() => props.room.status === "finished");
const isOwner = computed(() => props.room.ownerId === myId.value);
const me = computed(() => props.room.teams.flat().find(m => m.userId === myId.value));
const iLead = computed(() => Boolean(me.value?.leader));
const other = computed(() => (props.room.myTeam === 0 ? 1 : 0));
const initial = name => (name || "?").charAt(0).toUpperCase();

function teamName(i) {
  const leader = props.room.teams[i].find(m => m.leader);
  if (i === props.room.myTeam) return "Sizning jamoa";
  return leader ? `${leader.name.split(" ")[0]} jamoasi` : "Raqib jamoa";
}
const sorted = i => [...props.room.teams[i]].sort((a, b) => b.score - a.score);
const inRoom = id => props.room.teams.flat().some(m => m.userId === id) || props.room.invites.some(i => i.userId === id);
const canCancel = inv => iLead.value && (inv.team === props.room.myTeam || (inv.leader && isOwner.value));
const canInviteLeader = computed(() => isOwner.value && !props.room.teams[1].length && !props.room.invites.some(i => i.leader));

// ── Xona: qidiruv va taklif ──
const mode = ref("player");
const qName = ref("");
const qClass = ref("");
const results = ref([]);
const searching = ref(false);
const busy = ref(false);
const error = ref("");
let searchTimer = null;

async function search() {
  if (!iLead.value || !lobby.value) return;
  searching.value = true;
  try {
    const q = new URLSearchParams({ q: qName.value.trim(), className: qClass.value.trim() });
    results.value = await api(`/api/teams/players?${q}`);
  } catch { results.value = []; }
  searching.value = false;
}
function searchSoon() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(search, 280);
}
async function act(fn) {
  busy.value = true; error.value = "";
  try { await fn(); } catch (e) { error.value = e.message || "Amal bajarilmadi"; }
  busy.value = false;
}
function invite(f) {
  act(async () => { await team.invite(f.id, mode.value); play("click"); });
}
function confirmLeave() {
  const text = lobby.value
    ? (isOwner.value ? "Xona yopiladi va hamma chiqariladi. Davom etasizmi?" : "Xonadan chiqasizmi?")
    : "O'yindan chiqsangiz, shu paytgacha to'plagan ochkongiz jamoada qoladi. Chiqasizmi?";
  if (window.confirm(text)) team.leave();
}
// Raqib sardor hali yo'q bo'lsa — egasi avval uni chaqiradi
watch(canInviteLeader, (can) => { mode.value = can ? "leader" : "player"; }, { immediate: true });

// ── O'yin: ochkoni serverga yetkazish ──
const tick = ref(0);
const localScore = ref(0);
const localDone = ref(false);
let timer = null, lastSent = 0, sendTimer = null, doneSent = false, lastCount = 0, lastRefresh = 0;

const countdown = computed(() => { tick.value; return props.room.startsAt ? Math.max(0, Math.ceil((props.room.startsAt - team.now()) / 1000)) : 0; });
const left = computed(() => { tick.value; return props.room.endsAt ? Math.max(0, (props.room.endsAt - team.now()) / 1000) : 0; });
const playing = computed(() => props.room.status === "active" && countdown.value === 0);
const iAmDone = computed(() => localDone.value || Boolean(me.value?.done));
const running = computed(() => playing.value && !iAmDone.value && left.value > 0);

const outcome = computed(() => {
  const w = props.room.result?.winner;
  return w == null ? "draw" : w === props.room.myTeam ? "win" : "lose";
});
const reward = computed(() => props.room.result?.rewards?.[myId.value] ?? 0);

function send(done = false) {
  clearTimeout(sendTimer);
  lastSent = Date.now();
  if (done) doneSent = true;
  team.report(localScore.value, done).catch(() => { if (done) doneSent = false; });
}
function onScore(n) {
  localScore.value = n;
  if (doneSent) return;
  const wait = REPORT_MS - (Date.now() - lastSent);
  if (wait <= 0) send();
  else { clearTimeout(sendTimer); sendTimer = setTimeout(() => send(), wait); }
}
function onOver() {
  localDone.value = true;
  send(true);
}

onMounted(() => {
  search();
  timer = setInterval(() => {
    tick.value++;
    if (props.room.status !== "active") {
      // Xonada kutayotganda "saytda / band" holati yangilanib turadi
      if (lobby.value && iLead.value && Date.now() - lastRefresh > 6000) { lastRefresh = Date.now(); search(); }
      return;
    }
    if (countdown.value !== lastCount) {
      if (countdown.value > 0 && countdown.value <= 3) play("tick");
      lastCount = countdown.value;
    }
    if (!doneSent && countdown.value === 0 && left.value <= 0) onOver();
    if (localDone.value && !doneSent) send(true);
  }, 200);
});
onUnmounted(() => { clearInterval(timer); clearTimeout(sendTimer); clearTimeout(searchTimer); });
</script>

<style scoped>
.tr { display: flex; flex-direction: column; gap: 16px; }
.tr-head {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding: 14px 18px; border-radius: 22px; color: #fff;
  background: radial-gradient(circle at 50% -40%, rgba(255, 255, 255, .25), transparent 60%), linear-gradient(135deg, var(--c1), var(--c2));
  box-shadow: 0 14px 34px rgba(0, 0, 0, .22);
}
.tr-total { display: flex; flex-direction: column; min-width: 0; }
.tr-total.right { align-items: flex-end; text-align: right; }
.tr-total-name { font-size: 12.5px; font-weight: 700; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.tr-total.mine .tr-total-name { opacity: 1; text-decoration: underline; text-underline-offset: 3px; }
.tr-total-num { font-size: 34px; font-weight: 900; line-height: 1.05; font-variant-numeric: tabular-nums; text-shadow: 0 2px 8px rgba(0, 0, 0, .3); }
.tr-mid { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 6px; text-align: center; }
.tr-mid-title { font-size: 12px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
.tr-mid-sub { font-size: 11px; opacity: .85; }
.tr-clock { font-size: 17px; font-weight: 900; font-variant-numeric: tabular-nums; padding: 0 10px; border-radius: 99px; background: rgba(0, 0, 0, .3); }
.tr-clock.urgent { background: #d32f2f; }

.tr-teams { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.tr-team { padding: 14px; border-radius: 18px; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); min-width: 0; }
.tr-team.mine { border-color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--primary) / .12); }
.tr-team-title { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; font-size: 14px; font-weight: 800; }
.tr-count { margin-left: auto; padding: 1px 9px; border-radius: 99px; background: hsl(var(--muted)); font-size: 12px; font-variant-numeric: tabular-nums; }
.tr-member { display: flex; align-items: center; gap: 10px; padding: 7px 4px; }
.tr-member.pending { opacity: .7; }
.tr-av {
  position: relative; flex: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: hsl(var(--primary)); color: #fff; font-weight: 800; font-size: 14px;
}
.tr-av img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.tr-av--wait { background: hsl(var(--muted)); color: hsl(var(--muted-fg)); }
.tr-av.online::after { content: ""; position: absolute; right: 0; bottom: 0; width: 10px; height: 10px; border-radius: 50%; background: #2ecc71; border: 2px solid hsl(var(--card)); }
.tr-member-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.tr-member-name { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-member-sub { font-size: 12px; color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-badge { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 99px; background: hsl(38 90% 48% / .16); color: hsl(38 80% 34%); font-size: 11.5px; font-weight: 800; }
.tr-x { flex: none; width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer; background: none; color: hsl(var(--muted-fg)); display: flex; align-items: center; justify-content: center; }
.tr-x:hover { background: hsl(var(--destructive) / .12); color: hsl(var(--destructive)); }
.tr-empty { padding: 12px 6px; font-size: 13px; color: hsl(var(--muted-fg)); text-align: center; }

.tr-invite { padding: 16px; }
.tr-modes { display: flex; gap: 6px; flex-wrap: wrap; }
.tr-mode {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 12px; cursor: pointer;
  border: 1.5px solid hsl(var(--border)); background: hsl(var(--card)); color: hsl(var(--fg)); font-size: 13px; font-weight: 700;
}
.tr-mode.active { border-color: hsl(var(--primary)); background: hsl(var(--primary)); color: #fff; }
.tr-mode:disabled { opacity: .4; cursor: not-allowed; }
.tr-invite-hint { margin: 10px 0; font-size: 13px; color: hsl(var(--muted-fg)); }
.tr-search { display: flex; gap: 8px; }
.tr-search-field { position: relative; flex: 1; }
.tr-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: hsl(var(--muted-fg)); pointer-events: none; }
.tr-search-input { padding-left: 36px; }
.tr-class { width: 104px; flex: none; text-transform: uppercase; }
.tr-class::placeholder { text-transform: none; }
.tr-results { margin-top: 8px; max-height: 230px; overflow-y: auto; }
.tr-add {
  flex: none; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 10px; border: none; cursor: pointer;
  background: linear-gradient(135deg, var(--c1), var(--c2)); color: #fff; font-size: 13px; font-weight: 800;
}
.tr-add:disabled { opacity: .4; cursor: not-allowed; }
.tr-actions { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.tr-hint { font-size: 12.5px; color: hsl(var(--muted-fg)); text-align: center; }
.tr-error { font-size: 13.5px; color: hsl(var(--destructive)); text-align: center; }
.tr-wait-note { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 12px; font-size: 14px; color: hsl(var(--muted-fg)); text-align: center; }

.tr-play { display: grid; grid-template-columns: minmax(0, 1fr) 230px; gap: 16px; align-items: start; }
.tr-game { position: relative; min-height: 300px; min-width: 0; }
.tr-board { display: flex; flex-direction: column; gap: 10px; }
.tr-row { display: flex; align-items: center; gap: 6px; padding: 5px 6px; border-radius: 8px; font-size: 13.5px; }
.tr-row.me { background: hsl(var(--primary-light)); font-weight: 800; }
.tr-row-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-row-done { flex: none; color: hsl(142 60% 38%); }
.tr-row-score { flex: none; font-weight: 800; font-variant-numeric: tabular-nums; }

.tr-overlay {
  position: absolute; inset: -6px; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 22px; background: hsl(var(--bg) / .88); backdrop-filter: blur(5px);
}
.tr-rules { max-width: 420px; padding: 0 20px; text-align: center; font-size: 14px; color: hsl(var(--muted-fg)); }
.tr-count-num { margin-top: 10px; font-size: 110px; font-weight: 900; line-height: 1; color: hsl(var(--primary)); animation: pop .9s ease-out; }
@keyframes pop { 0% { transform: scale(2.2); opacity: 0; } 30% { transform: scale(1); opacity: 1; } 100% { transform: scale(.85); opacity: .5; } }
.tr-result { width: min(400px, 92%); padding: 26px 22px; text-align: center; border-radius: 26px; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); box-shadow: 0 24px 60px rgba(0, 0, 0, .25); }
.tr-result-icon { width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: hsl(var(--muted)); color: hsl(var(--muted-fg)); }
.tr-result.win .tr-result-icon { background: hsl(38 90% 48% / .18); color: hsl(38 90% 42%); }
.tr-result.draw .tr-result-icon { background: hsl(var(--primary-light)); color: hsl(var(--primary)); }
.tr-result-title { margin-top: 8px; font-size: 23px; font-weight: 900; }
.tr-result.win .tr-result-title { color: hsl(38 90% 42%); }
.tr-result-score { margin: 10px 0 4px; display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 42px; font-weight: 900; font-variant-numeric: tabular-nums; }
.tr-result-score .colon { opacity: .35; }
.tr-result-sub { font-size: 12.5px; color: hsl(var(--muted-fg)); }
.tr-reward { display: inline-block; margin-top: 6px; padding: 3px 14px; border-radius: 99px; font-size: 13px; font-weight: 800; background: hsl(38 90% 48% / .16); color: hsl(38 80% 34%); }
.tr-result button { margin-top: 16px; width: 100%; justify-content: center; }
.tr-leave { align-self: center; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 99px; border: none; background: none; color: hsl(var(--muted-fg)); font-size: 13px; cursor: pointer; }
.tr-leave:hover { color: hsl(var(--destructive)); background: hsl(var(--destructive) / .08); }
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 760px) {
  .tr-teams { grid-template-columns: 1fr; }
  .tr-play { grid-template-columns: 1fr; }
  .tr-board { flex-direction: row; }
  .tr-board .tr-team { flex: 1; padding: 10px; }
  .tr-total-num { font-size: 26px; }
  .tr-head { padding: 12px; }
}
</style>
