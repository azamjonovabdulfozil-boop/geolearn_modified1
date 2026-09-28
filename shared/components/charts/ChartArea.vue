<template>
  <div class="chart-wrap" ref="wrap">
    <svg :viewBox="`0 0 ${W} ${H}`" class="chart-svg" preserveAspectRatio="none"
         @pointermove="onMove" @pointerleave="hover = null">
      <defs>
        <linearGradient v-for="(s, si) in series" :key="s.key" :id="`${uid}-g${si}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   :stop-color="colorOf(s, si)" stop-opacity="0.30" />
          <stop offset="100%" :stop-color="colorOf(s, si)" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <!-- Gorizontal to'r va Y o'qi -->
      <g class="chart-grid">
        <template v-for="(t, i) in yTickValues" :key="i">
          <line :x1="padL" :x2="W - padR" :y1="scaleY(t)" :y2="scaleY(t)" />
          <text :x="padL - 7" :y="scaleY(t) + 3.5" class="axis-y">{{ fmtTick(t) }}</text>
        </template>
      </g>

      <!-- Maydon va chiziqlar -->
      <template v-for="(s, si) in series" :key="s.key">
        <path v-if="area" :d="areaPath(s.values)" :fill="`url(#${uid}-g${si})`" class="area" />
        <path :d="linePath(s.values)" fill="none" :stroke="colorOf(s, si)"
              stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="line" />
      </template>

      <!-- Kursor chizig'i va nuqtalar -->
      <g v-if="hover !== null">
        <line :x1="scaleX(hover)" :x2="scaleX(hover)" :y1="padT" :y2="H - padB" class="cursor-line" />
        <circle v-for="(s, si) in series" :key="s.key"
                :cx="scaleX(hover)" :cy="scaleY(s.values[hover] ?? 0)" r="3.6"
                :fill="colorOf(s, si)" class="dot" />
      </g>

      <!-- X o'qi -->
      <g class="axis-x-group">
        <text v-for="(l, i) in labels" :key="i" v-show="showLabel(i)"
              :x="scaleX(i)" :y="H - 6" class="axis-x">{{ l }}</text>
      </g>
    </svg>

    <!-- Ma'lumot oynasi -->
    <div v-if="hover !== null" class="tip" :style="tipStyle">
      <p class="tip-title">{{ tooltipTitle || labels[hover] }}</p>
      <p v-for="(s, si) in series" :key="s.key" class="tip-row">
        <span class="tip-dot" :style="{ background: colorOf(s, si) }"></span>
        <span class="tip-label">{{ s.label }}</span>
        <b class="tip-val">{{ formatValue(s.values[hover] ?? 0, s) }}</b>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  // [{ key, label, values: number[], color? }]
  series: { type: Array, required: true },
  labels: { type: Array, default: () => [] },
  height: { type: Number, default: 230 },
  area: { type: Boolean, default: true },
  yTicks: { type: Number, default: 4 },
  maxLabels: { type: Number, default: 8 },
  formatValue: { type: Function, default: v => String(v) },
  tooltipTitles: { type: Array, default: null },
});

const uid = "ca" + Math.random().toString(36).slice(2, 8);
const W = 720;
const H = computed(() => props.height);
const padL = 36, padR = 14, padT = 16, padB = 26;

const wrap = ref(null);
const hover = ref(null);

const count = computed(() => Math.max(1, props.labels.length || props.series[0]?.values.length || 1));

const maxValue = computed(() => {
  const all = props.series.flatMap(s => s.values || []);
  const m = Math.max(1, ...all);
  // Chiroyli yuqori chegara: 1-2-5 qadamlar bilan yaxlitlaymiz
  const mag = Math.pow(10, Math.floor(Math.log10(m)));
  for (const step of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (m <= mag * step) return mag * step;
  }
  return mag * 10;
});

const yTickValues = computed(() =>
  Array.from({ length: props.yTicks + 1 }, (_, i) => (maxValue.value / props.yTicks) * i)
);

const PALETTE = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))"];
function colorOf(s, i) { return s.color || PALETTE[i % PALETTE.length]; }

function scaleX(i) {
  if (count.value === 1) return padL + (W - padL - padR) / 2;
  return padL + (i / (count.value - 1)) * (W - padL - padR);
}
function scaleY(v) {
  const inner = H.value - padT - padB;
  return H.value - padB - (Math.max(0, v) / maxValue.value) * inner;
}

/** Yumshoq egri chiziq (Catmull-Rom → kubik Bezier). */
function linePath(values = []) {
  const pts = values.map((v, i) => [scaleX(i), scaleY(v)]);
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}
function areaPath(values = []) {
  const line = linePath(values);
  if (!line) return "";
  const last = scaleX(values.length - 1);
  const first = scaleX(0);
  return `${line} L${last},${H.value - padB} L${first},${H.value - padB} Z`;
}

function fmtTick(v) {
  if (v >= 1000) return (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** X belgilarini siyraklashtirish — sig'magani ko'rsatilmaydi. */
function showLabel(i) {
  const step = Math.ceil(count.value / props.maxLabels);
  return i % step === 0 || i === count.value - 1;
}

const tooltipTitle = computed(() =>
  hover.value !== null && props.tooltipTitles ? props.tooltipTitles[hover.value] : null
);

function onMove(e) {
  const box = wrap.value?.getBoundingClientRect();
  if (!box) return;
  const ratio = (e.clientX - box.left) / box.width;
  const x = ratio * W;
  const rel = (x - padL) / Math.max(1, W - padL - padR);
  hover.value = Math.max(0, Math.min(count.value - 1, Math.round(rel * (count.value - 1))));
}

const tipStyle = computed(() => {
  const pct = (scaleX(hover.value) / W) * 100;
  return {
    left: `${Math.min(88, Math.max(12, pct))}%`,
    transform: "translateX(-50%)",
  };
});
</script>

<style scoped>
.chart-wrap { position: relative; width: 100%; }
.chart-svg { width: 100%; display: block; height: v-bind('height + "px"'); touch-action: none; }
.chart-grid line { stroke: hsl(var(--chart-grid)); stroke-width: 1; }
.axis-y { fill: hsl(var(--chart-axis)); font-size: 10px; text-anchor: end; }
.axis-x { fill: hsl(var(--chart-axis)); font-size: 10px; text-anchor: middle; }
.cursor-line { stroke: hsl(var(--chart-axis)); stroke-width: 1; stroke-dasharray: 3 3; opacity: .6; }
.dot { stroke: hsl(var(--card)); stroke-width: 2; }
.line { animation: draw .6s ease-out; }
.area { animation: fade .6s ease-out; }
@keyframes draw { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes fade { from { opacity: 0 } to { opacity: 1 } }

.tip {
  position: absolute; top: 6px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  box-shadow: 0 8px 24px rgb(0 0 0 / .12);
  padding: 8px 10px;
  min-width: 130px;
  pointer-events: none;
  z-index: 3;
}
.tip-title { font-size: 11px; font-weight: 700; margin-bottom: 5px; color: hsl(var(--fg)); }
.tip-row { display: flex; align-items: center; gap: 6px; font-size: 11.5px; line-height: 1.7; }
.tip-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
.tip-label { color: hsl(var(--muted-fg)); }
.tip-val { margin-left: auto; font-weight: 700; }
</style>
