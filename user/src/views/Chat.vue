<template>
  <div class="chat" :class="{ 'chat--open': peerId }">
    <!-- ── Chap panel: suhbatlar va qidiruv ── -->
    <aside class="list">
      <div class="list-head">
        <h1 class="list-title">Do'stlar chati</h1>
        <div class="list-search">
          <Search :size="15" class="list-search-icon" />
          <input v-model="query" class="list-input" placeholder="Do'stni qidirish: ism" @input="searchSoon" />
          <input v-model="queryClass" class="list-input list-input--class" placeholder="Sinf" maxlength="8" @input="searchSoon" />
        </div>
      </div>

      <div class="list-body">
        <template v-if="searchMode">
          <p class="list-label">Qidiruv natijalari</p>
          <button v-for="u in found" :key="u.id" class="row" @click="open(u.id)">
            <Avatar :user="u" />
            <span class="row-text">
              <span class="row-name">{{ u.name }}</span>
              <span class="row-sub">{{ u.className || '—' }} · {{ u.online ? 'saytda' : lastSeen(u) }}</span>
            </span>
          </button>
          <p v-if="!found.length" class="list-empty">{{ searching ? "Qidirilmoqda..." : "Bunday o'quvchi topilmadi" }}</p>
        </template>
        <template v-else>
          <button v-for="d in dialogs" :key="d.peer.id" class="row" :class="{ active: d.peer.id === peerId }" @click="open(d.peer.id)">
            <Avatar :user="d.peer" />
            <span class="row-text">
              <span class="row-top">
                <span class="row-name">{{ d.peer.name }}</span>
                <span class="row-time">{{ shortTime(d.last.createdAt) }}</span>
              </span>
              <span class="row-bottom">
                <span class="row-sub">
                  <template v-if="typing[d.peer.id]"><em class="typing-text">yozmoqda...</em></template>
                  <template v-else>
                    <span v-if="d.last.from === myId" class="row-ticks" :class="{ read: d.last.readAt }">
                      <CheckCheck v-if="d.last.readAt" :size="14" /><Check v-else :size="14" />
                    </span>
                    {{ chat.preview({ ...d.last, file: { name: d.last.fileName } }) }}
                  </template>
                </span>
                <span v-if="d.unread" class="row-badge">{{ d.unread }}</span>
              </span>
            </span>
          </button>
          <div v-if="!dialogs.length && loaded" class="list-empty list-empty--big">
            <span class="list-empty-emoji">💬</span>
            <p>Hali suhbatlar yo'q</p>
            <p class="list-empty-sub">Yuqoridagi qidiruvga do'stingizning ismini yoki sinfini yozing</p>
          </div>
        </template>
      </div>
    </aside>

    <!-- ── O'ng panel: suhbat ── -->
    <section class="pane" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
      <div v-if="!peerId" class="pane-empty">
        <span class="pane-empty-emoji">✈️</span>
        <p class="pane-empty-title">Suhbatni tanlang</p>
        <p class="pane-empty-sub">Do'stingizga xabar, rasm, ovozli xabar yoki fayl yuboring</p>
      </div>

      <template v-else>
        <header class="pane-head">
          <button class="icon-btn pane-back" @click="closeDialog" aria-label="Orqaga"><ArrowLeft :size="19" /></button>
          <Avatar v-if="peer" :user="peer" />
          <div class="pane-head-text">
            <p class="pane-name">{{ peer?.name ?? '...' }}</p>
            <p class="pane-status" :class="{ on: peer?.online || typing[peerId] }">
              <template v-if="typing[peerId]">yozmoqda...</template>
              <template v-else-if="peer">{{ peer.className ? peer.className + ' · ' : '' }}{{ peer.online ? 'saytda' : lastSeen(peer) }}</template>
            </p>
          </div>
          <button v-if="peer" class="play-btn" @click="inviteToGame" title="Do'stni o'yinga chaqirish">
            <Swords :size="15" /><span>O'yinga chaqirish</span>
          </button>
        </header>

        <div ref="scrollEl" class="msgs" @scroll="onScroll">
          <button v-if="hasMore" class="more" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? "Yuklanmoqda..." : "Oldingi xabarlar" }}
          </button>
          <p v-if="loadedDialog && !messages.length" class="msgs-empty">
            Bu yerda hali xabar yo'q. Birinchi bo'lib salom yozing 👋
          </p>

          <template v-for="(m, i) in messages" :key="m.id">
            <div v-if="newDay(i)" class="day"><span>{{ dayLabel(m.createdAt) }}</span></div>
            <div class="msg" :class="{ mine: m.from === myId, grouped: grouped(i), menu: menuFor === m.id }" :data-id="m.id">
              <div class="bubble" :class="[`bubble--${m.kind}`, { flash: flashId === m.id }]"
                @contextmenu.prevent="menuFor = m.id" @touchstart.passive="pressStart(m)" @touchend="pressEnd" @touchmove.passive="pressEnd">

                <button v-if="m.reply" class="quote" @click="jumpTo(m.reply.id)">
                  <span class="quote-name">{{ m.reply.from === myId ? "Siz" : peer?.name }}</span>
                  <span class="quote-text">{{ chat.preview({ ...m.reply, file: { name: m.reply.fileName } }) }}</span>
                </button>

                <!-- Rasm -->
                <button v-if="m.kind === 'image'" class="photo" @click="lightbox = fileUrl(m)">
                  <img :src="fileUrl(m)" alt="" loading="lazy" @load="onMediaLoad" />
                </button>

                <!-- Ovozli xabar / audio -->
                <VoicePlayer v-else-if="m.kind === 'voice' || m.kind === 'audio'" :src="fileUrl(m)" :duration="m.file.duration"
                  :mine="m.from === myId" :title="m.kind === 'audio' ? m.file.name : ''" />

                <!-- Video -->
                <video v-else-if="m.kind === 'video'" class="video" :src="fileUrl(m)" controls preload="metadata" playsinline></video>

                <!-- Boshqa fayl -->
                <a v-else-if="m.kind === 'file'" class="file" :href="fileUrl(m) + '?download'" :download="m.file.name">
                  <span class="file-icon"><FileText :size="20" /></span>
                  <span class="file-text">
                    <span class="file-name">{{ m.file.name }}</span>
                    <span class="file-size">{{ fileSize(m.file.size) }} · yuklab olish</span>
                  </span>
                </a>

                <p v-if="m.text" class="text">{{ m.text }}</p>

                <span class="meta">
                  <span v-if="m.editedAt" class="meta-edited">tahrirlangan</span>
                  {{ hhmm(m.createdAt) }}
                  <template v-if="m.from === myId">
                    <Loader2 v-if="m.pending" :size="13" class="spin" />
                    <CheckCheck v-else-if="m.readAt" :size="15" class="tick-read" />
                    <Check v-else :size="15" />
                  </template>
                </span>
              </div>

              <div class="actions">
                <button class="act" title="Javob berish" @click="startReply(m)"><Reply :size="15" /></button>
                <button v-if="m.text" class="act" title="Nusxa olish" @click="copy(m)"><Copy :size="15" /></button>
                <button v-if="m.from === myId && m.text" class="act" title="Tahrirlash" @click="startEdit(m)"><Pencil :size="15" /></button>
                <button v-if="m.from === myId" class="act act--danger" title="O'chirish" @click="remove(m)"><Trash2 :size="15" /></button>
              </div>
            </div>
          </template>
        </div>

        <button v-if="showDown" class="down" @click="scrollBottom(true)" aria-label="Pastga">
          <ChevronDown :size="20" /><span v-if="newBelow" class="down-badge">{{ newBelow }}</span>
        </button>

        <!-- ── Yozish maydoni ── -->
        <footer class="composer">
          <div v-if="replyTo || editing" class="strip">
            <component :is="editing ? Pencil : Reply" :size="16" class="strip-icon" />
            <span class="strip-text">
              <span class="strip-title">{{ editing ? "Tahrirlash" : (replyTo.from === myId ? "O'zingizga javob" : `${peer?.name} ga javob`) }}</span>
              <span class="strip-sub">{{ chat.preview(editing || replyTo) }}</span>
            </span>
            <button class="icon-btn" @click="cancelStrip" aria-label="Bekor qilish"><X :size="17" /></button>
          </div>

          <div v-if="attachment" class="strip">
            <img v-if="attachment.preview" :src="attachment.preview" class="strip-thumb" alt="" />
            <span v-else class="strip-file"><Paperclip :size="16" /></span>
            <span class="strip-text">
              <span class="strip-title">{{ attachment.file.name }}</span>
              <span class="strip-sub">{{ fileSize(attachment.file.size) }} · izoh yozishingiz mumkin</span>
            </span>
            <button class="icon-btn" @click="clearAttachment" aria-label="Olib tashlash"><X :size="17" /></button>
          </div>

          <p v-if="error" class="composer-error">{{ error }}</p>

          <!-- Ovoz yozish -->
          <div v-if="recording" class="rec">
            <button class="icon-btn rec-cancel" @click="stopRecording(false)" title="Bekor qilish"><Trash2 :size="18" /></button>
            <span class="rec-dot"></span>
            <span class="rec-time">{{ clockOf(recSeconds) }}</span>
            <span class="rec-hint">Ovoz yozilmoqda...</span>
            <button class="send" @click="stopRecording(true)" title="Yuborish"><SendHorizontal :size="19" /></button>
          </div>

          <div v-else class="input-row">
            <button class="icon-btn" @click="fileEl.click()" title="Rasm yoki fayl biriktirish"><Paperclip :size="20" /></button>
            <input ref="fileEl" type="file" hidden @change="onPick" />
            <div class="emoji-wrap">
              <button class="icon-btn" @click="emojiOpen = !emojiOpen" title="Emoji"><Smile :size="20" /></button>
              <div v-if="emojiOpen" class="emoji">
                <button v-for="e in EMOJI" :key="e" class="emoji-btn" @click="addEmoji(e)">{{ e }}</button>
              </div>
            </div>
            <textarea ref="inputEl" v-model="draft" class="input" rows="1" placeholder="Xabar yozing..."
              @input="onInput" @keydown.enter.exact.prevent="submit" @paste="onPaste"></textarea>
            <button v-if="draft.trim() || attachment || editing" class="send" :disabled="sending" @click="submit" title="Yuborish">
              <Check v-if="editing" :size="19" /><SendHorizontal v-else :size="19" />
            </button>
            <button v-else class="send send--mic" @click="startRecording" title="Ovozli xabar yozish"><Mic :size="19" /></button>
          </div>
        </footer>

        <div v-if="dragging" class="drop"><Paperclip :size="34" /><span>Faylni shu yerga tashlang</span></div>
      </template>
    </section>

    <!-- Rasmni kattalashtirib ko'rish -->
    <Transition name="fade">
      <div v-if="lightbox" class="lightbox" @click="lightbox = null">
        <img :src="lightbox" alt="" />
        <button class="lightbox-x" aria-label="Yopish"><X :size="22" /></button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Search, ArrowLeft, Swords, Check, CheckCheck, Reply, Copy, Pencil, Trash2, X, Paperclip, Smile,
  SendHorizontal, Mic, FileText, ChevronDown, Loader2,
} from "lucide-vue-next";
import { api, resolveUrl } from "@shared/composables/api";
import { onLiveEvent } from "@shared/composables/live";
import { useAuthStore } from "@shared/stores/auth";
import { useChatStore } from "../stores/chat";
import Avatar from "../components/chat/Avatar.vue";
import VoicePlayer from "../components/chat/VoicePlayer.vue";

