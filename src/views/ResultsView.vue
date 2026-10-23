<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAppStore } from '../stores/app';
import { computeStandings, type StandingRow } from '../lib/standings';
import { exportTournamentToExcel } from '../lib/excel';
import { formatWeight, formatDate } from '../lib/utils';
import { FORMAT_SHORT, type Category, type Tournament } from '../types';

const route = useRoute();
const store = useAppStore();

const t = computed<Tournament | null>(() => store.tournament(String(route.params.id)));
const startedCats = computed<Category[]>(() =>
  t.value ? t.value.categories.filter(c => c.started) : [],
);

function standingsOf(cat: Category): StandingRow[] {
  return computeStandings(cat);
}

const MEDALS = ['🥇', '🥈', '🥉'] as const;
const MEDAL_CLASSES = ['gold', 'silver', 'bronze'] as const;

function podium(cat: Category): StandingRow[] {
  return standingsOf(cat).filter(r => r.played > 0).slice(0, 3);
}

const exportState = ref<{ kind: 'idle' | 'busy' | 'ok' | 'err'; msg: string }>({
  kind: 'idle',
  msg: '',
});

async function doExport() {
  if (!t.value || exportState.value.kind === 'busy') return;
  exportState.value = { kind: 'busy', msg: 'Готовлю файл…' };
  try {
    const result = await exportTournamentToExcel(t.value);
    if (result === null) {
      exportState.value = { kind: 'idle', msg: '' };
    } else {
      exportState.value = { kind: 'ok', msg: `Сохранено: ${result}` };
    }
  } catch (e) {
    console.error(e);
    exportState.value = { kind: 'err', msg: `Ошибка экспорта: ${String(e)}` };
  }
}

function allMatchesPlayed(cat: Category): boolean {
  return cat.matches.length > 0 && cat.matches.every(m => m.s1 != null);
}

function toggleFinished() {
  if (!t.value) return;
  store.toggleFinished(t.value);
}
</script>

<template>
  <div v-if="t">
    <RouterLink to="/" class="back-link">← Все турниры</RouterLink>
    <div class="form-row" style="align-items: center; margin-bottom: 4px">
      <h1 style="margin: 0">Итоги — {{ t.name }}</h1>
      <span class="badge" :class="t.status">{{ t.status === 'setup' ? 'подготовка' : t.status === 'running' ? 'идёт' : 'завершён' }}</span>
    </div>
    <p class="subtitle" v-if="startedCats.length">
      создан {{ formatDate(t.createdAt) }} · начатых категорий: {{ startedCats.length }}
    </p>

    <div v-if="!startedCats.length" class="empty">
      Нет начатых категорий — итогов пока нет.
      <RouterLink :to="`/builder/${t.id}`">Перейти к настройке</RouterLink>.
    </div>

    <template v-else>
      <div class="actions-bar" style="margin: 0 0 18px">
        <button class="btn btn-primary btn-big" @click="doExport">⬇ Экспорт в Excel</button>
        <span class="export-state" :class="exportState.kind === 'ok' ? 'ok' : exportState.kind === 'err' ? 'err' : ''">
          {{ exportState.msg }}
        </span>
        <span style="flex: 1"></span>
        <button class="btn" @click="toggleFinished">
          {{ t.status === 'finished' ? 'Открыть турнир снова' : 'Закрыть турнир (завершён)' }}
        </button>
      </div>

      <section v-for="cat in startedCats" :key="cat.id" class="card">
        <h2 class="card-title">
          {{ cat.name }}
          <span class="badge setup">{{ FORMAT_SHORT[cat.format] }}</span>
          <span v-if="allMatchesPlayed(cat)" class="badge running">все бои сыграны ✓</span>
        </h2>

        <div class="podium">
          <div
            v-for="(row, i) in podium(cat)"
            :key="row.participant.id"
            class="podium-spot"
            :class="MEDAL_CLASSES[i]"
          >
            <div class="podium-medal">{{ MEDALS[i] }} {{ row.place }} место</div>
            <div class="podium-name">{{ row.participant.name }}</div>
            <div class="podium-meta">
              № {{ row.participant.seed }} · {{ formatWeight(row.participant.weight) }} ·
              {{ row.points }} очк. ({{ row.wins }}П-{{ row.losses }}Пр)
            </div>
          </div>
        </div>

        <h3>Положение</h3>
        <table class="table">
          <thead>
            <tr>
              <th class="num">Место</th>
              <th class="num">№</th>
              <th>ФИО</th>
              <th class="num">Вес</th>
              <th class="num">И</th>
              <th class="num">В</th>
              <th class="num">П</th>
              <th class="num">Р+</th>
              <th class="num">Р−</th>
              <th class="num">±</th>
              <th class="num">Очки</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in standingsOf(cat)"
              :key="row.participant.id"
              :class="{
                'place-1': row.place === 1 && row.played > 0,
                'place-2': row.place === 2 && row.played > 0,
                'place-3': row.place === 3 && row.played > 0,
                withdrawn: row.participant.withdrawn,
              }"
            >
              <td class="num place-cell"><b>{{ row.place }}</b></td>
              <td class="num">{{ row.participant.seed }}</td>
              <td>{{ row.participant.name }}</td>
              <td class="num">{{ row.participant.weight ?? '—' }}</td>
              <td class="num">{{ row.played }}</td>
              <td class="num">{{ row.wins }}</td>
              <td class="num">{{ row.losses }}</td>
              <td class="num">{{ row.roundsWon }}</td>
              <td class="num">{{ row.roundsLost }}</td>
              <td class="num">{{ row.roundDiff > 0 ? `+${row.roundDiff}` : row.roundDiff }}</td>
              <td class="num"><b>{{ row.points }}</b></td>
            </tr>
          </tbody>
        </table>

        <h3>История встреч</h3>
        <table class="table">
          <thead>
            <tr>
              <th class="num" style="width: 60px">Тур</th>
              <th>Участник 1</th>
              <th class="num" style="width: 90px">Счёт</th>
              <th>Участник 2</th>
              <th>Победитель</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in [...cat.matches].sort((a, b) => a.round - b.round)" :key="m.id">
              <td class="num">{{ m.round }}</td>
              <td :class="{ 'winner-name': m.s1 != null && m.s1! > m.s2! }">
                {{ cat.participants.find(p => p.id === m.p1)?.name }}
              </td>
              <td class="num">
                {{ m.s1 != null ? `${m.s1}:${m.s2}` : '—' }}
                <span v-if="m.technical" class="tech-tag">тех.</span>
              </td>
              <td :class="{ 'winner-name': m.s1 != null && m.s2! > m.s1! }">
                {{ cat.participants.find(p => p.id === m.p2)?.name }}
              </td>
              <td>
                <template v-if="m.s1 == null">—</template>
                <template v-else-if="m.s1 > m.s2!">
                  {{ cat.participants.find(p => p.id === m.p1)?.name }}
                </template>
                <template v-else>
                  {{ cat.participants.find(p => p.id === m.p2)?.name }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>

  <div v-else class="empty">Турнир не найден. <RouterLink to="/">Вернуться к списку</RouterLink></div>
</template>

<style scoped>
h3 {
  margin: 18px 0 8px;
  font-size: 15.5px;
}

.winner-name {
  font-weight: 700;
  color: #1c7c33;
}
</style>
