// Kanvasli mini-o'yinlar uchun umumiy asos: o'lcham (retina), kadr sikli,
// sichqoncha/barmoq koordinatalari va klaviatura. O'yin faqat `update` va
// `draw` ni yozadi.
import { onMounted, onUnmounted, reactive } from "vue";

/**
 * @param canvasRef  <canvas> ref
 * @param opts.width / opts.height  mantiqiy o'lcham (chizish shu birlikda)
 * @param opts.active   () => boolean — o'yin yurib turibdimi
 * @param opts.update   (dt soniyada) — faqat faol paytda
 * @param opts.draw     (ctx, dt) — har kadrda
 * @param opts.onTap    ({ x, y }) — bosilganda (faol paytda)
 * @param opts.onKey    (key, down) — klaviatura (faol paytda)
 */
export function useArcade(canvasRef, { width, height, active, update, draw, onTap, onKey }) {
  const pointer = reactive({ x: width / 2, y: height / 2, down: false, moved: false });
  const keys = new Set();
  let ctx = null, raf = 0, last = 0;

  function toLocal(e) {
    const r = canvasRef.value.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * width;
    pointer.y = ((e.clientY - r.top) / r.height) * height;
  }
  function down(e) {
    e.preventDefault();
    toLocal(e);
    pointer.down = true; pointer.moved = true;
    if (active()) onTap?.({ x: pointer.x, y: pointer.y });
  }
  function move(e) { toLocal(e); pointer.moved = true; }
  function up() { pointer.down = false; }

  const GAME_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d"];
  function key(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!GAME_KEYS.includes(k) || !active()) return;
    // Yozish maydonida turgan bo'lsa (masalan chat) — tegmaymiz
    if (/^(input|textarea)$/i.test(e.target?.tagName ?? "")) return;
    e.preventDefault();
    const isDown = e.type === "keydown";
    if (isDown) { if (!e.repeat) { keys.add(k); onKey?.(k, true); } }
    else { keys.delete(k); onKey?.(k, false); }
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000);
    last = ts;
    if (active()) update?.(dt);
    draw(ctx, dt);
  }

  onMounted(() => {
    const c = canvasRef.value;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = width * dpr; c.height = height * dpr;
    ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    raf = requestAnimationFrame(frame);
  });
  onUnmounted(() => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("keydown", key);
    window.removeEventListener("keyup", key);
  });

  return { pointer, keys };
}

/** Yumaloq burchakli to'rtburchak yo'li (eski brauzerlar uchun ham). */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Chap yuqori burchakdagi jonlar (yuraklar o'rniga oddiy doirachalar). */
export function drawLives(ctx, lives, max = 3, x = 14, y = 14) {
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < lives ? "#ff5252" : "rgba(255,255,255,.25)";
    ctx.beginPath(); ctx.arc(x + i * 20 + 7, y + 7, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
  }
}
