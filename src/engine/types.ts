export type TileKind =
  | 'normal'
  | 'coin'
  | 'hazard'
  | 'event'
  | 'item'
  | 'boost'
  | 'pit'
  | 'duel'
  | 'trophy'
  | 'junction'
  | 'gate'
  | 'stadium'
  | 'start';

export interface Tile {
  id: number;
  kind: TileKind;
  /** World position on the board, in metres. y is ground height. */
  pos: [number, number, number];
  /** Outgoing connections. More than one means the player picks a path. */
  next: number[];
  /** Human readable landmark shown in the HUD when a car stops here. */
  label?: string;
  /** Marks tiles that only exist inside La Bombonera. */
  inside?: boolean;
  /** Coins granted (or removed, when negative) when landing. */
  coins?: number;
  /** Tiles the player is teleported to (shortcuts, tunnels). */
  warpTo?: number;
}

export interface DriverStats {
  /** Extra pips added to low dice rolls. */
  power: number;
  /** Chance of rolling again after a 6. */
  luck: number;
  /** Advantage inside driving minigames. */
  grip: number;
  /** Advantage inside reflex minigames. */
  reflex: number;
}

export interface Driver {
  id: string;
  name: string;
  nickname: string;
  team: string;
  /** Primary / secondary livery colours. */
  colors: [string, string];
  accent: string;
  stats: DriverStats;
  bio: string;
}

export type ItemId =
  | 'turbo'
  | 'doble_dado'
  | 'gancho'
  | 'barrera'
  | 'bengala'
  | 'bandera_roja'
  | 'imán';

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  description: string;
  /** Items played before rolling vs. items played on another player. */
  target: 'self' | 'rival';
  price: number;
}

export interface Player {
  id: number;
  name: string;
  driverId: string;
  /** 'human' players are driven from the keyboard, 'cpu' by the bot. */
  control: 'human' | 'cpu';
  tile: number;
  coins: number;
  stars: number;
  items: ItemId[];
  /** Set while a turbo / double dice is armed. */
  modifiers: { turbo?: boolean; doubleDice?: boolean; skipTurn?: boolean };
  /** Tiles visited this game, used for the stats screen. */
  distance: number;
  minigameWins: number;
  insideStadium: boolean;
  /** True once the pitch minigame of this stadium visit has been played. */
  stadiumDone: boolean;
}

export type Phase =
  | 'intro'
  | 'turn_start'
  | 'awaiting_roll'
  | 'rolling'
  | 'moving'
  | 'junction'
  | 'resolving'
  | 'minigame_intro'
  | 'minigame'
  | 'minigame_results'
  | 'round_end'
  | 'bombonera_cutscene'
  | 'game_over';

export interface GameLogEntry {
  id: number;
  round: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'epic';
}

export interface GameSettings {
  totalRounds: number;
  /** Every N rounds the players are pulled inside La Bombonera. */
  bomboneraEveryRounds: number;
  starPrice: number;
  mode: 'quick' | 'party';
}

export interface GameState {
  seed: number;
  rngCursor: number;
  settings: GameSettings;
  players: Player[];
  current: number;
  round: number;
  phase: Phase;
  /** Tile the trophy currently sits on. */
  trophyTile: number;
  /** Pending dice result for the presentation layer. */
  lastRoll: number | null;
  /** Path the pawn is walking through, consumed by the renderer. */
  pendingPath: number[];
  /** Options offered to the player when standing on a junction. */
  junctionOptions: number[];
  /** Steps still to walk once a junction is resolved. */
  stepsLeft: number;
  bomboneraOpen: boolean;
  bomboneraVisits: number;
  pendingMinigame: string | null;
  /** False when a duel or pitch game fired in the middle of somebody's turn. */
  minigameIsRoundEnd: boolean;
  lastMinigameResults: MinigameResult[] | null;
  log: GameLogEntry[];
  winnerId: number | null;
}

export interface MinigameResult {
  playerId: number;
  score: number;
  rank: number;
  coins: number;
}

export type GameAction =
  | { type: 'START_TURN' }
  | { type: 'USE_ITEM'; item: ItemId; targetId?: number }
  | { type: 'ROLL' }
  | { type: 'STEP_DONE' }
  | { type: 'CHOOSE_PATH'; tile: number }
  | { type: 'RESOLVE_TILE' }
  | { type: 'BUY_STAR'; buy: boolean }
  | { type: 'END_TURN' }
  | { type: 'START_MINIGAME' }
  | { type: 'FINISH_MINIGAME'; scores: { playerId: number; score: number }[] }
  | { type: 'CLOSE_RESULTS' }
  | { type: 'CONTINUE' };
