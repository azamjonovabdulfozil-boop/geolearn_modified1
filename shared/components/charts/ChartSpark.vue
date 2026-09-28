<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="spark" preserveAspectRatio="none">
    <defs>
      <linearGradient :id="uid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color" stop-opacity=".35" />
        <stop offset="100%" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <template v-if="type === 'bar'">
      <rect v-for="(v, i) in values" :key="i"
            :x="i * (W / values.length) + 0.8" :y="H - barH(v)"
            :width="Math.max(1.2, W / values.length - 1.6)" :height="barH(v)"
            :fill="color" :opacity="i === values.length - 1 ? 1 : .5" rx="1" />
    </template>
    <template v-else>
      <path :d="areaD" :fill="`url(#${uid})`" />
      <path :d="lineD" fill="none" :stroke="color" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round" />
      <circle v-if="values.length" :cx="x(values.length - 1)" :cy="y(values.at(-1))" r="2.2" :fill="color" />
    </template>
  </svg>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  values: { type: Array, default: () => [] },
  color: { type: String, default: "hsl(var(--primary))" },
  type: { type: String, default: "line" },   // line | bar
});

const uid = "sp" + Math.random().toString(36).slice(2, 8);
const W = 100, H = 30;
const max = computed(() => Math.max(1, ...props.values));

function x(i) {
  const n = props.values.length;
  return n <= 1 ? W / 2 : (i / (n - 1)) * W;
}
function y(v) { return H - 2 - ((v || 0) / max.value) * (H - 5); }
function barH(v) { return Math.max(1, ((v || 0) / max.value) * (H - 3)); }

const lineD = computed(() => {
  if (!props.values.length) return "";
  return props.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
});
const areaD = computed(() => {
  if (!props.values.length) return "";
  return `${lineD.value} L${W},${H} L0,${H} Z`;
});
</script>

<style scoped>
.spark { width: 100%; height: 32px; display: block; overflow: visible; }
</style>
