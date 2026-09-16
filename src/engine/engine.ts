import { BOARD, GATE_TILE, START_TILE, TROPHY_SPOTS, tile } from './board';
import { driverById } from './drivers';
import { ITEMS } from './items';
import { MINIGAMES } from './minigameList';
import { nextFloat, nextInt, pick } from './rng';
import type {
  GameAction,
  GameLogEntry,
  GameState,
  ItemId,
  MinigameResult,
  Player,
} from './types';

export interface NewGameConfig {
  seed?: number;
  mode: 'quick' | 'party';
  players: { name: string; driverId: string; control: 'human' | 'cpu' }[];
}

const MINIGAME_PRIZES = [15, 10, 6, 3];

let logCounter = 0;

function log(state: GameState, text: string, tone: GameLogEntry['tone'] = 'neutral') {
  logCounter += 1;
  state.log.unshift({ id: logCounter, round: state.round, text, tone });
  state.log = state.log.slice(0, 40);
}

export function createGame(config: NewGameConfig): GameState {
  const totalRounds = config.mode === 'quick' ? 6 : 12;
  const state: GameState = {
    seed: config.seed ?? Math.floor(Math.random() * 1e9),
    rngCursor: 0,
    settings: {
      totalRounds,
      bomboneraEveryRounds: config.mode === 'quick' ? 3 : 4,
      starPrice: 20,
      mode: config.mode,
    },
    players: config.players.map((p, i) => ({
      id: i,
      name: p.name,
      driverId: p.driverId,
      control: p.control,
      tile: START_TILE,
      coins: 10,
      stars: 0,
      items: [],
      modifiers: {},
      distance: 0,
      minigameWins: 0,
      insideStadium: false,
      stadiumDone: false,
    })),
    current: 0,
    round: 1,
    phase: 'turn_start',
    trophyTile: 0,
    lastRoll: null,
    pendingPath: [],
    junctionOptions: [],
    stepsLeft: 0,
    bomboneraOpen: false,
    bomboneraVisits: 0,
    pendingMinigame: null,
    minigameIsRoundEnd: true,
    lastMinigameResults: null,
    log: [],
    winnerId: null,
  };
  state.trophyTile = moveTrophy(state, -1);
  log(state, 'Bandera verde en Caminito. ¡Arranca la partida!', 'epic');
  return state;
}

function moveTrophy(state: GameState, avoid: number): number {
  let spot = avoid;
  let guard = 0;
  while ((spot === avoid || spot === state.trophyTile) && guard < 20) {
    spot = pick(state, TROPHY_SPOTS);
    guard += 1;
  }
  return spot;
}

export const currentPlayer = (state: GameState): Player => state.players[state.current];

function addCoins(player: Player, amount: number) {
  player.coins = Math.max(0, player.coins + amount);
}

function grantItem(state: GameState, player: Player): ItemId {
  const ids = Object.keys(ITEMS) as ItemId[];
  const item = pick(state, ids);
  if (player.items.length < 3) player.items.push(item);
  return item;
}

/** Walks the board until the dice steps run out or a real choice appears. */
function walk(state: GameState) {
  const player = currentPlayer(state);
  const path: number[] = [];
  while (state.stepsLeft > 0) {
    const options = exitsFor(state, player.tile, player);
    if (options.length > 1) {
      state.junctionOptions = options;
      state.pendingPath = path;
      state.phase = path.length ? 'moving' : 'junction';
      return;
    }
    const target = options[0];
    player.tile = target;
    player.distance += 1;
    state.stepsLeft -= 1;
    path.push(target);
    if (target === START_TILE) {
      addCoins(player, 10);
      log(state, `${player.name} completa una vuelta al barrio: +10 monedas.`, 'good');
    }
    if (tile(target).inside && !player.insideStadium) {
      player.insideStadium = true;
      player.stadiumDone = false;
      state.bomboneraVisits += 1;
      log(state, `🏟️ ${player.name} baja por el túnel y entra a La Bombonera.`, 'epic');
    }
    if (!tile(target).inside && player.insideStadium) {
      player.insideStadium = false;
      player.stadiumDone = false;
      log(state, `${player.name} sale de La Bombonera y vuelve a las calles.`, 'neutral');
    }
    // The pitch always grabs the car: whoever crosses it stops and plays there.
    if (tile(target).kind === 'stadium' && !player.stadiumDone) {
      state.stepsLeft = 0;
    }
  }
  state.junctionOptions = [];
  state.pendingPath = path;
  state.phase = 'moving';
}

