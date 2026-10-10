<template>
  <span class="avatar" :class="{ online: user.online }" :style="{ '--hue': hue }">
    <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" />
    <template v-else>{{ (user.name || '?').charAt(0).toUpperCase() }}</template>
  </span>
</template>

<script setup>
import { computed } from "vue";

// Foydalanuvchi rasmi; rasm bo'lmasa — ismining bosh harfi (rangi id bo'yicha).
const props = defineProps({ user: { type: Object, required: true } });
const hue = computed(() => ((props.user.id ?? 0) * 47) % 360);
</script>

<style scoped>
.avatar {
  position: relative; flex: none; width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; color: #fff;
  background: linear-gradient(135deg, hsl(var(--hue) 62% 52%), hsl(calc(var(--hue) + 30) 62% 40%));
}
.avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.avatar.online::after {
  content: ""; position: absolute; right: 0; bottom: 0; width: 12px; height: 12px; border-radius: 50%;
  background: #2ecc71; border: 2.5px solid hsl(var(--card));
}
</style>
