<template>
  <section class="geo-card panel">
    <header class="panel-head">
      <div v-if="icon" class="panel-icon" :style="{ background: tint, color }">
        <component :is="icon" :size="15" />
      </div>
      <div class="panel-titles">
        <h2 class="panel-title">{{ title }}</h2>
        <p v-if="subtitle" class="panel-sub">{{ subtitle }}</p>
      </div>
      <div class="panel-actions"><slot name="actions" /></div>
    </header>

    <div v-if="loading" class="panel-skeleton">
      <div v-for="i in skeletonRows" :key="i" class="geo-skeleton" :style="{ height: skeletonHeight + 'px' }"></div>
    </div>
    <div v-else-if="empty" class="panel-empty">
      <component :is="emptyIcon || icon" :size="32" style="opacity:.28" />
      <p>{{ emptyText }}</p>
      <slot name="empty-action" />
    </div>
    <div v-else class="panel-body"><slot /></div>
  </section>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
  icon: { type: [Object, Function], default: null },
  emptyIcon: { type: [Object, Function], default: null },
  color: { type: String, default: "hsl(var(--primary))" },
  loading: { type: Boolean, default: false },
  empty: { type: Boolean, default: false },
  emptyText: { type: String, default: "Ma'lumot yo'q" },
  skeletonRows: { type: Number, default: 4 },
  skeletonHeight: { type: Number, default: 44 },
});

const tint = computed(() => {
  const c = props.color.trim();
  if (c.startsWith("hsl(") && c.endsWith(")")) return `hsl(${c.slice(4, -1)} / .12)`;
  return `color-mix(in srgb, ${c} 12%, transparent)`;
});
</script>

<style scoped>
.panel { padding: 18px; display: flex; flex-direction: column; }
.panel-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.panel-icon { width: 31px; height: 31px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.panel-titles { min-width: 0; flex: 1; }
.panel-title { font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.panel-sub { font-size: 11px; color: hsl(var(--muted-fg)); margin-top: 1px; }
.panel-actions { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
.panel-body { flex: 1; min-height: 0; }
.panel-skeleton { display: flex; flex-direction: column; gap: 8px; }
.panel-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 9px; padding: 30px 8px; text-align: center;
  color: hsl(var(--muted-fg)); font-size: 12.5px; flex: 1;
}
</style>
