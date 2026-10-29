import { AI_SETTINGS, DEFAULT_AI_DIFFICULTY } from '../config/ai';
import type { AiDifficulty } from '../config/ai';
import { DEFAULT_SEED } from '../config/arena';
import { DEFAULT_STAGE, STAGES, stageById } from '../config/stages';
import type { StageDef } from '../config/stages';
import { DEFAULT_TEAMS } from './gameConfig';
import type { GameConfig } from './gameConfig';
import { needsTeamsScreen } from './teamsModel';

// Modelo do menu inicial: o que está escolhido, quais linhas aparecem, como o teclado mexe nelas.
// Sem Phaser: a cena só desenha este modelo e repassa as teclas.

export const MAX_VOLUME = 10;
export const DEFAULT_VOLUME = 7;
export const DEFAULT_MUSIC = 6;

export interface MenuSettings {
  /** Pessoas: 1 (sozinho), 2 (mesmo teclado) ou 3 a 5 (com controles de videogame). */
  players: 1 | 2 | 3 | 4 | 5;
  /** Inimigos do computador. Com 1 pessoa: 1 a 4; com 2 pessoas: 0 a 3 (no máximo 5 jogadores no total). */
  enemies: 0 | 1 | 2 | 3 | 4;
  difficulty: AiDifficulty;
  /** Rodadas que é preciso vencer para ganhar a partida: 1 (partida única), 2 ou 3. */
  wins: 1 | 2 | 3;
  /** Duração de cada rodada, em segundos (uma das opções de ROUND_TIME_OPTIONS). */
  time: number;
  /** Repescagem: quem é eliminado joga das laterais e pode voltar à arena. */
  sideline: boolean;
  /** Fase escolhida (id de config/stages.ts). */
  stage: string;
  /** Volume dos sons (efeitos), de 0 (mudo) a MAX_VOLUME. */
  volume: number;
  /** Volume da música, de 0 (mudo) a MAX_VOLUME. */
  music: number;
}

export type MenuRow = 'players' | 'enemies' | 'difficulty' | 'wins' | 'time' | 'sideline' | 'stage' | 'volume' | 'music' | 'controls' | 'next';

/**
 * As telas de configuração, na ordem em que aparecem depois de "Jogar" (a escolha de personagem fica entre
 * `rules` e `stage`): participantes -> regras -> (personagens) -> fase. `options` é a tela de Opções do menu principal.
 */
export type MenuScreen = 'participants' | 'rules' | 'stage' | 'options';

/** Texto do botão que fecha cada tela. */
export const NEXT_LABELS: Record<MenuScreen, string> = { participants: 'CONTINUAR', rules: 'CONTINUAR', stage: 'JOGAR', options: 'VOLTAR' };

export const SCREEN_TITLES: Record<MenuScreen, string> = { participants: 'QUEM VAI JOGAR', rules: 'REGRAS DA PARTIDA', stage: 'ESCOLHA A FASE', options: 'OPÇÕES' };

/** Durações de rodada que o menu oferece, em segundos. 0 = sem limite de tempo. */
export const ROUND_TIME_OPTIONS = [60, 90, 120, 180, 240, 300, 0] as const;
export const WINS_OPTIONS = [1, 2, 3] as const;

export interface MenuState {
  screen: MenuScreen;
  settings: MenuSettings;
  /** Posição na lista de linhas visíveis. */
  selected: number;
  /** Quantas pessoas cabem agora: 2, ou o número de controles conectados (até 5). A cena atualiza. */
  maxHumans: number;
}

export const DEFAULT_SETTINGS: MenuSettings = {
  players: 1,
  enemies: 1,
  difficulty: DEFAULT_AI_DIFFICULTY,
  wins: 2,
  time: 180,
  sideline: true,
  stage: DEFAULT_STAGE,
  volume: DEFAULT_VOLUME,
  music: DEFAULT_MUSIC,
};

