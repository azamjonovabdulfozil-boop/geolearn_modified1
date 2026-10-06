// ── Katta ro'yxatlarni bo'lib ko'rsatish ──────────────────────────────────
// 100+ o'quvchida reyting, natijalar kabi sahifalar minglab qatorga cho'zilib
// ketmasligi uchun avval `size` ta ko'rsatiladi, "Yana ko'rsatish" bilan qo'shiladi.
// Real vaqt yangilanishida (ro'yxat qayta yuklanganda) ochilgan qism saqlanadi;
// filtr o'zgarganda `reset()` chaqiriladi.
import { ref, computed, unref } from "vue";

export function usePaged(source, size = 30) {
  const limit = ref(size);
  const all = computed(() => unref(source) ?? []);
  const visible = computed(() => all.value.slice(0, limit.value));
  const remaining = computed(() => Math.max(0, all.value.length - limit.value));
  return {
    visible,
    remaining,
    total: computed(() => all.value.length),
    more: () => { limit.value += size; },
    reset: () => { limit.value = size; },
    pageSize: size,
  };
}