// Do'stlar chati: chapda suhbatlar ro'yxati, o'ngda ochiq suhbat.
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const chat = useChatStore();

const MAX_FILE_MB = 25;
const EMOJI = ["😀", "😂", "😍", "🥰", "😎", "🤔", "😢", "😡", "👍", "👎", "👏", "🙏", "🔥", "❤️", "🎉", "💯", "⚽", "🎮", "📚", "✅", "❌", "👋", "😴", "🤝", "🌍", "⭐", "😅", "🤩", "😇", "🥳", "💪", "👀"];

const myId = computed(() => auth.user?.id);
const peerId = computed(() => Number(route.params.userId) || null);

// ── Suhbatlar ro'yxati va qidiruv ──
const dialogs = ref([]);
const loaded = ref(false);
const query = ref("");
const queryClass = ref("");
const found = ref([]);
const searching = ref(false);
const typing = reactive({});        // peerId → true ("yozmoqda...")
const typingTimers = {};
let searchTimer = null;
const searchMode = computed(() => Boolean(query.value.trim() || queryClass.value.trim()));

async function loadDialogs() {
  try {
    const data = await api("/api/chat/dialogs");
    dialogs.value = data.dialogs;
    chat.unread = data.unread;
  } catch {}
  loaded.value = true;
}
async function search() {
  if (!searchMode.value) { found.value = []; return; }
  searching.value = true;
  try {
    const q = new URLSearchParams({ q: query.value.trim(), className: queryClass.value.trim() });
    found.value = await api(`/api/chat/users?${q}`);
  } catch { found.value = []; }
  searching.value = false;
}
function searchSoon() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(search, 260);
}
function open(id) {
  query.value = ""; queryClass.value = ""; found.value = [];
  if (id !== peerId.value) router.push(`/chat/${id}`);
}
function closeDialog() {
  router.push("/chat");
}

