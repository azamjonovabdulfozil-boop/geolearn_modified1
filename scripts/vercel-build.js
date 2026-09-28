// Vercel uchun build skripti.
//
// Ikkala sayt (admin va user) bitta repo'dan chiqadi, lekin Vercel'da
// ikkita alohida loyiha bo'ladi. Qaysi saytni qurish kerakligini
// SITE environment o'zgaruvchisi aytadi:
//
//   SITE=admin  → admin saytini quradi
//   SITE=user   → o'quvchi saytini quradi
//
// Natija har doim repo ildizidagi dist/ papkasiga tushadi, shuning uchun
// Vercel'da "Output Directory" ikkala loyiha uchun ham "dist" bo'ladi.
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITES = ["admin", "user"];

const site = (process.env.SITE || "").trim().toLowerCase();

if (!SITES.includes(site)) {
  console.error(`\n❌ SITE environment o'zgaruvchisi noto'g'ri: "${site || "(bo'sh)"}"`);
  console.error(`   Vercel loyiha sozlamalarida SITE ni qo'shing: ${SITES.join(" yoki ")}\n`);
  process.exit(1);
}

if (!process.env.VITE_API_URL) {
  console.warn(`\n⚠️  VITE_API_URL berilmagan — sayt backend'ga ulana olmaydi.`);
  console.warn(`   Vercel sozlamalarida VITE_API_URL = https://<render-nomi>.onrender.com qo'shing.\n`);
}

console.log(`▶ "${site}" sayti qurilmoqda → dist/`);
console.log(`  API manzili: ${process.env.VITE_API_URL || "(berilmagan)"}\n`);

const res = spawnSync(
  "npx",
  ["vite", "build", "--config", `${site}/vite.config.js`],
  {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, BUILD_OUT_DIR: "dist" },
  }
);

process.exit(res.status ?? 1);
