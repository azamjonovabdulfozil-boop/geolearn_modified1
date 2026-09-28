// Dev rejim uchun backend'ni ishga tushiradi.
//
// Backend FAQAT bitta portda (default 3000) va faqat API sifatida ishlaydi —
// frontend saytlarni vite beradi (admin → 5173, user → 5174).
//
// Port allaqachon GeoLearn backend'i tomonidan band bo'lsa (boshqa terminalda
// ishlab turgan bo'lsa) — xato bermay o'tkazib yuboriladi. Shuning uchun
// `npm run dev` va `npm run dev:user` ni ikki terminalda birga ishlatish mumkin.
//
// Portni boshqa dastur band qilgan bo'lsa — aniq xabar beriladi
// (aks holda saytlar jimgina noto'g'ri serverga so'rov yuborardi).
import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { findGeoLearnApi, findForeignServer, reportConflict } from "../backend/src/lib/port.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_PORT = Number(process.env.PORT) || 3000;

// Avval to'qnashuvni tekshiramiz: port yarmini boshqa dastur egallagan bo'lsa,
// GeoLearn ikkinchi yarmida ishlayotgan bo'lsa ham so'rovlar adashib ketadi.
const foreign = await findForeignServer(API_PORT);
if (foreign) {
  reportConflict(API_PORT, foreign.host);
  console.error(`   Ikkinchi saytni ham o'sha portga ulang:  PORT=3005 npm run dev:user\n`);
  process.exit(1);
}

const running = await findGeoLearnApi(API_PORT);
if (running) {
  console.log(`ℹ️  Backend allaqachon ishlayapti (http://localhost:${API_PORT}) — qayta ishga tushirilmadi.`);
  process.exit(0);
}

const child = spawn("npm", ["--prefix", "backend", "run", "dev"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    SITE: "api",       // faqat API — statik saytlarsiz
    API_ONLY: "1",
    PORT: String(API_PORT),
  },
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 0));
