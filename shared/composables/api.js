export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Backend manzili. Production'da (Vercel) .env faylidagi
// VITE_API_URL orqali Render backend manziliga ulanadi.
// Lokal devda bo'sh qoldirilsa, vite proxy /api so'rovlarini
// localhost:3000 ga yo'naltiradi (vite.shared.js dagi API_PORT).
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function resolveUrl(url) {
  if (/^https?:\/\//i.test(url)) return url; // to'liq URL bo'lsa, tegmaymiz
  return `${API_BASE_URL}${url}`;
}

function readSection() {
  try {
    const s = localStorage.getItem("geo_section");
    return s === "uz" || s === "ru" ? s : null;
  } catch { return null; }
}

export async function api(url, options = {}) {
  const token = localStorage.getItem("geo_token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Admin tanlagan bo'lim (o'zbek / rus sinflar) — backend shu bo'yicha filtrlaydi
  const section = readSection();
  if (section) headers["X-Section"] = section;

  const res = await fetch(resolveUrl(url), { ...options, headers });
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch {}
    throw new ApiError(res.status, data?.error || `HTTP ${res.status}`, data);
  }
  if (res.status === 204) return undefined;
  return res.json();
}