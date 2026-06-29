<template>
  <GeoLayout :navItems="navItems" />
</template>

<script setup>
import { computed } from "vue";
import { LayoutDashboard, BookOpen, Gamepad2, Trophy, Video, Bot, Activity, Settings } from "lucide-vue-next";
import GeoLayout from "@/components/GeoLayout.vue";

const navItems = computed(() => [
  { to: "/teacher/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { to: "/teacher/lessons",   icon: BookOpen,        labelKey: "lessons" },
  { to: "/teacher/games",     icon: Gamepad2,        labelKey: "games" },
  { to: "/teacher/ratings",   icon: Trophy,          labelKey: "ratings" },
  { to: "/teacher/videos",    icon: Video,           labelKey: "videos" },
  { to: "/teacher/ai",        icon: Bot,             labelKey: "ai" },
  { to: "/teacher/ai-logs",   icon: Activity,        label: "AI Logs" },
  { to: "/teacher/settings",  icon: Settings,        labelKey: "settings" },
]);
</script>
