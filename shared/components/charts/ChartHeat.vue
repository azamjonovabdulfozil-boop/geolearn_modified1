<template>
  <div class="heat">
    <div class="heat-grid" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
      <div v-for="(c, i) in cells" :key="i" class="cell"
           :style="cellStyle(c)"
           :title="`${c.label}: ${c.value}`">
        <span v-if="showLabels" class="cell-txt">{{ c.short ?? c.label }}</span>
      </div>
    </div>
    <div class="heat-foot">
      <span class="foot-label">{{ minLabel }}</span>
      <div class="heat-scale">
        <i v-for="n in 5" :key="n" :style="{ background: shade((n - 1) / 4) }"></i>
      </div>
      <span class="foot-label">{{ maxLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  cells: { type: Array, required: true },     // [{ label, value, short? }]
  columns: { type: Number, default: 12 },
  color: { type: String, default: "var(--chart-1)" },
  showLabels: { type: Boolean, default: false },
  minLabel: { type: String, default: "kam" },
  maxLabel: { type: String, default: "ko'p" },
});

const max = computed(() => Math.max(1, ...props.cells.map(c => c.value || 0)));

function shade(t) {
  const alpha = 0.06 + t * 0.94;
  return `hsl(${props.color} / ${alpha.toFixed(2)})`;
}
function cellStyle(c) {
  const t = (c.value || 0) / max.value;
  return {
    background: c.value ? shade(t) : "hsl(var(--muted))",
    color: t > 0.55 ? "#fff" : "hsl(var(--muted-fg))",
  };
}
</script>

<style scoped>
.heat { width: 100%; }
.heat-grid { display: grid; gap: 4px; }
.cell {
  aspect-ratio: 1;
  border-radius: 5px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700;
  transition: transform .15s, background .3s;
  min-height: 18px;
}
.cell:hover { transform: scale(1.14); }
.cell-txt { opacity: .85; }
.heat-foot { display: flex; align-items: center; gap: 7px; margin-top: 10px; justify-content: flex-end; }
.foot-label { font-size: 10px; color: hsl(var(--muted-fg)); }
.heat-scale { display: flex; gap: 3px; }
.heat-scale i { width: 13px; height: 8px; border-radius: 2px; display: block; }
</style>
