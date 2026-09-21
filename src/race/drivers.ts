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
  /** Optional GLB under public/models, replacing the procedural car. */
  model?: string;
}

/** 2026-inspired roster plus one guest character. */
export const DRIVERS: Driver[] = [
  {
    id: 'verstappen',
    name: 'Max Verstappen',
    nickname: 'Mad Max',
    team: 'Red Bull Racing',
    colors: ['#12284b', '#ffd400'],
    accent: '#ff2a2a',
    stats: { speed: 5, accel: 3, handling: 3, drift: 4, stamina: 3 },
    bio: 'Cuatro veces campeón del mundo y especialista en llevar cada frenada al límite.',
    model: 'rb19.glb',
  },
  {
    id: 'russell',
    name: 'George Russell',
    nickname: 'Mr. Consistency',
    team: 'Mercedes',
    colors: ['#111820', '#00d2be'],
    accent: '#00d1a0',
    stats: { speed: 4, accel: 4, handling: 4, drift: 3, stamina: 4 },
    bio: 'Preciso, constante y siempre listo para aprovechar una oportunidad.',
  },
  {
    id: 'leclerc',
    name: 'Charles Leclerc',
    nickname: 'Il Predestinato',
    team: 'Ferrari',
    colors: ['#b40000', '#ffd36a'],
    accent: '#ff3b30',
    stats: { speed: 5, accel: 4, handling: 2, drift: 3, stamina: 3 },
    bio: 'Velocidad pura y una vuelta de clasificación siempre al ataque.',
  },
  {
    id: 'colapinto',
    name: 'Franco Colapinto',
    nickname: 'El argentino',
    team: 'Alpine',
    colors: ['#0868d7', '#ff87bc'],
    accent: '#ff8ac7',
    stats: { speed: 3, accel: 4, handling: 5, drift: 4, stamina: 3 },
    bio: 'Talento argentino, manejo agresivo y reflejos para encontrar huecos imposibles.',
    model: 'alpine.glb',
  },
  {
    id: 'norris',
    name: 'Lando Norris',
    nickname: 'Last Lap Lando',
    team: 'McLaren',
    colors: ['#ff6a00', '#1b1b1b'],
    accent: '#ff8a3d',
    stats: { speed: 3, accel: 3, handling: 5, drift: 5, stamina: 4 },
    bio: 'Campeón 2025, rapidísimo en curva y con ritmo para atacar toda la carrera.',
  },
  {
    id: 'alonso',
    name: 'Fernando Alonso',
    nickname: 'Magic',
    team: 'Aston Martin',
    colors: ['#123c2c', '#d7ff4f'],
    accent: '#b6ff00',
    stats: { speed: 4, accel: 5, handling: 4, drift: 3, stamina: 4 },
    bio: 'Experiencia, lectura de carrera y defensa milimétrica en cada duelo.',
  },
  {
    id: 'sainz',
    name: 'Carlos Sainz',
    nickname: 'Smooth Operator',
    team: 'Williams',
    colors: ['#071f5b', '#18a8e8'],
    accent: '#4cc9f0',
    stats: { speed: 4, accel: 3, handling: 3, drift: 5, stamina: 5 },
    bio: 'Inteligente, metódico y especialmente fuerte cuando cambia la pista.',
  },
  {
    id: 'perez',
    name: 'Sergio Pérez',
    nickname: 'Checo',
    team: 'Cadillac',
    colors: ['#111827', '#e8e8e8'],
    accent: '#4f8cff',
    stats: { speed: 3, accel: 5, handling: 4, drift: 4, stamina: 4 },
    bio: 'Especialista en cuidar neumáticos y remontar cuando la carrera se complica.',
  },
  {
    id: 'mcqueen',
    name: 'Rayo McQueen',
    nickname: 'El 95',
    team: 'Rust-eze Racing Team',
    colors: ['#d71920', '#ffc928'],
    accent: '#ffdf34',
    stats: { speed: 5, accel: 5, handling: 4, drift: 4, stamina: 5 },
    bio: 'Velocidad. Soy veloz. Invitado especial para correr por las calles de La Boca.',
    model: 'lightning_mcqueen.glb',
  },
];

export const driverById = (id: string): Driver => DRIVERS.find((d) => d.id === id) ?? DRIVERS[0];
