import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createUser, getUserByUsername } from './lib/db.js';
import { hashPassword } from './lib/auth.js';
import { findForeignServer, reportConflict } from './lib/port.js';
import { eventsHandler } from './lib/events.js';
// DIQQAT: dotenv eng birinchi bo'lishi SHART.
// ES modullar e'lon tartibida yuklanadi.
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

const siteArg = process.argv.find(a => a.startsWith("--site="))?.slice(7);

const SITE = (
  siteArg ||
  process.env.SITE ||
  "both"
).toLowerCase();

const API_ONLY = process.env.API_ONLY === "1";

const TEACHER_PORT = Number(process.env.PORT) || 3000;
const STUDENT_PORT =
  Number(process.env.STUDENT_PORT) || TEACHER_PORT + 1;

const SITES = {
  teacher: {
    label: "Admin (o'qituvchi) sayti",
    apiLabel: "API — admin",
    dist: join(REPO_ROOT, "admin", "dist"),
    buildCmd: "npm run build:admin",
  },

  student: {
    label: "User (o'quvchi) sayti",
    apiLabel: "API — user",
    dist: join(REPO_ROOT, "user", "dist"),
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

// Render Environment Variables:
//
// FRONTEND_URL=https://geolearn-modified1-admin.vercel.app
//
// Agar bir nechta frontend bo'lsa:
//
// FRONTEND_URL=https://geolearn-modified1-admin.vercel.app,https://geolearn-modified1.vercel.app

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map(origin => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

// Lokal ishlaganda FRONTEND_URL bo'lmasa barcha originlarga ruxsat.
const corsOptions = {
  origin: (origin, callback) => {
    // Postman, server-to-server yoki localhost kabi origin yubormaydigan
    // so'rovlarni ham qabul qilamiz.
    if (!origin) {
      return callback(null, true);
    }

    // FRONTEND_URL berilmagan bo'lsa barcha originlarga ruxsat.
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }

    // Faqat ruxsat berilgan frontendlar.
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ CORS bloklandi:", origin);
    console.log("✅ Ruxsat berilgan originlar:", allowedOrigins);

    return callback(new Error("Not allowed by CORS"));
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
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Type",
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

  // Preflight OPTIONS so'rovlarini alohida qabul qilish.
  app.options("*", cors(corsOptions));

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

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      service: "GeoLearn API",
    });
  });

  // ─────────────────────────────────────────────────────────
  // API SITE
  // ─────────────────────────────────────────────────────────

  app.get("/api/site", (req, res) => {
    res.json({
      site: siteKey,
      label: site.label,
    });
  });

  // ─────────────────────────────────────────────────────────
  // REAL TIME EVENTS / SSE
  // ─────────────────────────────────────────────────────────

  app.get("/api/events", eventsHandler);

  // ─────────────────────────────────────────────────────────
  // API ROUTES
  // ─────────────────────────────────────────────────────────

  app.use("/api", authRoutes);

  app.use("/api", lessonRoutes);

  app.use("/api", videoRoutes);

  app.use("/api", gameRoutes);

  app.use("/api", ratingRoutes);

  app.use("/api", homeworkRoutes);

  app.use("/api", aiRoutes);

  app.use("/api", analyticsRoutes);

  app.use("/api", classRoutes);

  app.use("/api", gradeRoutes);

  // ─────────────────────────────────────────────────────────
  // UNKNOWN API ROUTE
  // ─────────────────────────────────────────────────────────

  app.use("/api", (req, res) => {
    res.status(404).json({
      error: "API yo'li topilmadi",
      path: req.originalUrl,
    });
  });

  // ─────────────────────────────────────────────────────────
  // STATIC FRONTEND
  // ─────────────────────────────────────────────────────────

  const hasBuild =
    !API_ONLY &&
    Boolean(site.dist) &&
    existsSync(join(site.dist, "index.html"));

  if (hasBuild) {
    app.use(express.static(site.dist));

    app.get("*", (req, res) => {
      res.sendFile(
        join(site.dist, "index.html")
      );
    });
  } else {
    app.get("*", (req, res) => {
      res.status(200).json({
        status: "GeoLearn API ishlayapti",
        site: siteKey,

        ...(site.buildCmd
          ? {
              hint: `Sayt hali qurilmagan. Repo ildizida: ${site.buildCmd}`,
            }
          : {}),
      });
    });
  }

  return {
    app,
    hasBuild,
  };
}

// ─────────────────────────────────────────────────────────────
// SERVER START
// ─────────────────────────────────────────────────────────────

function start(siteKey, port) {
  const site = SITES[siteKey];

  const {
    app,
    hasBuild,
  } = createApp(siteKey);

  const server = app.listen(
    port,
    () => {
      const name = hasBuild
        ? site.label
        : site.apiLabel;

      console.log(
        `${hasBuild ? "🌐" : "🔌"} ${name.padEnd(
          26
        )} → http://localhost:${port}${
          hasBuild ? "" : "  (faqat API)"
        }`
      );

      console.log(
        "CORS origins:",
        allowedOrigins.length > 0
          ? allowedOrigins
          : "ALL"
      );
    }
  );

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `❌ ${port} porti band (${site.label}).`
      );

      console.error(
        "   Boshqa port bilan: PORT=4000 STUDENT_PORT=4001 npm start"
      );

      process.exit(1);
    }

    throw err;
  });

  return server;
}

// ─────────────────────────────────────────────────────────────
// SEED ADMIN TEACHER
// ─────────────────────────────────────────────────────────────

if (!getUserByUsername("admin")) {
  createUser({
    name: "Administrator",
    username: "admin",
    passwordHash: hashPassword("admin123"),
    role: "teacher",
    grade: null,
    theme: "light",
    language: "uz",
    fontSize: "medium",
  });

  console.log(
    "✅ Admin yaratildi: admin / admin123"
  );
}

// ─────────────────────────────────────────────────────────────
// ISHGA TUSHIRISH
// ─────────────────────────────────────────────────────────────

console.log(
  "🌍 GeoLearn ishga tushmoqda...\n"
);

console.log(
  "🌐 FRONTEND_URL:",
  process.env.FRONTEND_URL || "ALL ORIGINS"
);

console.log(
  "🖥️ SITE:",
  SITE
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

for (const port of ports) {
  const foreign =
    await findForeignServer(port);

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

if (ports.length === 1) {
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