/**
 * Branching rules. The stadium is not optional: once the gate is open every car
 * that reaches it is pulled inside, plays on the pitch and only then drives out.
 */
function exitsFor(state: GameState, from: number, player: Player): number[] {
  const t = tile(from);
  if (t.next.length < 2) return t.next;
  if (from === GATE_TILE) return [state.bomboneraOpen ? t.next[1] : t.next[0]];
  if (t.inside) return [player.stadiumDone ? t.next[1] : t.next[0]];
  return t.next;
}

function startTurn(state: GameState) {
  const player = currentPlayer(state);
  state.lastRoll = null;
  state.pendingPath = [];
  state.junctionOptions = [];
  if (player.modifiers.skipTurn) {
    player.modifiers.skipTurn = false;
    log(state, `${player.name} quedó trabado en la obra y pierde el turno.`, 'bad');
    endTurn(state);
    return;
  }
  state.phase = 'awaiting_roll';
}

function roll(state: GameState) {
  const player = currentPlayer(state);
  const driver = driverById(player.driverId);
  let value = 1 + nextInt(state, 6);
  if (player.modifiers.doubleDice) {
    value += 1 + nextInt(state, 6);
    player.modifiers.doubleDice = false;
    log(state, `${player.name} usa Doble Dado.`, 'good');
  }
  if (value <= 2 && nextFloat(state) < driver.stats.power / 12) {
    value += 1;
  }
  if (player.modifiers.turbo) {
    value += 4;
    player.modifiers.turbo = false;
    log(state, `${player.name} activa el turbo: +4 casilleros.`, 'good');
  }
  state.lastRoll = value;
  state.stepsLeft = value;
  state.phase = 'rolling';
}

function resolveTile(state: GameState) {
  const player = currentPlayer(state);
  const t = tile(player.tile);
  const multiplier = player.insideStadium ? 2 : 1;

  if (player.tile === state.trophyTile) {
    if (player.coins >= state.settings.starPrice) {
      player.coins -= state.settings.starPrice;
      player.stars += 1;
      state.trophyTile = moveTrophy(state, player.tile);
      log(state, `🏆 ${player.name} compra una estrella. ¡El trofeo se mueve!`, 'epic');
    } else {
      log(state, `${player.name} llega al trofeo pero no le alcanzan las monedas.`, 'bad');
    }
    state.phase = 'resolving';
    return;
  }

  switch (t.kind) {
    case 'coin': {
      const amount = 3 * multiplier;
      addCoins(player, amount);
      log(state, `${player.name} junta ${amount} monedas.`, 'good');
      break;
    }
    case 'hazard': {
      const amount = 4;
      addCoins(player, -amount);
      log(state, `${player.name} pincha una goma: -${amount} monedas.`, 'bad');
      break;
    }
    case 'item':
    case 'pit': {
      const item = grantItem(state, player);
      addCoins(player, t.kind === 'pit' ? 2 : 0);
      log(state, `${player.name} consigue ${ITEMS[item].icon} ${ITEMS[item].name}.`, 'good');
      break;
    }
    case 'boost': {
      state.stepsLeft = 2;
      log(state, `${player.name} agarra una recta rápida: +2 casilleros.`, 'good');
      walk(state);
      state.phase = 'moving';
      return;
    }
    case 'event': {
      applyRandomEvent(state, player);
      break;
    }
    case 'duel': {
      const rival = closestRival(state, player);
      if (rival) {
        state.pendingMinigame = 'duelo';
        state.minigameIsRoundEnd = false;
        log(state, `⚔️ ${player.name} desafía a ${rival.name} a un duelo.`, 'epic');
        state.phase = 'minigame_intro';
        return;
      }
      break;
    }
    case 'gate': {
      if (state.bomboneraOpen) {
        log(state, `${player.name} se para frente al portón de La Bombonera…`, 'epic');
      }
      break;
    }
    case 'stadium': {
      state.pendingMinigame = pick(
        state,
        MINIGAMES.filter((m) => m.venue === 'stadium').map((m) => m.id),
      );
      state.minigameIsRoundEnd = false;
      player.stadiumDone = true;
      log(state, `🏟️ ${player.name} pisa el césped. ¡Minijuego en la cancha!`, 'epic');
      state.phase = 'minigame_intro';
      return;
    }
    default:
      break;
  }
  state.phase = 'resolving';
}