const DIFFICULTIES = Object.keys(AI_SETTINGS) as AiDifficulty[];

/** Começa no botão que fecha a tela (Enter já avança com as escolhas guardadas). */
export function createMenu(settings: MenuSettings = DEFAULT_SETTINGS, screen: MenuScreen = 'participants'): MenuState {
  return { screen, settings: { ...settings }, selected: visibleRows(settings, screen).length - 1, maxHumans: 2 };
}

/** Quantos passos tem o "Jogar": a tela de times só entra com 3 ou mais jogadores. */
export function totalSteps(settings: MenuSettings): number {
  return needsTeamsScreen(settings.players, settings.enemies) ? 5 : 4;
}

/** Número do passo de cada tela de configuração (personagens e times ficam no meio, em outras cenas). */
export function stepNumber(screen: MenuScreen, settings: MenuSettings): number | null {
  if (screen === 'participants') return 1;
  if (screen === 'rules') return 2;
  if (screen === 'stage') return totalSteps(settings);
  return null;
}

/** Máximo de jogadores na arena, somando pessoas e computador. */
export const MAX_TOTAL_PLAYERS = 5;

/** Quantos inimigos o modo permite: com 1 pessoa, de 1 a 4; com 2 pessoas, de 0 a 3. */
export function enemyRange(players: number): { min: number; max: number } {
  return { min: players === 1 ? 1 : 0, max: MAX_TOTAL_PLAYERS - players };
}

function clampEnemies(players: number, enemies: number): MenuSettings['enemies'] {
  const { min, max } = enemyRange(players);
  return Math.min(max, Math.max(min, enemies)) as MenuSettings['enemies'];
}

/** Linhas de cada tela. Equipes só com 3+ jogadores; a dificuldade só havendo inimigos do computador. */
export function visibleRows(settings: MenuSettings, screen: MenuScreen = 'participants'): MenuRow[] {
  if (screen === 'participants') {
    const rows: MenuRow[] = ['players', 'enemies'];
    if (settings.enemies > 0 || settings.players === 1) rows.push('difficulty');
    return [...rows, 'next'];
  }
  if (screen === 'rules') return ['wins', 'time', 'sideline', 'next'];
  if (screen === 'stage') return ['stage', 'next'];
  return ['volume', 'music', 'controls', 'next'];
}

export function selectedRow(menu: MenuState): MenuRow {
  const rows = visibleRows(menu.settings, menu.screen);
  return rows[Math.min(menu.selected, rows.length - 1)]!;
}

/** Sobe (-1) ou desce (+1) a seleção, dando a volta nas pontas. */
export function moveSelection(menu: MenuState, delta: -1 | 1): void {
  const count = visibleRows(menu.settings, menu.screen).length;
  menu.selected = (menu.selected + delta + count) % count;
}

function cycle<T>(values: readonly T[], current: T, delta: -1 | 1): T {
  const at = values.indexOf(current);
  return values[(at + delta + values.length) % values.length]!;
}

/**
 * Muda o valor da linha selecionada (esquerda = -1, direita = +1). A seleção continua na mesma linha
 * (ao trocar de modo, as linhas visíveis mudam). Devolve true se algo mudou.
 */