// ── Ochiq suhbat ──
const peer = ref(null);
const messages = ref([]);
const hasMore = ref(false);
const loadedDialog = ref(false);
const loadingMore = ref(false);
const scrollEl = ref(null);
const showDown = ref(false);
const newBelow = ref(0);
const flashId = ref(null);
const menuFor = ref(null);
const lightbox = ref(null);

const fileUrl = m => resolveUrl(m.file.url);

async function loadDialog() {
  const id = peerId.value;
  peer.value = null; messages.value = []; hasMore.value = false; loadedDialog.value = false;
  resetComposer();
  chat.openPeerId = id;
  if (!id) return;
  try {
    const data = await api(`/api/chat/with/${id}`);
    if (peerId.value !== id) return;
    peer.value = data.peer;
    messages.value = data.messages;
    hasMore.value = data.hasMore;
    loadedDialog.value = true;
    await nextTick();
    scrollBottom();
    inputEl.value?.focus({ preventScroll: true });
    loadDialogs();
  } catch (e) {
    if (e?.status === 404) router.replace("/chat");
  }
}
async function loadMore() {
  if (loadingMore.value || !messages.value.length) return;
  loadingMore.value = true;
  const el = scrollEl.value;
  const prevHeight = el.scrollHeight;
  try {
    const data = await api(`/api/chat/with/${peerId.value}?before=${messages.value[0].id}`);
    messages.value = [...data.messages, ...messages.value];
    hasMore.value = data.hasMore;
    await nextTick();
    el.scrollTop += el.scrollHeight - prevHeight;   // ko'rinib turgan joy siljimasin
  } catch {}
  loadingMore.value = false;
}

