import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createUser, getUserByUsername, updateUser } from './lib/db.js';
import { hashPassword } from './lib/auth.js';
import { findForeignServer, reportConflict } from './lib/port.js';
import { eventsHandler } from './lib/events.js';

// DIQQAT: dotenv eng birinchi bo'lishi SHART.
import "dotenv/config";




import express from "express";
import cors from "cors";






import authRoutes from "./routes/auth.js";
import lessonRoutes from "./routes/lessons.js";
import videoRoutes from "./routes/videos.js";
import gameRoutes from "./routes/games.js";
import ratingRoutes from "./routes/ratings.js";
import homeworkRoutes from "./routes/homework.js";
import aiRoutes from "./routes/ai.js";
import analyticsRoutes from "./routes/analytics.js";
import classRoutes from "./routes/classes.js";
import gradeRoutes from "./routes/grades.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");

// ─────────────────────────────────────────────────────────────
// SAYTLAR
// ─────────────────────────────────────────────────────────────

const siteArg = process.argv
  .find((a) => a.startsWith("--site="))
  ?.slice(7);

const SITE = (
  siteArg ||
  process.env.SITE ||
  "both"
).toLowerCase();

const API_ONLY = process.env.API_ONLY === "1";

const TEACHER_PORT =
  Number(process.env.PORT) || 3000;

const STUDENT_PORT =
  Number(process.env.STUDENT_PORT) ||
  TEACHER_PORT + 1;

const SITES = {
  teacher: {
    label: "Admin (o'qituvchi) sayti",
    apiLabel: "API — admin",
    dist: join(
      REPO_ROOT,
      "admin",
      "dist"
    ),
    buildCmd: "npm run build:admin",
  },

  student: {
    label: "User (o'quvchi) sayti",
    apiLabel: "API — user",
    dist: join(
      REPO_ROOT,
      "user",
      "dist"
    ),
    buildCmd: "npm run build:user",
  },

  api: {
    label: "API",
    apiLabel: "API",
    dist: null,
    buildCmd: null,
  },
};

// ─────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────

// Render Environment:
// FRONTEND_URL=https://geolearn-modified1-admin.vercel.app

const allowedOrigins = (
  process.env.FRONTEND_URL || ""
)
  .split(",")
  .map((origin) =>
    origin.trim().replace(/\/$/, "")
  )
  .filter(Boolean);

// Asosiy frontend domeni.
// FRONTEND_URL Render'da noto'g'ri bo'lsa ham,
// shu domen ishlashi uchun qo'shib qo'yamiz.
const ADMIN_ORIGIN =
  "https://geolearn-modified1-admin.vercel.app";

if (!allowedOrigins.includes(ADMIN_ORIGIN)) {
  allowedOrigins.push(ADMIN_ORIGIN);
}

console.log(
  "✅ CORS allowed origins:",
  allowedOrigins
);

// ─────────────────────────────────────────────────────────────
// CORS OPTIONS
// ─────────────────────────────────────────────────────────────

const corsOptions = {
  origin: (origin, callback) => {
    // Server-to-server / Postman kabi origin yo'q so'rovlar
    if (!origin) {
      return callback(null, true);
    }

    // Ruxsat berilgan frontend
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log(
      "⚠️ CORS bloklandi:",
      origin
    );

    // Xato tashlamaymiz.
    // Aks holda Express 500 qaytarishi mumkin.
    return callback(null, false);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
    "X-Section",
  ],

  optionsSuccessStatus: 204,
};

// ─────────────────────────────────────────────────────────────
// APP YARATISH
// ─────────────────────────────────────────────────────────────

