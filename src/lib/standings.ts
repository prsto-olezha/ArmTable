import type { Category, Match, Participant } from '../types';

export interface StandingRow {
  participant: Participant;
  place: number;
  played: number;
  wins: number;
  losses: number;
  roundsWon: number;
  roundsLost: number;
  roundDiff: number;
  points: number;
}

export function playedMatches(cat: Category): Match[] {
  return cat.matches.filter(m => m.s1 != null && m.s2 != null);
}

/**
 * Положение категории. Порядок: очки → личные встречи (мини-таблица среди
 * равных) → разница раундов → стартовый номер.
 */
export function computeStandings(cat: Category): StandingRow[] {
  const played = playedMatches(cat);
  const rows = new Map<string, StandingRow>();
  for (const p of cat.participants) {
    rows.set(p.id, {
      participant: p,
      place: 0,
      played: 0,
      wins: 0,
      losses: 0,
      roundsWon: 0,
      roundsLost: 0,
      roundDiff: 0,
      points: 0,
    });
  }
  for (const m of played) {
    const r1 = rows.get(m.p1);
    const r2 = rows.get(m.p2);
    if (!r1 || !r2) continue;
    r1.played++;
    r2.played++;
    r1.roundsWon += m.s1!;
    r1.roundsLost += m.s2!;
    r2.roundsWon += m.s2!;
    r2.roundsLost += m.s1!;
    if (m.s1! > m.s2!) {
      r1.wins++;
      r2.losses++;
    } else {
      r2.wins++;
      r1.losses++;
    }
  }
  for (const r of rows.values()) {
    r.points = r.wins;
    r.roundDiff = r.roundsWon - r.roundsLost;
  }
  const ordered = resolveGroups([...rows.values()], played);
  ordered.forEach((r, i) => {
    r.place = i + 1;
  });
  return ordered;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return map;
}

function resolveGroups(all: StandingRow[], played: Match[]): StandingRow[] {
  const out: StandingRow[] = [];
  const byPoints = groupBy([...all].sort((a, b) => b.points - a.points), r => r.points);
  for (const group of byPoints.values()) {
    out.push(...resolveGroup(group, played));
  }
  return out;
}

/** Разрешение группы с равными очками: личные встречи → разница раундов → номер */
function resolveGroup(group: StandingRow[], played: Match[]): StandingRow[] {
  if (group.length === 1) return group;
  const ids = new Set(group.map(r => r.participant.id));
  const mini = new Map<string, number>(group.map(r => [r.participant.id, 0]));
  for (const m of played) {
    if (!ids.has(m.p1) || !ids.has(m.p2)) continue;
    if (m.s1 === null || m.s2 === null) continue;
    if (m.s1 > m.s2) mini.set(m.p1, mini.get(m.p1)! + 1);
    else mini.set(m.p2, mini.get(m.p2)! + 1);
  }
  const byMini = groupBy(group, r => mini.get(r.participant.id)!);
  if (byMini.size > 1) {
    const keys = [...byMini.keys()].sort((a, b) => b - a);
    return keys.flatMap(k => resolveGroup(byMini.get(k)!, played));
  }
  return group.sort(
    (a, b) => b.roundDiff - a.roundDiff || a.participant.seed - b.participant.seed,
  );
}
