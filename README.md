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
| 🏫 admin (frontend) | **5173** | 4173 | — |
| 🎓 user (frontend) | **5174** | 4174 | — |
| 🔧 backend (API) | — | — | **3000** |

**Frontend saytlar faqat 5173 / 5174 portlarida, backend esa faqat 3000
portida ishlaydi.** Dev rejimda backend `SITE=api API_ONLY=1` bilan
ishga tushadi — ya'ni u hech qanday sayt bermaydi, faqat `/api`. Saytlarni
vite beradi va `/api` so'rovlarini proxy orqali `localhost:3000` ga yuboradi.

3000-portni boshqa loyihangiz band qilgan bo'lsa, boshqa port bering:

```bash
PORT=3005 npm run dev
PORT=3005 npm run dev:user
```

(`PORT` ham backend'ga, ham vite proxy'ga bir vaqtda ta'sir qiladi.)

Portni boshqa dastur band qilgan bo'lsa backend ishga tushmaydi va aniq xabar
beradi. Tekshiruv IPv4 (`127.0.0.1`) va IPv6 (`::1`) bo'yicha alohida ketadi:
bitta portning yarmini boshqa loyiha egallab, bizning server ikkinchi yarmiga
jimgina bog'lanib qolishi mumkin — o'shanda so'rovlar goh u, goh bu serverga
tushib «API yo'li topilmadi» kabi tushunarsiz xatolar chiqadi. Portda kim
o'tirganini ko'rish:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Har bir saytning URL'lari sodda: `/dashboard`, `/lessons`, `/ai` — rol prefiksi yo'q.

---

## 1. O'rnatish

```bash
npm run install:all      # ildiz + backend bog'liqliklari
```

## 2. Ishlab chiqish

`npm run dev` bitta terminalda **backend + ikkala saytni** ko'taradi, ya'ni
admin ham (5173), o'quvchi sayti ham (5174) darrov ochiladi.

```bash
npm run dev              # backend (3000) + ADMIN (5173) + USER (5174)
```

Faqat bittasi kerak bo'lsa:

```bash
npm run dev:admin:only   # backend (3000) + ADMIN sayti → http://localhost:5173
npm run dev:user         # backend (3000) + USER  sayti → http://localhost:5174
```

Yoki alohida qismlarni qo'lda:

```bash
npm run dev:backend      # faqat API           → 3000
npm run dev:admin        # faqat admin vite    → http://localhost:5173
npm run dev:user:web     # faqat user vite     → http://localhost:5174
npm run dev:sites        # faqat ikkala sayt (backendsiz)
npm run dev:all          # backend + admin + user bitta terminalda
```

Dev rejimda `/api` so'rovlari `.env.development` tufayli avtomatik
backend'ga (`http://localhost:3000`) proxy qilinadi. Boshqa manzil kerak bo'lsa:
`VITE_API_TARGET=http://localhost:4000 npm run dev:admin`.

## 3. Bitta serverda production

```bash
VITE_API_URL= npm run build      # admin/dist va user/dist
npm start
```

Natija:

```
🌐 Admin (o'qituvchi) sayti   → http://localhost:3000
🌐 User (o'quvchi) sayti      → http://localhost:3001
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

## 4. Deploy — GitHub + Vercel + Render

To'liq qadamba-qadam qo'llanma: **[DEPLOY.md](DEPLOY.md)** — qaysi
environment o'zgaruvchisi qayerga qo'yilishi, CORS, va bepul rejaning
cheklovlari shu yerda tushuntirilgan.

Qisqacha:

| Xizmat | Nima joylashadi | Asosiy env |
|--------|-----------------|------------|
| **Render** | backend (faqat API) | `JWT_SECRET`, `FRONTEND_URL` |
| **Vercel** #1 | admin sayti | `SITE=admin`, `VITE_API_URL` |
| **Vercel** #2 | o'quvchi sayti | `SITE=user`, `VITE_API_URL` |

Ikkala Vercel loyihasi ham bitta `vercel.json` dan foydalanadi
(`npm run vercel-build` → `dist/`); qaysi sayt qurilishini `SITE`
o'zgaruvchisi hal qiladi. Render ildizdagi `render.yaml` ni o'qiydi.

Ixtiyoriy: `VITE_ADMIN_URL` / `VITE_USER_URL` env orqali "boshqa portalga
o'tish" havolasini aniq belgilash mumkin. Berilmasa, havola port bo'yicha
avtomatik aniqlanadi (5173↔5174, 4173↔4174, 3000↔3001).

---

## Uy ishlari (homework)

O'qituvchi vazifa beradi, o'quvchi javob yozadi, o'qituvchi baholaydi.

**Admin sayti → «Uy ishi»** (`/homework`)
- Vazifa yaratish: sarlavha, matn, sinf, topshirish muddati, dars (ixtiyoriy),
  havola (ixtiyoriy).
- Kimga beriladi: **butun sinf** yoki ro'yxatdan **tanlangan o'quvchilar**.
- Har bir kartada topshirish progressi va nechta ish baholanmagani ko'rinadi.
- Kartani bosib javoblarni ochish → har bir o'quvchining javobi, unga
  **0–100 baho** va izoh yozish.

**User sayti → «Uy ishi»** (`/homework`)
- Faqat o'ziga berilgan vazifalar ko'rinadi (sinfi yoki shaxsiy ro'yxat bo'yicha).
- Holatlar: `Yangi` → `Topshirildi` → `Baholandi`, muddat o'tsa `Muddati o'tdi`.
- Javobni baholangunicha qayta tahrirlash mumkin; baholangach qulflanadi.
- Muddatdan keyin topshirilgan ish o'qituvchida «kech» deb belgilanadi.

Qo'yilgan baho o'quvchining umumiy balliga (reytingga) qo'shiladi. Qayta
baholansa faqat farqi hisobga olinadi.

| Endpoint | Kim | Nima qiladi |
|----------|-----|-------------|
| `GET /api/homework` | ikkalasi | o'qituvchiga — hammasi + statistika, o'quvchiga — o'ziniki + javobi |
| `GET /api/homework/students?grade=7` | teacher | vazifa berish uchun o'quvchilar ro'yxati |
| `POST /api/homework` | teacher | yangi vazifa |
| `GET /api/homework/:id` | ikkalasi | teacher — barcha javoblar; student — o'ziniki |
| `PUT/DELETE /api/homework/:id` | teacher | tahrirlash / o'chirish |
| `POST /api/homework/:id/submit` | student | javob topshirish (qayta yuborilsa yangilanadi) |
| `PUT /api/homework/submissions/:id/grade` | teacher | baho (0–100) + izoh |

Ma'lumotlar: `backend/data/homework.json` va `backend/data/homework_submissions.json`.

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
| admin | admin123 | teacher | admin sayti (5173) |

O'quvchilar user saytidagi `/register` sahifasida ro'yxatdan o'tadi.

---

## AI yordamchi

Javoblar provayderlar zanjiri orqali olinadi (birinchi ishlagani javob beradi).
Kalitlar `backend/.env` da:

| Env | Provayder | Izoh |
|-----|-----------|------|
| `OPENAI_API_KEY` | OpenAI | pullik |
| `GEMINI_API_KEY` | Google Gemini | bepul tarif katta, o'zbekchada yaxshi |
| `OPENROUTER_API_KEY` | OpenRouter | bepul modellar bor |
| `HF_TOKEN` | HuggingFace router | bepul tarif bor |
| `GROQ_API_KEY` | Groq | tezkor, bepul tarif bor |
| — | Pollinations | kalitsiz zaxira |

Bitta modelga 25 soniya, butun zanjirga 60 soniya vaqt ajratilgan. Kvota tugagan
provayder 10 daqiqaga chetlab o'tiladi, keyin yana sinaladi. Hech biri ishlamasa — oflayn zaxira javob
qaytadi va chatda belgilanadi.

Suhbatlar `backend/data/ai_chats.json` da saqlanadi, shuning uchun sahifa
yangilansa ham yozishmalar joyida qoladi. Chat tepasidagi **Chat tarixi**
tugmasi orqali eski suhbatlar yon paneldan ochiladi.

`GET /api/ai/status` (faqat o'qituvchi) provayderlar holatini ko'rsatadi.
