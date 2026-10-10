// ── Real vaqt yangilanishlari ─────────────────────────────────────────────
// Backend /api/events orqali "qaysi ma'lumot o'zgardi" deb xabar beradi.
// Sahifalar useLive([...to'plamlar], qaytaYuklash) bilan obuna bo'ladi —
// boshqa foydalanuvchi nimanidir o'zgartirsa, sahifa o'zi yangilanadi.
import { ref, onMounted, onUnmounted, getCurrentInstance } from "vue";
import { resolveUrl } from "./api";

const listeners = new Set();
const JITTER_MS = 900;
export const liveConnected = ref(false);

let source = null;
let sourceToken = null;
let everConnected = false;

// Shaxsiy hodisalar (do'stning xabari, o'yinga taklif, 1v1 va jamoaviy o'yin holati):
// server ularni faqat shu foydalanuvchiga yuboradi, ma'lumoti bilan birga.
const PERSONAL_EVENTS = ["duel", "chat", "team"];
const personal = new Map();   // hodisa nomi → Set<fn>

function currentToken() {
  try { return localStorage.getItem("geo_token") || ""; } catch { return ""; }
}

function emit(collections) {
  for (const l of listeners) {
    if (!collections || l.collections.some(c => collections.includes(c))) l.trigger();
  }
}

function connect() {
  if (typeof EventSource === "undefined") return;
  const token = currentToken();
  // Boshqa foydalanuvchi kirgan bo'lsa (yoki chiqib ketgan) — qayta ulanamiz
  if (source && token !== sourceToken) { source.close(); source = null; }
  if (source) return;
  sourceToken = token;
  source = new EventSource(resolveUrl("/api/events" + (token ? `?token=${encodeURIComponent(token)}` : "")));
  source.onopen = () => {
    liveConnected.value = true;
    // Uzilish paytida o'tkazib yuborilgan o'zgarishlarni olish uchun
    if (everConnected) emit(null);
    everConnected = true;
  };
  source.onerror = () => { liveConnected.value = false; };  // EventSource o'zi qayta ulanadi
  source.addEventListener("change", (e) => {
    try { emit(JSON.parse(e.data).c ?? []); } catch {}
  });
  for (const name of PERSONAL_EVENTS) {
    source.addEventListener(name, (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      for (const fn of personal.get(name) ?? []) { try { fn(data); } catch {} }
    });
  }
}

if (typeof document !== "undefined") {
  // Tab qayta ochilganda — eng so'nggi holatni olamiz
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && listeners.size) emit(null);
  });
}

/**
 * Obuna: `collections` dan biri o'zgarsa `fn` chaqiriladi (tez-tez
 * o'zgarishlar bittaga jamlanadi). Komponent ichida chaqirilsa —
 * u yopilganda obuna avtomatik bekor qilinadi.
 * "settings" (masalan bloklangan sinflar) har doim kuzatiladi.
 * @returns {() => void} obunani bekor qilish
 */
export function useLive(collections, fn, { delay = 350 } = {}) {
  let timer = null;
  let running = false;
  let again = false;

  async function run() {
    if (running) { again = true; return; }
    running = true;
    try { await fn(); } catch {}
    running = false;
    if (again) { again = false; trigger(); }
  }
  function trigger() {
    clearTimeout(timer);
    // Tasodifiy qo'shimcha kechikish: 100+ foydalanuvchi bir vaqtda serverga
    // yopirilib kelmasligi uchun so'rovlar ~1 soniyaga taqsimlanadi
    timer = setTimeout(run, delay + Math.random() * JITTER_MS);
  }

  const listener = { collections: [...collections, "settings"], trigger };
  const start = () => { listeners.add(listener); connect(); };
  const stop = () => { clearTimeout(timer); listeners.delete(listener); };

  if (getCurrentInstance()) {
    onMounted(start);
    onUnmounted(stop);
  } else {
    start();
  }
  return stop;
}

/**
 * Shaxsiy hodisaga obuna ("duel" yoki "chat"). Komponent ichida chaqirilsa —
 * u yopilganda obuna avtomatik bekor qilinadi.
 * @returns {() => void} obunani bekor qilish
 */
export function onLiveEvent(name, fn) {
  if (getCurrentInstance()) {
    let stop = null;
    onMounted(() => { stop = subscribeLive(name, fn); });
    onUnmounted(() => stop?.());
    return () => stop?.();
  }
  return subscribeLive(name, fn);
}

/** Xuddi shu obuna, lekin darhol boshlanadi (store'lar uchun — komponentga bog'lanmaydi). */
export function subscribeLive(name, fn) {
  if (!personal.has(name)) personal.set(name, new Set());
  const set = personal.get(name);
  set.add(fn);
  connect();
  return () => set.delete(fn);
}

/** Kirish/chiqishdan keyin — ulanishni yangi token bilan qayta ochadi. */
export function reconnectLive() {
  if (source || listeners.size || [...personal.values()].some(s => s.size)) connect();
}
