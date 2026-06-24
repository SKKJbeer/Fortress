import { create } from 'zustand';
import { LatLng, distanceKm as distanceKmBetween } from '../utils/h3Utils';

export interface CaptureProgress {
  h3id: string;
  startedAt: number;
  secondsIn: number;
  requiredSeconds: number;
}

interface RunState {
  isRunning: boolean;
  startedAt: number | null;
  currentPosition: LatLng | null;
  currentH3Cell: string | null;
  path: LatLng[];
  distanceKm: number;
  capturedCells: string[];
  inProgressCell: CaptureProgress | null;
  lastSpeedKmh: number;
  isSpeeding: boolean;

  startRun: () => void;
  stopRun: () => { distanceKm: number; capturedCells: string[] };
  updatePosition: (pos: LatLng, h3id: string, speed: number) => void;
  progressCapture: (h3id: string, requiredSeconds: number) => boolean;
  resetProgress: () => void;
}

export const useRunStore = create<RunState>()((set, get) => ({
  isRunning: false,
  startedAt: null,
  currentPosition: null,
  currentH3Cell: null,
  path: [],
  distanceKm: 0,
  capturedCells: [],
  inProgressCell: null,
  lastSpeedKmh: 0,
  isSpeeding: false,

  startRun: () =>
    set({
      isRunning: true,
      startedAt: Date.now(),
      path: [],
      distanceKm: 0,
      capturedCells: [],
      inProgressCell: null,
      lastSpeedKmh: 0,
      isSpeeding: false,
    }),

  stopRun: () => {
    const { distanceKm, capturedCells } = get();
    set({
      isRunning: false,
      startedAt: null,
      currentH3Cell: null,
      inProgressCell: null,
      isSpeeding: false,
    });
    return { distanceKm, capturedCells };
  },

  updatePosition: (pos, h3id, speed) => {
    const s = get();
    const MAX_SPEED = 52;
    const isSpeeding = speed > MAX_SPEED;

    let newDistanceKm = s.distanceKm;
    if (s.currentPosition && s.path.length > 0) {
      newDistanceKm += distanceKmBetween(s.currentPosition, pos);
    }

    const cellChanged = h3id !== s.currentH3Cell;

    set({
      currentPosition: pos,
      currentH3Cell: h3id,
      path: [...s.path, pos].slice(-500),
      distanceKm: Math.round(newDistanceKm * 1000) / 1000,
      lastSpeedKmh: Math.round(speed * 10) / 10,
      isSpeeding,
      inProgressCell: cellChanged ? null : s.inProgressCell,
    });
  },

  progressCapture: (h3id, requiredSeconds) => {
    const s = get();
    const now = Date.now();

    if (s.isSpeeding) return false;
    if (s.capturedCells.includes(h3id)) return false;

    const current = s.inProgressCell;

    if (!current || current.h3id !== h3id) {
      set({
        inProgressCell: {
          h3id,
          startedAt: now,
          secondsIn: 0,
          requiredSeconds,
        },
      });
      return false;
    }

    const secondsIn = (now - current.startedAt) / 1000;
    const updated: typeof current = { ...current, secondsIn };

    if (secondsIn >= requiredSeconds) {
      set({
        capturedCells: [...s.capturedCells, h3id],
        inProgressCell: null,
      });
      return true;
    }

    set({ inProgressCell: updated });
    return false;
  },

  resetProgress: () => set({ inProgressCell: null }),
}));