function closestRival(state: GameState, player: Player): Player | null {
  const rivals = state.players.filter((p) => p.id !== player.id);
  if (!rivals.length) return null;
  const pos = tile(player.tile).pos;
  return rivals.reduce((best, p) => {
    const d = (a: Player) => {
      const q = tile(a.tile).pos;
      return (q[0] - pos[0]) ** 2 + (q[2] - pos[2]) ** 2;
    };
    return d(p) < d(best) ? p : best;
  }, rivals[0]);
}

function applyRandomEvent(state: GameState, player: Player) {
  const roll = nextInt(state, 8);
  switch (roll) {
    case 0: {
      addCoins(player, 8);
      log(state, `Los turistas de Caminito le tiran monedas a ${player.name}: +8.`, 'good');
      break;
    }
    case 1: {
      const rival = closestRival(state, player);
      if (rival) {
        const stolen = Math.min(6, rival.coins);
        addCoins(rival, -stolen);
        addCoins(player, stolen);
        log(state, `${player.name} le gana un sprint a ${rival.name} y le saca ${stolen} monedas.`, 'good');
      }
      break;
    }
    case 2: {
      addCoins(player, -5);
      log(state, `Multa por estacionar en la vereda: ${player.name} pierde 5 monedas.`, 'bad');
      break;
    }
    case 3: {
      const item = grantItem(state, player);
      log(state, `Un murguero le regala ${ITEMS[item].name} a ${player.name}.`, 'good');
      break;
    }
    case 4: {
      state.trophyTile = moveTrophy(state, state.trophyTile);
      log(state, 'Viento del Riachuelo: ¡el trofeo cambia de lugar!', 'epic');
      break;
    }
    case 5: {
      state.stepsLeft = 3;
      log(state, `${player.name} se cuelga de un colectivo: +3 casilleros.`, 'good');
      walk(state);
      return;
    }
    case 6: {
      const leader = [...state.players].sort((a, b) => b.coins - a.coins)[0];
      if (leader.id !== player.id) {
        const share = Math.min(7, leader.coins);
        addCoins(leader, -share);
        addCoins(player, share);
        log(state, `Solidaridad del barrio: ${leader.name} le pasa ${share} monedas a ${player.name}.`, 'good');
      } else {
        addCoins(player, 4);
        log(state, `${player.name} firma autógrafos: +4 monedas.`, 'good');
      }
      break;
    }
    default: {
      player.modifiers.turbo = true;
      log(state, `${player.name} carga turbo para el próximo turno.`, 'good');
    }
  }
}

