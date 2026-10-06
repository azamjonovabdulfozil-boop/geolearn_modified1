# GeoLearn — Deploy qo'llanmasi

GitHub → Render (backend) → Vercel (ikkita frontend).

```
                    ┌─────────────────────────────┐
                    │  GitHub: geolearn_modified  │
                    └──────────────┬──────────────┘
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
          ┌──────────────┐  ┌───────────┐  ┌───────────┐
          │   RENDER     │  │  VERCEL   │  │  VERCEL   │
          │   backend    │  │ SITE=admin│  │ SITE=user │
          │  (faqat API) │  │           │  │           │
          └──────┬───────┘  └─────┬─────┘  └─────┬─────┘
                 │                │              │
                 └────────────────┴──────────────┘
                     ikkalasi ham shu API'ga so'rov yuboradi
```

Uchta xizmat, uchta alohida sozlama. **Tartib muhim:** avval Render (chunki
uning manzili Vercel'ga kerak), keyin Vercel, oxirida Render'ga qaytib
`FRONTEND_URL` ni yozasiz.

---

## ⚠️ 0-qadam: Avval maxfiy kalitlarni almashtiring

`backend/.env` fayli ilgari git'ga tushib, GitHub'ga yuborilgan. Ya'ni
undagi kalitlar **ochilgan** deb hisoblanadi. Endi bu fayl `.gitignore` ga
qo'shildi, lekin eski commit'larda qolgan.

Deploy'dan oldin quyidagilarni **bekor qilib, yangisini oling**:

| Kalit | Qayerdan | Nima qilish |
|---|---|---|
| `OPENAI_API_KEY` | platform.openai.com → API keys | eskisini o'chiring (Revoke), yangi yarating |
| `HF_TOKEN` | huggingface.co → Settings → Tokens | eskisini o'chiring, yangi yarating |
| `JWT_SECRET` | — | yangi yarating: `openssl rand -hex 32` |

Yangi kalitlarni endi **hech qachon faylga yozmang** — faqat Render va Vercel
sozlamalariga kiriting.

---

## 1-qadam: GitHub

Repo allaqachon ulangan. Tozalash bajarilgan: `node_modules` (3000+ fayl),
`backend/.env` va foydalanuvchi ma'lumotlari endi git'ga tushmaydi.

```bash
git add -A
git commit -m "Deploy sozlamalari: Vercel + Render"
git push
```

**Nima git'ga tushadi va nima tushmaydi:**

| Tushadi ✓ | Tushmaydi ✗ |
|---|---|
| Kod (`admin/`, `user/`, `shared/`, `backend/src/`) | `node_modules/` |
| `backend/data/lessons.json`, `topics.json` (kontent) | `backend/.env` (kalitlar) |
| `vercel.json`, `render.yaml` | `backend/data/users.json` (parol xeshlari, avatarlar) |
| `.env.development` (bo'sh, xavfsiz) | `backend/data/activity.json`, `games.json`, AI tarixi |
| `.env.production.example` (namuna) | `dist/`, `admin/dist/`, `user/dist/` |

---

## 2-qadam: Render — backend

**New → Blueprint → repo'ni tanlang → Apply.**
Render ildizdagi `render.yaml` ni o'zi o'qiydi: `rootDir: backend`,
`npm ci`, `npm run start:api`, health check `/api/site`.

Keyin **Dashboard → geolearn-backend → Environment** bo'limiga kiring.

### Render'ga qo'yiladigan o'zgaruvchilar

| O'zgaruvchi | Qiymat | Majburiymi | Izoh |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://...neon.tech/neondb?sslmode=require` | ✅ ha | **Bo'lmasa o'quvchilar o'chib ketadi va kira olmaydi.** Pastdagi "Ma'lumotlar bazasi" bo'limiga qarang |
| `JWT_SECRET` | *(Render o'zi yaratadi)* | ✅ ha | `render.yaml` da `generateValue: true` — qo'lda kiritish shart emas |
| `SITE` | `api` | ✅ ha | `render.yaml` da yozilgan, tegmang |
| `FRONTEND_URL` | `https://geolearn-admin.vercel.app,https://geolearn.vercel.app` | ✅ ha | **3-qadamdan keyin** to'ldiriladi. Vergul bilan, oxirida `/` **bo'lmasin** |
| `OPENAI_API_KEY` | `sk-...` | ⬜ ixtiyoriy | AI yordamchisi uchun |
| `OPENROUTER_API_KEY` | | ⬜ ixtiyoriy | OpenAI o'rniga ishlatsa bo'ladi |
| `GROQ_API_KEY` | | ⬜ ixtiyoriy | |
| `HF_TOKEN` | | ⬜ ixtiyoriy | rasm generatsiyasi |
| `LOVABLE_API_KEY` | | ⬜ ixtiyoriy | |

> **`PORT` ni QO'YMANG.** Render uni o'zi beradi. Qo'lda yozsangiz — servis
> ishga tushmaydi.

Deploy tugagach manzilni yozib oling, masalan:
`https://geolearn-backend.onrender.com`

Tekshirish:
```bash
curl https://geolearn-backend.onrender.com/api/site
# {"site":"api","label":"API"}
```

### ⚠️ Bepul rejadagi ikki cheklov

**1. Disk vaqtinchalik — `DATABASE_URL` shart.** Render'ning bepul rejasida
fayl tizimi har deploy va har uxlab-uyg'onishda tozalanadi. `DATABASE_URL`
bo'lmasa, ro'yxatdan o'tgan o'quvchilar o'chib ketadi va keyin **kira
olmaydi** ("Login yoki parol noto'g'ri").

#### Ma'lumotlar bazasi (bepul, 5 daqiqa)

1. https://neon.tech → Sign up (GitHub bilan) → **Create project**
   (region: Europe / Frankfurt).
2. **Connection string** ni nusxalang (`postgresql://...?sslmode=require`).
3. Render → geolearn-backend → **Environment** → `DATABASE_URL` = shu qator → Save.
4. Render loglarida `💾 Ma'lumotlar: Postgres (... ta to'plam yuklandi)` chiqsa — tayyor.

Shundan keyin o'quvchilar, natijalar, AI suhbatlari va chatdagi rasmlar
bazada saqlanadi; server qayta ishga tushganda hammasi bazadan tiklanadi.
Bazaga ulanib bo'lmasa server ataylab to'xtaydi (eski bo'sh fayllar bilan
bazadagi to'g'ri ma'lumotni ustidan yozib yubormaslik uchun).

Muqobil (pullik): `starter` rejaga o'tib `render.yaml` oxiridagi diskni yoqish:
```yaml
disk:
  name: geolearn-data
  mountPath: /opt/render/project/src/backend/data
  sizeGB: 1
```

**2. 15 daqiqa harakatsizlikdan keyin servis uxlaydi.** Keyingi so'rov
30–60 soniya kutadi. Birinchi kirish sekin bo'lsa — sababi shu.

---

## 3-qadam: Vercel — ikkita loyiha

Bitta repo'dan **ikkita alohida Vercel loyihasi** yaratiladi. Farqi —
faqat bitta `SITE` o'zgaruvchisida.

Har ikkalasi uchun: **Add New → Project → shu repo'ni tanlang.**

### Sozlamalar (ikkalasi uchun bir xil)

| Maydon | Qiymat |
|---|---|
| Root Directory | `./` (o'zgartirmang) |
| Framework Preset | Other |
| Build Command | *(bo'sh qoldiring — `vercel.json` dan olinadi)* |
| Output Directory | *(bo'sh qoldiring — `vercel.json` dan olinadi)* |

`vercel.json` ildizda turibdi va ikkala loyihaga ham shu qo'llaniladi:
build `npm run vercel-build`, natija `dist/`, SPA uchun rewrite.

### A) Admin sayti — loyiha nomi masalan `geolearn-admin`

**Settings → Environment Variables:**

| O'zgaruvchi | Qiymat |
|---|---|
| `SITE` | `admin` |
| `VITE_API_URL` | `https://geolearn-backend.onrender.com` |

### B) O'quvchi sayti — loyiha nomi masalan `geolearn`

**Settings → Environment Variables:**

| O'zgaruvchi | Qiymat |
|---|---|
| `SITE` | `user` |
| `VITE_API_URL` | `https://geolearn-backend.onrender.com` |

> `VITE_API_URL` oxirida **`/` belgisi bo'lmasin**:
> ✅ `https://...onrender.com` · ❌ `https://...onrender.com/`

> Har ikkala o'zgaruvchini **Production, Preview va Development** uchun
> belgilang (Vercel'da uchta katakcha bor).

> `SITE` berilmasa build ataylab to'xtaydi va aniq xabar beradi —
> jimgina noto'g'ri sayt qurilmasin uchun.

---

## 4-qadam: Render'ga qaytib CORS'ni yoping

Vercel manzillari tayyor bo'lgach, Render → Environment → `FRONTEND_URL`:

```
https://geolearn-admin.vercel.app,https://geolearn.vercel.app
```

Saqlang → Render avtomatik qayta deploy qiladi.

**Bu nima qiladi:** backend faqat shu ikki manzildan kelgan so'rovlarni
qabul qiladi. Bo'sh qoldirilsa — **hamma saytga ruxsat beriladi**, ya'ni
istalgan odam sizning API'ngizni o'z saytidan ishlatishi mumkin. Shuning
uchun production'da uni albatta to'ldiring.

---

## Environment o'zgaruvchilari — umumiy jadval

| O'zgaruvchi | Render (backend) | Vercel (admin) | Vercel (user) | Lokal |
|---|---|---|---|---|
| `JWT_SECRET` | ✅ (avtomatik) | — | — | `backend/.env` |
| `SITE` | `api` | `admin` | `user` | — |
| `FRONTEND_URL` | ✅ ikkala Vercel manzili | — | — | bo'sh |
| `VITE_API_URL` | — | ✅ Render manzili | ✅ Render manzili | bo'sh (proxy) |
| `PORT` | ❌ qo'ymang | — | — | `3000` |
| `OPENAI_API_KEY` va boshqa AI kalitlar | ⬜ ixtiyoriy | — | — | `backend/.env` |

**Asosiy qoida:**
`VITE_` bilan boshlanadigan o'zgaruvchilar **frontend** uchun va build
paytida kodga yoziladi — ya'ni ular **ochiq**, ularga maxfiy kalit
qo'ymang. Maxfiy kalitlar faqat Render tomonda (backend'da) yashaydi.

---

## Tekshirish ro'yxati

Deploy tugagach:

1. `https://geolearn-backend.onrender.com/api/site` → `{"site":"api",...}`
2. Admin saytini oching → login: `admin` / `admin123`
3. **Darhol parolni almashtiring** (Sozlamalar bo'limida)
4. O'quvchi saytida ro'yxatdan o'ting → o'yin kodi bilan qo'shiling
5. Brauzer konsolida (F12) CORS xatosi yo'qligini tekshiring

CORS xatosi chiqsa → Render'dagi `FRONTEND_URL` da manzil aynan to'g'ri
yozilganini (`https://`, `/` yo'q) tekshiring.

---

## Lokal ish deploy'dan keyin ham o'zgarmaydi

```bash
npm run dev        # backend (3000) + admin  → localhost:5173
npm run dev:user   # backend (3000) + user   → localhost:5174
```

Lokalda `VITE_API_URL` bo'sh (`.env.development`), shuning uchun `/api`
so'rovlari vite proxy orqali lokal backend'ga boradi — Render'ga emas.

Production build'ni lokal sinash uchun:
```bash
cp .env.production.example .env.production   # ichidagi manzilni to'g'irlang
npm run build:admin && npm run preview:admin
```
