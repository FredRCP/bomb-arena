import { describe, expect, it } from 'vitest';
import { BOMB_FUSE_TICKS, FLAME_TICKS } from '../../src/config/bombs';
import { CELL_TICKS, buildHazards, cellIndex, findEscape, hasHazard, hypotheticalBomb, isWalkable, unsafeAt } from '../../src/core';
import type { GameState } from '../../src/core';
import { addBomb } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const HALL = ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'];
const CORRIDOR = ['###########', '#.........#', '###########'];

function idx(state: GameState, col: number, row: number): number {
  return cellIndex(state.arena, col, row);
}

describe('buildHazards', () => {
  it('uma bomba marca a cruz inteira com a janela [explosão, explosão + FLAME_TICKS]', () => {
    const state = stateFromText(HALL);
    addBomb(state, 3, 3, { ticksLeft: 50, range: 2 });
    const hazards = buildHazards(state);
    for (const [c, r] of [[3, 3], [1, 3], [2, 3], [4, 3], [5, 3], [3, 1], [3, 2], [3, 4], [3, 5]] as const) {
      expect(hazards.windows[idx(state, c, r)], `${c},${r}`).toEqual([[50, 50 + FLAME_TICKS]]);
    }
    expect(hasHazard(hazards, idx(state, 2, 2))).toBe(false);
    expect(hasHazard(hazards, idx(state, 5, 5))).toBe(false);
  });

  it('uma chama acesa marca a célula de agora até o fim dela', () => {
    const state = stateFromText(HALL);
    state.flames.push({ col: 2, row: 2, ticksLeft: 12 });
    expect(buildHazards(state).windows[idx(state, 2, 2)]).toEqual([[0, 12]]);
  });

  it('parede e bloco limitam a cruz, como no jogo', () => {
    const state = stateFromText(['#######', '#.o...#', '#######']);
    addBomb(state, 3, 1, { ticksLeft: 40, range: 4 });
    const hazards = buildHazards(state);
    expect(hasHazard(hazards, idx(state, 2, 1))).toBe(true);
    expect(hasHazard(hazards, idx(state, 1, 1))).toBe(false); // atrás do bloco a chama não passa
  });

  it('cadeia: a bomba atingida explode na hora da que a atingiu', () => {
    const state = stateFromText(CORRIDOR);
    addBomb(state, 2, 1, { ticksLeft: 20, range: 2 });
    addBomb(state, 4, 1, { ticksLeft: 150, range: 1 });
    const hazards = buildHazards(state);
    expect(hazards.explodeAt).toEqual([20, 20]);
    // A cruz da segunda (alcance 1) também começa em 20: a célula 5 só queima por causa dela.
    expect(hazards.windows[idx(state, 5, 1)]).toEqual([[20, 20 + FLAME_TICKS]]);
  });

  it('cadeia em várias etapas (A atinge B, B atinge C)', () => {
    const state = stateFromText(CORRIDOR);
    addBomb(state, 1, 1, { ticksLeft: 10, range: 2 });
    addBomb(state, 3, 1, { ticksLeft: 200, range: 2 });
    addBomb(state, 5, 1, { ticksLeft: 200, range: 1 });
    expect(buildHazards(state).explodeAt).toEqual([10, 10, 10]);
  });

  it('bomba hipotética entra no mapa sem alterar o estado', () => {
    const state = stateFromText(HALL);
    const before = JSON.stringify(state);
    const hazards = buildHazards(state, hypotheticalBomb({ col: 3, row: 3 }, 1, 2));
    expect(hasHazard(hazards, idx(state, 3, 2))).toBe(true);
    expect(hazards.windows[idx(state, 3, 3)]).toEqual([[BOMB_FUSE_TICKS, BOMB_FUSE_TICKS + FLAME_TICKS]]);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('unsafeAt e isWalkable', () => {
  it('estar na célula durante a janela é perigoso; antes ou depois não', () => {
    const state = stateFromText(HALL);
    addBomb(state, 3, 3, { ticksLeft: 100, range: 1 });
    const hazards = buildHazards(state);
    const cell = idx(state, 3, 2);
    expect(unsafeAt(hazards, cell, 100, 5)).toBe(true);
    expect(unsafeAt(hazards, cell, 100 + FLAME_TICKS + 20, 5)).toBe(false);
    expect(unsafeAt(hazards, cell, 20, 5)).toBe(false);
    expect(unsafeAt(hazards, cell, 96, 5)).toBe(true); // a ocupação (±5) toca o início da janela
  });

  it('célula com bomba, bloco ou parede não é andável', () => {
    const state = stateFromText(['#####', '#.o.#', '#####']);
    addBomb(state, 3, 1);
    const hazards = buildHazards(state);
    expect(isWalkable(state, hazards, 1, 1)).toBe(true);
    expect(isWalkable(state, hazards, 2, 1)).toBe(false);
    expect(isWalkable(state, hazards, 3, 1)).toBe(false);
    expect(isWalkable(state, hazards, 0, 1)).toBe(false);
  });
});

describe('findEscape', () => {
  it('no corredor aberto, foge até fora do alcance (3 células) pelo caminho mais curto', () => {
    const state = stateFromText(CORRIDOR);
    addBomb(state, 5, 1, { ticksLeft: 120, range: 2, owner: 1, walkThrough: [1] });
    const path = findEscape(state, buildHazards(state), { col: 5, row: 1 }, 0);
    expect(path).not.toBeNull();
    expect(path).toHaveLength(3);
    const last = path![2]!;
    expect(Math.abs(last.col - 5)).toBe(3);
  });

  it('beco sem saída curto demais: não há fuga (e a IA não deve bombardear ali)', () => {
    const state = stateFromText(['#####', '#...#', '#####']);
    const bomb = hypotheticalBomb({ col: 2, row: 1 }, 1, 2);
    expect(findEscape(state, buildHazards(state, bomb), { col: 2, row: 1 }, 0)).toBeNull();
  });

  it('em encruzilhada existe fuga dobrando a esquina', () => {
    const state = stateFromText(['#####', '#...#', '#.#.#', '#...#', '#####']);
    const bomb = hypotheticalBomb({ col: 1, row: 1 }, 1, 2);
    const path = findEscape(state, buildHazards(state, bomb), { col: 1, row: 1 }, 0);
    expect(path).not.toBeNull();
    // Fora da cruz de (1,1): a coluna 1 e a linha 1 queimam; precisa chegar a (2,3) ou (3,2)... passando só por células livres.
    const goal = path![path!.length - 1]!;
    expect(goal.col !== 1 && goal.row !== 1).toBe(true);
  });

  it('sem tempo: bomba prestes a explodir no corredor longo e a saída é mais longe que o tempo', () => {
    const state = stateFromText(CORRIDOR);
    addBomb(state, 5, 1, { ticksLeft: 10, range: 2, walkThrough: [1] });
    expect(findEscape(state, buildHazards(state), { col: 5, row: 1 }, 0)).toBeNull();
  });

  it('a folga de segurança torna o julgamento mais exigente', () => {
    const state = stateFromText(CORRIDOR);
    // 3 passos de escape = 3 * CELL_TICKS. Com pavio justo, passa sem folga mas não com folga grande.
    addBomb(state, 5, 1, { ticksLeft: 3 * CELL_TICKS + 8, range: 2, walkThrough: [1] });
    const hazards = buildHazards(state);
    expect(findEscape(state, hazards, { col: 5, row: 1 }, 0)).not.toBeNull();
    expect(findEscape(state, hazards, { col: 5, row: 1 }, 40)).toBeNull();
  });

  it('não atravessa uma célula que vai pegar fogo quando ela passar por lá', () => {
    // Corredor: a jogadora está em 5; bomba dela em 5 (tempo longo) e outra bomba em 8 que explode logo.
    // O caminho para a direita passa por células da cruz da bomba em 8 (cols 6 a 10): perigoso. Resta a esquerda.
    const state = stateFromText(CORRIDOR);
    addBomb(state, 5, 1, { ticksLeft: 150, range: 2, owner: 1, walkThrough: [1] });
    addBomb(state, 9, 1, { ticksLeft: 25, range: 3, owner: 2 });
    const path = findEscape(state, buildHazards(state), { col: 5, row: 1 }, 0);
    expect(path).not.toBeNull();
    expect(path![0]!.col).toBe(4); // foge para a esquerda
  });

  it('não passa por cima de outra bomba', () => {
    const state = stateFromText(CORRIDOR);
    addBomb(state, 5, 1, { ticksLeft: 150, range: 1, owner: 1, walkThrough: [1] });
    addBomb(state, 4, 1, { ticksLeft: 150, range: 1, owner: 2 });
    const path = findEscape(state, buildHazards(state), { col: 5, row: 1 }, 0)!;
    expect(path.every((cell) => cell.col !== 4)).toBe(true);
  });
});

describe('findEscape usa a posição e a velocidade REAIS do corpo', () => {
  // Corredor de (1,1) a (9,1). Bomba em (4,1) alcance 3 cobre as colunas 1 a 7: a fuga é para a direita (coluna 8 ou mais).
  function scenario(bombTicks: number, flameAt6?: number): GameState {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 5, row: 1 }]);
    addBomb(state, 4, 1, { ticksLeft: bombTicks, range: 3, owner: 2 });
    if (flameAt6 !== undefined) state.flames.push({ col: 6, row: 1, ticksLeft: flameAt6 });
    return state;
  }
  const body = (x: number, speedBonus = 0) => ({ x, y: 1.5, speedBonus });

  it('colado na borda da célula, o corpo entra na vizinha em poucos passos: uma chama curta ali já bloqueia', () => {
    const state = scenario(60, 5);
    const hazards = buildHazards(state);
    // No centro da célula 5 a vizinha (6) só é pisada depois de ~7 passos: a chama (5 passos) já terá apagado.
    expect(findEscape(state, hazards, body(5.5), 0)).not.toBeNull();
    // A 0,05 da borda, o centro entra na célula 6 em 1 passo, em plena chama.
    expect(findEscape(state, hazards, body(5.95), 0)).toBeNull();
  });

  it('sem informar a posição, vale o corpo no centro da célula (como antes)', () => {
    const state = scenario(60, 5);
    expect(findEscape(state, buildHazards(state), { col: 5, row: 1 }, 0)).not.toBeNull();
  });

  it('item de velocidade encurta o tempo de fuga: onde a velocidade base não chega a tempo, a máxima chega', () => {
    const state = scenario(30);
    const hazards = buildHazards(state);
    expect(findEscape(state, hazards, body(5.5, 0), 0)).toBeNull();
    expect(findEscape(state, hazards, body(5.5, 3), 0)).not.toBeNull();
  });

  it('a folga de segurança pode tornar a fuga impossível; sem folga ela existe (base do plano B da IA)', () => {
    const state = scenario(45);
    const hazards = buildHazards(state);
    expect(findEscape(state, hazards, body(5.5, 0), 20)).toBeNull();
    expect(findEscape(state, hazards, body(5.5, 0), 0)).not.toBeNull();
  });
});
