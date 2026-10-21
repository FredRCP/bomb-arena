import { describe, expect, it } from 'vitest';
import { bodyOverlapsCell, collidesAt, createGameState, createPlayer, createRng, getCell, spawnCells, step } from '../../src/core';
import type { Direction, GameState, Intents } from '../../src/core';

const DIRECTIONS: Array<Direction | null> = ['up', 'down', 'left', 'right', null];

/** Partida de dois jogadores que jogam "no escuro" (andam e colocam bombas ao acaso) por muitos passos. */
function playRandomly(seed: number, ticks: number, check: (state: GameState) => void): void {
  const state = createGameState({ seed, blockDensity: 0.6 });
  const corners = spawnCells(state.arena.cols, state.arena.rows);
  state.players.push(createPlayer(2, corners[3]));
  for (const player of state.players) {
    player.maxBombs = 3;
    player.bombRange = 3;
  }

  const rng = createRng(seed * 7919 + 1);
  let move1: Direction | null = null;
  let move2: Direction | null = null;

  for (let t = 0; t < ticks; t++) {
    // Troca de direção de vez em quando, como uma pessoa seguraria uma tecla.
    if (rng() < 0.05) move1 = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)] ?? null;
    if (rng() < 0.05) move2 = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)] ?? null;
    const intents: Intents = {
      1: { move: move1, placeBomb: rng() < 0.03 },
      2: { move: move2, placeBomb: rng() < 0.03 },
    };
    step(state, intents);
    check(state);
  }
}

describe('invariantes em partidas aleatórias (20 sementes x 3000 passos)', () => {
  it('valem em todos os passos', () => {
    const wasDead = new Set<number>();
    let bombsSeen = 0;
    let blocksDestroyed = 0;
    let deaths = 0;

    for (let seed = 1; seed <= 20; seed++) {
      wasDead.clear();
      const initialBlocks = createGameState({ seed, blockDensity: 0.6 }).arena.cells.filter((c) => c === 'block').length;
      let lastState: GameState | undefined;

      playRandomly(seed, 3000, (state) => {
        lastState = state;
        bombsSeen = Math.max(bombsSeen, state.bombs.length);

        // 1. Ninguém vivo invade parede/bloco nem bomba que o bloqueia.
        for (const player of state.players) {
          if (!player.alive) continue;
          expect(collidesAt(state.arena, player.x, player.y), `jogador ${player.id} dentro de sólido`).toBe(false);
          for (const bomb of state.bombs) {
            if (bomb.walkThrough.includes(player.id)) continue;
            expect(
              bodyOverlapsCell(player.x, player.y, bomb.col, bomb.row),
              `jogador ${player.id} dentro de bomba que o bloqueia`,
            ).toBe(false);
          }
        }

        // 2. Bombas: uma por célula, em célula livre, com pavio positivo e dentro do limite do dono.
        const keys = new Set<string>();
        for (const bomb of state.bombs) {
          const key = `${bomb.col},${bomb.row}`;
          expect(keys.has(key), `duas bombas em ${key}`).toBe(false);
          keys.add(key);
          expect(getCell(state.arena, bomb.col, bomb.row)).toBe('empty');
          expect(bomb.ticksLeft).toBeGreaterThan(0);
          for (const id of bomb.walkThrough) {
            const p = state.players.find((q) => q.id === id)!;
            expect(bodyOverlapsCell(p.x, p.y, bomb.col, bomb.row), 'walkThrough sem estar em cima').toBe(true);
          }
        }
        for (const player of state.players) {
          expect(state.bombs.filter((b) => b.owner === player.id).length).toBeLessThanOrEqual(player.maxBombs);
        }

        // 3. Chamas: nunca em parede, tempo válido, uma por célula.
        const flameKeys = new Set<string>();
        for (const flame of state.flames) {
          expect(getCell(state.arena, flame.col, flame.row)).not.toBe('wall');
          expect(flame.ticksLeft).toBeGreaterThan(0);
          const key = `${flame.col},${flame.row}`;
          expect(flameKeys.has(key), `chama duplicada em ${key}`).toBe(false);
          flameKeys.add(key);
        }

        // 4. Quem está numa chama já está morto; e morto nunca revive.
        for (const player of state.players) {
          const inFlame = state.flames.some((f) => f.col === Math.floor(player.x) && f.row === Math.floor(player.y));
          if (inFlame) expect(player.alive, 'vivo dentro de uma chama').toBe(false);
          if (!player.alive) wasDead.add(player.id);
          else expect(wasDead.has(player.id), 'jogador reviveu').toBe(false);
        }

        // 5. Paredes fixas nunca mudam: a borda continua toda de parede.
        expect(getCell(state.arena, 0, 0)).toBe('wall');
        expect(getCell(state.arena, 2, 2)).toBe('wall');
        state.events.length = 0; // ninguém lê os eventos aqui; evita acumular
      });

      const finalBlocks = lastState!.arena.cells.filter((c) => c === 'block').length;
      blocksDestroyed += initialBlocks - finalBlocks;
      deaths += lastState!.players.filter((p) => !p.alive).length;
    }

    // Garante que o teste exercitou de verdade o que promete (não passou "no vazio").
    expect(bombsSeen, 'bombas simultâneas vistas').toBeGreaterThanOrEqual(3);
    expect(blocksDestroyed, 'blocos destruídos no total').toBeGreaterThan(50);
    expect(deaths, 'mortes no total').toBeGreaterThan(5);
  }, 60_000);
});
