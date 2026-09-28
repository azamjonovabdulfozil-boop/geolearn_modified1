<template>
  <div class="donut-wrap">
    <div class="donut-svg-wrap">
      <svg :viewBox="`0 0 ${S} ${S}`" class="donut">
        <circle :cx="S/2" :cy="S/2" :r="radius" fill="none" class="donut-track" :stroke-width="thickness" />
        <circle v-for="(seg, i) in segments" :key="i"
                :cx="S/2" :cy="S/2" :r="radius" fill="none"
                :stroke="seg.color" :stroke-width="thickness"
                :stroke-dasharray="`${seg.len} ${circumference - seg.len}`"
                :stroke-dashoffset="-seg.offset"
                stroke-linecap="butt" class="seg"
                :style="{ opacity: hover === null || hover === i ? 1 : .35 }"
                @pointerenter="hover = i" @pointerleave="hover = null" />
      </svg>
      <div class="donut-center">
        <p class="donut-value">{{ hover === null ? centerText : items[hover].value }}</p>
        <p class="donut-label">{{ hover === null ? centerLabel : items[hover].label }}</p>
      </div>
    </div>

    <ul v-if="legend" class="legend">
      <li v-for="(it, i) in items" :key="i" class="legend-row"
          @pointerenter="hover = i" @pointerleave="hover = null"
          :style="{ opacity: hover === null || hover === i ? 1 : .5 }">
        <span class="legend-dot" :style="{ background: colorOf(it, i) }"></span>
        <span class="legend-label">{{ it.label }}</span>
        <b class="legend-val">{{ it.value }}</b>
        <span class="legend-pct">{{ pct(it.value) }}%</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  items: { type: Array, required: true },   // [{ label, value, color? }]
  size: { type: Number, default: 150 },
  thickness: { type: Number, default: 18 },
  centerLabel: { type: String, default: "Jami" },
  centerValue: { type: [String, Number], default: null },
  legend: { type: Boolean, default: true },
});

const hover = ref(null);
const S = 160;
const radius = computed(() => (S - props.thickness) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);

const PALETTE = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))"];
function colorOf(it, i) { return it.color || PALETTE[i % PALETTE.length]; }

const total = computed(() => props.items.reduce((s, i) => s + (i.value || 0), 0));
const centerText = computed(() => props.centerValue ?? total.value);

const segments = computed(() => {
  let offset = 0;
  return props.items.map((it, i) => {
    const share = total.value ? (it.value || 0) / total.value : 0;
    const len = share * circumference.value;
    const seg = { len, offset, color: colorOf(it, i) };
    offset += len;
    return seg;
  });
});

function pct(v) {
  return total.value ? Math.round((v / total.value) * 100) : 0;
}
</script>

<style scoped>
.donut-wrap { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.donut-svg-wrap { position: relative; width: v-bind('size + "px"'); flex-shrink: 0; }
.donut { width: 100%; display: block; transform: rotate(-90deg); }
.donut-track { stroke: hsl(var(--muted)); }
.seg { transition: opacity .15s; cursor: default; animation: grow .7s ease-out backwards; }
@keyframes grow { from { stroke-dasharray: 0 999; } }
.donut-center {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none; text-align: center; padding: 0 12px;
}
.donut-value { font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: -.02em; }
.donut-label { font-size: 10.5px; color: hsl(var(--muted-fg)); margin-top: 4px; line-height: 1.25; }

.legend { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 130px; display: flex; flex-direction: column; gap: 5px; }
.legend-row { display: flex; align-items: center; gap: 8px; font-size: 12px; transition: opacity .15s; }
.legend-dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
.legend-label { color: hsl(var(--muted-fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.legend-val { margin-left: auto; font-weight: 700; }
.legend-pct { font-size: 11px; color: hsl(var(--muted-fg)); width: 34px; text-align: right; }
</style>
