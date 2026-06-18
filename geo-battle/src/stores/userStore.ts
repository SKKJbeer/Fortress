import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Faction } from '../constants/factions';

export interface UserStats {
  totalRuns: number;
  totalKm: number;
  cellsCaptured: number;
  cellsLost: number;
}

interface UserState {
  isOnboarded: boolean;
  name: string;
  faction: Faction | null;
  stats: UserStats;
  spellLastUsedAt: number | null;

  setFaction: (faction: Faction) => void;
  setName: (name: string) => void;
  completeOnboarding: (name: string, faction: Faction) => void;
  addRunStats: (km: number, captured: number) => void;
  useSpell: () => void;
  canUseSpell: () => boolean;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      isOnboarded: false,
      name: '',
      faction: null,
      stats: { totalRuns: 0, totalKm: 0, cellsCaptured: 0, cellsLost: 0 },
      spellLastUsedAt: null,

      setFaction: (faction) => set({ faction }),
      setName: (name) => set({ name }),

      completeOnboarding: (name, faction) =>
        set({ name, faction, isOnboarded: true }),

      addRunStats: (km, captured) =>
        set((s) => ({
          stats: {
            ...s.stats,
            totalRuns: s.stats.totalRuns + 1,
            totalKm: Math.round((s.stats.totalKm + km) * 10) / 10,
            cellsCaptured: s.stats.cellsCaptured + captured,
          },
        })),

      useSpell: () => set({ spellLastUsedAt: Date.now() }),

      canUseSpell: () => {
        const { spellLastUsedAt } = get();
        if (!spellLastUsedAt) return true;
        return Date.now() - spellLastUsedAt > 24 * 60 * 60 * 1000;
      },
    }),
    {
      name: 'geo-battle-user',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
