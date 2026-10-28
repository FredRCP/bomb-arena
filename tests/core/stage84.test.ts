import { describe, expect, it } from 'vitest';
import { AI_SETTINGS } from '../../src/config/ai';
import { MAX_BOMBS_CAP, SPEED_ITEMS_CAP, SPEED_PER_ITEM } from '../../src/config/items';
import { PLAYER_SLACK, PLAYER_SPEED } from '../../src/config/simulation';
import { applyItem, createAi, createGameState, createMatch, dropPowerups, recordRound, step, stepDistanceOf } from '../../src/core';
import type { GameState, PlayerState } from '../../src/core';
import { closeNextCell } from '../../src/core/shrink';
import { addBomb } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const HALL = ['#########', '#.......#', '#.#.#.#.#', '#.......#', '#.#.#.#.#', '#.......#', '#########'];

function trio(): GameState {
  return stateFromText(HALL, [
    { id: 1, col: 1, row: 1 },
    { id: 2, col: 7, row: 5 },
    { id: 3, col: 4, row: 3, team: 0 },
  ]);
}

/** Dá muitos itens de uma vez ao jogador (sem passar pelo chão). */
function powerUp(p: PlayerState): void {
  p.maxBombs = 4;
  p.bombRange = 3;
  p.speedBonus = 2;
  p.canKick = true;
  p.remote = true;
  p.ghostTicks = 100;
  p.invertTicks = 100;
}

describe('velocidade e limites', () => {
  it('a velocidade inicial é a de antes menos 1 ponto; com 5 itens o passo continua abaixo do limite de 2 folgas do corpo', () => {
    expect(PLAYER_SPEED + SPEED_PER_ITEM).toBeCloseTo(4.5, 9);
    const p = stateFromText(HALL).players[0]!;
    expect(stepDistanceOf(p)).toBeCloseTo(PLAYER_SPEED / 60, 12);
    p.speedBonus = SPEED_ITEMS_CAP;
    expect(stepDistanceOf(p)).toBeLessThan(2 * PLAYER_SLACK);
  });

  it('limites: no máximo 8 bombas e 5 de velocidade; depois o item é gasto sem efeito', () => {
    expect(MAX_BOMBS_CAP).toBe(8);
    expect(SPEED_ITEMS_CAP).toBe(5);
    const p = stateFromText(HALL).players[0]!;
    for (let i = 1; i < 8; i++) expect(applyItem(p, 'bomb')).toBe(true);
    expect(p.maxBombs).toBe(8);
    expect(applyItem(p, 'bomb')).toBe(false);
    for (let i = 0; i < 5; i++) expect(applyItem(p, 'speed')).toBe(true);
    expect(p.speedBonus).toBe(5);
    expect(applyItem(p, 'speed')).toBe(false);
  });
});

describe('todos começam iguais', () => {
  it('pessoas e computador (em qualquer dificuldade) nascem sem item algum; só o handicap de velocidade da dificuldade difere', () => {
    for (const difficulty of Object.keys(AI_SETTINGS) as Array<keyof typeof AI_SETTINGS>) {
      const state = createGameState({ seed: 5, players: 1, enemies: 4, enemySpeedScale: AI_SETTINGS[difficulty].speedScale });
      for (const p of state.players) {
        expect(p, `${difficulty} jogador ${p.id}`).toMatchObject({
          maxBombs: 1, bombRange: 1, speedBonus: 0, canKick: false, piercing: false, remote: false, canThrow: false, ghostTicks: 0, invertTicks: 0, shieldTicks: 0,
        });
      }
    }
    // Na dificuldade mais difícil nem a velocidade difere.
    const hard = createGameState({ seed: 5, players: 1, enemies: 2, enemySpeedScale: AI_SETTINGS.ultra.speedScale });
    expect(new Set(hard.players.map((p) => stepDistanceOf(p))).size).toBe(1);
  });
});

