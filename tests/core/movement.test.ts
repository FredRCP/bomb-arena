import { describe, expect, it } from 'vitest';
import { PLAYER_HALF_SIZE, PLAYER_SLACK } from '../../src/config/simulation';
import { STEP_DISTANCE, collidesAt, createGameState, createPlayer, createRng, movePlayer, step } from '../../src/core';
import type { Arena, Direction, PlayerState } from '../../src/core';
import { arenaFromText } from '../helpers/arenaFromText';

const H = PLAYER_HALF_SIZE;

// Praça 3x3 cercada de parede: células livres de (1,1) a (3,3).
const PLAZA = arenaFromText(['#####', '#...#', '#...#', '#...#', '#####']);

function playerAt(x: number, y: number): PlayerState {
  return { ...createPlayer(1, { col: 0, row: 0 }), x, y };
}

function walk(arena: Arena, player: PlayerState, direction: Direction, ticks: number): void {
  for (let i = 0; i < ticks; i++) movePlayer(arena, player, direction);
}

/** O corpo está inteiro dentro da faixa (célula) indicada: nenhuma parte invade as vizinhas. */
function expectInsideLane(center: number, lane: number): void {
  expect(center).toBeGreaterThanOrEqual(lane + H - 1e-9);
  expect(center).toBeLessThanOrEqual(lane + 1 - H + 1e-9);
}

describe('collidesAt', () => {
  it('não há colisão no meio de uma célula livre', () => {
    expect(collidesAt(PLAZA, 2.5, 2.5)).toBe(false);
  });

  it('encostar na parede não é invadi-la, mas entrar um pouco é', () => {
    expect(collidesAt(PLAZA, 1 + H, 2.5)).toBe(false);
    expect(collidesAt(PLAZA, 1 + H - 0.01, 2.5)).toBe(true);
    expect(collidesAt(PLAZA, 3 + 1 - H, 2.5)).toBe(false);
    expect(collidesAt(PLAZA, 3 + 1 - H + 0.01, 2.5)).toBe(true);
  });

  it('fora da arena sempre colide', () => {
    expect(collidesAt(PLAZA, -5, 2)).toBe(true);
    expect(collidesAt(PLAZA, 2, 50)).toBe(true);
  });

  it('um bloco colide como uma parede', () => {
    const arena = arenaFromText(['#####', '#.o.#', '#####']);
    expect(collidesAt(arena, 2.5, 1.5)).toBe(true);
    expect(collidesAt(arena, 1.5, 1.5)).toBe(false);
  });
});

describe('movePlayer em espaço aberto', () => {
  it.each<[Direction, number, number]>([
    ['left', -1, 0],
    ['right', 1, 0],
    ['up', 0, -1],
    ['down', 0, 1],
  ])('andar para %s percorre um passo inteiro', (direction, dx, dy) => {
    const player = playerAt(2.5, 2.5);
    movePlayer(PLAZA, player, direction);
    expect(player.x).toBeCloseTo(2.5 + dx * STEP_DISTANCE, 9);
    expect(player.y).toBeCloseTo(2.5 + dy * STEP_DISTANCE, 9);
  });

  it('andar vários passos soma as distâncias', () => {
    const arena = arenaFromText(['#######', '#.....#', '#######']);
    const player = playerAt(1.5, 1.5);
    walk(arena, player, 'right', 10);
    expect(player.x).toBeCloseTo(1.5 + 10 * STEP_DISTANCE, 9);
    expect(player.y).toBe(1.5);
  });
});

describe('movePlayer contra paredes e blocos', () => {
  it.each<[Direction, number, number]>([
    ['left', 1 + H, 2.5],
    ['right', 4 - H, 2.5],
    ['up', 2.5, 1 + H],
    ['down', 2.5, 4 - H],
  ])('para encostado na parede ao andar para %s', (direction, expectedX, expectedY) => {
    const player = playerAt(2.5, 2.5);
    walk(PLAZA, player, direction, 200);
    expect(player.x).toBeCloseTo(expectedX, 9);
    expect(player.y).toBeCloseTo(expectedY, 9);
    expect(collidesAt(PLAZA, player.x, player.y)).toBe(false);
  });

  it('para encostado em um bloco', () => {
    const arena = arenaFromText(['#######', '#..o..#', '#######']);
    const player = playerAt(1.5, 1.5);
    walk(arena, player, 'right', 200);
    expect(player.x).toBeCloseTo(3 - H, 9);
  });

  it('continuar empurrando a parede não muda a posição', () => {
    const player = playerAt(2.5, 2.5);
    walk(PLAZA, player, 'right', 200);
    const { x, y } = player;
    walk(PLAZA, player, 'right', 50);
    expect(player.x).toBe(x);
    expect(player.y).toBe(y);
  });

  it('nunca atravessa a borda da arena, mesmo com um passo maior que a folga restante', () => {
    const player = playerAt(4 - H - STEP_DISTANCE / 2, 2.5);
    walk(PLAZA, player, 'right', 5);
    expect(player.x).toBeCloseTo(4 - H, 9);
  });
});

