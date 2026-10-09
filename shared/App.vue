<template>
  <RouterView />
</template>

<script setup>
import { RouterView } from "vue-router";
import { useGradesStore } from "@shared/stores/grades";
import { useAuthStore } from "@shared/stores/auth";
import { useLive } from "@shared/composables/live";
import { useSettingsStore } from "@shared/stores/settings";

// Bloklangan sinflar ro'yxati — butun ilova uchun bir marta yuklanadi
const grades = useGradesStore();
grades.load();
useLive([], grades.load);   // "settings" o'zgarsa — darhol yangilanadi

// CRM nomi va logosi — admin o'zgartirsa hamma joyda darhol yangilanadi
const settings = useSettingsStore();
settings.loadBrand();
useLive([], settings.loadBrand);

// Profil (ism, sinf, ball) boshqa joyda o'zgarsa ham darhol ko'rinsin
const auth = useAuthStore();
useLive(["users"], () => auth.user && auth.refreshMe(), { delay: 1000 });
</script>
