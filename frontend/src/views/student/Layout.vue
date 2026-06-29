<template>
  <GeoLayout :navItems="navItems" />
</template>

<script setup>
import { computed } from "vue";
import { LayoutDashboard, BookOpen, Gamepad2, Trophy, Video, Bot, Settings } from "lucide-vue-next";
import GeoLayout from "@/components/GeoLayout.vue";

const navItems = computed(() => [
  { to: "/student/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { to: "/student/lessons",   icon: BookOpen,       labelKey: "lessons" },
  { to: "/student/games",     icon: Gamepad2,       labelKey: "games" },
  { to: "/student/ratings",   icon: Trophy,         labelKey: "ratings" },
  { to: "/student/videos",    icon: Video,          labelKey: "videos" },
  { to: "/student/ai",        icon: Bot,            labelKey: "ai" },
  { to: "/student/settings",  icon: Settings,       labelKey: "settings" },
]);
</script>
