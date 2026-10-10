// O'yinlar uchun umumiy yordamchilar: urug'li tasodifiy sonlar va qisqa tovushlar.

/**
 * Urug'li tasodifiy sonlar (mulberry32). 1v1 o'yinda ikkala o'yinchiga bir xil
 * urug' beriladi — olmalar, kartalar va dushmanlar ikkalasida bir xil chiqadi.
 */
export function makeRng(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Tovushlar (Web Audio; fayl kerak emas) ──
let ctx = null;
function audio() {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq, start, dur, { type = "sine", gain = 0.12, slide = 0 } = {}) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const t = ac.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const SOUNDS = {
  click:   () => tone(520, 0, 0.06, { type: "triangle", gain: 0.08 }),
  eat:     () => { tone(660, 0, 0.07, { type: "square", gain: 0.06 }); tone(990, 0.06, 0.09, { type: "square", gain: 0.06 }); },
  shoot:   () => tone(300, 0, 0.12, { type: "sawtooth", gain: 0.07, slide: -220 }),
  boom:    () => tone(140, 0, 0.3, { type: "sawtooth", gain: 0.12, slide: -100 }),
  kick:    () => tone(180, 0, 0.14, { type: "triangle", gain: 0.16, slide: -120 }),
  good:    () => { tone(523, 0, 0.1); tone(659, 0.1, 0.1); tone(784, 0.2, 0.18); },
  bad:     () => { tone(300, 0, 0.16, { type: "sawtooth", gain: 0.08 }); tone(200, 0.15, 0.24, { type: "sawtooth", gain: 0.08 }); },
  flip:    () => tone(700, 0, 0.04, { type: "triangle", gain: 0.06 }),
  tick:    () => tone(880, 0, 0.05, { type: "square", gain: 0.05 }),
  invite:  () => { tone(784, 0, 0.12); tone(988, 0.14, 0.12); tone(1175, 0.28, 0.2); },
  message: () => { tone(880, 0, 0.08, { gain: 0.08 }); tone(1175, 0.09, 0.12, { gain: 0.08 }); },
  win:     () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22)),
  lose:    () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.28, { type: "triangle" })),
};

/** Qisqa tovush chiqaradi. Brauzer ruxsat bermasa — jim o'tadi. */
export function play(name) {
  try { SOUNDS[name]?.(); } catch {}
}

/** Soniyani "1:05" ko'rinishiga keltiradi. */
export function clock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