function playItem(state: GameState, item: ItemId, targetId?: number) {
  const player = currentPlayer(state);
  const index = player.items.indexOf(item);
  if (index < 0) return;
  player.items.splice(index, 1);
  const target = state.players.find((p) => p.id === targetId);
  switch (item) {
    case 'turbo':
      player.modifiers.turbo = true;
      log(state, `${player.name} arma el turbo.`, 'good');
      break;
    case 'doble_dado':
      player.modifiers.doubleDice = true;
      log(state, `${player.name} prepara el doble dado.`, 'good');
      break;
    case 'gancho': {
      if (target) {
        const stolen = Math.min(10, target.coins);
        addCoins(target, -stolen);
        addCoins(player, stolen);
        log(state, `${player.name} le engancha ${stolen} monedas a ${target.name}.`, 'bad');
      }
      break;
    }
    case 'barrera': {
      if (target) {
        target.modifiers.skipTurn = true;
        log(state, `${player.name} bloquea el camino de ${target.name}.`, 'bad');
      }
      break;
    }
    case 'bengala': {
      player.tile = state.trophyTile;
      log(state, `${player.name} dispara una bengala y aparece junto al trofeo.`, 'epic');
      break;
    }
    case 'bandera_roja': {
      if (target) {
        for (let i = 0; i < 5; i++) {
          const back = BOARD.findIndex((t) => t.next.includes(target.tile));
          if (back >= 0) target.tile = back;
        }
        log(state, `Bandera roja para ${target.name}: retrocede 5 casilleros.`, 'bad');
      }
      break;
    }
    case 'imán': {
      const richest = [...state.players]
        .filter((p) => p.id !== player.id && p.items.length > 0)
        .sort((a, b) => b.items.length - a.items.length)[0];
      if (richest) {
        const stolen = richest.items.pop() as ItemId;
        if (player.items.length < 3) player.items.push(stolen);
        log(state, `${player.name} le roba ${ITEMS[stolen].name} a ${richest.name}.`, 'bad');
      }
      break;
    }
  }
}

function endTurn(state: GameState) {
  state.lastRoll = null;
  state.pendingPath = [];
  state.junctionOptions = [];
  const wasLast = state.current === state.players.length - 1;
  state.current = (state.current + 1) % state.players.length;
  if (!wasLast) {
    startTurn(state);
    return;
  }
  // Round finished: everybody plays a minigame.
  const insideAnyone = state.players.some((p) => p.insideStadium);
  const pool = MINIGAMES.filter((m) =>
    insideAnyone ? m.venue === 'stadium' : m.venue !== 'stadium',
  ).filter((m) => m.format === 'ffa');
  state.pendingMinigame = pick(state, pool).id;
  state.minigameIsRoundEnd = true;
  state.phase = 'minigame_intro';
}

function afterMinigame(state: GameState) {
  state.pendingMinigame = null;
  // Duel and pitch minigames fire mid turn: the player still has to finish it.
  if (!state.minigameIsRoundEnd) {
    state.phase = 'resolving';
    return;
  }
  state.round += 1;
  if (state.round > state.settings.totalRounds) {
    finishGame(state);
    return;
  }
  if (state.round % state.settings.bomboneraEveryRounds === 0 && !state.bomboneraOpen) {
    state.bomboneraOpen = true;
    // The opening drags the whole grid down the tunnel so nobody misses the
    // stadium act; afterwards the gate stays open for anyone lapping past it.
    const tunnelEntry = tile(GATE_TILE).next[1];
    for (const p of state.players) {
      if (p.insideStadium) continue;
      p.tile = tunnelEntry;
      p.insideStadium = true;
      p.stadiumDone = false;
      state.bomboneraVisits += 1;
    }
    state.phase = 'bombonera_cutscene';
    log(state, '🏟️ ¡SE ABRE EL PORTÓN DE LA BOMBONERA! Todos al túnel.', 'epic');
    return;
  }
  state.current = 0;
  state.phase = 'round_end';
}

