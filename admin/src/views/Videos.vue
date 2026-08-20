<template>
  <div class="fade-in">
    <div class="page-header">
      <div>
        <h1 class="geo-page-title">Videolar</h1>
        <p class="geo-page-sub">{{ videos.length }} ta video mavjud</p>
      </div>
      <button @click="showCreate = true" class="geo-btn-primary">
        <Plus :size="16" /> Video qo'shish
      </button>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreate" class="modal-back" @click.self="showCreate = false">
          <div class="modal-box geo-card">
            <div class="modal-head">
              <h2>Video qo'shish</h2>
              <button @click="showCreate = false" class="geo-btn-ghost p-1"><X :size="18" /></button>
            </div>
            <div class="form-stack">
              <div class="form-field">
                <label>Sarlavha</label>
                <input v-model="form.title" class="geo-input" placeholder="Video sarlavhasi" />
              </div>
              <div class="form-field">
                <label>YouTube URL</label>
                <input v-model="form.url" class="geo-input" placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div class="form-field">
                <label>Sinf</label>
                <div class="grade-grid">
                  <button v-for="g in [6,7,8,9,10,11]" :key="g" type="button"
                    @click="form.grade = g" class="grade-btn" :class="{ 'grade-btn--on': form.grade === g }">{{ g }}</button>
                </div>
              </div>
              <div class="modal-actions">
                <button @click="showCreate = false" class="geo-btn-outline flex-1">Bekor</button>
                <button @click="addVideo" :disabled="!form.title || !form.url || creating" class="geo-btn-primary flex-1">
                  <Loader2 v-if="creating" :size="15" class="animate-spin" />
                  {{ creating ? '...' : "Qo'shish" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Loading -->
    <div v-if="loading" class="video-grid">
      <div v-for="i in 6" :key="i" class="geo-skeleton" style="aspect-ratio:16/9;border-radius:1rem"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="!videos.length" class="geo-card empty-card">
      <div class="empty-icon-wrap">
        <Video :size="28" style="color:hsl(var(--muted-fg));opacity:.5" />
      </div>
      <p class="empty-title">Hali videolar yo'q</p>
      <p class="empty-sub">Birinchi videoni qo'shing</p>
    </div>

    <!-- Grid -->
    <div v-else class="video-grid">
      <div v-for="v in videos" :key="v.id" class="video-card geo-card geo-card-hover group">
        <div class="video-thumb">
          <img :src="`https://img.youtube.com/vi/${getYoutubeId(v.youtubeUrl)}/hqdefault.jpg`"
            class="thumb-img" loading="lazy" />
          <div class="thumb-overlay">
            <div class="play-btn">
              <Play :size="18" style="color:hsl(var(--primary));margin-left:2px" />
            </div>
          </div>
          <span class="grade-tag geo-badge" style="position:absolute;top:8px;right:8px;background:hsl(var(--primary));color:white">
            {{ v.grade }}-sinf
          </span>
          <button @click="deleteVideo(v.id)"
            class="del-btn" title="O'chirish">
            <Trash2 :size="13" style="color:white" />
          </button>
        </div>
        <div class="video-info">
          <p class="video-title">{{ v.title }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { Plus, Video, Play, Trash2, Loader2, X } from "lucide-vue-next";
import { api } from "@shared/composables/api";

const videos = ref([]);
const loading = ref(true);
const showCreate = ref(false);
const creating = ref(false);
const form = ref({ title: "", url: "", grade: 7 });

function getYoutubeId(url) {
  return url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] ?? "";
}

async function load() {
  try { videos.value = await api("/api/videos"); } catch {}
  loading.value = false;
}
onMounted(load);

async function addVideo() {
  creating.value = true;
  try {
    await api("/api/videos", { method: "POST", body: JSON.stringify({ title: form.value.title, youtubeUrl: form.value.url, grade: form.value.grade }) });
    showCreate.value = false;
    form.value = { title: "", url: "", grade: 7 };
    await load();
  } catch {}
  creating.value = false;
}

async function deleteVideo(id) {
  try { await api(`/api/videos/${id}`, { method: "DELETE" }); await load(); } catch {}
}
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }

/* Modal */
.modal-back { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,.45); backdrop-filter: blur(4px); }
.modal-box { width: 100%; max-width: 440px; padding: 24px; }
.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.modal-head h2 { font-size: 17px; font-weight: 700; }
.form-stack { display: flex; flex-direction: column; gap: 16px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field label { font-size: 13px; font-weight: 600; }
.grade-grid { display: grid; grid-template-columns: repeat(6,1fr); gap: 6px; }
.grade-btn { padding: 9px 4px; border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; border: 1.5px solid hsl(var(--border)); background: transparent; color: hsl(var(--muted-fg)); transition: all .15s; font-family: inherit; }
.grade-btn:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--primary)); }
.grade-btn--on { background: hsl(var(--primary)); color: white; border-color: hsl(var(--primary)); }
.modal-actions { display: flex; gap: 10px; padding-top: 4px; }
.flex-1 { flex: 1; }

/* Grid */
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.video-card { overflow: hidden; }
.video-thumb {
  position: relative;
  aspect-ratio: 16/9;
  background: hsl(var(--muted));
  overflow: hidden;
}
.thumb-img {
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform .3s;
}
.video-card:hover .thumb-img { transform: scale(1.04); }
.thumb-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.18);
  display: flex; align-items: center; justify-content: center;
}
.play-btn {
  width: 44px; height: 44px;
  border-radius: 50%;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,.2);
}
.del-btn {
  position: absolute; top: 8px; left: 8px;
  width: 28px; height: 28px;
  border-radius: 8px;
  background: rgba(0,0,0,0.55);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity .2s;
}
.video-card:hover .del-btn { opacity: 1; }
.video-info { padding: 12px 14px; }
.video-title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Empty */
.empty-card { text-align: center; padding: 60px 24px; }
.empty-icon-wrap { width: 60px; height: 60px; border-radius: 16px; background: hsl(var(--muted)); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
.empty-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: hsl(var(--muted-fg)); }
.p-1 { padding: 4px; }
</style>
