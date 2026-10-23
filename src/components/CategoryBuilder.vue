<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAppStore } from '../stores/app';
import { confirmDialog, formatWeight } from '../lib/utils';
import {
  FORMATS,
  FORMAT_LABELS,
  type Category,
  type MatchFormat,
  type Tournament,
} from '../types';

const props = defineProps<{
  tournament: Tournament;
  category: Category;
}>();

const store = useAppStore();
const cat = computed(() => props.category);

const newName = ref('');
const newWeight = ref('');

const hasResults = computed(() => cat.value.matches.some(m => m.s1 != null));
const canStart = computed(
  () => !cat.value.started && cat.value.participants.length >= 2,
);
const sortedParticipants = computed(() =>
  [...cat.value.participants].sort((a, b) => a.seed - b.seed),
);

function add() {
  if (!newName.value.trim()) return;
  let weight: number | null = null;
  const parsed = parseFloat(newWeight.value.replace(',', '.'));
  if (newWeight.value.trim() !== '' && !Number.isNaN(parsed)) weight = parsed;
  store.addParticipant(cat.value, newName.value, weight);
  newName.value = '';
  newWeight.value = '';
}

function removeParticipant(id: string) {
  const p = cat.value.participants.find(x => x.id === id);
  if (p && confirmDialog(`Убрать участника «${p.name}» из категории?`)) {
    store.removeParticipant(cat.value, id);
  }
}

function start() {
  if (
    confirmDialog(
      `Сгенерировать расписание круговой системы для «${cat.value.name}»? ` +
        `После этого состав зафиксирован (${cat.value.participants.length} участн. → ` +
        `${cat.value.participants.length % 2 === 0 ? cat.value.participants.length - 1 : cat.value.participants.length} туров).`,
    )
  ) {
    store.startCategory(props.tournament, cat.value);
  }
}

function resetSchedule() {
  if (confirmDialog('Сбросить расписание? Результатов пока нет, состав снова можно менять.')) {
    store.resetCategorySchedule(cat.value);
  }
}

function removeCategory() {
  if (
    confirmDialog(
      hasResults.value
        ? `В категории есть результаты! Удалить «${cat.value.name}» целиком?`
        : `Удалить категорию «${cat.value.name}»?`,
    )
  ) {
    store.deleteCategory(props.tournament, cat.value.id);
  }
}

function renameCategory(e: Event) {
  const value = (e.target as HTMLInputElement).value.trim();
  if (value) cat.value.name = value;
  store.persist();
}

function changeFormat(f: MatchFormat) {
  cat.value.format = f;
  store.persist();
}
</script>

<template>
  <section class="card">
    <div class="card-title">
      <input :value="cat.name" class="cat-name-input" @change="renameCategory" />
      <span
        class="badge"
        :class="cat.started ? 'running' : 'setup'"
      >{{ cat.started ? 'идёт' : 'набор' }}</span>
      <span class="cat-count">{{ cat.participants.length }} участн.</span>
      <span style="flex: 1"></span>
      <label class="field" style="flex-direction: row; align-items: center; gap: 8px">
        Формат
        <select
          :value="cat.format"
          class="inline-input"
          :disabled="cat.started"
          @change="changeFormat(($event.target as HTMLSelectElement).value as MatchFormat)"
        >
          <option v-for="f in FORMATS" :key="f" :value="f">{{ FORMAT_LABELS[f] }}</option>
        </select>
      </label>
    </div>

    <table v-if="cat.participants.length" class="table">
      <thead>
        <tr>
          <th class="num" style="width: 46px">№</th>
          <th>ФИО</th>
          <th style="width: 90px">Вес</th>
          <th v-if="!cat.started" style="width: 50px"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in sortedParticipants" :key="p.id">
          <td class="num">{{ p.seed }}</td>
          <td>{{ p.name }}</td>
          <td>{{ formatWeight(p.weight) }}</td>
          <td v-if="!cat.started" class="num">
            <button class="chip-clear" title="Убрать участника" @click="removeParticipant(p.id)">✕</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty" style="padding: 18px">В категории пока нет участников.</div>

    <template v-if="!cat.started">
      <div class="participant-add">
        <input
          v-model="newName"
          placeholder="ФИО участника"
          style="width: 280px"
          @keyup.enter="add"
        />
        <input
          v-model="newWeight"
          placeholder="Вес, кг"
          style="width: 100px"
          @keyup.enter="add"
        />
        <button class="btn btn-primary" :disabled="!newName.trim()" @click="add">
          + Добавить
        </button>
        <button
          class="btn"
          :disabled="cat.participants.length < 2"
          title="Жеребьёвка: случайные стартовые номера"
          @click="store.shuffleSeeds(cat)"
        >
          🔀 Перемешать
        </button>
      </div>
      <div class="actions-bar" style="margin-top: 4px">
        <button class="btn btn-primary btn-big" :disabled="!canStart" @click="start">
          ▶ Начать категорию
        </button>
        <span v-if="cat.participants.length < 2" class="hint">
          Для старта нужно минимум 2 участника.
        </span>
      </div>
    </template>
    <template v-else>
      <div class="actions-bar">
        <span class="badge running">расписание сгенерировано</span>
        <RouterLink class="btn btn-primary" :to="`/run/${tournament.id}`">Перейти к проведению</RouterLink>
        <RouterLink class="btn" :to="`/results/${tournament.id}`">Итоги</RouterLink>
        <button v-if="!hasResults" class="btn btn-danger btn-sm" @click="resetSchedule">
          Отменить (сбросить расписание)
        </button>
      </div>
    </template>

    <div class="actions-bar" style="margin-top: 12px; justify-content: flex-end">
      <button class="btn btn-danger btn-sm" @click="removeCategory">Удалить категорию</button>
    </div>
  </section>
</template>

<style scoped>
.cat-name-input {
  font-size: 17px;
  font-weight: 700;
  width: 240px;
  border: 1px solid transparent;
  background: transparent;
}

.cat-name-input:hover {
  border-color: #c6d0da;
  background: #fff;
}

.cat-name-input:focus {
  border-color: #1f5aa0;
  background: #fff;
}

.cat-count {
  color: #7a8794;
  font-size: 13.5px;
  font-weight: 500;
}
</style>
