/* Проверка алгоритмов: круговое расписание и тай-брейки. Запуск через esbuild bundle. */
import { buildRoundRobin, roundCount } from '../src/lib/berger';
import { computeStandings } from '../src/lib/standings';
import type { Category, Participant } from '../src/types';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('ok:', msg);
  }
}

// ── Расписание ──
for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const pairings = buildRoundRobin(ids);
  const pairs = pairings.map(p => [p.p1, p.p2].sort().join('|')).sort();
  const unique = new Set(pairs);
  const expectedPairs = (n * (n - 1)) / 2;
  const expectedRounds = roundCount(n);
  const actualRounds = new Set(pairings.map(p => p.round)).size;
  const perRoundOk = pairings.every(p => p.round >= 1 && p.round <= expectedRounds);
  assert(
    pairs.length === expectedPairs && unique.size === expectedPairs,
    `n=${n}: каждая пара встречается ровно один раз (${pairs.length}/${expectedPairs})`,
  );
  assert(
    actualRounds === expectedRounds && perRoundOk,
    `n=${n}: число туров ${actualRounds} = ${expectedRounds}`,
  );
  // в одном туре участник не играет дважды
  for (let r = 1; r <= actualRounds; r++) {
    const inRound = pairings.filter(p => p.round === r).flatMap(p => [p.p1, p.p2]);
    if (new Set(inRound).size !== inRound.length) {
      assert(false, `n=${n}, тур ${r}: участник играет дважды`);
    }
  }
}

// ── Тай-брейки ──
function mkParticipant(id: string, name: string, seed: number): Participant {
  return { id, name, weight: null, seed };
}

const participants = [
  mkParticipant('a', 'Алиев', 1),
  mkParticipant('b', 'Бароев', 2),
  mkParticipant('c', 'Валиев', 3),
  mkParticipant('d', 'Гасанов', 4),
];

// Алиев и Бароев по 2 очка; личная встреча выиграна Бароевым → Бароев выше.
// Валиев 1 очко, Гасанов 0.
const matches = [
  { id: 'm1', round: 1, p1: 'a', p2: 'b', s1: 1, s2: 2 }, // b
  { id: 'm2', round: 1, p1: 'c', p2: 'd', s1: 2, s2: 1 }, // c
  { id: 'm3', round: 2, p1: 'a', p2: 'c', s1: 2, s2: 0 }, // a
  { id: 'm4', round: 2, p1: 'b', p2: 'd', s1: 2, s2: 0 }, // b
  { id: 'm5', round: 3, p1: 'a', p2: 'd', s1: 0, s2: 0 }, // неверно, заменим
];
// поправим m5: a проиграл d? Тогда у a 2 очка, d 1, c 1... пересчитаем:
// a: проигрыш b, победа c, победа d = 2 очка
// b: победа a, победа d, ? c — не сыгран? нет: круговой должен быть полный.
const fullMatches = [
  { id: 'm1', round: 1, p1: 'a', p2: 'b', s1: 1, s2: 2 },
  { id: 'm2', round: 1, p1: 'c', p2: 'd', s1: 2, s2: 1 },
  { id: 'm3', round: 2, p1: 'a', p2: 'c', s1: 2, s2: 0 },
  { id: 'm4', round: 2, p1: 'b', p2: 'd', s1: 2, s2: 0 },
  { id: 'm5', round: 3, p1: 'a', p2: 'd', s1: 2, s2: 1 },
  { id: 'm6', round: 3, p1: 'b', p2: 'c', s1: 0, s2: 2 },
];
// a: W over c,d; L to b → 2 очка
// b: W over a,d; L to c → 2 очка
// c: W over d,b; L to a → 2 очка
// d: L всем → 0
// Тройная ничья a,b,c по 2 очка. Мини-таблица: a: W c, L b → 1; b: W a, L c → 1; c: W b, L a → 1.
// Мини не разделила → разница раундов:
// a: 1:2 (b), 2:0 (c), 2:1 (d) → 5:3 → +2
// b: 2:1 (a), 2:0 (d), 0:2 (c) → 4:3 → +1
// c: 2:1 (d), 0:2 (a), 2:0 (b) → 4:3 → +1
// a первый, затем b и c равны и по разнице → по стартовому номеру: b (№2) выше c (№3).
const cat: Category = {
  id: 'cat',
  name: 'Тест',
  format: 'bo3',
  participants,
  matches: fullMatches,
  started: true,
};
const rows = computeStandings(cat);
assert(rows[0].participant.id === 'a', `1 место: a (разница раундов), получили ${rows[0].participant.id}`);
assert(rows[1].participant.id === 'b', `2 место: b (стартовый номер), получили ${rows[1].participant.id}`);
assert(rows[2].participant.id === 'c', `3 место: c, получили ${rows[2].participant.id}`);
assert(rows[3].participant.id === 'd', `4 место: d, получили ${rows[3].participant.id}`);

// Незавершённый турнир: убираем m6. a и b по 2 очка, личная встреча (m1) сыграна:
// b победил → b выше a, несмотря на лучшую разницу раундов у a? нет: у b +3, у a +2,
// но личная встреча приоритетнее → b первый.
const partial: Category = { ...cat, matches: fullMatches.slice(0, 5) };
const rows2 = computeStandings(partial);
assert(rows2[0].participant.id === 'b', `промежуточно 1: b (личная встреча), получили ${rows2[0].participant.id}`);
assert(rows2[1].participant.id === 'a', `промежуточно 2: a, получили ${rows2[1].participant.id}`);
assert(rows2[2].participant.id === 'c', `промежуточно 3: c, получили ${rows2[2].participant.id}`);

// Личная встреча ещё НЕ сыграна (убрали m1 и m6): a — 2 очка; b и c по 1,
// мини-таблица 0:0 → b выше c за счёт разницы раундов (+2 против +1).
const partial2: Category = { ...cat, matches: fullMatches.filter(m => m.id !== 'm1' && m.id !== 'm6') };
const rows3 = computeStandings(partial2);
assert(rows3[0].participant.id === 'a', `без личной: 1 — a, получили ${rows3[0].participant.id}`);
assert(rows3[1].participant.id === 'b', `без личной: 2 — b (разница раундов), получили ${rows3[1].participant.id}`);
assert(rows3[2].participant.id === 'c', `без личной: 3 — c, получили ${rows3[2].participant.id}`);

console.log(process.exitCode ? '\nЕСТЬ ОШИБКИ' : '\nВсе проверки пройдены');
