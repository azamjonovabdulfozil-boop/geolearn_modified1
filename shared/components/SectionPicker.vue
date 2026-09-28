<template>
  <div class="sp">
    <button v-for="o in options" :key="o.value" type="button"
      class="sp-btn" :class="{ 'sp-btn--on': modelValue === o.value }"
      @click="$emit('update:modelValue', o.value)">
      <span>{{ o.flag }}</span> {{ o.label }}
    </button>
  </div>
</template>

<script setup>
// Kontent qaysi sinflar uchun: o'zbek / rus / barcha sinflarga.
// `withAll=false` — faqat o'zbek yoki rus (masalan sinf qo'shishda).
import { computed } from "vue";
import { SECTION_OPTIONS } from "@shared/stores/settings";

const props = defineProps({
  modelValue: { type: String, default: "all" },
  withAll: { type: Boolean, default: true },
});
defineEmits(["update:modelValue"]);

const options = computed(() => {
  const list = [...SECTION_OPTIONS.filter(o => o.value !== "all"), ...SECTION_OPTIONS.filter(o => o.value === "all")];
  return props.withAll ? list : list.filter(o => o.value !== "all");
});
</script>

<style scoped>
.sp { display: flex; gap: 6px; flex-wrap: wrap; }
.sp-btn {
  flex: 1; min-width: 110px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 10px; border-radius: 10px;
  border: 1.5px solid hsl(var(--border)); background: transparent;
  color: hsl(var(--muted-fg)); font-family: inherit; font-size: 12.5px; font-weight: 600;
  cursor: pointer; transition: all .15s;
}
.sp-btn:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--primary)); }
.sp-btn--on { background: hsl(var(--primary)); border-color: hsl(var(--primary)); color: #fff; }
</style>
