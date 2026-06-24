import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gridDisk } from 'h3-js';
import { Faction } from '../constants/factions';

export interface Territory {
  h3id: string;
  faction: Faction;
  ownerName: string;
  strength: number;
  conqueredAt: number;
  lastActivityAt: number;
}

interface MapState {
  territories: Record<string, Territory>;
  userH3Cell: string | null;

  setUserCell: (h3id: string) => void;
  captureCell: (h3id: string, faction: Faction, ownerName: string) => void;
  getTerritory: (h3id: string) => Territory | null;
  getCurrentStrength: (h3id: string) => number;
  seedDemoTerritories: (centerH3: string, faction: Faction) => void;
}

function decayedStrength(territory: Territory): number {
  const daysSince = (Date.now() - territory.lastActivityAt) / 86400000;
  return Math.max(0, Math.floor(territory.strength - daysSince));
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      territories: {},
      userH3Cell: null,

      setUserCell: (h3id) => set({ userH3Cell: h3id }),

      captureCell: (h3id, faction, ownerName) =>
        set((s) => ({
          territories: {
            ...s.territories,
            [h3id]: {
              h3id,
              faction,
              ownerName,
              strength: 1,
              conqueredAt: Date.now(),
              lastActivityAt: Date.now(),
            },
          },
        })),

      getTerritory: (h3id) => get().territories[h3id] ?? null,

      getCurrentStrength: (h3id) => {
        const t = get().territories[h3id];
        return t ? decayedStrength(t) : 0;
      },

      seedDemoTerritories: (centerH3, playerFaction) => {
        const allCells: string[] = gridDisk(centerH3, 4);
        const factions: Faction[] = ['undead', 'human', 'elf'];
        const newTerritories: Record<string, Territory> = {};

        allCells.forEach((h3id, i) => {
          if (h3id === centerH3) return;
          if (i % 5 === 0) return;

          let faction: Faction;
          if (i % 3 === 0) faction = factions[0];
          else if (i % 3 === 1) faction = factions[1];
          else faction = factions[2];

          const daysAgo = Math.random() * 3;
          const strength = Math.max(1, Math.floor(5 - daysAgo));

          newTerritories[h3id] = {
            h3id,
            faction,
            ownerName: faction === playerFaction ? 'Demo' : `Demo ${faction}`,
            strength,
            conqueredAt: Date.now() - daysAgo * 86400000,
            lastActivityAt: Date.now() - daysAgo * 86400000,
          };
        });

        set({ territories: newTerritories });
      },
    }),
    {
      name: 'geo-battle-map',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
