export interface Pairing {
  round: number;
  p1: string;
  p2: string;
}

/**
 * Круговая система (метод круга / таблицы Бергера): каждый играет с каждым
 * ровно один раз. При нечётном числе участников в каждом туре один пропускает.
 */
export function buildRoundRobin(ids: string[]): Pairing[] {
  if (ids.length < 2) return [];
  const BYE = '';
  const arr = ids.length % 2 === 1 ? [...ids, BYE] : [...ids];
  const n = arr.length;
  const rounds = n - 1;
  const rot = [...arr];
  const pairings: Pairing[] = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i];
      const b = rot[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      pairings.push(
        r % 2 === 0 ? { round: r + 1, p1: a, p2: b } : { round: r + 1, p1: b, p2: a },
      );
    }
    // первый участник зафиксирован, остальные сдвигаются по кругу
    rot.splice(1, 0, rot.pop()!);
  }
  return pairings;
}

/** Число туров кругового турнира */
export function roundCount(participantCount: number): number {
  if (participantCount < 2) return 0;
  return participantCount % 2 === 0 ? participantCount - 1 : participantCount;
}
