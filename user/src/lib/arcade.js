// Ochko yig'ish o'yinlarining komponentlari. Har biri bir xil ko'rinishda ishlaydi:
// props { seed, active }, hodisalar: score(n) va over. Shu sababli 1 ga 1 xonasi,
// jamoaviy xona va yolg'iz mashq — hammasi bitta ro'yxatdan foydalanadi.
// Komponentlar kerak bo'lganda yuklanadi (o'yinlar sahifasi og'irlashmasin).
import { defineAsyncComponent } from "vue";

const load = fn => defineAsyncComponent(fn);
const rapid = mode => ({ component: load(() => import("../components/games/arcade/RapidGame.vue")), props: { mode } });
const game = fn => ({ component: load(fn), props: {} });

export const ARCADE = {
  tank: game(() => import("../components/games/TankGame.vue")),
  snake: game(() => import("../components/games/SnakeGame.vue")),
  memory: game(() => import("../components/games/MemoryGame.vue")),
  shooter: game(() => import("../components/games/arcade/ShooterGame.vue")),
  target: game(() => import("../components/games/arcade/TargetGame.vue")),
  balloon: game(() => import("../components/games/arcade/BalloonGame.vue")),
  basket: game(() => import("../components/games/arcade/BasketGame.vue")),
  breakout: game(() => import("../components/games/arcade/BreakoutGame.vue")),
  flappy: game(() => import("../components/games/arcade/FlappyGame.vue")),
  runner: game(() => import("../components/games/arcade/RunnerGame.vue")),
  catcher: game(() => import("../components/games/arcade/CatcherGame.vue")),
  racer: game(() => import("../components/games/arcade/RacerGame.vue")),
  whack: game(() => import("../components/games/arcade/WhackGame.vue")),
  simon: game(() => import("../components/games/arcade/SimonGame.vue")),
  schulte: game(() => import("../components/games/arcade/SchulteGame.vue")),
  g2048: game(() => import("../components/games/arcade/G2048Game.vue")),
  slide: game(() => import("../components/games/arcade/SlideGame.vue")),
  maze: game(() => import("../components/games/arcade/MazeGame.vue")),
  reaction: game(() => import("../components/games/arcade/ReactionGame.vue")),
  typing: game(() => import("../components/games/arcade/TypingGame.vue")),
  math: rapid("math"),
  mathtf: rapid("mathtf"),
  compare: rapid("compare"),
  sequence: rapid("sequence"),
  stroop: rapid("stroop"),
  anagram: rapid("anagram"),
  continent: rapid("continent"),
  oddone: rapid("oddone"),
};

/** Mashq rejimidagi o'yin vaqti (soniya) — backenddagi gameCatalog.js bilan bir xil. */
export const DURATION = {
  tank: 90, shooter: 75, target: 60, balloon: 45, basket: 60, snake: 90, breakout: 90, flappy: 60, runner: 60,
  catcher: 60, racer: 60, whack: 45, memory: 120, simon: 75, schulte: 60, g2048: 120, slide: 120, maze: 90,
  reaction: 45, typing: 60, math: 60, mathtf: 60, compare: 60, sequence: 60, stroop: 45, anagram: 75, continent: 60, oddone: 60,
};
