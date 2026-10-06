<template>
  <div v-if="remaining > 0" class="show-more">
    <button type="button" class="show-more-btn" @click="$emit('more')">
      <ChevronDown :size="15" />
      <span>{{ label }}</span>
    </button>
    <span class="show-more-info">{{ info }}</span>
  </div>
</template>

<script setup>
// "Yana ko'rsatish" tugmasi — usePaged() bilan birga ishlatiladi
import { computed } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { useSettingsStore } from "@shared/stores/settings";

const props = defineProps({
  remaining: { type: Number, required: true },
  shown: { type: Number, default: 0 },
  step: { type: Number, default: 30 },
});
defineEmits(["more"]);

const settings = useSettingsStore();
const ru = computed(() => settings.language === "ru");
const next = computed(() => Math.min(props.step, props.remaining));
const label = computed(() => ru.value ? `Показать ещё ${next.value}` : `Yana ${next.value} ta ko'rsatish`);
const info = computed(() => ru.value
  ? `Показано ${props.shown} · осталось ${props.remaining}`
  : `${props.shown} ta ko'rsatilgan · yana ${props.remaining} ta bor`);
</script>

<style scoped>
.show-more { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 12px 16px; }
.show-more-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; border-radius: 99px;
  border: 1.5px solid hsl(var(--border)); background: hsl(var(--card));
  color: hsl(var(--fg)); font-size: 13px; font-weight: 600; font-family: inherit;
  cursor: pointer; transition: all .15s;
}
.show-more-btn:hover { border-color: hsl(var(--primary)); color: hsl(var(--primary)); background: hsl(var(--primary) / .05); }
.show-more-info { font-size: 11.5px; color: hsl(var(--muted-fg)); }
</style>
