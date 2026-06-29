import { COUNTRIES, CONTINENT_NAMES, flagUrl } from "./countries.js";
import { RIVERS, MOUNTAINS, SEAS, LAKES, DESERTS, OCEANS, CONTINENTS_LIST, VOLCANOES, ISLANDS, CURRENCIES } from "./geoData.js";

const byCont = (c) => COUNTRIES.filter(x => x[3] === c);

// ── 50 TOPICS ─────────────────────────────────────────
// kinds: flag_to_country, country_to_flag, country_to_capital,
//        capital_to_country, country_to_continent, mixed_country,
//        rivers, mountains, seas, lakes, deserts, oceans, continents,
//        volcanoes, islands, currencies, bt_only (brain-teaser only)
export const TOPICS = [
  // ── Flag → Country (image quiz) ──
  { id: 1,  name: "Jahon bayroqlari",        category: "Bayroqlar", icon: "🏳️", kind: "flag_to_country", pool: COUNTRIES },
  { id: 2,  name: "Yevropa bayroqlari",      category: "Bayroqlar", icon: "🇪🇺", kind: "flag_to_country", pool: byCont("EU") },
  { id: 3,  name: "Osiyo bayroqlari",        category: "Bayroqlar", icon: "🌏", kind: "flag_to_country", pool: byCont("AS") },
  { id: 4,  name: "Afrika bayroqlari",       category: "Bayroqlar", icon: "🌍", kind: "flag_to_country", pool: byCont("AF") },
  { id: 5,  name: "Amerika bayroqlari",      category: "Bayroqlar", icon: "🌎", kind: "flag_to_country", pool: [...byCont("NA"), ...byCont("SA")] },
  { id: 6,  name: "Markaziy Osiyo bayroqlari", category: "Bayroqlar", icon: "🏔️", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["uz","kz","kg","tj","tm","af"].includes(c[1])) },
  { id: 7,  name: "MDH bayroqlari",          category: "Bayroqlar", icon: "🤝", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["ru","by","ua","md","kz","kg","tj","tm","uz","az","am","ge"].includes(c[1])) },
  { id: 8,  name: "Arab davlatlari bayroqlari", category: "Bayroqlar", icon: "🕌", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["sa","ae","qa","eg","sy","iq","ly","tn","dz","ma","sd"].includes(c[1])) },
  { id: 9,  name: "Skandinaviya bayroqlari", category: "Bayroqlar", icon: "❄️", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["se","no","fi","dk","is"].includes(c[1])) },
  { id:10,  name: "Bolqon bayroqlari",       category: "Bayroqlar", icon: "🏞️", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["rs","hr","si","ba","al","bg","gr","ro"].includes(c[1])) },
  { id:11,  name: "Yevropa Ittifoqi a'zolari", category: "Bayroqlar", icon: "💶", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["de","fr","it","es","pt","nl","be","at","pl","cz","sk","hu","ro","bg","gr","se","fi","dk","ie","hr","si","ee","lv","lt"].includes(c[1])) },
  { id:12,  name: "G'arbiy Yevropa bayroqlari", category: "Bayroqlar", icon: "🏰", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["de","fr","it","es","pt","gb","ie","nl","be","ch","at"].includes(c[1])) },
  { id:13,  name: "Sharqiy Yevropa bayroqlari", category: "Bayroqlar", icon: "🛕", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["ru","by","ua","pl","cz","sk","hu","ro","bg"].includes(c[1])) },
  { id:14,  name: "Janubi-Sharqiy Osiyo bayroqlari", category: "Bayroqlar", icon: "🌴", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["th","vn","id","my","ph","sg"].includes(c[1])) },
  { id:15,  name: "Sharqiy Osiyo bayroqlari", category: "Bayroqlar", icon: "🐉", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["cn","jp","kr","kp","mn"].includes(c[1])) },
  { id:16,  name: "Janubiy Amerika bayroqlari", category: "Bayroqlar", icon: "🌎", kind: "flag_to_country", pool: byCont("SA") },
  { id:17,  name: "Yaqin Sharq bayroqlari",  category: "Bayroqlar", icon: "🐪", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["tr","ir","iq","sy","il","sa","ae","qa"].includes(c[1])) },
  { id:18,  name: "Bayroq → Davlat (qiyin)",  category: "Bayroqlar", icon: "🎯", kind: "flag_to_country",
            pool: COUNTRIES.filter(c => ["lv","lt","ee","md","by","ge","am","az","mn","np","lk","bd"].includes(c[1])) },

  // ── Country → Capital ──
  { id:19, name: "Davlat poytaxtlari (jahon)", category: "Poytaxtlar", icon: "🏛️", kind: "country_to_capital", pool: COUNTRIES },
  { id:20, name: "Yevropa poytaxtlari",       category: "Poytaxtlar", icon: "🗼", kind: "country_to_capital", pool: byCont("EU") },
  { id:21, name: "Osiyo poytaxtlari",         category: "Poytaxtlar", icon: "🏯", kind: "country_to_capital", pool: byCont("AS") },
  { id:22, name: "Afrika poytaxtlari",        category: "Poytaxtlar", icon: "🦒", kind: "country_to_capital", pool: byCont("AF") },
  { id:23, name: "Amerika poytaxtlari",       category: "Poytaxtlar", icon: "🗽", kind: "country_to_capital", pool: [...byCont("NA"), ...byCont("SA")] },
  { id:24, name: "Markaziy Osiyo poytaxtlari", category: "Poytaxtlar", icon: "⛰️", kind: "country_to_capital",
           pool: COUNTRIES.filter(c => ["uz","kz","kg","tj","tm"].includes(c[1])) },

  // ── Capital → Country ──
  { id:25, name: "Poytaxt → Davlat (jahon)",  category: "Poytaxtlar", icon: "📍", kind: "capital_to_country", pool: COUNTRIES },
  { id:26, name: "Poytaxt → Davlat (Yevropa)", category: "Poytaxtlar", icon: "🧭", kind: "capital_to_country", pool: byCont("EU") },

  // ── Country → Flag (reverse) ──
  { id:27, name: "Davlat → Bayroq",            category: "Bayroqlar", icon: "🚩", kind: "country_to_flag", pool: COUNTRIES },

  // ── Country → Continent ──
  { id:28, name: "Davlat qaysi materikda?",   category: "Materiklar", icon: "🗺️", kind: "country_to_continent", pool: COUNTRIES },

  // ── Geography pools ──
  { id:29, name: "Dunyo daryolari",           category: "Daryolar", icon: "🏞️", kind: "rivers", pool: RIVERS },
  { id:30, name: "Eng uzun daryolar",         category: "Daryolar", icon: "💧", kind: "rivers_longest", pool: RIVERS },
  { id:31, name: "Tog'lar va cho'qqilar",      category: "Tog'lar",  icon: "🏔️", kind: "mountains", pool: MOUNTAINS },
  { id:32, name: "Eng baland cho'qqilar",      category: "Tog'lar",  icon: "🗻", kind: "mountains_highest", pool: MOUNTAINS },
  { id:33, name: "Dengizlar",                  category: "Suvliklar", icon: "🌊", kind: "seas", pool: SEAS },
  { id:34, name: "Ko'llar",                    category: "Suvliklar", icon: "🏞️", kind: "lakes", pool: LAKES },
  { id:35, name: "Cho'llar",                   category: "Tabiat",   icon: "🏜️", kind: "deserts", pool: DESERTS },
  { id:36, name: "Okeanlar",                   category: "Suvliklar", icon: "🌊", kind: "oceans", pool: OCEANS },
  { id:37, name: "Materiklar",                 category: "Materiklar", icon: "🌐", kind: "continents", pool: CONTINENTS_LIST },
  { id:38, name: "Vulqonlar",                  category: "Tabiat",   icon: "🌋", kind: "volcanoes", pool: VOLCANOES },
  { id:39, name: "Eng katta orollar",          category: "Tabiat",   icon: "🏝️", kind: "islands", pool: ISLANDS },
  { id:40, name: "Pul birliklari",             category: "Iqtisod",  icon: "💰", kind: "currencies", pool: CURRENCIES },

  // ── Specialized brain-teasers ──
  { id:41, name: "O'zbekiston geografiyasi",   category: "O'zbekiston", icon: "🇺🇿", kind: "uzbekistan", pool: null },
  { id:42, name: "Qit'alarning hajmi",         category: "Materiklar", icon: "📐", kind: "continents_size", pool: CONTINENTS_LIST },
  { id:43, name: "Geografik rekordlar",        category: "Bilimdon",  icon: "🏆", kind: "geo_records", pool: null },
  { id:44, name: "Bayroqlar rang-tarkibi",     category: "Bayroqlar", icon: "🎨", kind: "flag_colors", pool: null },
  { id:45, name: "Qit'alarning chegaralari",   category: "Bilimdon",  icon: "🧠", kind: "geo_bt", pool: null },
  { id:46, name: "Iqlim mintaqalari",          category: "Tabiat",    icon: "🌡️", kind: "climate_bt", pool: null },
  { id:47, name: "Yarim orollar",              category: "Tabiat",    icon: "🗺️", kind: "peninsulas_bt", pool: null },
  { id:48, name: "Dunyo aholisi",              category: "Iqtisod",   icon: "👥", kind: "population_bt", pool: null },
  { id:49, name: "Yulduzli geografiya",        category: "Bilimdon",  icon: "⭐", kind: "stars_bt", pool: null },
  { id:50, name: "Aralash geografiya (qiyin)", category: "Bilimdon",  icon: "🧩", kind: "mixed_bt", pool: null },
];

export function getTopicById(id) {
  return TOPICS.find(t => t.id === id);
}

// Public-safe list (no pool data, only metadata)
export function listTopicsPublic() {
  return TOPICS.map(({ id, name, category, icon, kind }) => ({
    id, name, category, icon,
    hasImages: kind === "flag_to_country" || kind === "country_to_flag",
  }));
}
