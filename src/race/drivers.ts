export interface DriverStats {
  /** Top speed. */
  speed: number;
  /** How quickly the car reaches top speed. */
  accel: number;
  /** Cornering bite. */
  handling: number;
  /** Mini turbo charge rate while drifting. */
  drift: number;
  /** How fast the car recovers from spins and mud. */
  stamina: number;
}

export interface Driver {
  id: string;
  name: string;
  nickname: string;
  team: string;
  /** Body paint and secondary colour. */
  colors: [string, string];
  accent: string;
  stats: DriverStats;
  bio: string;
}

/**
 * Original characters, not real world personalities. Replacing this array (or
 * loading it from a server) is the only change needed to ship a licensed grid.
 */
export const DRIVERS: Driver[] = [
  {
    id: 'voss',
    name: 'Max Voss',
    nickname: 'El Relámpago',
    team: 'Aurora Racing',
    colors: ['#12284b', '#ffd400'],
    accent: '#ff2a2a',
    stats: { speed: 5, accel: 3, handling: 3, drift: 4, stamina: 3 },
    bio: 'Frena más tarde que todos y no le tiembla el pulso en la curva del puerto.',
  },
  {
    id: 'mensah',
    name: 'Kofi Mensah',
    nickname: 'El Metrónomo',
    team: 'Silverline GP',
    colors: ['#0d3b36', '#9ff5e2'],
    accent: '#00d1a0',
    stats: { speed: 4, accel: 4, handling: 4, drift: 3, stamina: 4 },
    bio: 'Da siempre la misma vuelta, décima más, décima menos.',
  },
  {
    id: 'ferraro',
    name: 'Luca Ferraro',
    nickname: 'Il Rosso',
    team: 'Scuderia Rossa',
    colors: ['#8b0000', '#ffdf6b'],
    accent: '#ff3b30',
    stats: { speed: 5, accel: 4, handling: 2, drift: 3, stamina: 3 },
    bio: 'Motor de sobra, paciencia ninguna.',
  },
  {
    id: 'salgado',
    name: 'Nico Salgado',
    nickname: 'El Porteño',
    team: 'Riachuelo Motors',
    colors: ['#0b3d91', '#f5d020'],
    accent: '#ffcc00',
    stats: { speed: 3, accel: 4, handling: 5, drift: 4, stamina: 3 },
    bio: 'Creció a tres cuadras de la cancha y conoce cada adoquín flojo.',
  },
  {
    id: 'ibarra',
    name: 'Sol Ibarra',
    nickname: 'La Tormenta',
    team: 'Papaya Works',
    colors: ['#ff6a00', '#1b1b1b'],
    accent: '#ff8a3d',
    stats: { speed: 3, accel: 3, handling: 5, drift: 5, stamina: 4 },
    bio: 'Con la pista mojada es imposible de pasar.',
  },
  {
    id: 'kovac',
    name: 'Ana Kovač',
    nickname: 'La Cirujana',
    team: 'Boreal Dynamics',
    colors: ['#123c2c', '#d7ff4f'],
    accent: '#b6ff00',
    stats: { speed: 4, accel: 5, handling: 4, drift: 3, stamina: 4 },
    bio: 'Sale de cada curva con el auto perfectamente apuntado.',
  },
  {
    id: 'okafor',
    name: 'Tayo Okafor',
    nickname: 'El Portuario',
    team: 'Dársena Sur',
    colors: ['#2b2d42', '#8ecae6'],
    accent: '#4cc9f0',
    stats: { speed: 4, accel: 3, handling: 3, drift: 5, stamina: 5 },
    bio: 'Aprendió a derrapar entre contenedores y grúas.',
  },
  {
    id: 'brambilla',
    name: 'Emi Brambilla',
    nickname: 'La Hincha',
    team: 'Xeneize Motorsport',
    colors: ['#0b4ea2', '#ffd200'],
    accent: '#ffe066',
    stats: { speed: 3, accel: 5, handling: 4, drift: 4, stamina: 4 },
    bio: 'Cuando el circuito entra a la cancha, acelera como si jugara de local.',
  },
];

export const driverById = (id: string): Driver => DRIVERS.find((d) => d.id === id) ?? DRIVERS[0];