const nearBottom = () => {
  const el = scrollEl.value;
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
};
function scrollBottom(smooth = false) {
  const el = scrollEl.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  newBelow.value = 0;
}
function onScroll() {
  showDown.value = !nearBottom();
  if (!showDown.value) newBelow.value = 0;
  if (scrollEl.value.scrollTop < 60 && hasMore.value) loadMore();
}
function onMediaLoad() {
  if (!showDown.value) scrollBottom();
}
async function jumpTo(id) {
  const el = scrollEl.value?.querySelector(`[data-id="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  flashId.value = id;
  setTimeout(() => { if (flashId.value === id) flashId.value = null; }, 1400);
}

/** Suhbat ochiq turganda kelgan xabarni "o'qildi" qilamiz. */
async function markRead() {
  if (!peerId.value || document.visibilityState !== "visible") return;
  try { await api(`/api/chat/with/${peerId.value}?limit=1`); chat.refreshUnread(); } catch {}
}

// ── Jonli hodisalar ──
onLiveEvent("chat", (e) => {
  const inThis = e.peerId === peerId.value;
  if (e.type === "typing") {
    typing[e.peerId] = true;
    clearTimeout(typingTimers[e.peerId]);
    typingTimers[e.peerId] = setTimeout(() => { typing[e.peerId] = false; }, 3500);
    return;
  }
  if (e.type === "new") {
    typing[e.peerId] = false;
    if (inThis && !messages.value.some(m => m.id === e.message.id)) {
      const stick = nearBottom() || e.message.from === myId.value;
      // O'zim yuborgan xabar: vaqtinchalik nusxasi o'rniga haqiqiysi qo'yiladi (send() ichida)
      if (e.message.from !== myId.value || !messages.value.some(m => m.pending)) messages.value.push(e.message);
      nextTick(() => { if (stick) scrollBottom(true); else newBelow.value++; });
      if (e.message.from !== myId.value) markRead();
    }
    loadDialogs();
    return;
  }
  if (e.type === "edit" && inThis) {
    const i = messages.value.findIndex(m => m.id === e.message.id);
    if (i !== -1) messages.value[i] = e.message;
  }
  if (e.type === "delete" && inThis) {
    messages.value = messages.value.filter(m => m.id !== e.id);
  }
  if (e.type === "read" && inThis) {
    for (const m of messages.value) if (e.ids.includes(m.id)) m.readAt = e.readAt;
  }
  if (e.type !== "typing") loadDialogs();
});

// ── Yozish ──
const draft = ref("");
const inputEl = ref(null);
const fileEl = ref(null);
const attachment = ref(null);      // { file, preview }
const replyTo = ref(null);
const editing = ref(null);
const sending = ref(false);
const error = ref("");
const emojiOpen = ref(false);
const dragging = ref(false);
let lastTyping = 0;

function resetComposer() {
  draft.value = ""; replyTo.value = null; editing.value = null; error.value = ""; emojiOpen.value = false;
  clearAttachment();
  nextTick(autoGrow);
}
function autoGrow() {
  const el = inputEl.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}
function onInput() {
  autoGrow();
  error.value = "";
  if (!peerId.value || !draft.value || Date.now() - lastTyping < 2500) return;
  lastTyping = Date.now();
  api(`/api/chat/typing/${peerId.value}`, { method: "POST" }).catch(() => {});
}
function addEmoji(e) {
  const el = inputEl.value;
  const at = el?.selectionStart ?? draft.value.length;
  draft.value = draft.value.slice(0, at) + e + draft.value.slice(el?.selectionEnd ?? at);
  nextTick(() => { el?.focus(); el?.setSelectionRange(at + e.length, at + e.length); autoGrow(); });
}

function setAttachment(file) {
  if (!file) return;
  if (file.size > MAX_FILE_MB * 1024 * 1024) { error.value = `Fayl ${MAX_FILE_MB} MB dan oshmasin`; return; }
  clearAttachment();
  error.value = "";
  attachment.value = { file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null };
  inputEl.value?.focus();
}
function clearAttachment() {
  if (attachment.value?.preview) URL.revokeObjectURL(attachment.value.preview);
  attachment.value = null;
  if (fileEl.value) fileEl.value.value = "";
}
function onPick(e) { setAttachment(e.target.files?.[0]); }
function onDrop(e) { dragging.value = false; if (peerId.value) setAttachment(e.dataTransfer?.files?.[0]); }
function onPaste(e) {
  const file = [...(e.clipboardData?.files ?? [])][0];
  if (file) { e.preventDefault(); setAttachment(file); }
}

/** Xabarni serverga yuboradi (fayl bo'lsa — multipart). */
async function post({ text = "", file = null, voice = false, duration = null, replyId = null }) {
  let body, headers = {};
  if (file) {
    body = new FormData();
    body.append("file", file, file.name);
    if (text) body.append("text", text);
    if (replyId) body.append("replyTo", String(replyId));
    if (voice) body.append("voice", "1");
    if (duration) body.append("duration", String(duration));
  } else {
    body = JSON.stringify({ text, replyTo: replyId });
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(resolveUrl(`/api/chat/with/${peerId.value}`), {
    method: "POST", body,
    headers: { ...headers, Authorization: `Bearer ${localStorage.getItem("geo_token")}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Xabar yuborilmadi");
  return data;
}

async function send(payload) {
  lastTyping = 0;   // keyingi xabarni yoza boshlaganda "yozmoqda..." darhol chiqsin
  const temp = {
    id: `tmp-${Date.now()}`, from: myId.value, to: peerId.value, pending: true,
    // Fayl yuklanayotganda vaqtincha matnli pufakcha ko'rsatiladi
    kind: "text",
    text: payload.text || (payload.voice ? "🎤 Ovozli xabar yuborilmoqda..." : payload.file ? `📎 ${payload.file.name}` : ""),
    createdAt: new Date().toISOString(), reply: payload.reply ?? null,
  };
  messages.value.push(temp);
  await nextTick();
  scrollBottom(true);
  try {
    const real = await post(payload);
    const i = messages.value.findIndex(m => m.id === temp.id);
    const dup = messages.value.some(m => m.id === real.id);
    if (i !== -1) dup ? messages.value.splice(i, 1) : (messages.value[i] = real);
    await nextTick();
    scrollBottom(true);
    loadDialogs();
    return true;
  } catch (e) {
    messages.value = messages.value.filter(m => m.id !== temp.id);
    error.value = e.message;
    return false;
  }
}

async function submit() {
  if (sending.value) return;
  const text = draft.value.trim();
  emojiOpen.value = false;

  if (editing.value) {
    if (!text) return;
    sending.value = true;
    try {
      const m = await api(`/api/chat/messages/${editing.value.id}`, { method: "PUT", body: JSON.stringify({ text }) });
      const i = messages.value.findIndex(x => x.id === m.id);
      if (i !== -1) messages.value[i] = m;
      resetComposer();
    } catch (e) { error.value = e.message; }
    sending.value = false;
    return;
  }

  if (!text && !attachment.value) return;
  sending.value = true;
  const payload = { text, file: attachment.value?.file ?? null, replyId: replyTo.value?.id ?? null, reply: replyTo.value ? { id: replyTo.value.id, from: replyTo.value.from, kind: replyTo.value.kind, text: replyTo.value.text, fileName: replyTo.value.file?.name } : null };
  const keep = { draft: draft.value, attachment: attachment.value, replyTo: replyTo.value };
  draft.value = ""; attachment.value = null; replyTo.value = null;
  if (fileEl.value) fileEl.value.value = "";
  nextTick(autoGrow);
  if (await send(payload)) {
    if (keep.attachment?.preview) URL.revokeObjectURL(keep.attachment.preview);
  } else {
    // Yuborilmadi — yozilgan narsa yo'qolmasin
    draft.value = keep.draft; attachment.value = keep.attachment; replyTo.value = keep.replyTo;
    nextTick(autoGrow);
  }
  sending.value = false;
}

// ── Xabar ustidagi amallar ──
function startReply(m) { menuFor.value = null; editing.value = null; replyTo.value = m; inputEl.value?.focus(); }
function startEdit(m) {
  menuFor.value = null; replyTo.value = null; clearAttachment();
  editing.value = m; draft.value = m.text;
  nextTick(() => { autoGrow(); inputEl.value?.focus(); });
}
function cancelStrip() {
  if (editing.value) draft.value = "";
  editing.value = null; replyTo.value = null;
  nextTick(autoGrow);
}
async function copy(m) {
  menuFor.value = null;
  try { await navigator.clipboard.writeText(m.text); } catch {}
}
async function remove(m) {
  menuFor.value = null;
  if (!window.confirm("Xabar ikkala tomonda ham o'chiriladi. O'chirilsinmi?")) return;
  try {
    await api(`/api/chat/messages/${m.id}`, { method: "DELETE" });
    messages.value = messages.value.filter(x => x.id !== m.id);
    loadDialogs();
  } catch (e) { error.value = e.message; }
}
// Telefonda: xabarni bosib turish — amallar chiqadi
let pressTimer = null;
function pressStart(m) { clearTimeout(pressTimer); pressTimer = setTimeout(() => { menuFor.value = m.id; }, 450); }
function pressEnd() { clearTimeout(pressTimer); }
function onDocClick(e) {
  if (menuFor.value && !e.target.closest?.(".msg.menu")) menuFor.value = null;
  if (emojiOpen.value && !e.target.closest?.(".emoji-wrap")) emojiOpen.value = false;
}

// ── Ovozli xabar ──
const recording = ref(false);
const recSeconds = ref(0);
let recorder = null, recChunks = [], recStream = null, recTimer = null, recSend = false;

async function startRecording() {
  error.value = "";
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    error.value = "Bu brauzer ovoz yozishni qo'llamaydi";
    return;
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    error.value = "Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering.";
    return;
  }
  const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(t => MediaRecorder.isTypeSupported(t)) ?? "";
  recorder = new MediaRecorder(recStream, type ? { mimeType: type } : undefined);
  recChunks = [];
  recorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
  recorder.onstop = async () => {
    recStream?.getTracks().forEach(t => t.stop());
    const seconds = recSeconds.value;
    recording.value = false;
    if (!recSend || !recChunks.length || seconds < 1) return;
    const mime = (recorder.mimeType || type || "audio/webm").split(";")[0];
    const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
    const file = new File(recChunks, `ovoz.${ext}`, { type: mime });
    const reply = replyTo.value;
    replyTo.value = null;
    await send({ file, voice: true, duration: seconds, replyId: reply?.id ?? null });
  };
  recorder.start();
  recSeconds.value = 0;
  recording.value = true;
  clearInterval(recTimer);
  recTimer = setInterval(() => {
    recSeconds.value++;
    if (recSeconds.value >= 300) stopRecording(true);    // eng ko'pi 5 daqiqa
  }, 1000);
}
function stopRecording(sendIt) {
  clearInterval(recTimer);
  recSend = sendIt;
  if (recorder && recorder.state !== "inactive") recorder.stop();
  else { recStream?.getTracks().forEach(t => t.stop()); recording.value = false; }
}