describe('quem morre espalha os itens', () => {
  it('cada item vira um item no chão (bombas e alcance extras, velocidade, habilidades) em casas livres diferentes; o jogador volta ao zero', () => {
    const state = trio();
    const p = state.players[0]!;
    powerUp(p);
    addBomb(state, 3, 1, { owner: 2, ticksLeft: 500 });
    state.flames.push({ col: 5, row: 1, ticksLeft: 50 });
    state.flames.push({ col: 1, row: 1, ticksLeft: 5 }); // mata o jogador 1
    step(state);
    expect(p.alive).toBe(false);
    // 3 bombas extras + 2 de alcance + 2 de velocidade + chute + relógio
    const kinds = state.items.map((i) => i.kind).sort();
    expect(kinds).toEqual(['bomb', 'bomb', 'bomb', 'kick', 'range', 'range', 'remote', 'speed', 'speed']);
    const cells = state.items.map((i) => `${i.col},${i.row}`);
    expect(new Set(cells).size).toBe(cells.length);
    for (const item of state.items) {
      expect(state.arena.cells[item.row * state.arena.cols + item.col]).toBe('empty');
      expect(`${item.col},${item.row}`).not.toBe('3,1'); // bomba
      expect(`${item.col},${item.row}`).not.toBe('5,1'); // chama
    }
    expect(p).toMatchObject({ maxBombs: 1, bombRange: 1, speedBonus: 0, canKick: false, remote: false, ghostTicks: 0, invertTicks: 0 });
    expect(state.events.filter((e) => e.type === 'itemSpawned')).toHaveLength(9);
  });

  it('é determinístico: a mesma partida espalha nos mesmos lugares', () => {
    const make = (): GameState => {
      const state = trio();
      powerUp(state.players[0]!);
      state.flames.push({ col: 1, row: 1, ticksLeft: 5 });
      step(state);
      return state;
    };
    expect(make().items).toEqual(make().items);
  });

  it('sem casas livres, o que sobra se perde sem dar erro; quem não tem item não espalha nada', () => {
    const state = stateFromText(['####', '#..#', '####'], [{ id: 1, col: 1, row: 1 }]);
    powerUp(state.players[0]!);
    state.players[0]!.alive = false;
    dropPowerups(state, state.players[0]!);
    expect(state.items.length).toBeLessThanOrEqual(2);
    const clean = trio();
    clean.players[0]!.alive = false;
    dropPowerups(clean, clean.players[0]!);
    expect(clean.items).toEqual([]);
  });

  it('esmagado pela morte súbita também espalha', () => {
    const state = trio();
    powerUp(state.players[0]!);
    state.round.suddenDeath = true;
    state.players[0]!.x = 1.5;
    state.players[0]!.y = 1.5;
    closeNextCell(state);
    expect(state.players[0]!.alive).toBe(false);
    expect(state.items.length).toBe(9);
  });

  it('quem volta das laterais volta sem nada', () => {
    const state = trio();
    powerUp(state.players[0]!);
    state.flames.push({ col: 1, row: 1, ticksLeft: 5 });
    step(state);
    const p1 = state.players[0]!;
    p1.sideline = 4;
    addBomb(state, 4, 3, { owner: 1, ticksLeft: 1, range: 1 });
    step(state);
    expect(p1.alive).toBe(true);
    expect(p1).toMatchObject({ maxBombs: 1, bombRange: 1, speedBonus: 0, canKick: false, remote: false });
  });
});

describe('partida: única, melhor de 2, melhor de 3', () => {
  const players = stateFromText(HALL, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 3, row: 1 }]).players;

  it('padrão: 2 vitórias, até 5 rodadas (como antes)', () => {
    expect(createMatch()).toMatchObject({ roundsToWin: 2, maxRounds: 5 });
  });

  it('partida única: uma rodada decide; empate encerra a partida empatada', () => {
    const win = createMatch(1);
    expect(win.maxRounds).toBe(1);
    recordRound(win, { kind: 'win', winner: 2 }, players);
    expect(win).toMatchObject({ finished: true, winnerTeam: 2 });
    const draw = createMatch(1);
    recordRound(draw, { kind: 'draw' }, players);
    expect(draw).toMatchObject({ finished: true, winnerTeam: null });
  });

  it('3 vitórias: quem chegar a 3 vence; senão até 7 rodadas', () => {
    const match = createMatch(3);
    expect(match.maxRounds).toBe(7);
    recordRound(match, { kind: 'win', winner: 1 }, players);
    recordRound(match, { kind: 'win', winner: 1 }, players);
    expect(match.finished).toBe(false);
    recordRound(match, { kind: 'win', winner: 1 }, players);
    expect(match).toMatchObject({ finished: true, winnerTeam: 1 });
  });
});

describe('IA eliminada joga das laterais', () => {
  it('a IA eliminada anda no anel e joga bombas para dentro da arena', () => {
    const state = trio();
    state.flames.push({ col: 4, row: 3, ticksLeft: 5 }); // elimina o computador (jogador 3)
    step(state);
    const ghost = state.players[2]!;
    expect(ghost.alive).toBe(false);
    expect(ghost.sideline).not.toBeNull();
    const ai = createAi(3, 'expert', 1);
    const thrownAt: Array<[number, number]> = [];
    for (let t = 0; t < 600; t++) {
      step(state, { 3: ai.decide(state) });
      for (const e of state.events) if (e.type === 'bombThrown') thrownAt.push([e.col, e.row]);
      state.events.length = 0;
    }
    expect(thrownAt.length).toBeGreaterThan(0);
    for (const [col, row] of thrownAt) expect(state.arena.cells[row * state.arena.cols + col]).not.toBe('wall');
  });

  it('a IA das laterais, contra humanos parados, costuma eliminar alguém e voltar à arena', () => {
    let revived = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = trio();
      state.flames.push({ col: 4, row: 3, ticksLeft: 5 });
      step(state);
      const ai = createAi(3, 'expert', seed);
      for (let t = 0; t < 900 && state.round.phase === 'playing'; t++) {
        step(state, { 3: ai.decide(state) });
        if (state.players[2]!.alive) {
          revived += 1;
          break;
        }
      }
    }
    expect(revived).toBeGreaterThan(2);
  });

  it('com a opção desligada, a IA eliminada não faz nada', () => {
    const off = trio();
    off.sidelineEnabled = false;
    off.flames.push({ col: 4, row: 3, ticksLeft: 5 });
    step(off);
    const ai = createAi(3, 'expert', 1);
    expect(ai.decide(off)).toEqual({ move: null, placeBomb: false });
  });
});
