<template>
  <div class="bars-wrap">
    <div class="bars" :style="{ height: height + 'px' }">
      <div v-for="(l, i) in labels" :key="i" class="bar-col"
           @pointerenter="hover = i" @pointerleave="hover = null">
        <div class="bar-stack" :class="{ stacked }">
          <div v-for="(s, si) in series" :key="s.key" class="bar"
               :style="barStyle(s, si, i)" :title="`${s.label}: ${formatValue(s.values[i] ?? 0)}`">
            <span v-if="showValues && (s.values[i] ?? 0) > 0 && series.length === 1" class="bar-val">
              {{ formatValue(s.values[i]) }}
            </span>
          </div>
        </div>
        <span class="bar-label" :class="{ 'bar-label--on': highlight === i }">{{ l }}</span>
      </div>

      <div v-if="hover !== null" class="tip" :style="{ left: tipLeft }">
        <p class="tip-title">{{ labels[hover] }}</p>
        <p v-for="(s, si) in series" :key="s.key" class="tip-row">
          <span class="tip-dot" :style="{ background: colorOf(s, si) }"></span>
          <span class="tip-label">{{ s.label }}</span>
          <b class="tip-val">{{ formatValue(s.values[hover] ?? 0) }}</b>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  series: { type: Array, required: true },   // [{ key, label, values, color? }]
  labels: { type: Array, required: true },
  height: { type: Number, default: 190 },
  stacked: { type: Boolean, default: false },
  showValues: { type: Boolean, default: true },
  highlight: { type: Number, default: -1 },
  formatValue: { type: Function, default: v => String(v) },
});

const hover = ref(null);
const PALETTE = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))"];
function colorOf(s, i) { return s.color || PALETTE[i % PALETTE.length]; }

const maxValue = computed(() => {
  if (props.stacked) {
    return Math.max(1, ...props.labels.map((_, i) =>
      props.series.reduce((s, ser) => s + (ser.values[i] || 0), 0)));
  }
  return Math.max(1, ...props.series.flatMap(s => s.values || []));
});

function barStyle(s, si, i) {
  const v = s.values[i] || 0;
  const pct = (v / maxValue.value) * 100;
  return {
    height: `${v > 0 ? Math.max(pct, 2) : 1.5}%`,
    background: colorOf(s, si),
    opacity: hover.value === null || hover.value === i ? 1 : 0.45,
    animationDelay: `${i * 25}ms`,
  };
}

const tipLeft = computed(() => {
  const pct = ((hover.value + 0.5) / Math.max(1, props.labels.length)) * 100;
  return `${Math.min(85, Math.max(15, pct))}%`;
});
</script>

<style scoped>
.bars-wrap { width: 100%; }
.bars { display: flex; align-items: flex-end; gap: 5px; position: relative; }
.bar-col { flex: 1; height: 100%; display: flex; flex-direction: column; min-width: 0; }
.bar-stack { flex: 1; display: flex; align-items: flex-end; justify-content: center; gap: 3px; min-height: 0; }
.bar-stack.stacked { flex-direction: column-reverse; gap: 0; }
.bar {
  flex: 1; max-width: 26px; min-width: 5px;
  border-radius: 5px 5px 0 0;
  position: relative;
  transition: opacity .15s, height .45s cubic-bezier(.2,.7,.3,1);
  animation: grow .5s cubic-bezier(.2,.7,.3,1) backwards;
}
.stacked .bar { width: 100%; max-width: 30px; border-radius: 0; }
.stacked .bar:last-child { border-radius: 5px 5px 0 0; }
@keyframes grow { from { height: 0 !important; } }
.bar-val {
  position: absolute; top: -15px; left: 50%; transform: translateX(-50%);
  font-size: 10px; font-weight: 700; color: hsl(var(--fg)); white-space: nowrap;
}
.bar-label {
  font-size: 10.5px; color: hsl(var(--chart-axis));
  text-align: center; margin-top: 7px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bar-label--on { color: hsl(var(--primary)); font-weight: 700; }

.tip {
  position: absolute; top: -4px; transform: translateX(-50%);
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 10px; box-shadow: 0 8px 24px rgb(0 0 0 / .12);
  padding: 8px 10px; min-width: 120px; pointer-events: none; z-index: 3;
}
.tip-title { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
.tip-row { display: flex; align-items: center; gap: 6px; font-size: 11.5px; line-height: 1.7; }
.tip-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
.tip-label { color: hsl(var(--muted-fg)); }
.tip-val { margin-left: auto; font-weight: 700; }
</style>