export function changeValue(menu: MenuState, delta: -1 | 1): boolean {
  const row = selectedRow(menu);
  const s = menu.settings;
  if (row === 'players') {
    const values = Array.from({ length: Math.max(2, menu.maxHumans) }, (_, i) => i + 1);
    s.players = cycle(values, Math.min(s.players, values.length), delta) as MenuSettings['players'];
    s.enemies = clampEnemies(s.players, s.enemies); // ao trocar o modo, ajusta os inimigos à faixa permitida
  } else if (row === 'enemies') {
    const { min, max } = enemyRange(s.players);
    const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    s.enemies = cycle(values, s.enemies, delta) as MenuSettings['enemies'];
  } else if (row === 'difficulty') {
    s.difficulty = cycle(DIFFICULTIES, s.difficulty, delta);
  } else if (row === 'wins') {
    s.wins = cycle(WINS_OPTIONS, s.wins, delta);
  } else if (row === 'time') {
    s.time = cycle(ROUND_TIME_OPTIONS, s.time as (typeof ROUND_TIME_OPTIONS)[number], delta);
  } else if (row === 'sideline') {
    s.sideline = !s.sideline;
  } else if (row === 'stage') {
    const ids = STAGES.map((stage) => stage.id);
    s.stage = cycle(ids, s.stage, delta);
  } else if (row === 'volume') {
    const next = Math.min(MAX_VOLUME, Math.max(0, s.volume + delta));
    if (next === s.volume) return false;
    s.volume = next;
  } else if (row === 'music') {
    const next = Math.min(MAX_VOLUME, Math.max(0, s.music + delta));
    if (next === s.music) return false;
    s.music = next;
  } else {
    return false;
  }
  menu.selected = Math.min(menu.selected, visibleRows(s, menu.screen).length - 1);
  return true;
}

/** Nomes dos níveis, do mais fácil ao mais difícil (a ordem é a da lista em config/ai.ts). */
export const DIFFICULTY_LABELS: Record<AiDifficulty, string> = {
  easy: 'Fácil',
  normal: 'Normal',
  hard: 'Difícil',
  expert: 'Hardcore',
  ultra: 'Impossível',
};

/** Uma frase bem-humorada por nível, mostrada embaixo da escolha. */
export const DIFFICULTY_TAGLINES: Record<AiDifficulty, string> = {
  easy: 'Para aquecer os dedos.',
  normal: 'Um desafio justo.',
  hard: 'Aqui a coisa já esquenta.',
  expert: 'Só para quem tem sangue frio.',
  ultra: 'Boa sorte. Você vai precisar.',
};

