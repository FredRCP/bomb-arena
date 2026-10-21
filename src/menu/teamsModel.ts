import { SOLO_TEAM_BASE } from '../core/state';

// Tela de times (como no Bomberman clássico): todos os jogadores começam no meio ("sem time") e cada um pode ser
// empurrado para a esquerda (Time Azul) ou para a direita (Time Vermelho). Lógica pura, sem Phaser, com testes.

/** Onde o jogador está: -1 = Time Azul (esquerda), 0 = sem time (meio), 1 = Time Vermelho (direita). */
export type Side = -1 | 0 | 1;

export interface TeamsState {
  /** Lado de cada jogador (índice 0 = jogador 1). */
  sides: Side[];
  /** Jogador sob o cursor. */
  selected: number;
}

export function createTeams(total: number, sides?: readonly Side[]): TeamsState {
  return { sides: Array.from({ length: total }, (_, i) => sides?.[i] ?? 0), selected: 0 };
}

export function moveTeamSelection(state: TeamsState, delta: -1 | 1): void {
  const count = state.sides.length;
  state.selected = (state.selected + delta + count) % count;
}

/** Empurra o jogador selecionado para a esquerda (-1) ou direita (+1); para nas pontas. Devolve true se ele mudou de lado. */
export function moveSide(state: TeamsState, delta: -1 | 1): boolean {
  const now = state.sides[state.selected]!;
  const next = Math.max(-1, Math.min(1, now + delta)) as Side;
  if (next === now) return false;
  state.sides[state.selected] = next;
  return true;
}

/** Time de cada jogador: esquerda = 1, direita = 2, meio = um time só dele (SOLO_TEAM_BASE + id). */
export function teamAssignment(sides: readonly Side[]): number[] {
  return sides.map((side, i) => (side === -1 ? 1 : side === 1 ? 2 : SOLO_TEAM_BASE + i + 1));
}

/** A divisão vale se existem pelo menos dois times (todos num lado só não tem contra quem jogar). */
export function isValidTeams(sides: readonly Side[]): boolean {
  return new Set(teamAssignment(sides)).size >= 2;
}

/** O caminho de volta: do time de cada jogador (o que o GameConfig guarda) para o lado na tela. */
export function sidesFromAssignment(assignment: readonly number[] | undefined, total: number): Side[] {
  return Array.from({ length: total }, (_, i) => {
    const team = assignment?.[i];
    return team === 1 ? -1 : team === 2 ? 1 : 0;
  });
}

/** Nomes das vagas na tela de times: "Você" ou "Jogador N" para pessoas, "CPU k" para o computador. */
export function slotLabels(humans: number, total: number): string[] {
  return Array.from({ length: total }, (_, i) => {
    if (i >= humans) return `CPU ${i - humans + 1}`;
    return humans === 1 ? 'Você' : `Jogador ${i + 1}`;
  });
}

/** A tela de times só faz sentido com 3 ou mais jogadores (com 2, é um contra um de qualquer jeito). */
export function needsTeamsScreen(humans: number, enemies: number): boolean {
  return humans + enemies >= 3;
}
