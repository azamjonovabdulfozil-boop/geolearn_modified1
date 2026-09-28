import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "@shared/App.vue";
import router from "./router";
import "@shared/assets/main.css";
import { useSettingsStore } from "@shared/stores/settings";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
// Admin panelda til tanlanmaydi (uning o'rniga sinflar bo'limi) — doim o'zbekcha
useSettingsStore(pinia).setLanguage("uz");
app.use(router);
app.mount("#app");