/** Tempo de rodada em texto: "3:00", ou "sem limite" (0). */
function clockText(seconds: number): string {
  return seconds === 0 ? 'sem limite' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Rótulo e valor mostrados em cada linha (textos em português). */
export function describeRow(settings: MenuSettings, row: MenuRow): { label: string; value: string } {
  switch (row) {
    case 'players':
      return { label: 'Jogadores', value: settings.players === 1 ? '1 jogador' : settings.players === 2 ? '2 jogadores (mesmo teclado)' : `${settings.players} jogadores (com controles)` };
    case 'enemies':
      return { label: 'Jogadores do computador', value: String(settings.enemies) };
    case 'difficulty':
      return { label: 'Dificuldade', value: DIFFICULTY_LABELS[settings.difficulty] };
    case 'wins':
      return { label: 'Partida', value: settings.wins === 1 ? 'Partida única' : `Melhor de ${settings.wins}` };
    case 'time':
      return { label: 'Tempo da rodada', value: clockText(settings.time) };
    case 'sideline':
      return { label: 'Repescagem', value: settings.sideline ? 'Ligada' : 'Desligada' };
    case 'volume':
      return { label: 'Volume dos sons', value: settings.volume === 0 ? 'mudo' : `${settings.volume * 10}%` };
    case 'music':
      return { label: 'Volume da música', value: settings.music === 0 ? 'mudo' : `${settings.music * 10}%` };
    case 'controls':
      return { label: 'Controles', value: 'ver os comandos  ▶' };
    case 'stage': {
      const stage = stageById(settings.stage);
      return { label: 'Fase', value: stage.available ? stage.name : `${stage.name} (em breve)` };
    }
    case 'next':
      return { label: '', value: '' };
  }
}

/** Escolhas do menu -> configuração da partida. */
export function toGameConfig(settings: MenuSettings, seed: number = DEFAULT_SEED): GameConfig {
  return {
    players: settings.players,
    enemies: clampEnemies(settings.players, settings.enemies),
    difficulty: settings.difficulty,
    teams: DEFAULT_TEAMS,
    seed,
    items: true,
    wins: settings.wins,
    time: settings.time,
    sideline: settings.sideline,
    stage: stageById(settings.stage).id,
  };
}

/**
 * Por que a fase NÃO pode ser jogada agora (texto para mostrar), ou null se pode:
 * ainda não existe ("em breve"), não cabe tanta gente, ou é grande demais para a tela de toque.
 */
export function stageIssue(stage: StageDef, total: number, touch: boolean): string | null {
  if (!stage.available) return 'Em breve!';
  if (touch && !stage.mobileOk) return 'Esta arena é grande demais para celular.';
  if (total > stage.maxPlayers) return `Esta fase comporta até ${stage.maxPlayers} jogadores (a partida tem ${total}).`;
  return null;
}

/** A fase escolhida pode ser jogada? `total` = jogadores da partida (pessoas + computador); `touch` = tela de toque. */
export function canStart(settings: MenuSettings, touch = false, total: number = settings.players + settings.enemies): boolean {
  return stageIssue(stageById(settings.stage), total, touch) === null;
}

/** Resumo da partida, uma linha por assunto (mostrado na tela da fase, antes de jogar). */
export function summaryLines(settings: MenuSettings): string[] {
  const enemies = clampEnemies(settings.players, settings.enemies);
  const people = settings.players === 1 ? '1 pessoa' : `${settings.players} pessoas`;
  const lines = [enemies > 0 ? `${people} + ${enemies} do computador (${DIFFICULTY_LABELS[settings.difficulty]})` : people];
  const minutes = clockText(settings.time);
  lines.push(`${settings.wins === 1 ? 'Partida única' : `Melhor de ${settings.wins}`} · rodadas ${settings.time === 0 ? 'sem limite de tempo' : `de ${minutes}`} · repescagem ${settings.sideline ? 'ligada' : 'desligada'}`);
  return lines;
}

/**
 * Lê configurações guardadas (texto JSON do localStorage). Qualquer coisa estranha — texto inválido, campos
 * faltando, valores fora da faixa — volta ao padrão naquele campo, nunca quebra o jogo.
 */
export function parseSettings(raw: string | null): MenuSettings {
  const result: MenuSettings = { ...DEFAULT_SETTINGS };
  if (raw === null) return result;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return result;
  }
  if (typeof data !== 'object' || data === null) return result;
  const record = data as Record<string, unknown>;
  if (typeof record.players === 'number' && Number.isInteger(record.players) && record.players >= 1 && record.players <= 5) result.players = record.players as MenuSettings['players'];
  if (typeof record.enemies === 'number' && Number.isInteger(record.enemies) && record.enemies >= 0 && record.enemies <= 4) {
    result.enemies = record.enemies as MenuSettings['enemies'];
  }
  if (typeof record.difficulty === 'string' && (DIFFICULTIES as string[]).includes(record.difficulty)) {
    result.difficulty = record.difficulty as AiDifficulty;
  }
  if (typeof record.stage === 'string' && STAGES.some((stage) => stage.id === record.stage)) result.stage = record.stage;
  if (record.wins === 1 || record.wins === 2 || record.wins === 3) result.wins = record.wins;
  if (typeof record.time === 'number' && (ROUND_TIME_OPTIONS as readonly number[]).includes(record.time)) result.time = record.time;
  if (typeof record.sideline === 'boolean') result.sideline = record.sideline;
  if (typeof record.volume === 'number' && Number.isInteger(record.volume) && record.volume >= 0 && record.volume <= MAX_VOLUME) {
    result.volume = record.volume;
  }
  if (typeof record.music === 'number' && Number.isInteger(record.music) && record.music >= 0 && record.music <= MAX_VOLUME) {
    result.music = record.music;
  }
  result.enemies = clampEnemies(result.players, result.enemies);
  return result;
}
