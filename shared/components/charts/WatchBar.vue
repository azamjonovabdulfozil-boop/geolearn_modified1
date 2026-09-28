<template>
  <div class="watch">
    <div class="watch-track" :title="`${percent}% ko'rilgan`">
      <div class="watch-fill" :style="{ width: percent + '%', background: color }"></div>
      <span class="mark mark-half" title="Yarmi"></span>
      <span class="mark mark-end" title="Oxiri"></span>
    </div>
    <div v-if="showMeta" class="watch-meta">
      <span class="watch-status" :style="{ color }">
        <component :is="statusIcon" :size="11" />
        {{ statusLabel }}
      </span>
      <span class="watch-pct" :style="{ color }">{{ percent }}%</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { CheckCircle2, PlayCircle, CircleDashed, Circle } from "lucide-vue-next";

const props = defineProps({
  percent: { type: Number, default: 0 },
  status: { type: String, default: null },     // completed | half | started | opened
  label: { type: String, default: "" },
  showMeta: { type: Boolean, default: true },
});

const state = computed(() => {
  if (props.status) return props.status;
  if (props.percent >= 90) return "completed";
  if (props.percent >= 45) return "half";
  if (props.percent > 0) return "started";
  return "opened";
});

const COLORS = {
  completed: "hsl(var(--success))",
  half: "hsl(var(--warning))",
  started: "hsl(var(--chart-5))",
  opened: "hsl(var(--muted-fg))",
};
const LABELS = {
  completed: "Oxirigacha ko'rdi",
  half: "Yarmidan oshdi",
  started: "Boshladi",
  opened: "Faqat ochdi",
};
const ICONS = {
  completed: CheckCircle2,
  half: PlayCircle,
  started: CircleDashed,
  opened: Circle,
};

const color = computed(() => COLORS[state.value]);
const statusLabel = computed(() => props.label || LABELS[state.value]);
const statusIcon = computed(() => ICONS[state.value]);
</script>

<style scoped>
.watch { width: 100%; }
.watch-track {
  position: relative; height: 7px; border-radius: 99px;
  background: hsl(var(--muted)); overflow: hidden;
}
.watch-fill { height: 100%; border-radius: 99px; transition: width .6s cubic-bezier(.2,.7,.3,1); }
.mark { position: absolute; top: 0; bottom: 0; width: 1.5px; background: hsl(var(--card)); opacity: .85; }
.mark-half { left: 50%; }
.mark-end { left: 90%; }
.watch-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; gap: 8px; }
.watch-status { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; }
.watch-pct { font-size: 11px; font-weight: 800; }
</style>
