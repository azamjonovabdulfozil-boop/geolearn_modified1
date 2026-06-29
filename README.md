# GeoLearn — Ko'p Portal Tizimi

## Portlar

| Portal | URL | Rol |
|--------|-----|-----|
| 🏫 O'qituvchi (Admin) | http://localhost:5173 | Faqat `teacher` roli |
| 🎓 O'quvchi (User) | http://localhost:5174 | Faqat `student` roli |
| 🔧 Backend API | http://localhost:3001 | — |

---

## Ishga tushurish

### 1. Backend
```bash
cd backend
npm install
npm start
```

### 2. Frontend — ikkala portni birga
```bash
cd frontend
npm install
npm run dev:all
```

### 2a. Alohida-alohida
```bash
# Terminal 1 — O'qituvchi portali (5173)
cd frontend
npm run dev:teacher

# Terminal 2 — O'quvchi portali (5174)
cd frontend
npm run dev:student
```

---

## Standart login

| Foydalanuvchi | Parol | Rol |
|--------------|-------|-----|
| admin | admin123 | teacher |

O'quvchilar `/register` sahifasida ro'yxatdan o'tadi.

---

## Xavfsizlik

- **Port 5173** ga kirgan `student` roli bloklanadi va xato xabar chiqadi
- **Port 5174** ga kirgan `teacher` roli bloklanadi va xato xabar chiqadi
- Har bir portal faqat o'z rolidagi foydalanuvchilarga ruxsat beradi
