import { describe, expect, it } from 'vitest';
import { BOMB_FUSE_TICKS, FLAME_TICKS } from '../../src/config/bombs';
import { drainEvents, getCell, step } from '../../src/core';
import type { GameState } from '../../src/core';
import { addBomb, burning, cells, run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

// Salão 7x7 (células livres de (1,1) a (5,5)), jogador longe do centro.
const HALL = ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'];
// Corredor horizontal de (1,1) a (9,1).
const LONG = ['###########', '#.........#', '###########'];

/** Jogador 1 fora do caminho, para os testes de forma da explosão. */
function hall(lines = HALL, col = 1, row = 1): GameState {
  return stateFromText(lines, [{ id: 1, col, row }]);
}

describe('tempo do pavio e das chamas', () => {
  it('a bomba explode exatamente depois de BOMB_FUSE_TICKS passos (contando o passo em que foi colocada)', () => {
    const state = hall(HALL, 1, 1);
    step(state, { 1: { move: null, placeBomb: true } });
    state.players[0]!.x = 5.5; // sai do caminho: só queremos medir o tempo
    state.players[0]!.y = 5.5;
    drainEvents(state);

    run(state, BOMB_FUSE_TICKS - 2); // total de passos até aqui: BOMB_FUSE_TICKS - 1
    expect(state.bombs).toHaveLength(1);
    expect(state.flames).toEqual([]);

    run(state, 1); // passo número BOMB_FUSE_TICKS
    expect(state.bombs).toEqual([]);
    expect(burning(state).length).toBeGreaterThan(0);
  });

  it('as chamas ficam acesas por FLAME_TICKS passos e depois somem', () => {
    const state = hall(HALL, 5, 5);
    addBomb(state, 2, 2, { range: 1 });
    run(state, 1); // explode neste passo
    expect(state.flames.every((flame) => flame.ticksLeft === FLAME_TICKS)).toBe(true);

    run(state, FLAME_TICKS - 1);
    expect(state.flames.length).toBeGreaterThan(0);
    run(state, 1);
    expect(state.flames).toEqual([]);
  });

  it('uma nova explosão sobre chama acesa renova o tempo dela, sem duplicar a célula', () => {
    const state = hall(HALL, 5, 5);
    state.flames.push({ col: 2, row: 3, ticksLeft: 4 });
    addBomb(state, 2, 2, { range: 1 });
    run(state, 1);
    const sameCell = state.flames.filter((flame) => flame.col === 2 && flame.row === 3);
    expect(sameCell.map(({ col, row, ticksLeft }) => ({ col, row, ticksLeft }))).toEqual([{ col: 2, row: 3, ticksLeft: FLAME_TICKS }]);
  });
});

describe('forma da explosão', () => {
  it('é uma cruz com o alcance da bomba nas 4 direções', () => {
    const state = hall(HALL, 5, 5);
    addBomb(state, 3, 3, { range: 2 });
    run(state, 1);
    expect(burning(state)).toEqual(
      cells([3, 3], [2, 3], [1, 3], [4, 3], [5, 3], [3, 2], [3, 1], [3, 4], [3, 5]),
    );
  });

  it('alcance 1 e alcance 3 mudam o tamanho da cruz', () => {
    const one = hall(HALL, 5, 5);
    addBomb(one, 3, 3, { range: 1 });
    run(one, 1);
    expect(burning(one)).toEqual(cells([3, 3], [2, 3], [4, 3], [3, 2], [3, 4]));

    const three = hall(LONG, 9, 1);
    addBomb(three, 3, 1, { range: 3 });
    run(three, 1);
    expect(burning(three)).toEqual(cells([3, 1], [2, 1], [1, 1], [4, 1], [5, 1], [6, 1]));
  });

  it('alcance maior que a arena: a chama para na borda e nunca sai do mapa', () => {
    const state = hall(HALL, 5, 5);
    addBomb(state, 3, 3, { range: 50 });
    run(state, 1);
    expect(burning(state)).toEqual(
      cells([3, 3], [1, 3], [2, 3], [4, 3], [5, 3], [3, 1], [3, 2], [3, 4], [3, 5]),
    );
  });

  it('parede (pilar) para a chama e não pega fogo', () => {
    const state = hall(['#######', '#..#..#', '#.....#', '#.....#', '#######'], 1, 3);
    addBomb(state, 2, 1, { range: 3 });
    run(state, 1);
    // Direita: (3,1) é parede, então a chama nem entra nela nem passa dela.
    expect(burning(state)).not.toContain('3,1');
    expect(burning(state)).not.toContain('4,1');
    expect(burning(state)).toEqual(cells([2, 1], [1, 1], [2, 2], [2, 3]));
  });

  it('bomba colada na parede só queima para o lado livre', () => {
    const state = hall(HALL, 5, 5);
    addBomb(state, 1, 1, { range: 2 });
    run(state, 1);
    expect(burning(state)).toEqual(cells([1, 1], [2, 1], [3, 1], [1, 2], [1, 3]));
  });
});

describe('blocos destrutíveis', () => {
  const WITH_BLOCKS = ['###########', '#...o.o...#', '###########'];

  it('a chama entra no bloco, o destrói e para ali', () => {
    const state = hall(WITH_BLOCKS, 9, 1);
    addBomb(state, 2, 1, { range: 5 });
    run(state, 1);
    // Direita: (3,1) livre, (4,1) bloco -> destruído; (5,1) e (6,1)(bloco) ficam de fora.
    expect(burning(state)).toEqual(cells([2, 1], [1, 1], [3, 1], [4, 1]));
    expect(getCell(state.arena, 4, 1)).toBe('empty');
    expect(getCell(state.arena, 6, 1)).toBe('block');
  });

  it('gera um evento por bloco destruído', () => {
    const state = hall(WITH_BLOCKS, 9, 1);
    addBomb(state, 5, 1, { range: 5 });
    run(state, 1);
    const events = drainEvents(state);
    expect(events.filter((e) => e.type === 'blockDestroyed')).toEqual([
      { type: 'blockDestroyed', col: 4, row: 1 },
      { type: 'blockDestroyed', col: 6, row: 1 },
    ]);
    expect(events.filter((e) => e.type === 'bombExploded')).toEqual([
      { type: 'bombExploded', col: 5, row: 1, owner: 1 },
    ]);
  });

  it('dois blocos em fila: só o primeiro é destruído', () => {
    const state = hall(['#######', '#.oo..#', '#######'], 5, 1);
    addBomb(state, 1, 1, { range: 4 });
    run(state, 1);
    expect(getCell(state.arena, 2, 1)).toBe('empty');
    expect(getCell(state.arena, 3, 1)).toBe('block');
  });

  it('o espaço do bloco destruído passa a ser livre para andar, e a chama dele é perigosa por um tempo', () => {
    const state = hall(['#######', '#.o...#', '#######'], 5, 1);
    addBomb(state, 1, 1, { range: 2 });
    run(state, 1);
    state.players[0]!.x = 3.5; // longe da chama; anda para a esquerda até o espaço do bloco
    run(state, FLAME_TICKS); // chamas apagam
    expect(state.flames).toEqual([]);
    run(state, 60, { 1: { move: 'left' } });
    expect(state.players[0]!.x).toBeLessThan(2); // atravessou onde havia o bloco
  });
});

describe('reação em cadeia', () => {
  it('uma bomba atingida explode no mesmo passo, mesmo com o pavio longe do fim', () => {
    const state = hall(LONG, 9, 1);
    addBomb(state, 2, 1, { range: 3, ticksLeft: 1 });
    addBomb(state, 4, 1, { range: 1, ticksLeft: 500 });
    run(state, 1);
    expect(state.bombs).toEqual([]);
    const events = drainEvents(state).filter((e) => e.type === 'bombExploded');
    expect(events).toHaveLength(2);
  });

  it('a chama para na bomba atingida: o que está depois dela só queima se a outra bomba alcançar', () => {
    const state = hall(LONG, 9, 1);
    addBomb(state, 1, 1, { range: 6, ticksLeft: 1 });
    addBomb(state, 3, 1, { range: 1, ticksLeft: 500 });
    run(state, 1);
    // A primeira chega até (3,1) e para ali; a segunda (alcance 1) queima (2,1) e (4,1). A célula (5,1) fica livre.
    expect(burning(state)).toEqual(cells([1, 1], [2, 1], [3, 1], [4, 1]));
  });

  it('cadeia de três bombas, em curva', () => {
    const state = hall(HALL, 5, 5);
    addBomb(state, 1, 1, { range: 2, ticksLeft: 1 }); // atinge (3,1)
    addBomb(state, 3, 1, { range: 2, ticksLeft: 999 }); // atinge (3,3)
    addBomb(state, 3, 3, { range: 1, ticksLeft: 999 });
    run(state, 1);
    expect(state.bombs).toEqual([]);
    expect(burning(state)).toContain('4,3');
  });

  it('bomba fora de alcance não explode', () => {
    const state = hall(LONG, 9, 1);
    addBomb(state, 2, 1, { range: 2, ticksLeft: 1 });
    addBomb(state, 6, 1, { range: 1, ticksLeft: 500 });
    run(state, 1);
    expect(state.bombs).toHaveLength(1);
  });

  it('a cadeia é resolvida em UM passo, e não uma bomba por passo', () => {
    const state = hall(LONG, 9, 1);
    for (const col of [1, 3, 5, 7]) addBomb(state, col, 1, { range: 2, ticksLeft: col === 1 ? 1 : 999 });
    run(state, 1);
    expect(state.bombs).toEqual([]);
  });
});

describe('explosões simultâneas', () => {
  const ROW = ['###########', '#...o.....#', '###########'];

  it('não dependem da ordem das bombas na lista', () => {
    function resultado(reverse: boolean): { flames: string[]; cells: string[]; events: string[] } {
      const state = hall(ROW, 9, 1);
      const specs: Array<[number, number]> = [
        [1, 5],
        [7, 3],
      ];
      for (const [col, range] of reverse ? [...specs].reverse() : specs) addBomb(state, col, 1, { range });
      run(state, 1);
      return {
        flames: burning(state),
        cells: [...state.arena.cells],
        events: drainEvents(state)
          .map((e) => JSON.stringify(e))
          .sort(),
      };
    }
    expect(resultado(true)).toEqual(resultado(false));
  });

  it('duas bombas atingindo o mesmo bloco: ele é destruído uma vez só (um evento)', () => {
    const state = hall(ROW, 9, 1);
    addBomb(state, 2, 1, { range: 3 });
    addBomb(state, 6, 1, { range: 3 });
    run(state, 1);
    const destroyed = drainEvents(state).filter((e) => e.type === 'blockDestroyed');
    expect(destroyed).toEqual([{ type: 'blockDestroyed', col: 4, row: 1 }]);
  });

  it('o bloco destruído por uma bomba NÃO deixa a chama da outra passar no mesmo passo', () => {
    // A bomba em 1 tem alcance 5 e, se o bloco em 4 sumisse antes, queimaria até 6.
    const state = hall(ROW, 9, 1);
    addBomb(state, 1, 1, { range: 5 });
    addBomb(state, 7, 1, { range: 1 }); // alcança (6,1), mas não (5,1) nem (4,1)
    run(state, 1);
    expect(burning(state)).toEqual(cells([1, 1], [2, 1], [3, 1], [4, 1], [6, 1], [7, 1], [8, 1]));
    expect(burning(state)).not.toContain('5,1');
  });

  it('duas bombas com o pavio acabando no mesmo passo explodem as duas', () => {
    const state = hall(HALL, 5, 5);
    addBomb(state, 1, 1, { range: 1 });
    addBomb(state, 5, 1, { range: 1 });
    run(state, 1);
    expect(state.bombs).toEqual([]);
    expect(burning(state)).toEqual(cells([1, 1], [2, 1], [1, 2], [5, 1], [4, 1], [5, 2]));
  });
});

describe('dano aos jogadores', () => {
  it('quem está na cruz morre, uma vez só, com um evento playerHit', () => {
    const state = hall(HALL, 3, 5);
    addBomb(state, 3, 3, { range: 2 });
    run(state, 1);
    expect(state.players[0]!.alive).toBe(false);
    run(state, 5);
    expect(drainEvents(state).filter((e) => e.type === 'playerHit')).toEqual([{ type: 'playerHit', playerId: 1, killers: [] }]);
  });

  it('quem está fora da cruz continua vivo', () => {
    const state = hall(HALL, 5, 5);
    addBomb(state, 3, 3, { range: 2 });
    run(state, 1);
    expect(state.players[0]!.alive).toBe(true);
  });

  it('quem está em cima da bomba quando ela explode morre', () => {
    const state = hall(HALL, 3, 3);
    addBomb(state, 3, 3, { range: 1, walkThrough: [1] });
    run(state, 1);
    expect(state.players[0]!.alive).toBe(false);
  });

  it('a chama não passa por trás de um bloco: quem está atrás dele fica vivo', () => {
    const state = hall(['#######', '#.o...#', '#######'], 3, 1);
    addBomb(state, 1, 1, { range: 4 });
    run(state, 1);
    expect(state.players[0]!.alive).toBe(true);
  });

  it('o dano vale pela célula do CENTRO do corpo', () => {
    const noLimite = hall(LONG, 1, 1);
    noLimite.flames.push({ col: 2, row: 1, ticksLeft: 10 });
    noLimite.players[0]!.x = 1.99; // centro ainda na célula 1, corpo já dentro da 2
    run(noLimite, 1);
    expect(noLimite.players[0]!.alive).toBe(true);

    const dentro = hall(LONG, 1, 1);
    dentro.flames.push({ col: 2, row: 1, ticksLeft: 10 });
    dentro.players[0]!.x = 2.0;
    run(dentro, 1);
    expect(dentro.players[0]!.alive).toBe(false);
  });

  it('quem ENTRA numa célula ainda em chamas é atingido', () => {
    const state = hall(LONG, 1, 1);
    state.flames.push({ col: 3, row: 1, ticksLeft: 30 });
    run(state, 40, { 1: { move: 'right' } });
    expect(state.players[0]!.alive).toBe(false);
    expect(state.players[0]!.x).toBeLessThan(3.5); // morreu ao chegar, não seguiu andando
  });

  it('quem chega só DEPOIS de a chama apagar passa em segurança', () => {
    const state = hall(LONG, 1, 1);
    state.flames.push({ col: 3, row: 1, ticksLeft: 2 });
    run(state, 40, { 1: { move: 'right' } });
    expect(state.players[0]!.alive).toBe(true);
    expect(state.players[0]!.x).toBeGreaterThan(4);
  });

  it('morto fica morto: não anda, não coloca bomba e não revive quando a chama apaga', () => {
    const state = hall(LONG, 3, 1);
    state.flames.push({ col: 3, row: 1, ticksLeft: 5 });
    run(state, 1);
    expect(state.players[0]!.alive).toBe(false);

    const { x, y } = state.players[0]!;
    run(state, FLAME_TICKS + 10, { 1: { move: 'right', placeBomb: true } });
    expect(state.players[0]).toMatchObject({ x, y, alive: false });
    expect(state.bombs).toEqual([]);
  });

  it('as bombas de quem morreu continuam valendo', () => {
    const state = hall(LONG, 9, 1);
    state.players[0]!.alive = false;
    addBomb(state, 2, 1, { range: 1, owner: 1, ticksLeft: 3 });
    run(state, 3);
    expect(state.bombs).toEqual([]);
    expect(burning(state)).toContain('2,1');
  });

  it('dois jogadores atingidos no mesmo passo: os dois morrem (a decisão de empate é da Etapa 4)', () => {
    const state = stateFromText(LONG, [
      { id: 1, col: 3, row: 1 },
      { id: 2, col: 5, row: 1 },
    ]);
    addBomb(state, 4, 1, { range: 1 });
    run(state, 1);
    expect(state.players.map((p) => p.alive)).toEqual([false, false]);
    expect(drainEvents(state).filter((e) => e.type === 'playerHit')).toHaveLength(2);
  });

  it('um jogador pode matar o outro sem se ferir', () => {
    const state = stateFromText(LONG, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 5, row: 1 },
    ]);
    addBomb(state, 6, 1, { range: 2, owner: 1 });
    run(state, 1);
    expect(state.players.map((p) => p.alive)).toEqual([true, false]);
  });
});

