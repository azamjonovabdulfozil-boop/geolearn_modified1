import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Har bir sayt uchun alohida sozlama
const SITES = {
  teacher: {
    outDir: "dist-teacher",
    devPort: 5173,
    previewPort: 4173,
    title: "GeoLearn Admin — O'qituvchi paneli",
    description: "GeoLearn o'qituvchi paneli: darslar, testlar, o'yinlar va reyting boshqaruvi",
  },
  student: {
    outDir: "dist-student",
    devPort: 5174,
    previewPort: 4174,
    title: "GeoLearn — O'quvchi portali",
    description: "Interaktiv darslar, testlar va o'yinlar orqali geografiyani o'rganing",
  },
  both: {
    outDir: "dist",
    devPort: 5175,
    previewPort: 4175,
    title: "GeoLearn — Geografiya Platformasi",
    description: "Interaktiv darslar, testlar va o'yinlar orqali geografiyani o'rganing",
  },
};

/** index.html sarlavhasini sayt roliga qarab almashtiradi. */
function htmlMeta(site) {
  return {
    name: "geolearn-html-meta",
    transformIndexHtml(html) {
      return html
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${site.title}</title>`)
        .replace(/(<meta name="description" content=")[^"]*(")/, `$1${site.description}$2`);
    },
  };
}

/**
 * @param {"teacher"|"student"|"both"} role
 */
export function makeConfig(role) {
  const site = SITES[role];
  const apiTarget = process.env.VITE_API_TARGET || "http://localhost:3001";
  const proxy = { "/api": { target: apiTarget, changeOrigin: true } };

  // Boshqa portalning manzili (login sahifasidagi yo'naltirish uchun).
  // Bo'sh qoldirilsa — brauzerda joriy port bo'yicha avtomatik aniqlanadi.
  const otherPortalUrl =
    role === "teacher" ? (process.env.VITE_STUDENT_URL || "")
    : role === "student" ? (process.env.VITE_TEACHER_URL || "")
    : "";

  return defineConfig({
    plugins: [vue(), tailwindcss(), htmlMeta(site)],
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    define: {
      __APP_ROLE__: JSON.stringify(role),
      __OTHER_PORTAL_URL__: JSON.stringify(otherPortalUrl),
    },
    // Ikkala dev server bir vaqtda ishlaganda bog'liqlik keshi to'qnashmasligi uchun
    cacheDir: `node_modules/.vite-${role}`,
    build: { outDir: site.outDir, emptyOutDir: true },
    server: { port: site.devPort, strictPort: true, proxy },
    preview: { port: site.previewPort, strictPort: true, proxy },
  });
}
