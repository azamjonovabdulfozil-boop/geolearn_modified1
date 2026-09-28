// ── YouTube IFrame API ────────────────────────────────────────────────────
// Video qanchasi ko'rilganini bilish uchun oddiy <iframe> yetarli emas —
// YouTube ning o'z pleyer API si kerak. Skript bir marta yuklanadi va
// barcha komponentlar shu va'dani (promise) kutadi.

let apiPromise = null;

export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[data-yt-api]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.dataset.ytApi = "1";
      s.onerror = () => reject(new Error("YouTube API yuklanmadi"));
      document.head.appendChild(s);
    }
    // Tarmoq sekin bo'lsa ham cheksiz kutib qolmaymiz
    setTimeout(() => reject(new Error("YouTube API kutish vaqti tugadi")), 12000);
  }).catch(err => {
    apiPromise = null;
    throw err;
  });

  return apiPromise;
}

/** YouTube havolasidan video ID sini ajratadi (barcha ko'rinishlar uchun). */
export function youtubeId(url = "") {
  const patterns = [
    /[?&]v=([\w-]{6,})/,               // watch?v=ID
    /youtu\.be\/([\w-]{6,})/,          // youtu.be/ID
    /\/embed\/([\w-]{6,})/,            // /embed/ID
    /\/shorts\/([\w-]{6,})/,           // /shorts/ID
    /\/live\/([\w-]{6,})/,             // /live/ID
  ];
  for (const re of patterns) {
    const m = String(url).match(re);
    if (m) return m[1];
  }
  const bare = String(url).trim();
  return /^[\w-]{11}$/.test(bare) ? bare : "";
}

/** Sekundni "12:34" ko'rinishida. */
export function formatTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  if (m < 60) return `${m}:${r}`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${r}`;
}