function finishGame(state: GameState) {
  const ranked = [...state.players].sort(
    (a, b) => b.stars - a.stars || b.coins - a.coins || b.minigameWins - a.minigameWins,
  );
  // Bonus stars keep the ending tense, the way a party game should.
  const richest = [...state.players].sort((a, b) => b.coins - a.coins)[0];
  const mgKing = [...state.players].sort((a, b) => b.minigameWins - a.minigameWins)[0];
  richest.stars += 1;
  mgKing.stars += 1;
  log(state, `⭐ Estrella bonus por monedas: ${richest.name}.`, 'epic');
  log(state, `⭐ Estrella bonus por minijuegos: ${mgKing.name}.`, 'epic');
  const finalRank = [...state.players].sort((a, b) => b.stars - a.stars || b.coins - a.coins);
  state.winnerId = finalRank[0].id;
  void ranked;
  state.phase = 'game_over';
  log(state, `🏁 ¡${finalRank[0].name} es campeón de La Boca!`, 'epic');
}

export function reduce(state: GameState, action: GameAction): GameState {
  const next: GameState = structuredClone(state);
  switch (action.type) {
    case 'START_TURN':
      startTurn(next);
      break;
    case 'USE_ITEM':
      playItem(next, action.item, action.targetId);
      break;
    case 'ROLL':
      if (next.phase === 'awaiting_roll') {
        roll(next);
        walk(next);
      }
      break;
    case 'STEP_DONE': {
      next.pendingPath = [];
      if (next.stepsLeft > 0 && next.junctionOptions.length > 1) {
        next.phase = 'junction';
      } else {
        resolveTile(next);
      }
      break;
    }
    case 'CHOOSE_PATH': {
      const player = currentPlayer(next);
      player.tile = action.tile;
      player.distance += 1;
      next.stepsLeft = Math.max(0, next.stepsLeft - 1);
      next.junctionOptions = [];
      next.pendingPath = [action.tile];
      if (next.stepsLeft > 0) walk(next);
      else next.phase = 'moving';
      break;
    }
    case 'RESOLVE_TILE':
      resolveTile(next);
      break;
    case 'END_TURN':
      endTurn(next);
      break;
    case 'START_MINIGAME':
      next.phase = 'minigame';
      break;
    case 'FINISH_MINIGAME': {
      const meta = MINIGAMES.find((m) => m.id === next.pendingMinigame);
      const sorted = [...action.scores].sort((a, b) =>
        meta?.lowerIsBetter ? a.score - b.score : b.score - a.score,
      );
      const results: MinigameResult[] = sorted.map((s, i) => ({
        playerId: s.playerId,
        score: s.score,
        rank: i + 1,
        coins: MINIGAME_PRIZES[Math.min(i, MINIGAME_PRIZES.length - 1)],
      }));
      results.forEach((r) => {
        const p = next.players.find((pl) => pl.id === r.playerId);
        if (!p) return;
        addCoins(p, r.coins);
        if (r.rank === 1) p.minigameWins += 1;
      });
      next.lastMinigameResults = results;
      const champ = next.players.find((p) => p.id === results[0].playerId);
      if (champ) log(next, `🎮 ${champ.name} gana el minijuego (+${results[0].coins} monedas).`, 'good');
      next.phase = 'minigame_results';
      break;
    }
    case 'CLOSE_RESULTS':
      afterMinigame(next);
      break;
    case 'CONTINUE': {
      if (next.phase === 'bombonera_cutscene') {
        next.current = 0;
        next.phase = 'round_end';
        break;
      }
      if (next.phase === 'round_end') {
        startTurn(next);
        break;
      }
      if (next.phase === 'resolving') {
        endTurn(next);
        break;
      }
      break;
    }
    default:
      break;
  }
  return next;
}

export function ranking(state: GameState): Player[] {
  return [...state.players].sort(
    (a, b) => b.stars - a.stars || b.coins - a.coins || b.minigameWins - a.minigameWins,
  );
}
