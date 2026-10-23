export type MatchFormat = 'winloss' | 'bo3' | 'bo5';

export interface Participant {
  id: string;
  /** ФИО */
  name: string;
  /** Вес, кг */
  weight: number | null;
  /** Стартовый номер (после жеребьёвки) */
  seed: number;
  /** Снят с турнира (оставшиеся бои — технические поражения) */
  withdrawn?: boolean;
}

export interface Match {
  id: string;
  /** Номер тура, начиная с 1 */
  round: number;
  p1: string;
  p2: string;
  /** Выигранные раунды боя */
  s1: number | null;
  s2: number | null;
  /** Результат технический (снятие соперника) */
  technical?: boolean;
}

export interface Category {
  id: string;
  name: string;
  /** Формат боя; может отличаться от формата турнира */
  format: MatchFormat;
  participants: Participant[];
  matches: Match[];
  /** Расписание сгенерировано */
  started: boolean;
}

export type TournamentStatus = 'setup' | 'running' | 'finished';

export interface Tournament {
  id: string;
  name: string;
  createdAt: string;
  /** Формат по умолчанию для новых категорий */
  format: MatchFormat;
  status: TournamentStatus;
  categories: Category[];
}

export interface AppData {
  version: 1;
  tournaments: Tournament[];
}

export const FORMAT_LABELS: Record<MatchFormat, string> = {
  winloss: 'Победа / поражение',
  bo3: 'Бой до 2 побед (2:0 / 2:1)',
  bo5: 'Бой до 3 побед (3:0 / 3:1 / 3:2)',
};

export const FORMAT_SHORT: Record<MatchFormat, string> = {
  winloss: 'победа/поражение',
  bo3: 'до 2 побед',
  bo5: 'до 3 побед',
};

export const FORMATS: MatchFormat[] = ['winloss', 'bo3', 'bo5'];

export function winsNeeded(format: MatchFormat): number {
  return format === 'winloss' ? 1 : format === 'bo3' ? 2 : 3;
}

/** Возможные счёты в пользу первого участника */
export function scorePresets(format: MatchFormat): [number, number][] {
  const w = winsNeeded(format);
  if (format === 'winloss') return [[1, 0]];
  return Array.from({ length: w }, (_, i) => [w, i] as [number, number]);
}

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  setup: 'подготовка',
  running: 'идёт',
  finished: 'завершён',
};
