export type ItemId = 'turbo' | 'escudo' | 'aceite' | 'bengala' | 'barro' | 'atajo' | 'tormenta';

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  desc: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  turbo: {
    id: 'turbo',
    name: 'Turbo del Riachuelo',
    icon: '🔥',
    desc: 'Empujón de nafta rara durante tres segundos.',
  },
  escudo: {
    id: 'escudo',
    name: 'Escudo de chapa',
    icon: '🛡️',
    desc: 'Rebota el próximo golpe que te toque.',
  },
  aceite: {
    id: 'aceite',
    name: 'Aceite del taller',
    icon: '🛢️',
    desc: 'Mancha resbalosa que dejás atrás tuyo.',
  },
  bengala: {
    id: 'bengala',
    name: 'Bengala de tribuna',
    icon: '🎆',
    desc: 'Persigue al auto de adelante y lo hace trompear.',
  },
  barro: {
    id: 'barro',
    name: 'Bomba de barro',
    icon: '💥',
    desc: 'Salpica a todos los que van adelante y les tapa la visión.',
  },
  atajo: {
    id: 'atajo',
    name: 'Pase de atajo',
    icon: '🧭',
    desc: 'Cinco segundos sin perder agarre fuera de la pista.',
  },
  tormenta: {
    id: 'tormenta',
    name: 'Tormenta de Santa Rosa',
    icon: '🌧️',
    desc: 'Se larga a llover y la pista se pone difícil para todos.',
  },
};

/** Weighted draw: the further back you are, the better the odds. */
export function drawItem(position: number, total: number, rand: () => number): ItemId {
  const behind = total > 1 ? (position - 1) / (total - 1) : 0;
  const table: [ItemId, number][] = [
    ['turbo', 0.9 + behind * 1.4],
    ['escudo', 0.7 + behind * 0.4],
    ['aceite', 1.1 - behind * 0.5],
    ['bengala', 0.25 + behind * 1.6],
    ['barro', 0.15 + behind * 1.1],
    ['atajo', 0.4 + behind * 0.6],
    ['tormenta', behind > 0.6 ? 0.35 : 0.05],
  ];
  const total_w = table.reduce((a, [, w]) => a + w, 0);
  let roll = rand() * total_w;
  for (const [id, w] of table) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return 'turbo';
}
