import { createPlayer, createRound } from '../../src/core';
import type { GameState, PlayerId } from '../../src/core';
import { arenaFromText } from './arenaFromText';

export interface PlayerSpec {
  id: PlayerId;
  col: number;
  row: number;
  bombRange?: number;
  maxBombs?: number;
  /** Time (padrão: o próprio id). Use 0 para um inimigo do computador. */
  team?: number;
  /** Controlado pelo computador (padrão: não). */
  cpu?: boolean;
}

/**
 * Monta uma partida a partir de um desenho em texto (# parede, o bloco, . livre) e da posição dos jogadores.
 * Por padrão, só o jogador 1 na célula (1, 1).
 */
export function stateFromText(lines: string[], players: PlayerSpec[] = [{ id: 1, col: 1, row: 1 }]): GameState {
  return {
    arena: arenaFromText(lines),
    players: players.map((spec) => ({
      ...createPlayer(spec.id, { col: spec.col, row: spec.row }, spec.team ?? spec.id, spec.cpu ?? false),
      ...(spec.bombRange !== undefined && { bombRange: spec.bombRange }),
      ...(spec.maxBombs !== undefined && { maxBombs: spec.maxBombs }),
    })),
    bombs: [],
    flames: [],
    items: [],
    hiddenItems: [],
    events: [],
    round: createRound(),
    tick: 0,
  };
}
