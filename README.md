# GeoLearn

Loyiha uchta mustaqil qismga ajratilgan: **admin sayti**, **user sayti** va
**backend API**. Ikkala sayt umumiy koddan (`shared/`) foydalanadi, lekin
alohida papkada, alohida build va alohida portda ishlaydi.

```
geolearn_modified/
├── admin/                  🏫 O'qituvchi (admin) sayti — faqat "teacher" roli
│   ├── index.html
│   ├── vite.config.js
│   ├── public/favicon.svg
│   ├── dist/               (build natijasi)
│   └── src/
│       ├── main.js
│       ├── router.js
│       └── views/          Dashboard, Lessons, Topics, Games, Ratings,
│                           Videos, AI, AILogs, Settings, Layout
│
├── user/                   🎓 O'quvchi sayti — faqat "student" roli
│   ├── index.html
│   ├── vite.config.js
│   ├── public/favicon.svg
│   ├── dist/               (build natijasi)
│   └── src/
│       ├── main.js
│       ├── router.js
│       └── views/          Dashboard, Lessons, LessonTopics, TopicRead, Test,
│                           Games, Ratings, Videos, AI, Settings, Layout
│
├── shared/                 ♻️ Ikkala sayt uchun umumiy kod
│   ├── App.vue
│   ├── assets/main.css
│   ├── components/         GeoLayout.vue, AiChat.vue
│   ├── composables/        api.js, markdown.js
│   ├── stores/             auth.js, settings.js
│   ├── views/              Login.vue, Register.vue, NotFound.vue
│   └── router/guard.js     rol tekshiruvi
│
├── backend/                🔧 API + ikkala saytni xizmat qilish
│   ├── src/routes/         auth, lessons, videos, games, ratings, ai
│   ├── src/lib/            db, auth, ai, aiPrompt, chats, …
│   └── data/               JSON "baza" (users, lessons, ai_chats, …)
│
├── package.json            ikkala sayt uchun umumiy bog'liqliklar va skriptlar
├── vite.shared.js          vite config fabrikasi (port, alias, build sozlamalari)
└── vercel.json
```

Kodda ikkita alias ishlatiladi:

| Alias | Nimaga ishora qiladi |
|-------|----------------------|
| `@shared/…` | `shared/` — umumiy kod |
| `@/…` | shu saytning o'z `src/` papkasi |

---

## Portlar

| Qism | Dev | Preview | Backend server |
|------|-----|---------|----------------|
| 🏫 admin | 5173 | 4173 | **3001** |
| 🎓 user | 5174 | 4174 | **3002** |
| 🔧 API | — | — | 3001 (va 3002) |

Har bir saytning URL'lari sodda: `/dashboard`, `/lessons`, `/ai` — rol prefiksi yo'q.

---

## 1. O'rnatish

```bash
npm run install:all      # ildiz + backend bog'liqliklari
```

## 2. Ishlab chiqish

```bash
npm run dev              # backend + admin + user birga
```

Yoki alohida:

```bash
npm run dev:backend      # API           → 3001
npm run dev:admin        # admin sayti   → http://localhost:5173
npm run dev:user         # user sayti    → http://localhost:5174
npm run dev:sites        # faqat ikkala sayt
```

Dev rejimda `/api` so'rovlari `.env.development` tufayli avtomatik
`http://localhost:3001` ga proxy qilinadi. Boshqa manzil kerak bo'lsa:
`VITE_API_TARGET=http://localhost:4000 npm run dev:admin`.

## 3. Bitta serverda production

```bash
VITE_API_URL= npm run build      # admin/dist va user/dist
npm start
```

Natija:

```
🌐 Admin (o'qituvchi) sayti   → http://localhost:3001
🌐 User (o'quvchi) sayti      → http://localhost:3002
```

`VITE_API_URL=` bo'sh qoldirilishi muhim — shunda har bir sayt API'ni o'z
portidan (nisbiy `/api` yo'li orqali) chaqiradi.

Portlarni o'zgartirish: `PORT=8080 STUDENT_PORT=8081 npm start`.

Bittasini alohida ko'tarish (backend papkasida):

```bash
npm run start:teacher    # faqat admin sayti, PORT portida
npm run start:student    # faqat user sayti, PORT portida
npm run start:api        # faqat API, statik fayllarsiz
```

## 4. Vercel (2 ta sayt) + Render (API)

**Render** — bitta API xizmati (`backend/render.yaml` shunga sozlangan):

- Start command: `npm run start:api`
- `FRONTEND_URL` ga ikkala sayt manzilini vergul bilan kiriting:
  `https://geolearn-admin.vercel.app,https://geolearn.vercel.app`

**Vercel** — bitta repodan ikkita loyiha:

| Sozlama | Admin loyihasi | User loyihasi |
|---------|----------------|---------------|
| Root Directory | repo ildizi | repo ildizi |
| Build Command | `npm run build:admin` | `npm run build:user` |
| Output Directory | `admin/dist` | `user/dist` |
| `VITE_API_URL` | Render backend manzili | Render backend manzili |

Ixtiyoriy: `VITE_ADMIN_URL` / `VITE_USER_URL` env orqali "boshqa portalga
o'tish" havolasini aniq belgilash mumkin. Berilmasa, havola port bo'yicha
avtomatik aniqlanadi (5173↔5174, 4173↔4174, 3001↔3002).

---

## Rollarni ajratish qanday ishlaydi

- `admin/` va `user/` — bir-birini import qilmaydi; har birida faqat o'ziga
  tegishli sahifalar bor, shuning uchun boshqa rolning kodi build'ga umuman
  tushmaydi.
- **Login:** boshqa roldagi foydalanuvchi kirsa, sessiya bekor qilinadi va
  ikkinchi portalga havola ko'rsatiladi.
- **Router guard** (`shared/router/guard.js`): brauzerda boshqa rolning tokeni
  saqlanib qolgan bo'lsa, u tozalanib `/login?wrongRole=1` ga qaytariladi.
- **Ro'yxatdan o'tish** (`/register`) faqat user saytida mavjud.

---

## Standart login

| Foydalanuvchi | Parol | Rol | Qaysi saytda |
|---------------|-------|-----|--------------|
| admin | admin123 | teacher | admin sayti (5173 / 3001) |

O'quvchilar user saytidagi `/register` sahifasida ro'yxatdan o'tadi.

---

## AI yordamchi

Javoblar provayderlar zanjiri orqali olinadi (birinchi ishlagani javob beradi).
Kalitlar `backend/.env` da:

| Env | Provayder | Izoh |
|-----|-----------|------|
| `OPENAI_API_KEY` | OpenAI | pullik |
| `OPENROUTER_API_KEY` | OpenRouter | bepul modellar bor |
| `HF_TOKEN` | HuggingFace router | bepul tarif bor |
| `GROQ_API_KEY` | Groq | tezkor, bepul tarif bor |
| — | Pollinations | kalitsiz zaxira |

Bitta modelga 25 soniya, butun zanjirga 60 soniya vaqt ajratilgan. Kvota tugagan
provayder avtomatik chetlab o'tiladi. Hech biri ishlamasa — oflayn zaxira javob
qaytadi va chatda belgilanadi.

Suhbatlar `backend/data/ai_chats.json` da saqlanadi, shuning uchun sahifa
yangilansa ham yozishmalar joyida qoladi. Chat tepasidagi **Chat tarixi**
tugmasi orqali eski suhbatlar yon paneldan ochiladi.

`GET /api/ai/status` (faqat o'qituvchi) provayderlar holatini ko'rsatadi.
