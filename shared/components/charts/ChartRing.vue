<template>
  <div class="ring-wrap" :style="{ width: size + 'px', height: size + 'px' }">
    <svg viewBox="0 0 120 120" class="ring-canvas">
      <circle cx="60" cy="60" :r="R" fill="none" class="ring-track" :stroke-width="thickness" />
      <circle cx="60" cy="60" :r="R" fill="none" :stroke="color" :stroke-width="thickness"
              stroke-linecap="round" class="ring-arc"
              :stroke-dasharray="C" :stroke-dashoffset="offset" />
    </svg>
    <div class="ring-center">
      <slot>
        <p class="ring-value" :style="{ color }">{{ Math.round(value) }}<small>%</small></p>
        <p v-if="label" class="ring-label">{{ label }}</p>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  value: { type: Number, default: 0 },       // 0..100
  size: { type: Number, default: 120 },
  thickness: { type: Number, default: 10 },
  color: { type: String, default: "hsl(var(--primary))" },
  label: { type: String, default: "" },
});

const R = computed(() => 60 - props.thickness / 2);
const C = computed(() => 2 * Math.PI * R.value);
const offset = computed(() => C.value * (1 - Math.max(0, Math.min(100, props.value)) / 100));
</script>

<style scoped>
.ring-wrap { position: relative; flex-shrink: 0; }
.ring-canvas { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring-track { stroke: hsl(var(--muted)); }
.ring-arc { transition: stroke-dashoffset .8s cubic-bezier(.2,.7,.3,1); }
.ring-center {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
}
.ring-value { font-size: 21px; font-weight: 800; line-height: 1; letter-spacing: -.02em; }
.ring-value small { font-size: 12px; font-weight: 700; margin-left: 1px; }
.ring-label { font-size: 10px; color: hsl(var(--muted-fg)); margin-top: 3px; }
</style>