describe('fluxo completo pelo jogador', () => {
  it('coloca a bomba, foge e sobrevive; ficar parado em cima dela é morte', () => {
    const fugir = stateFromText(['#####', '#...#', '#.#.#', '#...#', '#####'], [{ id: 1, col: 1, row: 1 }]);
    step(fugir, { 1: { move: null, placeBomb: true } });
    run(fugir, 30, { 1: { move: 'right' } }); // para a direita
    run(fugir, 30, { 1: { move: 'down' } }); // para baixo: sai da linha 1 e da coluna 1
    run(fugir, BOMB_FUSE_TICKS);
    expect(fugir.players[0]!.alive).toBe(true);

    const parado = stateFromText(['#####', '#...#', '#.#.#', '#...#', '#####'], [{ id: 1, col: 1, row: 1 }]);
    step(parado, { 1: { move: null, placeBomb: true } });
    run(parado, BOMB_FUSE_TICKS);
    expect(parado.players[0]!.alive).toBe(false);
  });

  it('é determinístico: o mesmo roteiro gera exatamente o mesmo estado', () => {
    function jogar(): GameState {
      const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1, maxBombs: 3 }]);
      for (let round = 0; round < 30; round++) {
        step(state, { 1: { move: 'right', placeBomb: round % 7 === 0 } });
        run(state, 20, { 1: { move: round % 2 === 0 ? 'down' : 'left' } });
      }
      return state;
    }
    expect(jogar()).toEqual(jogar());
  });
});
