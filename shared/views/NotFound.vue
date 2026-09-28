<template>
  <div class="min-h-screen flex items-center justify-center text-center p-6">
    <div>
      <div class="text-8xl font-bold text-primary mb-4">404</div>
      <h1 class="text-2xl font-bold mb-2">Sahifa topilmadi</h1>
      <p class="text-muted mb-6">Bu sahifa mavjud emas yoki o'chirilgan.</p>
      <RouterLink to="/" class="geo-btn-primary px-6 py-3 rounded-xl">Bosh sahifaga qaytish</RouterLink>
    </div>
  </div>
</template>
<script setup>
import { RouterLink } from "vue-router";
</script>
