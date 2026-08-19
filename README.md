# GeoLearn — ikkita alohida sayt

Loyiha ikkita mustaqil saytga ajratilgan. Ular bir xil koddan quriladi, lekin
alohida build, alohida port va alohida sarlavhaga ega. Har bir sayt faqat o'z
roliga xizmat qiladi — boshqa rolning sahifalari umuman ochilmaydi.

| Sayt | Rol | Dev port | Preview port | Node server porti | Build papkasi |
|------|-----|----------|--------------|-------------------|---------------|
| 🏫 Admin (o'qituvchi) | faqat `teacher` | 5173 | 4173 | 3001 | `frontend/dist-teacher` |
| 🎓 O'quvchi | faqat `student` | 5174 | 4174 | 3002 | `frontend/dist-student` |
| 🔧 Backend API | — | — | — | 3001 (va 3002) | — |

---

## 1. Ishlab chiqish (dev)

Backend'ni ishga tushiring (API 3001-portda):

```bash
cd backend
npm install
npm start
```

So'ng ikkala saytni birga ishga tushiring:

```bash
cd frontend
npm install
npm run dev:all          # 5173 va 5174 birga
```

Yoki alohida terminallarda:

```bash
npm run dev:teacher      # http://localhost:5173  — admin sayti
npm run dev:student      # http://localhost:5174  — o'quvchi sayti
```

Dev rejimda `/api` so'rovlari `frontend/.env.development` tufayli avtomatik
`http://localhost:3001` ga proxy qilinadi. Boshqa backend manzili kerak bo'lsa:
`VITE_API_TARGET=http://localhost:4000 npm run dev:teacher`.

---

## 2. Bitta serverda ishga tushirish (eng sodda production)

Backend ikkala saytni **alohida portlarda** o'zi xizmat qiladi:

```bash
cd frontend
VITE_API_URL= npm run build:all     # dist-teacher va dist-student

cd ../backend
npm start
```

Natija:

```
🌐 O'qituvchi (admin) sayti   → http://localhost:3001
🌐 O'quvchi sayti             → http://localhost:3002
```

`VITE_API_URL=` bo'sh qoldirilgani muhim — shunda frontend API'ni o'z portidan
(nisbiy `/api` yo'li orqali) chaqiradi.

Portlarni o'zgartirish: `PORT=8080 STUDENT_PORT=8081 npm start`.

Faqat bitta saytni ko'tarish kerak bo'lsa:

```bash
npm run start:teacher    # faqat admin sayti, PORT portida
npm run start:student    # faqat o'quvchi sayti, PORT portida
npm run start:api        # faqat API, statik fayllarsiz
```

---

## 3. Vercel (2 ta sayt) + Render (API)

**Render** — bitta API xizmati (`backend/render.yaml` shunga sozlangan):

- Start command: `npm run start:api`
- `FRONTEND_URL` ga ikkala sayt manzilini vergul bilan kiriting:
  `https://geolearn-admin.vercel.app,https://geolearn.vercel.app`

**Vercel** — bitta repodan ikkita loyiha yarating:

| Sozlama | Admin loyihasi | O'quvchi loyihasi |
|---------|----------------|-------------------|
| Root Directory | `frontend` | `frontend` |
| Build Command | `npm run build:teacher` | `npm run build:student` |
| Output Directory | `dist-teacher` | `dist-student` |
| `VITE_API_URL` | Render backend manzili | Render backend manzili |

Ixtiyoriy: `VITE_STUDENT_URL` / `VITE_TEACHER_URL` env orqali "boshqa portalga
o'tish" havolasini aniq belgilash mumkin. Berilmasa, havola port bo'yicha
avtomatik aniqlanadi (5173↔5174, 4173↔4174, 3001↔3002).

---

## Rollarni ajratish qanday ishlaydi

- Har bir build'ga `__APP_ROLE__` (`teacher` yoki `student`) qotib yoziladi.
- **Login:** boshqa roldagi foydalanuvchi kirsa, sessiya bekor qilinadi va
  ikkinchi portalga havola ko'rsatiladi.
- **Router:** sayt roliga tegishli bo'lmagan yo'llar (`/teacher/*` o'quvchi
  saytida va aksincha) bloklanadi. Brauzerda boshqa rolning tokeni saqlanib
  qolgan bo'lsa, u tozalanib `/login?wrongRole=1` ga qaytariladi.
- **Ro'yxatdan o'tish** (`/register`) faqat o'quvchi saytida mavjud.

---

## Standart login

| Foydalanuvchi | Parol | Rol | Qaysi saytda |
|---------------|-------|-----|--------------|
| admin | admin123 | teacher | admin sayti (5173 / 3001) |

O'quvchilar o'quvchi saytidagi `/register` sahifasida ro'yxatdan o'tadi.

---

## AI yordamchi

Javoblar bir nechta provayder zanjiri orqali olinadi (birinchi ishlagani
javob beradi). Kalitlar `backend/.env` da:

| Env | Provayder | Izoh |
|-----|-----------|------|
| `OPENAI_API_KEY` | OpenAI | pullik |
| `GROQ_API_KEY` | Groq | bepul tarif bor |
| `OPENROUTER_API_KEY` | OpenRouter | bepul modellar bor |
| `HF_TOKEN` | HuggingFace router | bepul tarif bor |
| — | Pollinations | kalitsiz zaxira |

Kvota tugagan yoki kaliti noto'g'ri provayder avtomatik chetlab o'tiladi.
Hech biri ishlamasa — oflayn zaxira javob qaytadi va chatda belgilanadi.

Suhbatlar `backend/data/ai_chats.json` da saqlanadi, shuning uchun sahifa
yangilansa ham yozishmalar joyida qoladi. Chat tepasidagi **Chat tarixi**
tugmasi orqali eski suhbatlar ochiladi.

`GET /api/ai/status` (faqat o'qituvchi) provayderlar holatini ko'rsatadi.
