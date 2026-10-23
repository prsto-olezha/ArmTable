<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';
import { confirmDialog, formatDate } from '../lib/utils';
import { FORMATS, FORMAT_LABELS, STATUS_LABELS, type MatchFormat, type Tournament } from '../types';

const store = useAppStore();
const router = useRouter();

const name = ref('');
const format = ref<MatchFormat>('bo3');
const count = ref(2);

function create() {
  const t = store.createTournament(name.value || 'Турнир', format.value, count.value);
  router.push(`/builder/${t.id}`);
}

function statusLabel(t: Tournament) {
  return STATUS_LABELS[t.status];
}

function participantsCount(t: Tournament): number {
  return t.categories.reduce((sum, c) => sum + c.participants.length, 0);
}

function startedCount(t: Tournament): number {
  return t.categories.filter(c => c.started).length;
}

function remove(t: Tournament) {
  if (confirmDialog(`Удалить турнир «${t.name}» вместе со всеми результатами?`)) {
    store.deleteTournament(t.id);
  }
}
</script>

<template>
  <div>
    <h1>Турниры</h1>
    <p class="subtitle">Круговая система: каждый играет с каждым в своей категории.</p>

    <section class="card">
      <h2 class="card-title">Новый турнир</h2>
      <div class="form-row">
        <label class="field">
          Название
          <input
            v-model="name"
            placeholder="Например, Кубок города"
            class="inline-input"
            style="width: 260px"
            @keyup.enter="create"
          />
        </label>
        <label class="field">
          Формат боя
          <select v-model="format" class="inline-input" style="min-width: 240px">
            <option v-for="f in FORMATS" :key="f" :value="f">{{ FORMAT_LABELS[f] }}</option>
          </select>
        </label>
        <label class="field">
          Категорий
          <input v-model.number="count" type="number" min="1" max="50" class="inline-input" style="width: 90px" />
        </label>
        <button class="btn btn-primary btn-big" @click="create">Создать</button>
      </div>
      <p class="hint">Формат можно будет переопределить в каждой категории отдельно.</p>
    </section>

    <template v-if="store.data.tournaments.length">
      <h2>Мои турниры</h2>
      <div v-for="t in store.data.tournaments" :key="t.id" class="card">
        <div class="form-row" style="align-items: center; justify-content: space-between">
          <div>
            <div class="card-title" style="margin-bottom: 4px">
              {{ t.name }}
              <span class="badge" :class="t.status">{{ statusLabel(t) }}</span>
            </div>
            <div class="t-meta">
              создан {{ formatDate(t.createdAt) }} · категорий {{ t.categories.length }} ·
              участников {{ participantsCount(t) }} · начато {{ startedCount(t) }}
            </div>
          </div>
          <div class="form-row">
            <RouterLink class="btn" :to="`/builder/${t.id}`">Настройка</RouterLink>
            <RouterLink class="btn" :to="`/run/${t.id}`">Проведение</RouterLink>
            <RouterLink class="btn" :to="`/results/${t.id}`">Итоги</RouterLink>
            <button class="btn btn-danger" @click="remove(t)">Удалить</button>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="empty" style="margin-top: 18px">
      Пока нет ни одного турнира — создайте первый выше.
    </div>
  </div>
</template>

<style scoped>
.t-meta {
  color: #7a8794;
  font-size: 13.5px;
}
</style>
