export type Faction = 'undead' | 'human' | 'elf';

export interface FactionConfig {
  id: Faction;
  name: string;
  emoji: string;
  color: string;
  colorDim: string;
  colorBorder: string;
  description: string;
  passiveBonus: string;
  spell: { name: string; description: string; cooldownHours: number };
  captureMultiplier: number;
  decayMultiplier: number;
  speedCapKmh: number;
}

export const FACTIONS: Record<Faction, FactionConfig> = {
  undead: {
    id: 'undead',
    name: 'Untote',
    emoji: '💀',
    color: '#9B30FF',
    colorDim: 'rgba(155, 48, 255, 0.35)',
    colorBorder: '#7B00DD',
    description: 'Ausdauernd und zäh. Territorien halten doppelt so lang ohne zu zerfallen.',
    passiveBonus: 'Capture −20% Zeit · Decay −50%',
    spell: {
      name: 'Pest',
      description: 'Benachbarte Gegner-Zellen verlieren sofort 3 Stärke (Radius 2 Hexes)',
      cooldownHours: 24,
    },
    captureMultiplier: 0.8,
    decayMultiplier: 0.5,
    speedCapKmh: 35,
  },
  human: {
    id: 'human',
    name: 'Menschen',
    emoji: '⚔️',
    color: '#1E8FD9',
    colorDim: 'rgba(30, 143, 217, 0.35)',
    colorBorder: '#0D6FAF',
    description: 'Ausgewogen und strategisch. Stärke wächst schneller, perfekt zum Verteidigen.',
    passiveBonus: 'Stärke +20% schneller · Balanced',
    spell: {
      name: 'Festung',
      description: '3 Zellen für 6h uneinnehmbar machen',
      cooldownHours: 24,
    },
    captureMultiplier: 1.0,
    decayMultiplier: 1.0,
    speedCapKmh: 35,
  },
  elf: {
    id: 'elf',
    name: 'Elfen',
    emoji: '🌿',
    color: '#00C853',
    colorDim: 'rgba(0, 200, 83, 0.35)',
    colorBorder: '#009640',
    description: 'Schnell und mobil. Höherer Speed-Cap erlaubt Fahrrad-Runs.',
    passiveBonus: 'Speed-Cap 52 km/h · 2 Zellen gleichzeitig',
    spell: {
      name: 'Naturpakt',
      description: 'Gelaufene Route → alle eigenen Zellen auf Stärke 10',
      cooldownHours: 24,
    },
    captureMultiplier: 1.0,
    decayMultiplier: 1.5,
    speedCapKmh: 52,
  },
};

export const NEUTRAL_STYLE = {
  color: '#4A4A5A',
  colorDim: 'rgba(74, 74, 90, 0.18)',
  colorBorder: '#3A3A4A',
};

export const H3_RESOLUTION = 8;
export const CAPTURE_SECONDS = 180;
export const NEARBY_RING_RADIUS = 4;
