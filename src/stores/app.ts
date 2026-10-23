import { defineStore } from 'pinia';
import { buildRoundRobin } from '../lib/berger';
import { loadData, saveData } from '../lib/storage';
import { shuffle, uid } from '../lib/utils';
import {
  winsNeeded,
  type AppData,
  type Category,
  type MatchFormat,
  type Tournament,
} from '../types';

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const useAppStore = defineStore('app', {
  state: (): { data: AppData; loaded: boolean } => ({
    data: { version: 1, tournaments: [] },
    loaded: false,
  }),
  getters: {
    tournament: state => (id: string): Tournament | null =>
      state.data.tournaments.find(t => t.id === id) ?? null,
  },
  actions: {
    async init() {
      const d = await loadData();
      if (d && d.tournaments) this.data = d;
      this.loaded = true;
    },
    persist() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void saveData(this.data);
      }, 250);
    },
    touch() {
      this.persist();
    },

    createTournament(name: string, format: MatchFormat, categoryCount: number): Tournament {
      const count = Math.max(1, Math.min(50, Math.floor(categoryCount) || 1));
      const t: Tournament = {
        id: uid(),
        name: name.trim() || 'Турнир',
        createdAt: new Date().toISOString(),
        format,
        status: 'setup',
        categories: Array.from({ length: count }, (_, i) =>
          this.emptyCategory(format, `Категория ${i + 1}`),
        ),
      };
      this.data.tournaments.unshift(t);
      this.persist();
      return t;
    },
    emptyCategory(format: MatchFormat, name: string): Category {
      return { id: uid(), name, format, participants: [], matches: [], started: false };
    },
    deleteTournament(id: string) {
      this.data.tournaments = this.data.tournaments.filter(t => t.id !== id);
      this.persist();
    },
    addCategory(t: Tournament) {
      t.categories.push(this.emptyCategory(t.format, `Категория ${t.categories.length + 1}`));
      this.persist();
    },
    deleteCategory(t: Tournament, catId: string) {
      t.categories = t.categories.filter(c => c.id !== catId);
      this.persist();
    },

    addParticipant(cat: Category, name: string, weight: number | null) {
      if (cat.started) return;
      const seed = cat.participants.reduce((m, p) => Math.max(m, p.seed), 0) + 1;
      cat.participants.push({ id: uid(), name: name.trim(), weight, seed });
      this.persist();
    },
    removeParticipant(cat: Category, participantId: string) {
      if (cat.started) return;
      cat.participants = cat.participants.filter(p => p.id !== participantId);
      this.persist();
    },
    shuffleSeeds(cat: Category) {
      if (cat.started) return;
      const order = shuffle(cat.participants);
      order.forEach((p, i) => {
        p.seed = i + 1;
      });
      this.persist();
    },

    startCategory(t: Tournament, cat: Category) {
      if (cat.started || cat.participants.length < 2) return;
      cat.participants.sort((a, b) => a.seed - b.seed);
      cat.participants.forEach((p, i) => {
        p.seed = i + 1;
      });
      const ids = cat.participants.map(p => p.id);
      cat.matches = buildRoundRobin(ids).map(pr => ({
        id: uid(),
        round: pr.round,
        p1: pr.p1,
        p2: pr.p2,
        s1: null,
        s2: null,
      }));
      cat.started = true;
      if (t.status === 'setup') t.status = 'running';
      this.persist();
    },
    /** Сбросить расписание (можно только пока нет ни одного результата) */
    resetCategorySchedule(cat: Category) {
      if (!cat.started) return;
      if (cat.matches.some(m => m.s1 != null)) return;
      cat.matches = [];
      cat.started = false;
      this.persist();
    },

    setScore(cat: Category, matchId: string, s1: number, s2: number) {
      const m = cat.matches.find(x => x.id === matchId);
      if (!m) return;
      const w = winsNeeded(cat.format);
      const hi = Math.max(s1, s2);
      const lo = Math.min(s1, s2);
      if (s1 === s2 || hi !== w || lo > w - 1 || lo < 0) return;
      m.s1 = s1;
      m.s2 = s2;
      m.technical = false;
      this.persist();
    },
    clearScore(cat: Category, matchId: string) {
      const m = cat.matches.find(x => x.id === matchId);
      if (!m) return;
      m.s1 = null;
      m.s2 = null;
      m.technical = false;
      this.persist();
    },

    /** Снять участника: оставшиеся бои — технические поражения */
    withdrawParticipant(cat: Category, participantId: string) {
      const p = cat.participants.find(x => x.id === participantId);
      if (!p || p.withdrawn) return;
      p.withdrawn = true;
      const w = winsNeeded(cat.format);
      for (const m of cat.matches) {
        if (m.s1 != null) continue;
        if (m.p1 === participantId) {
          m.s1 = 0;
          m.s2 = w;
          m.technical = true;
        } else if (m.p2 === participantId) {
          m.s1 = w;
          m.s2 = 0;
          m.technical = true;
        }
      }
      this.persist();
    },
    restoreParticipant(cat: Category, participantId: string) {
      const p = cat.participants.find(x => x.id === participantId);
      if (!p) return;
      p.withdrawn = false;
      for (const m of cat.matches) {
        if (m.technical && (m.p1 === participantId || m.p2 === participantId)) {
          m.s1 = null;
          m.s2 = null;
          m.technical = false;
        }
      }
      this.persist();
    },

    toggleFinished(t: Tournament) {
      t.status = t.status === 'finished' ? 'running' : 'finished';
      this.persist();
    },
  },
});
