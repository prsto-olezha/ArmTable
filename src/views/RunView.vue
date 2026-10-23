<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAppStore } from '../stores/app';
import { computeStandings } from '../lib/standings';
import { confirmDialog, formatWeight } from '../lib/utils';
import { scorePresets, type Category, type Match, type Tournament } from '../types';

const route = useRoute();
const store = useAppStore();

const t = computed<Tournament | null>(() => store.tournament(String(route.params.id)));
const startedCats = computed<Category[]>(() =>
  t.value ? t.value.categories.filter(c => c.started) : [],
);

const activeCatId = ref('');
const cat = computed<Category | null>(() => {
  if (!startedCats.value.length) return null;
  return startedCats.value.find(c => c.id === activeCatId.value) ?? startedCats.value[0];
});

const currentRound = ref(1);

function autoRound(c: Category): number {
  const rounds = [...new Set(c.matches.map(m => m.round))].sort((a, b) => a - b);
  for (const r of rounds) {
    if (c.matches.some(m => m.round === r && m.s1 == null)) return r;
  }
  return rounds[rounds.length - 1] ?? 1;
}

watch(
  cat,
  c => {
    if (c && !c.matches.some(m => m.round === currentRound.value)) {
      currentRound.value = autoRound(c);
    }
  },
  { immediate: true },
);

const totalRounds = computed(() =>
  cat.value ? new Set(cat.value.matches.map(m => m.round)).size : 0,
);
const roundMatches = computed<Match[]>(() =>
  cat.value ? cat.value.matches.filter(m => m.round === currentRound.value) : [],
);
const roundPlayed = computed(() => roundMatches.value.filter(m => m.s1 != null).length);
const roundComplete = computed(
  () => roundMatches.value.length > 0 && roundPlayed.value === roundMatches.value.length,
);
const standings = computed(() => (cat.value ? computeStandings(cat.value) : []));
const presets = computed(() => (cat.value ? scorePresets(cat.value.format) : []));

function p(id: string) {
  return cat.value?.participants.find(x => x.id === id);
}

function isActive(m: Match, s1: number, s2: number) {
  return m.s1 === s1 && m.s2 === s2;
}

function set(m: Match, s1: number, s2: number) {
  if (cat.value) store.setScore(cat.value, m.id, s1, s2);
}

function clear(m: Match) {
  if (cat.value) store.clearScore(cat.value, m.id);
}

function toggleWithdraw(participantId: string) {
  if (!cat.value) return;
  const person = p(participantId);
  if (!person) return;
  if (person.withdrawn) {
    if (confirmDialog(`Вернуть «${person.name}» в турнир? Технические результаты будут стёрты.`)) {
      store.restoreParticipant(cat.value, participantId);
    }
  } else if (
    confirmDialog(
      `Снять «${person.name}» с турнира? Во всех оставшихся боях ему будут засчитаны технические поражения.`,
    )
  ) {
    store.withdrawParticipant(cat.value, participantId);
  }
}

function switchCat(id: string) {
  activeCatId.value = id;
}
</script>

