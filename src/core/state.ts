import { DEFAULT_BOMB_RANGE, DEFAULT_MAX_BOMBS } from '../config/bombs';
import { ARENA_SYMMETRIC, DEFAULT_SEED } from '../config/arena';
import { centerSpawn, createArena, spawnCells } from './arena';
import type { ArenaOptions } from './arena';
import { createHazards } from './hazards';
import type { HazardOptions } from './hazards';
import { generateHiddenItems } from './items';
import { createRound } from './round';
import type { Cell, GameEvent, GameState, PlayerId, PlayerState } from './types';

/**
 * Como os jogadores se dividem em times:
 * - free: cada um por si (o time de cada um é o seu id);
 * - versus: todas as pessoas no time 1 contra todo o computador no time 2;
 * - mixed: times misturados — jogadores 1, 3 e 5 no time 1, jogadores 2 e 4 no time 2 (pessoas e computador juntos).
 */
export type TeamMode = 'free' | 'versus' | 'mixed';
export const TEAM_MODES: readonly TeamMode[] = ['free', 'versus', 'mixed'];

/** Time de cada vaga (índice 0 = jogador 1). Modo sem adversário possível (ex.: só pessoas no versus) vira "cada um por si". */
export function assignTeams(mode: TeamMode, humans: number, total: number): number[] {
  const ids = Array.from({ length: total }, (_, i) => i + 1);
  if (mode === 'versus' && humans < total) return ids.map((id) => (id <= humans ? 1 : 2));
  if (mode === 'mixed' && total > 2) return ids.map((id) => (id % 2 === 1 ? 1 : 2));
  return ids;
}

/** Cria um jogador vivo, parado no centro da célula indicada. Sem informar o time, ele joga por conta própria. */
export function createPlayer(id: PlayerId, cell: Cell, team: number = id, cpu = false): PlayerState {
  return {
    id,
    team,
    cpu,
    x: cell.col + 0.5,
    y: cell.row + 0.5,
    alive: true,
    bombRange: DEFAULT_BOMB_RANGE,
    maxBombs: DEFAULT_MAX_BOMBS,
    speedBonus: 0,
    speedScale: 1,
    facing: 'down',
    canKick: false,
    piercing: false,
    remote: false,
    canThrow: false,
    ghostTicks: 0,
    invertTicks: 0,
    shieldTicks: 0,
    vest: false,
    heroTicks: 0,
    spawn: { col: cell.col, row: cell.row },
    sideline: null,
    sidelineCooldown: 0,
  };
}

export interface GameOptions extends ArenaOptions {
  /** Quantos jogadores nascem: 1 (canto superior esquerdo) ou 2 (o segundo, no canto oposto). Padrão: 1. */
  /** Pessoas na partida, de 1 a 5 (as de 3 em diante jogam com controle de videogame). */
  players?: 1 | 2 | 3 | 4 | 5;
  /** Inimigos do computador (0 a 3). Nascem nos cantos que sobram (o time deles vem de `teams`). Padrão: 0. */
  enemies?: 0 | 1 | 2 | 3 | 4;
  /** Esconder itens em parte dos blocos (padrão: sim). Desligar deixa a partida igual à das Etapas 1–6. */
  items?: boolean;
  /** Duração da rodada em passos. Padrão: ROUND_TIME_TICKS (3 minutos). Útil para testes. */
  roundTicks?: number;
  /** Quem é eliminado joga das laterais e pode voltar (padrão: sim). */
  sideline?: boolean;
  /** Multiplicador da velocidade base dos inimigos do computador (1 = igual à das pessoas). Padrão: 1. */
  enemySpeedScale?: number;
  /** Divisão em times (padrão: cada um por si). */
  teams?: TeamMode;
  /**
   * Time de cada vaga, escolhido na tela de times (índice 0 = jogador 1). Quando informado (e do tamanho certo),
   * vale no lugar de `teams`. Convenção: 1 = Time Azul, 2 = Time Vermelho, e quem joga sem time usa um número
   * próprio (veja `SOLO_TEAM_BASE`).
   */
  teamAssignment?: readonly number[];
  /** Perigos do terreno da arena (areia movediça, dardos, esfinge). Padrão: nenhum. */
  hazards?: HazardOptions;
}

/** Quem joga sem time recebe o time SOLO_TEAM_BASE + id (nunca colide com os times 1 e 2). */
export const SOLO_TEAM_BASE = 10;

/** Ordem: jogador 1 em cima à esquerda, jogador 2 no canto oposto, depois os outros dois cantos e, por fim, o centro. */
const SPAWN_ORDER = [0, 3, 1, 2, 4] as const;

/** Máximo de jogadores na arena, somando pessoas e computador. */
export const MAX_PLAYERS = 5;

/** Cria o estado inicial da partida: arena, jogadores (humanos e inimigos) vivos nos cantos e tudo o mais zerado. */
export function createGameState(options: GameOptions = {}): GameState {
  const humans = Math.min(MAX_PLAYERS, Math.max(1, options.players ?? 1));
  const enemies = Math.min(options.enemies ?? 0, MAX_PLAYERS - humans);
  // Com 5 jogadores, o quinto nasce no centro da arena (que então ganha uma zona livre).
  const arena = createArena({ ...options, centerSpawn: humans + enemies >= MAX_PLAYERS });
  const hazards = createHazards(arena, options.hazards, options.seed ?? DEFAULT_SEED);
  const spawns = [...spawnCells(arena.cols, arena.rows), centerSpawn(arena.cols, arena.rows)];
  const total = humans + enemies;
  const teams = options.teamAssignment?.length === total ? [...options.teamAssignment] : assignTeams(options.teams ?? 'free', humans, total);
  const players: PlayerState[] = [];
  for (let i = 0; i < humans + enemies; i++) {
    const id = (i + 1) as PlayerId;
    const corner = spawns[SPAWN_ORDER[i]!]!;
    const player = createPlayer(id, corner, teams[i]!, i >= humans);
    if (i >= humans) player.speedScale = options.enemySpeedScale ?? 1;
    players.push(player);
  }

  return {
    arena,
    players,
    bombs: [],
    flames: [],
    items: [],
    ...(hazards && { hazards }),
    hiddenItems:
      options.items === false
        ? []
        : generateHiddenItems(arena, options.seed ?? DEFAULT_SEED, options.symmetric ?? ARENA_SYMMETRIC),
    events: [],
    round: createRound(options.roundTicks),
    sidelineEnabled: options.sideline ?? true,
    tick: 0,
  };
}

/** Entrega os eventos acumulados e esvazia a lista. Quem desenha e toca sons chama isto depois dos passos. */
export function drainEvents(state: GameState): GameEvent[] {
  return state.events.splice(0, state.events.length);
}
