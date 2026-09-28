import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(fileURLToPath(import.meta.url));

// Backend (API) porti — faqat backend shu portda ishlaydi, frontend emas.
export const API_PORT = Number(process.env.PORT) || 3000;

// Har bir saytning papkasi, roli va o'z frontend portlari
export const SITES = {
  admin: { dir: "admin", role: "teacher", devPort: 5173, previewPort: 4173 },
  user:  { dir: "user",  role: "student", devPort: 5174, previewPort: 4174 },
};

/**
 * @param {"admin"|"user"} key
 */
export function makeConfig(key) {
  const site = SITES[key];
  const other = key === "admin" ? SITES.user : SITES.admin;
  const siteRoot = resolve(ROOT, site.dir);

  // Ikkala sayt ham /api so'rovlarini bitta backendga (3000) yuboradi.
  const apiTarget = process.env.VITE_API_TARGET || `http://localhost:${API_PORT}`;
  const proxy = { "/api": { target: apiTarget, changeOrigin: true } };

  // Ikkinchi saytning manzili. Bo'sh qoldirilsa — brauzerda port bo'yicha
  // avtomatik aniqlanadi (shared/views/Login.vue ga qarang).
  const otherPortalUrl =
    (key === "admin" ? process.env.VITE_USER_URL : process.env.VITE_ADMIN_URL) || "";

  return defineConfig({
    root: siteRoot,
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        "@":       resolve(siteRoot, "src"),   // saytning o'z kodi
        "@shared": resolve(ROOT, "shared"),    // ikkala sayt uchun umumiy kod
      },
    },
    define: {
      __APP_ROLE__: JSON.stringify(site.role),
      __OTHER_PORTAL_URL__: JSON.stringify(otherPortalUrl),
    },
    // .env fayllari repo ildizida turadi (vite root'i admin/ yoki user/ bo'lgani
    // uchun buni aniq ko'rsatish shart — aks holda VITE_API_URL o'qilmaydi).
    envDir: ROOT,
    // Ikkala dev server bir vaqtda ishlaganda kesh to'qnashmasligi uchun
    cacheDir: resolve(ROOT, "node_modules", `.vite-${key}`),
    build: {
      // Odatda admin/dist va user/dist. Vercel'da ikkala loyiha uchun bitta
      // sozlama yetarli bo'lishi uchun BUILD_OUT_DIR bilan bekor qilinadi.
      outDir: process.env.BUILD_OUT_DIR
        ? resolve(ROOT, process.env.BUILD_OUT_DIR)
        : resolve(siteRoot, "dist"),
      emptyOutDir: true,
    },
    server: { port: site.devPort, strictPort: true, proxy },
    preview: { port: site.previewPort, strictPort: true, proxy },
  });
}
