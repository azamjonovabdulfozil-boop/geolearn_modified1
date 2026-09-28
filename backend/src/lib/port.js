import { createConnection } from "net";

/**
 * Bitta port ikkita dastur o'rtasida bo'linib qolishi mumkin: masalan boshqa
 * loyiha 127.0.0.1:3000 ni band qilgan bo'lsa, bizning server IPv6 (::1) ga
 * jimgina bog'lanib ketadi. Shunda brauzer so'rovlari goh bizga, goh o'sha
 * dasturga tushadi va "API yo'li topilmadi" kabi tushunarsiz xatolar chiqadi.
 * Shuning uchun portni IPv4 va IPv6 bo'yicha ALOHIDA tekshiramiz.
 */
const HOSTS = ["127.0.0.1", "::1"];

function apiUrl(host, port) {
  return host.includes(":")
    ? `http://[${host}]:${port}/api/site`
    : `http://${host}:${port}/api/site`;
}

/** Shu manzilda kimdir tinglayaptimi? */
function isOpen(port, host) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    const done = (busy) => { socket.destroy(); resolve(busy); };
    socket.setTimeout(700);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

/** Portdagi server — bizning GeoLearn API'mizmi? */
async function isGeoLearnApi(port, host) {
  try {
    const res = await fetch(apiUrl(host, port), { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const data = await res.json();
    return typeof data?.site === "string";
  } catch {
    return false;
  }
}

/** Portni GeoLearn egallaganmi (ixtiyoriy manzilda)? */
export async function findGeoLearnApi(port) {
  for (const host of HOSTS) {
    if (await isOpen(port, host) && await isGeoLearnApi(port, host)) return { host };
  }
  return null;
}

/**
 * Portni BOSHQA dastur band qilganmi? Band bo'lsa {host} qaytaradi.
 * GeoLearn'ning o'zi tinglayotgan bo'lsa — null (bu to'qnashuv emas).
 */
export async function findForeignServer(port) {
  for (const host of HOSTS) {
    if (await isOpen(port, host) && !(await isGeoLearnApi(port, host))) return { host };
  }
  return null;
}

/** Terminalga tushunarli xato matnini chiqaradi. */
export function reportConflict(port, host) {
  console.error(`\n❌ ${port} portini BOSHQA dastur band qilgan (${host}) — GeoLearn backend'i emas.`);
  console.error(`   Qaysi dastur ekanini ko'rish:`);
  console.error(`       lsof -nP -iTCP:${port} -sTCP:LISTEN`);
  console.error(`   Uni to'xtating yoki GeoLearn'ni boshqa portda ishga tushiring:`);
  console.error(`       PORT=3005 npm run dev\n`);
}