function inviteToGame() {
  router.push({ path: "/games", query: { friend: peer.value.id, name: peer.value.name } });
}

// ── Ko'rinish uchun yordamchilar ──
const pad = n => String(n).padStart(2, "0");
const hhmm = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const clockOf = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  if (sameDay(d, now)) return "Bugun";
  if (sameDay(d, new Date(now.getTime() - 86400000))) return "Kecha";
  const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  return `${d.getDate()}-${months[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? " " + d.getFullYear() : ""}`;
}
function shortTime(iso) {
  return sameDay(iso, new Date()) ? hhmm(iso) : dayLabel(iso) === "Kecha" ? "Kecha" : `${pad(new Date(iso).getDate())}.${pad(new Date(iso).getMonth() + 1)}`;
}
function lastSeen(u) {
  if (!u.lastSeenAt) return "saytda emas";
  return `oxirgi marta ${sameDay(u.lastSeenAt, new Date()) ? "bugun " + hhmm(u.lastSeenAt) : dayLabel(u.lastSeenAt).toLowerCase()}`;
}
function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
const newDay = i => i === 0 || !sameDay(messages.value[i].createdAt, messages.value[i - 1].createdAt);
/** Oldingi xabar shu odamniki va yaqin vaqtda bo'lsa — pufakchalar yopishib turadi. */
function grouped(i) {
  if (i === 0 || newDay(i)) return false;
  const a = messages.value[i - 1], b = messages.value[i];
  return a.from === b.from && new Date(b.createdAt) - new Date(a.createdAt) < 5 * 60000;
}

