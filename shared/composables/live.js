// ── Real vaqt yangilanishlari ─────────────────────────────────────────────
// Backend /api/events orqali "qaysi ma'lumot o'zgardi" deb xabar beradi.
// Sahifalar useLive([...to'plamlar], qaytaYuklash) bilan obuna bo'ladi —
// boshqa foydalanuvchi nimanidir o'zgartirsa, sahifa o'zi yangilanadi.
import { ref, onMounted, onUnmounted, getCurrentInstance } from "vue";
import { resolveUrl } from "./api";

const listeners = new Set();
export const liveConnected = ref(false);

let source = null;
let everConnected = false;

function emit(collections) {
  for (const l of listeners) {
    if (!collections || l.collections.some(c => collections.includes(c))) l.trigger();
  }
}

function connect() {
  if (source || typeof EventSource === "undefined") return;
  source = new EventSource(resolveUrl("/api/events"));
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
    timer = setTimeout(run, delay);
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
