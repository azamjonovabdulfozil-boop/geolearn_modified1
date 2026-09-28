<template>
  <div class="stat-card geo-card" :class="{ 'stat-card--link': !!to }">
    <component :is="to ? 'RouterLink' : 'div'" :to="to" class="stat-inner">
      <div class="stat-top">
        <div class="stat-icon" :style="{ background: `${tint}`, color }">
          <component :is="icon" :size="18" />
        </div>
        <span v-if="delta !== null && delta !== undefined" class="delta"
              :class="delta >= 0 ? 'delta--up' : 'delta--down'">
          <component :is="delta >= 0 ? TrendingUp : TrendingDown" :size="11" />
          {{ delta >= 0 ? '+' : '' }}{{ delta }}%
        </span>
        <span v-else-if="pulse" class="pulse"></span>
      </div>

      <p class="stat-value">
        <span v-if="loading" class="geo-skeleton val-skel"></span>
        <template v-else>{{ value }}<small v-if="unit">{{ unit }}</small></template>
      </p>
      <p class="stat-label">{{ label }}</p>
      <p v-if="sub" class="stat-sub">{{ sub }}</p>

      <div v-if="spark?.length" class="stat-spark">
        <ChartSpark :values="spark" :color="color" :type="sparkType" />
      </div>
    </component>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { TrendingUp, TrendingDown } from "lucide-vue-next";
import ChartSpark from "./ChartSpark.vue";

const props = defineProps({
  icon: { type: [Object, Function], required: true },
  label: { type: String, required: true },
  value: { type: [String, Number], default: 0 },
  unit: { type: String, default: "" },
  sub: { type: String, default: "" },
  delta: { type: Number, default: null },
  color: { type: String, default: "hsl(var(--chart-1))" },
  spark: { type: Array, default: () => [] },
  sparkType: { type: String, default: "line" },
  loading: { type: Boolean, default: false },
  pulse: { type: Boolean, default: false },
  to: { type: String, default: "" },
});

// Ikonka orqa foni — rangning shaffof varianti
const tint = computed(() => {
  const c = props.color.trim();
  if (c.startsWith("hsl(") && c.endsWith(")")) return `hsl(${c.slice(4, -1)} / .12)`;
  return `color-mix(in srgb, ${c} 12%, transparent)`;
});
</script>

<style scoped>
.stat-card { padding: 0; overflow: hidden; transition: transform .18s, box-shadow .18s; }
.stat-card--link:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgb(0 0 0 / .10); }
.stat-inner { display: block; padding: 16px 16px 12px; text-decoration: none; color: inherit; }
.stat-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.stat-icon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; }
.delta {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 99px;
}
.delta--up { color: hsl(var(--success)); background: hsl(var(--success) / .12); }
.delta--down { color: hsl(var(--destructive)); background: hsl(var(--destructive) / .12); }
.pulse {
  width: 9px; height: 9px; border-radius: 50%;
  background: hsl(var(--success));
  box-shadow: 0 0 0 0 hsl(var(--success) / .6);
  animation: pulse 1.9s infinite;
}
@keyframes pulse { 70% { box-shadow: 0 0 0 8px transparent } 100% { box-shadow: 0 0 0 0 transparent } }

.stat-value { font-size: 1.85rem; font-weight: 800; line-height: 1; letter-spacing: -.03em; }
.stat-value small { font-size: .85rem; font-weight: 700; color: hsl(var(--muted-fg)); margin-left: 2px; }
.val-skel { display: inline-block; width: 54px; height: 26px; border-radius: 7px; }
.stat-label { font-size: 12px; color: hsl(var(--muted-fg)); font-weight: 500; margin-top: 6px; }
.stat-sub { font-size: 11px; color: hsl(var(--muted-fg)); opacity: .8; margin-top: 2px; }
.stat-spark { margin: 8px -16px -12px; opacity: .9; }
</style>
