import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  define: {
    __APP_ROLE__: JSON.stringify("teacher"),
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.VITE_API_TARGET || "http://localhost:3001", changeOrigin: true } },
  },
});