function onVisible() { if (document.visibilityState === "visible") markRead(); }
let refreshTimer = null;

watch(peerId, loadDialog);

onMounted(() => {
  loadDialogs();
  loadDialog();
  document.addEventListener("click", onDocClick);
  document.addEventListener("visibilitychange", onVisible);
  // "saytda" holati va ulanish uzilgan paytdagi xabarlar uchun zaxira yangilash
  refreshTimer = setInterval(async () => {
    loadDialogs();
    if (!peerId.value || document.visibilityState !== "visible") return;
    try {
      const data = await api(`/api/chat/with/${peerId.value}`);
      if (data.peer.id !== peerId.value) return;
      peer.value = data.peer;
      const known = new Set(messages.value.map(m => m.id));
      const fresh = data.messages.filter(m => !known.has(m.id) && m.id > (messages.value.filter(x => !x.pending).at(-1)?.id ?? 0));
      if (fresh.length) {
        const stick = nearBottom();
        messages.value.push(...fresh);
        nextTick(() => { if (stick) scrollBottom(true); else newBelow.value += fresh.length; });
      }
    } catch {}
  }, 20000);
});
onUnmounted(() => {
  chat.openPeerId = null;
  chat.refreshUnread();
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("visibilitychange", onVisible);
  clearInterval(refreshTimer); clearTimeout(searchTimer); clearTimeout(pressTimer);
  if (recording.value) stopRecording(false);
  clearAttachment();
});
</script>

<style scoped>
.chat {
  display: grid; grid-template-columns: 330px 1fr; height: calc(100vh - 64px); min-height: 440px;
  border-radius: 22px; overflow: hidden; background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  box-shadow: 0 8px 30px rgba(0, 0, 0, .07);
}

