<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAppStore } from '../stores/app';
import CategoryBuilder from '../components/CategoryBuilder.vue';
import { FORMATS, FORMAT_LABELS, type MatchFormat, type Tournament } from '../types';

const route = useRoute();
const store = useAppStore();

const t = computed<Tournament | null>(() => store.tournament(String(route.params.id)));

function rename(e: Event) {
  if (!t.value) return;
  const value = (e.target as HTMLInputElement).value.trim();
  if (value) t.value.name = value;
  store.persist();
}

function changeFormat(f: MatchFormat) {
  if (!t.value) return;
  t.value.format = f;
  store.persist();
}
</script>

<template>
  <div v-if="t">
    <RouterLink to="/" class="back-link">← Все турниры</RouterLink>
    <div class="form-row" style="align-items: flex-end; margin-bottom: 18px">
      <h1 style="margin: 0">Настройка турнира</h1>
      <span class="badge" :class="t.status">{{ t.status === 'setup' ? 'подготовка' : t.status === 'running' ? 'идёт' : 'завершён' }}</span>
    </div>

    <section class="card">
      <div class="form-row">
        <label class="field">
          Название турнира
          <input :value="t.name" style="width: 320px" @change="rename" />
        </label>
        <label class="field">
          Формат боя по умолчанию (для новых категорий)
          <select :value="t.format" style="min-width: 260px" @change="changeFormat(($event.target as HTMLSelectElement).value as MatchFormat)">
            <option v-for="f in FORMATS" :key="f" :value="f">{{ FORMAT_LABELS[f] }}</option>
          </select>
        </label>
      </div>
    </section>

    <h2>Категории и участники</h2>
    <p class="section-note">
      Введите ФИО и вес участников. Перед началом нажмите «Перемешать» для жеребьёвки стартовых
      номеров (или оставьте порядок ввода). Затем — «Начать категорию»: расписание круговой
      системы сгенерируется автоматически.
    </p>

    <CategoryBuilder v-for="cat in t.categories" :key="cat.id" :tournament="t" :category="cat" />

    <div class="actions-bar">
      <button class="btn btn-primary btn-big" @click="store.addCategory(t)">+ Добавить категорию</button>
    </div>
  </div>

  <div v-else class="empty">Турнир не найден. <RouterLink to="/">Вернуться к списку</RouterLink></div>
</template>