<template>
  <div v-if="t">
    <RouterLink :to="`/builder/${t.id}`" class="back-link">← Настройка турнира</RouterLink>
    <h1 style="margin-bottom: 18px">{{ t.name }} — проведение</h1>

    <div v-if="!startedCats.length" class="empty">
      Ни одна категория ещё не начата.
      <RouterLink :to="`/builder/${t.id}`">Добавьте участников и начните категорию</RouterLink>.
    </div>

    <template v-else>
      <div class="tabs">
        <button
          v-for="c in startedCats"
          :key="c.id"
          class="tab"
          :class="{ active: cat?.id === c.id }"
          @click="switchCat(c.id)"
        >
          {{ c.name }}
        </button>
      </div>

      <div v-if="cat" class="grid-2">
        <section>
          <div class="round-nav">
            <button class="btn" :disabled="currentRound <= 1" @click="currentRound--">‹ Назад</button>
            <div class="round-label">Тур {{ currentRound }} из {{ totalRounds }}</div>
            <button class="btn" :disabled="currentRound >= totalRounds" @click="currentRound++">
              Вперёд ›
            </button>
            <span class="round-progress">сыграно {{ roundPlayed }} из {{ roundMatches.length }}</span>
            <span v-if="roundComplete" class="badge running">тур завершён ✓</span>
          </div>

          <div
            v-for="m in roundMatches"
            :key="m.id"
            class="match-card"
            :class="{ done: m.s1 != null }"
          >
            <div class="m-side left" :class="{ winner: m.s1 != null && m.s1! > m.s2! }">
              <span class="m-name">{{ p(m.p1)?.name }}</span>
              <span class="m-sub">№ {{ p(m.p1)?.seed }} · {{ formatWeight(p(m.p1)?.weight ?? null) }}</span>
            </div>

            <div class="m-center">
              <button
                v-for="pr in presets"
                :key="`l${pr[1]}`"
                class="chip"
                :class="{ active: isActive(m, pr[0], pr[1]) }"
                :title="`Победа: ${p(m.p1)?.name}`"
                @click="set(m, pr[0], pr[1])"
              >
                {{ pr[0] }}:{{ pr[1] }}
              </button>
              <div class="score-big" :class="{ empty: m.s1 == null }">
                {{ m.s1 != null ? `${m.s1} : ${m.s2}` : '– : –' }}
              </div>
              <button
                v-for="pr in presets"
                :key="`r${pr[1]}`"
                class="chip"
                :class="{ active: isActive(m, pr[1], pr[0]) }"
                :title="`Победа: ${p(m.p2)?.name}`"
                @click="set(m, pr[1], pr[0])"
              >
                {{ pr[1] }}:{{ pr[0] }}
              </button>
              <span v-if="m.technical" class="tech-tag">тех.</span>
              <button v-if="m.s1 != null" class="chip-clear" title="Очистить результат" @click="clear(m)">✕</button>
            </div>

            <div class="m-side right" :class="{ winner: m.s1 != null && m.s2! > m.s1! }">
              <span class="m-name">{{ p(m.p2)?.name }}</span>
              <span class="m-sub">{{ formatWeight(p(m.p2)?.weight ?? null) }} · № {{ p(m.p2)?.seed }}</span>
            </div>
          </div>

          <p class="hint">
            Клик по счёту (например «2:0» слева) — победа левого участника с этим счётом; кнопки
            справа — победа правого.
          </p>
        </section>

        <aside class="card">
          <h2 class="card-title" style="margin-bottom: 8px">Положение (живое)</h2>
          <table class="table">
            <thead>
              <tr>
                <th class="num" style="width: 34px">№</th>
                <th>Участник</th>
                <th class="num">И</th>
                <th class="num">В</th>
                <th class="num">П</th>
                <th class="num">Очки</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in standings"
                :key="row.participant.id"
                :class="{
                  'place-1': row.place === 1 && row.played > 0,
                  'place-2': row.place === 2 && row.played > 0,
                  'place-3': row.place === 3 && row.played > 0,
                  withdrawn: row.participant.withdrawn,
                }"
              >
                <td class="num place-cell">{{ row.place }}</td>
                <td>{{ row.participant.name }}</td>
                <td class="num">{{ row.played }}</td>
                <td class="num">{{ row.wins }}</td>
                <td class="num">{{ row.losses }}</td>
                <td class="num"><b>{{ row.points }}</b></td>
                <td class="num">
                  <button class="btn btn-sm" @click="toggleWithdraw(row.participant.id)">
                    {{ row.participant.withdrawn ? 'вернуть' : 'снять' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <RouterLink class="btn" style="margin-top: 12px" :to="`/results/${t.id}`">
            Итоги и экспорт →
          </RouterLink>
        </aside>
      </div>
    </template>
  </div>

  <div v-else class="empty">Турнир не найден. <RouterLink to="/">Вернуться к списку</RouterLink></div>
</template>
