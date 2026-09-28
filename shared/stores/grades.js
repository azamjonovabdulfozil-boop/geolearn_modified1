import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "@shared/composables/api";
import { GRADES } from "@shared/constants";

// Admin sozlamalarda bloklagan sinflar. Bloklangan sinf hech qayerda
// (tanlash tugmalari, filtrlar, reyting ...) ko'rinmaydi.
export const useGradesStore = defineStore("grades", () => {
  const all = ref([...GRADES]);
  const blocked = ref([]);
  let loading = null;

  const open = computed(() => all.value.filter(g => !blocked.value.includes(g)));
  const isBlocked = (g) => blocked.value.includes(Number(g));

  function apply(data) {
    if (Array.isArray(data?.grades)) all.value = data.grades;
    if (Array.isArray(data?.blocked)) blocked.value = data.blocked;
  }

  /** Serverdan yuklaydi (bir vaqtda bir marta). */
  function load() {
    loading ??= api("/api/grades").then(apply).catch(() => {}).finally(() => { loading = null; });
    return loading;
  }

  /** Sinfni bloklaydi yoki qayta ochadi. */
  async function toggle(g) {
    const prev = blocked.value;
    blocked.value = isBlocked(g) ? prev.filter(x => x !== g) : [...prev, g].sort((a, b) => a - b);
    try {
      apply(await api("/api/grades/blocked", { method: "PUT", body: JSON.stringify({ blocked: blocked.value }) }));
    } catch (e) {
      blocked.value = prev;
      throw e;
    }
  }

  /** Tanlangan sinf bloklangan bo'lsa — birinchi ochiq sinfni qaytaradi. */
  function fallback(g) {
    return open.value.includes(g) ? g : (open.value[0] ?? g);
  }

  return { all, blocked, open, isBlocked, load, toggle, fallback };
});
