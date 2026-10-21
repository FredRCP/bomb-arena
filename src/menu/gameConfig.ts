import { AI_SETTINGS, DEFAULT_AI_DIFFICULTY } from '../config/ai';
import type { AiDifficulty } from '../config/ai';
import { DEFAULT_SEED } from '../config/arena';
import { TEAM_MODES } from '../core/state';
import type { TeamMode } from '../core/state';

export const DEFAULT_TEAMS: TeamMode = 'free';

// Configuração de uma partida: o que o menu escolhe ou o que o endereço pede (?players=1&enemies=3...).
// Sem Phaser: recebe o texto do endereço como parâmetro, então é testável.

export interface GameConfig {
  players: 1 | 2;
  /** Inimigos do computador. Em partida de 2 pessoas o padrão é 0. Pessoas + inimigos: no máximo 5. */
  enemies: 0 | 1 | 2 | 3 | 4;
  difficulty: AiDifficulty;
  /** Times: cada um por si, pessoas × computador ou misturados (?teams=free|versus|mixed). */
  teams: TeamMode;
  /** Time de cada jogador, escolhido na tela de times (veja menu/teamsModel.ts). Quando existe, vale no lugar de `teams`. */
  teamAssignment?: number[];
  /** Semente da primeira rodada; a rodada N usa semente + N - 1. */
  seed: number;
  /** Itens escondidos nos blocos (?items=0 desliga). */
  items: boolean;
  /** Ajudas de teste: sobrescrevem bombas/alcance de todos os jogadores (?bombs=3&range=4). */
  bombs?: number;
  range?: number;
  /** Duração da rodada em segundos (?time=10, para testar a morte súbita). Ausente: 3 minutos. */
  time?: number;
  /** Rodadas que um time precisa vencer para ganhar a partida (1 = partida única). Ausente: 2. */
  wins?: number;
  /** Quem é eliminado joga das laterais e pode voltar (?sideline=0 desliga). Ausente: sim. */
  sideline?: boolean;
  /** Fase escolhida (id de config/stages.ts). Por enquanto só muda o que o menu mostra. */
  stage?: string;
  /** Contagem regressiva antes da rodada, em segundos (?countdown=0 pula, para testar). Ausente: 3. */
  countdown?: number;
  /** Ajuda de teste: habilidades que as pessoas já começam tendo (?power=kick,pierce,remote,throw,ghost; também invert e slow, para ver os itens ruins; vest e hero, para ver colete e super-herói). */
  power?: AbilityName[];
}

export const ABILITY_NAMES = ['kick', 'pierce', 'remote', 'throw', 'ghost', 'invert', 'slow', 'vest', 'hero'] as const;
export type AbilityName = (typeof ABILITY_NAMES)[number];

/** Parâmetros do endereço que, se presentes, fazem o jogo pular o menu e começar direto. */
const GAME_PARAMS = ['players', 'enemies', 'ai', 'seed', 'bombs', 'range', 'items', 'time', 'power', 'countdown', 'wins', 'sideline', 'teams'] as const;

export function hasGameParams(search: string): boolean {
  const query = new URLSearchParams(search);
  return GAME_PARAMS.some((name) => query.has(name));
}

function readInt(query: URLSearchParams, name: string, min: number, max: number): number | undefined {
  const raw = query.get(name);
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : undefined;
}

/** Lê a configuração do endereço (ex.: "?players=1&enemies=2&ai=hard"). Valor ausente ou inválido usa o padrão. */
export function parseGameConfig(search: string): GameConfig {
  const query = new URLSearchParams(search);
  const players = readInt(query, 'players', 1, 2) === 1 ? 1 : 2;
  const enemies = Math.min(readInt(query, 'enemies', 0, 4) ?? (players === 1 ? 1 : 0), 5 - players) as 0 | 1 | 2 | 3 | 4;
  const aiRaw = query.get('ai');
  const difficulty = (Object.keys(AI_SETTINGS) as AiDifficulty[]).find((name) => name === aiRaw) ?? DEFAULT_AI_DIFFICULTY;
  const config: GameConfig = {
    players,
    enemies,
    difficulty,
    teams: (TEAM_MODES as readonly string[]).includes(query.get('teams') ?? '') ? (query.get('teams') as TeamMode) : DEFAULT_TEAMS,
    seed: readInt(query, 'seed', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) ?? DEFAULT_SEED,
    items: query.get('items') !== '0',
  };
  const bombs = readInt(query, 'bombs', 1, 9);
  const range = readInt(query, 'range', 1, 12);
  if (bombs !== undefined) config.bombs = bombs;
  if (range !== undefined) config.range = range;
  const time = readInt(query, 'time', 1, 600);
  if (time !== undefined) config.time = time;
  const wins = readInt(query, 'wins', 1, 3);
  if (wins !== undefined) config.wins = wins;
  if (query.get('sideline') === '0') config.sideline = false;
  const countdown = readInt(query, 'countdown', 0, 10);
  if (countdown !== undefined) config.countdown = countdown;
  const power = (query.get('power') ?? '').split(',').filter((name): name is AbilityName => (ABILITY_NAMES as readonly string[]).includes(name));
  if (power.length > 0) config.power = [...new Set(power)];
  return config;
}
