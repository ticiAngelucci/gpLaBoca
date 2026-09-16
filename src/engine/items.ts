import type { ItemDef, ItemId } from './types';

export const ITEMS: Record<ItemId, ItemDef> = {
  turbo: {
    id: 'turbo',
    name: 'Turbo de Caminito',
    icon: '🔥',
    description: '+4 casilleros al próximo dado.',
    target: 'self',
    price: 8,
  },
  doble_dado: {
    id: 'doble_dado',
    name: 'Doble Dado',
    icon: '🎲',
    description: 'Tirás dos dados y sumás los dos.',
    target: 'self',
    price: 10,
  },
  gancho: {
    id: 'gancho',
    name: 'Gancho del Riachuelo',
    icon: '🪝',
    description: 'Le robás 10 monedas a un rival.',
    target: 'rival',
    price: 12,
  },
  barrera: {
    id: 'barrera',
    name: 'Barrera de Obra',
    icon: '🚧',
    description: 'Un rival pierde su próximo turno.',
    target: 'rival',
    price: 14,
  },
  bengala: {
    id: 'bengala',
    name: 'Bengala de Tribuna',
    icon: '🎆',
    description: 'Te teletransportás directo al trofeo.',
    target: 'self',
    price: 20,
  },
  bandera_roja: {
    id: 'bandera_roja',
    name: 'Bandera Roja',
    icon: '🚩',
    description: 'Mandás a un rival 5 casilleros atrás.',
    target: 'rival',
    price: 12,
  },
  imán: {
    id: 'imán',
    name: 'Imán de Boxes',
    icon: '🧲',
    description: 'Robás un objeto al rival con más objetos.',
    target: 'rival',
    price: 9,
  },
};

export const ITEM_LIST = Object.values(ITEMS);