describe('ajuda de canto', () => {
  // Pilar de três células no meio: só as faixas das pontas (colunas 1 e 5) têm passagem na linha 2.
  const CORNER_VERTICAL = arenaFromText(['#######', '#.....#', '#.###.#', '#.....#', '#######']);

  it('desliza para a faixa livre ao subir com o corpo parcialmente sobre o pilar', () => {
    const player = playerAt(1.8, 3.5);
    walk(CORNER_VERTICAL, player, 'up', 150);
    // Não precisa terminar centralizado: basta o corpo sair de cima do pilar e seguir em frente.
    expectInsideLane(player.x, 1);
    expect(player.y).toBeCloseTo(1 + H, 9);
  });

  it('desliza para a faixa livre ao descer', () => {
    const player = playerAt(1.8, 1.5);
    walk(CORNER_VERTICAL, player, 'down', 150);
    expectInsideLane(player.x, 1);
    expect(player.y).toBeCloseTo(4 - H, 9);
  });

  it('não ajuda quando a faixa mais próxima também está bloqueada', () => {
    const player = playerAt(2.2, 3.5);
    walk(CORNER_VERTICAL, player, 'up', 150);
    expect(player.x).toBe(2.2);
    expect(player.y).toBeCloseTo(3 + H, 9);
  });

  it('desliza também na horizontal', () => {
    const arena = arenaFromText(['#######', '#.....#', '#..#..#', '#.....#', '#######']);
    const player = playerAt(1.5, 1.8);
    walk(arena, player, 'right', 200);
    expectInsideLane(player.y, 1);
    expect(player.x).toBeCloseTo(6 - H, 9);
  });

  it('não ajuda quando já está alinhado e a parede é de frente', () => {
    const player = playerAt(2.5, 3.5);
    walk(CORNER_VERTICAL, player, 'up', 150);
    expect(player.x).toBe(2.5);
    expect(player.y).toBeCloseTo(3 + H, 9);
  });
});

describe('invariante: o corpo nunca invade parede ou bloco', () => {
  const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

  it.each([0, 0.4, 0.75, 1])('com densidade de blocos %s, em 25 arenas e 1500 passos aleatórios cada', (blockDensity) => {
    const violations: string[] = [];

    for (let seed = 1; seed <= 25; seed++) {
      const state = createGameState({ seed, blockDensity });
      const rng = createRng(seed * 7919);
      let direction: Direction = 'up';
      let remaining = 0;

      for (let tick = 0; tick < 1500; tick++) {
        if (remaining === 0) {
          direction = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)] ?? 'up';
          remaining = 3 + Math.floor(rng() * 25);
        }
        remaining -= 1;

        step(state, { 1: { move: direction } });

        const player = state.players[0];
        if (player === undefined || collidesAt(state.arena, player.x, player.y)) {
          violations.push(`semente ${seed}, passo ${tick}`);
          break;
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('em arena aberta o jogador de fato passeia por várias células', () => {
    const state = createGameState({ seed: 3, blockDensity: 0 });
    const rng = createRng(99);
    const visited = new Set<string>();
    let direction: Direction = 'right';
    let remaining = 0;

    for (let tick = 0; tick < 1500; tick++) {
      if (remaining === 0) {
        direction = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)] ?? 'up';
        remaining = 10 + Math.floor(rng() * 30);
      }
      remaining -= 1;
      step(state, { 1: { move: direction } });
      const player = state.players[0]!;
      visited.add(`${Math.floor(player.x)},${Math.floor(player.y)}`);
    }

    // Em média o passeio visita ~30 células (medido com corpos de 0,4 e de 0,45: o mesmo); 20 é só um piso seguro.
    expect(visited.size).toBeGreaterThanOrEqual(15);
  });
});

describe('folga dentro da célula', () => {
  it('em cada direção, o boneco para encostado na parede a PLAYER_HALF_SIZE dela (nem antes, nem depois)', () => {
    const checks: Array<[Direction, 'x' | 'y', number]> = [
      ['left', 'x', 1 + H],
      ['right', 'x', 4 - H],
      ['up', 'y', 1 + H],
      ['down', 'y', 4 - H],
    ];
    for (const [direction, axis, expected] of checks) {
      const player = playerAt(2.5, 2.5);
      walk(PLAZA, player, direction, 80);
      expect(player[axis], direction).toBeCloseTo(expected, 6);
    }
  });

  it('da célula do canto, empurrar contra a parede desloca no máximo PLAYER_SLACK', () => {
    const player = playerAt(1.5, 1.5);
    walk(PLAZA, player, 'left', 60);
    expect(1.5 - player.x).toBeLessThanOrEqual(PLAYER_SLACK + 1e-9);
    expect(1.5 - player.x).toBeGreaterThan(0);
    walk(PLAZA, player, 'up', 60);
    expect(1.5 - player.y).toBeLessThanOrEqual(PLAYER_SLACK + 1e-9);
  });

  it('a folga é pequena: menos de 4 pixels (célula de 64 px)', () => {
    expect(PLAYER_SLACK * 64).toBeLessThan(4);
  });
});
