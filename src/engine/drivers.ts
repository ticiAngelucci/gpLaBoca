import type { Driver } from './types';

/**
 * Roster is intentionally data driven: swapping this array (or loading it from a
 * server) is the only change needed to ship a different, licensed line up.
 * The drivers below are original characters, not real world personalities.
 */
export const DRIVERS: Driver[] = [
  {
    id: 'voss',
    name: 'Max Voss',
    nickname: 'El Relámpago',
    team: 'Aurora Racing',
    colors: ['#12284b', '#ffd400'],
    accent: '#ff2a2a',
    stats: { power: 3, luck: 2, grip: 4, reflex: 3 },
    bio: 'Agresivo en la primera curva y todavía más agresivo en los minijuegos.',
  },
  {
    id: 'mensah',
    name: 'Kofi Mensah',
    nickname: 'El Metrónomo',
    team: 'Silverline GP',
    colors: ['#0d3b36', '#9ff5e2'],
    accent: '#00d1a0',
    stats: { power: 2, luck: 3, grip: 3, reflex: 4 },
    bio: 'Siete títulos imaginarios y una calma que desespera a los rivales.',
  },
  {
    id: 'ferraro',
    name: 'Luca Ferraro',
    nickname: 'Il Rosso',
    team: 'Scuderia Rossa',
    colors: ['#8b0000', '#ffdf6b'],
    accent: '#ff3b30',
    stats: { power: 4, luck: 2, grip: 3, reflex: 2 },
    bio: 'Cuando huele podio, se olvida del freno.',
  },
  {
    id: 'salgado',
    name: 'Nico Salgado',
    nickname: 'El Porteño',
    team: 'Riachuelo Motors',
    colors: ['#0b3d91', '#f5d020'],
    accent: '#ffcc00',
    stats: { power: 2, luck: 4, grip: 2, reflex: 3 },
    bio: 'Creció a tres cuadras de la cancha. Conoce cada adoquín del barrio.',
  },
  {
    id: 'ibarra',
    name: 'Sol Ibarra',
    nickname: 'La Tormenta',
    team: 'Papaya Works',
    colors: ['#ff6a00', '#1b1b1b'],
    accent: '#ff8a3d',
    stats: { power: 3, luck: 3, grip: 4, reflex: 2 },
    bio: 'Bajo lluvia es imposible de pasar. Bajo sol, también.',
  },
  {
    id: 'kovac',
    name: 'Ana Kovač',
    nickname: 'La Cirujana',
    team: 'Boreal Dynamics',
    colors: ['#123c2c', '#d7ff4f'],
    accent: '#b6ff00',
    stats: { power: 2, luck: 3, grip: 3, reflex: 5 },
    bio: 'Sus reflejos rompen cronómetros en los minijuegos de precisión.',
  },
];

export const driverById = (id: string): Driver =>
  DRIVERS.find((d) => d.id === id) ?? DRIVERS[0];