function createApp(siteKey) {
  const site = SITES[siteKey];

  const app = express();

  // ─────────────────────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────────────────────

  app.use(cors(corsOptions));

  // CORS headerlarini qo'lda ham beramiz.
  // Bu /api/events kabi endpointlarda ham ishlaydi.

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (
      origin &&
      allowedOrigins.includes(origin)
    ) {
      res.header(
        "Access-Control-Allow-Origin",
        origin
      );

      res.header(
        "Access-Control-Allow-Credentials",
        "true"
      );

      res.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
      );

      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Accept, Origin, X-Requested-With, X-Section"
      );

      res.header(
        "Access-Control-Expose-Headers",
        "Content-Length, Content-Type"
      );

      // Cache orqali eski CORS javobi kelmasligi uchun
      res.header(
        "Vary",
        "Origin"
      );
    }

    // ───────────────────────────────────────────────────────
    // PREFLIGHT OPTIONS
    // ───────────────────────────────────────────────────────

    if (req.method === "OPTIONS") {
      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {
        return res.sendStatus(204);
      }

      return res.sendStatus(403);
    }

    next();
  });

  // ─────────────────────────────────────────────────────────
  // BODY PARSER
  // ─────────────────────────────────────────────────────────

  app.use(
    express.json({
      limit: "50mb",
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: "50mb",
    })
  );

  // ─────────────────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────────────────

  app.get(
    "/health",
    (req, res) => {
      res.status(200).json({
        status: "ok",
        service: "GeoLearn API",
        site: siteKey,
      });
    }
  );

  // ─────────────────────────────────────────────────────────
  // SITE
  // ─────────────────────────────────────────────────────────

  app.get(
    "/api/site",
    (req, res) => {
      res.json({
        site: siteKey,
        label: site.label,
      });
    }
  );

  // ─────────────────────────────────────────────────────────
  // REAL TIME EVENTS / SSE
  // ─────────────────────────────────────────────────────────

  app.get(
    "/api/events",
    eventsHandler
  );

  // ─────────────────────────────────────────────────────────
  // API ROUTES
  // ─────────────────────────────────────────────────────────

  app.use(
    "/api",
    authRoutes
  );

  app.use(
    "/api",
    lessonRoutes
  );

  app.use(
    "/api",
    videoRoutes
  );

  app.use(
    "/api",
    gameRoutes
  );

  app.use(
    "/api",
    ratingRoutes
  );

  app.use(
    "/api",
    homeworkRoutes
  );

  app.use(
    "/api",
    aiRoutes
  );

  app.use(
    "/api",
    analyticsRoutes
  );

  app.use(
    "/api",
    classRoutes
  );

  app.use(
    "/api",
    gradeRoutes
  );

  // ─────────────────────────────────────────────────────────
  // UNKNOWN API ROUTE
  // ─────────────────────────────────────────────────────────

  app.use(
    "/api",
    (req, res) => {
      res.status(404).json({
        error: "API yo'li topilmadi",
        path: req.originalUrl,
      });
    }
  );

  // ─────────────────────────────────────────────────────────
  // STATIC FRONTEND
  // ─────────────────────────────────────────────────────────

  const hasBuild =
    !API_ONLY &&
    Boolean(site.dist) &&
    existsSync(
      join(
        site.dist,
        "index.html"
      )
    );

  if (hasBuild) {
    app.use(
      express.static(site.dist)
    );

    app.get(
      "*",
      (req, res) => {
        res.sendFile(
          join(
            site.dist,
            "index.html"
          )
        );
      }
    );
  } else {
    app.get(
      "*",
      (req, res) => {
        res.status(200).json({
          status:
            "GeoLearn API ishlayapti",

          site: siteKey,

          ...(site.buildCmd
            ? {
                hint:
                  `Sayt hali qurilmagan. Repo ildizida: ${site.buildCmd}`,
              }
            : {}),
        });
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // ERROR HANDLER
  // ─────────────────────────────────────────────────────────

  app.use(
    (err, req, res, next) => {
      console.error(
        "❌ SERVER ERROR:",
        err
      );

      // Javobda CORS headerlari saqlanib qolishi uchun
      const origin =
        req.headers.origin;

      if (
        origin &&
        allowedOrigins.includes(origin)
      ) {
        res.header(
          "Access-Control-Allow-Origin",
          origin
        );

        res.header(
          "Access-Control-Allow-Credentials",
          "true"
        );
      }

      if (res.headersSent) {
        return next(err);
      }

      res.status(500).json({
        error:
          "Serverda xatolik yuz berdi",
        message:
          process.env.NODE_ENV ===
          "production"
            ? "Internal server error"
            : err.message,
      });
    }
  );

  return {
    app,
    hasBuild,
  };
}

// ─────────────────────────────────────────────────────────────
// SERVER START
// ─────────────────────────────────────────────────────────────

function start(
  siteKey,
  port
) {
  const site =
    SITES[siteKey];

  const {
    app,
    hasBuild,
  } =
    createApp(siteKey);

  const server =
    app.listen(
      port,
      () => {
        const name =
          hasBuild
            ? site.label
            : site.apiLabel;

        console.log(
          `${hasBuild ? "🌐" : "🔌"} ${name.padEnd(
            26
          )} → http://localhost:${port}${
            hasBuild
              ? ""
              : "  (faqat API)"
          }`
        );

        console.log(
          "🌐 FRONTEND_URL:",
          process.env.FRONTEND_URL ||
            "ALL"
        );

        console.log(
          "🌐 CORS origins:",
          allowedOrigins
        );
      }
    );

  server.on(
    "error",
    (err) => {
      if (
        err.code ===
        "EADDRINUSE"
      ) {
        console.error(
          `❌ ${port} porti band (${site.label}).`
        );

        console.error(
          "   Boshqa port bilan: PORT=4000 STUDENT_PORT=4001 npm start"
        );

        process.exit(1);
      }

      throw err;
    }
  );

  return server;
}

// ─────────────────────────────────────────────────────────────
// SEED ADMIN TEACHER
// ─────────────────────────────────────────────────────────────

// Admin (o'qituvchi) hisobi. Login va parolni ADMIN_USERNAME /
// ADMIN_PASSWORD env o'zgaruvchilari bilan almashtirish mumkin (Render →
// Environment yoki backend/.env); berilmasa quyidagi standart qiymatlar
// ishlatiladi. Standart parol ochiq yozilmaydi — faqat uning xeshi.
const ADMIN_USERNAME =
  String(
    process.env.ADMIN_USERNAME ?? ""
  ).trim() || "toxir";

const ADMIN_PASSWORD = String(
  process.env.ADMIN_PASSWORD ?? ""
).trim();

const ADMIN_HASH = ADMIN_PASSWORD
  ? hashPassword(ADMIN_PASSWORD)
  : "39dea881559374f916bc1f680540a3a80fba90bac902b12f3e94d80e843ff529";

const adminTaken = getUserByUsername(
  ADMIN_USERNAME
);

const adminUser =
  adminTaken?.role === "teacher"
    ? adminTaken
    : null;

// Eski standart hisob (admin / admin123) — yangi login/parolga ko'chiriladi
const legacyAdmin =
  ADMIN_USERNAME !== "admin"
    ? getUserByUsername("admin")
    : null;

if (
  adminUser
) {
  // ADMIN_PASSWORD berilgan bo'lsa — parol har ishga tushganda shunga keltiriladi
  if (
    ADMIN_PASSWORD &&
    adminUser.passwordHash !== ADMIN_HASH
  ) {
    updateUser(
      adminUser.id,
      { passwordHash: ADMIN_HASH }
    );

    console.log(
      "🔑 Admin paroli ADMIN_PASSWORD bo'yicha yangilandi"
    );
  }
} else if (
  adminTaken
) {
  console.error(
    `⚠️  "${ADMIN_USERNAME}" logini o'quvchida band — admin hisobi yaratilmadi. ADMIN_USERNAME ni boshqa qiymatga o'zgartiring.`
  );
} else if (
  legacyAdmin?.role === "teacher"
) {
  updateUser(
    legacyAdmin.id,
    {
      username: ADMIN_USERNAME,
      passwordHash: ADMIN_HASH,
    }
  );

  console.log(
    `🔑 Admin hisobi yangilandi: login "${ADMIN_USERNAME}"`
  );
} else {
  createUser({
    name: "Administrator",
    username: ADMIN_USERNAME,
    passwordHash: ADMIN_HASH,
    role: "teacher",
    grade: null,
    theme: "light",
    language: "uz",
    fontSize: "medium",
  });

  console.log(
    `✅ Admin yaratildi: login "${ADMIN_USERNAME}"`
  );
}

// ─────────────────────────────────────────────────────────────
// ISHGA TUSHIRISH
// ─────────────────────────────────────────────────────────────

console.log(
  "🌍 GeoLearn ishga tushmoqda...\n"
);

console.log(
  "🌐 SITE:",
  SITE
);

console.log(
  "🌐 FRONTEND_URL:",
  process.env.FRONTEND_URL ||
    "ALL ORIGINS"
);

const ports =
  SITE === "teacher" ||
  SITE === "student" ||
  SITE === "api"
    ? [TEACHER_PORT]
    : [
        TEACHER_PORT,
        STUDENT_PORT,
      ];

// ─────────────────────────────────────────────────────────────
// PORT CHECK
// ─────────────────────────────────────────────────────────────

for (
  const port of ports
) {
  const foreign =
    await findForeignServer(
      port
    );

  if (foreign) {
    reportConflict(
      port,
      foreign.host
    );

    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────

if (
  ports.length === 1
) {
  start(
    SITE,
    TEACHER_PORT
  );
} else {
  start(
    "teacher",
    TEACHER_PORT
  );

  start(
    "student",
    STUDENT_PORT
  );
}

console.log("");
