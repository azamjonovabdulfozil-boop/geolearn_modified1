<template>
  <GeoLayout :navItems="navItems" />
</template>

<script setup>
import { computed } from "vue";
import { LayoutDashboard, BookOpen, Gamepad2, Trophy, Video, Bot, Settings } from "lucide-vue-next";
import GeoLayout from "@shared/components/GeoLayout.vue";

const navItems = computed(() => [
  { to: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { to: "/lessons",   icon: BookOpen,       labelKey: "lessons" },
  { to: "/games",     icon: Gamepad2,       labelKey: "games" },
  { to: "/ratings",   icon: Trophy,         labelKey: "ratings" },
  { to: "/videos",    icon: Video,          labelKey: "videos" },
  { to: "/ai",        icon: Bot,            labelKey: "ai" },
  { to: "/settings",  icon: Settings,       labelKey: "settings" },
]);
</script>