/* ── Chap panel ── */
.list { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid hsl(var(--border)); }
.list-head { padding: 16px 14px 12px; border-bottom: 1px solid hsl(var(--border)); }
.list-title { font-size: 19px; font-weight: 800; margin-bottom: 10px; }
.list-search { position: relative; display: flex; gap: 6px; }
.list-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: hsl(var(--muted-fg)); pointer-events: none; }
.list-input {
  flex: 1; min-width: 0; height: 38px; padding: 0 12px 0 34px; border-radius: 99px; border: 1px solid transparent; outline: none;
  background: hsl(var(--muted)); color: hsl(var(--fg)); font-size: 14px;
}
.list-input:focus { border-color: hsl(var(--primary)); background: hsl(var(--card)); }
.list-input--class { flex: none; width: 74px; padding: 0 12px; text-align: center; text-transform: uppercase; }
.list-input--class::placeholder { text-transform: none; }
.list-body { flex: 1; overflow-y: auto; padding: 6px; }
.list-label { padding: 8px 10px 4px; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: hsl(var(--muted-fg)); }
.row {
  width: 100%; display: flex; align-items: center; gap: 11px; padding: 9px 10px; border: none; border-radius: 14px; cursor: pointer;
  background: none; color: inherit; text-align: left;
}
.row:hover { background: hsl(var(--muted)); }
.row.active { background: hsl(var(--primary)); color: #fff; }
.row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.row-top, .row-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.row-name { font-size: 14.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-time { flex: none; font-size: 11.5px; opacity: .65; }
.row-sub { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; font-size: 13px; opacity: .7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-ticks { flex: none; display: inline-flex; }
.row-ticks.read { color: #29b6f6; }
.row.active .row-ticks.read { color: #fff; }
.row-badge { flex: none; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 99px; background: hsl(var(--primary)); color: #fff; font-size: 11.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.row.active .row-badge { background: #fff; color: hsl(var(--primary)); }
.typing-text { font-style: normal; color: hsl(var(--primary)); }
.row.active .typing-text { color: #fff; }
.list-empty { padding: 22px 12px; text-align: center; font-size: 13.5px; color: hsl(var(--muted-fg)); }
.list-empty--big { padding-top: 50px; }
.list-empty-emoji { font-size: 40px; }
.list-empty-sub { margin-top: 4px; font-size: 12.5px; }

/* ── O'ng panel ── */
.pane {
  position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0;
  background-color: hsl(var(--bg));
  background-image:
    radial-gradient(circle at 20% 15%, hsl(var(--primary) / .07), transparent 40%),
    radial-gradient(circle at 85% 80%, hsl(var(--primary) / .07), transparent 40%),
    radial-gradient(hsl(var(--primary) / .09) 1.2px, transparent 1.2px);
  background-size: auto, auto, 22px 22px;
}
.pane-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; }
.pane-empty-emoji { font-size: 56px; }
.pane-empty-title { margin-top: 8px; font-size: 19px; font-weight: 800; }
.pane-empty-sub { font-size: 14px; color: hsl(var(--muted-fg)); }
.pane-head { display: flex; align-items: center; gap: 11px; padding: 10px 14px; background: hsl(var(--card)); border-bottom: 1px solid hsl(var(--border)); }
.pane-back { display: none; }
.pane-head-text { flex: 1; min-width: 0; }
.pane-name { font-size: 15.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pane-status { font-size: 12.5px; color: hsl(var(--muted-fg)); }
.pane-status.on { color: hsl(var(--primary)); }
.play-btn {
  flex: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 13px; border-radius: 99px; border: none; cursor: pointer;
  background: linear-gradient(135deg, #7c4dff, #448aff); color: #fff; font-size: 13px; font-weight: 800;
}
.icon-btn {
  flex: none; width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; background: none; color: hsl(var(--muted-fg));
  display: flex; align-items: center; justify-content: center;
}
.icon-btn:hover { background: hsl(var(--muted)); color: hsl(var(--fg)); }

.msgs { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 16px 8px; display: flex; flex-direction: column; }
.msgs-empty { margin: auto; padding: 10px 18px; border-radius: 99px; background: hsl(var(--card) / .9); font-size: 14px; color: hsl(var(--muted-fg)); }
.more { align-self: center; margin-bottom: 10px; padding: 5px 14px; border-radius: 99px; border: none; cursor: pointer; background: hsl(var(--card)); color: hsl(var(--primary)); font-size: 12.5px; font-weight: 700; box-shadow: 0 1px 4px rgba(0, 0, 0, .1); }
.day { display: flex; justify-content: center; margin: 12px 0 8px; }
.day span { padding: 3px 12px; border-radius: 99px; background: hsl(var(--fg) / .32); color: #fff; font-size: 12px; font-weight: 700; }

.msg { position: relative; display: flex; align-items: flex-end; gap: 6px; margin-top: 8px; max-width: 100%; }
.msg.grouped { margin-top: 2px; }
.msg.mine { flex-direction: row-reverse; }
.bubble {
  position: relative; max-width: min(78%, 520px); padding: 7px 11px 6px; border-radius: 18px 18px 18px 6px;
  background: hsl(var(--card)); color: hsl(var(--card-fg)); box-shadow: 0 1px 2px rgba(0, 0, 0, .12);
  overflow-wrap: anywhere; transition: box-shadow .3s;
}
.msg.mine .bubble { border-radius: 18px 18px 6px 18px; background: hsl(var(--primary)); color: #fff; }
.msg.grouped .bubble { border-top-left-radius: 8px; }
.msg.mine.grouped .bubble { border-top-left-radius: 18px; border-top-right-radius: 8px; }
.bubble.flash { box-shadow: 0 0 0 4px hsl(var(--warning) / .55); }
.bubble--image, .bubble--video { padding: 4px 4px 6px; }
.text { white-space: pre-wrap; font-size: 15px; line-height: 1.42; }
.bubble--image .text, .bubble--video .text { padding: 5px 7px 0; }
.meta { float: right; display: inline-flex; align-items: center; gap: 3px; margin: 5px 0 -1px 10px; font-size: 11px; opacity: .65; white-space: nowrap; }
.bubble--image .meta, .bubble--video .meta { margin-right: 6px; }
.meta-edited { font-style: italic; margin-right: 2px; }
.msg.mine .tick-read { color: #b3f0ff; opacity: 1; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.quote {
  display: flex; flex-direction: column; width: 100%; margin-bottom: 5px; padding: 4px 9px; border: none; border-left: 3px solid hsl(var(--primary));
  border-radius: 6px; background: hsl(var(--primary) / .1); color: inherit; text-align: left; cursor: pointer;
}
.msg.mine .quote { border-left-color: #fff; background: rgba(255, 255, 255, .18); }
.quote-name { font-size: 12.5px; font-weight: 800; }
.quote-text { font-size: 13px; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.photo { display: block; padding: 0; border: none; background: none; cursor: zoom-in; border-radius: 14px; overflow: hidden; }
.photo img { display: block; max-width: 100%; max-height: 340px; min-width: 120px; min-height: 60px; object-fit: cover; }
.video { display: block; max-width: 100%; max-height: 340px; border-radius: 14px; background: #000; }
.file { display: flex; align-items: center; gap: 10px; min-width: 190px; padding: 3px 2px; color: inherit; text-decoration: none; }
.file-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: hsl(var(--primary)); color: #fff; }
.msg.mine .file-icon { background: rgba(255, 255, 255, .25); }
.file-text { min-width: 0; display: flex; flex-direction: column; }
.file-name { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-size { font-size: 12px; opacity: .7; }

.actions { display: none; gap: 2px; padding: 3px; border-radius: 99px; background: hsl(var(--card)); box-shadow: 0 2px 10px rgba(0, 0, 0, .16); }
.msg:hover .actions, .msg.menu .actions { display: flex; }
.act { width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer; background: none; color: hsl(var(--muted-fg)); display: flex; align-items: center; justify-content: center; }
.act:hover { background: hsl(var(--muted)); color: hsl(var(--fg)); }
.act--danger:hover { background: hsl(var(--destructive) / .12); color: hsl(var(--destructive)); }
@media (hover: none) { .msg:hover .actions { display: none; } .msg.menu .actions { display: flex; } }

.down {
  position: absolute; right: 16px; bottom: 86px; width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer;
  background: hsl(var(--card)); color: hsl(var(--fg)); box-shadow: 0 4px 14px rgba(0, 0, 0, .2); display: flex; align-items: center; justify-content: center;
}
.down-badge { position: absolute; top: -6px; right: -4px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 99px; background: hsl(var(--primary)); color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; }

/* ── Yozish maydoni ── */
.composer { padding: 8px 12px 12px; background: hsl(var(--card)); border-top: 1px solid hsl(var(--border)); }
.strip { display: flex; align-items: center; gap: 10px; padding: 4px 4px 8px; }
.strip-icon { flex: none; color: hsl(var(--primary)); }
.strip-thumb { flex: none; width: 42px; height: 42px; border-radius: 10px; object-fit: cover; }
.strip-file { flex: none; width: 42px; height: 42px; border-radius: 10px; background: hsl(var(--muted)); display: flex; align-items: center; justify-content: center; }
.strip-text { flex: 1; min-width: 0; display: flex; flex-direction: column; padding-left: 8px; border-left: 3px solid hsl(var(--primary)); }
.strip-title { font-size: 13px; font-weight: 800; color: hsl(var(--primary)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.strip-sub { font-size: 13px; color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.composer-error { padding: 0 6px 6px; font-size: 13px; color: hsl(var(--destructive)); }
.input-row { display: flex; align-items: flex-end; gap: 4px; }
.input {
  flex: 1; min-width: 0; resize: none; max-height: 140px; padding: 9px 14px; border-radius: 20px; border: 1px solid transparent; outline: none;
  background: hsl(var(--muted)); color: hsl(var(--fg)); font: inherit; font-size: 15px; line-height: 1.4;
}
.input:focus { border-color: hsl(var(--primary) / .5); }
.send {
  flex: none; width: 42px; height: 42px; margin-left: 4px; border-radius: 50%; border: none; cursor: pointer;
  background: hsl(var(--primary)); color: #fff; display: flex; align-items: center; justify-content: center; transition: transform .12s, filter .15s;
}
.send:hover:not(:disabled) { filter: brightness(1.1); }
.send:active:not(:disabled) { transform: scale(.92); }
.send:disabled { opacity: .5; }
.send--mic { background: hsl(var(--muted)); color: hsl(var(--fg)); }
.emoji-wrap { position: relative; }
.emoji {
  position: absolute; left: -44px; bottom: 48px; z-index: 6; width: 292px; padding: 8px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px;
  border-radius: 16px; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); box-shadow: 0 12px 34px rgba(0, 0, 0, .2);
}
.emoji-btn { height: 34px; border: none; border-radius: 8px; background: none; cursor: pointer; font-size: 20px; }
.emoji-btn:hover { background: hsl(var(--muted)); }

.rec { display: flex; align-items: center; gap: 10px; }
.rec-cancel:hover { color: hsl(var(--destructive)); }
.rec-dot { width: 11px; height: 11px; border-radius: 50%; background: #e53935; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: .25; } }
.rec-time { font-weight: 800; font-variant-numeric: tabular-nums; }
.rec-hint { flex: 1; font-size: 13.5px; color: hsl(var(--muted-fg)); }

.drop {
  position: absolute; inset: 10px; z-index: 8; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  border-radius: 18px; border: 3px dashed hsl(var(--primary)); background: hsl(var(--card) / .92); color: hsl(var(--primary)); font-weight: 800; pointer-events: none;
}

.lightbox { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0, 0, 0, .88); cursor: zoom-out; }
.lightbox img { max-width: 100%; max-height: 100%; border-radius: 8px; }
.lightbox-x { position: absolute; top: 16px; right: 16px; width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer; background: rgba(255, 255, 255, .15); color: #fff; display: flex; align-items: center; justify-content: center; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── Telefon: bitta panel ── */
@media (max-width: 860px) {
  .chat { grid-template-columns: 1fr; height: calc(100dvh - 56px - 40px); border-radius: 18px; }
  .pane { display: none; }
  .chat--open .list { display: none; }
  .chat--open .pane { display: flex; }
  .pane-back { display: flex; }
  .play-btn span { display: none; }
  .play-btn { width: 38px; padding: 0; justify-content: center; }
  .bubble { max-width: 86%; }
  .emoji { left: -40px; width: 264px; }
}
</style>
