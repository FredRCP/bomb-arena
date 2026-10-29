import { describe, expect, it } from 'vitest';
import { DIRECTIONS, MUTE_KEY, PAUSE_KEY, PLAYER_CONTROLS, QUIT_KEY, RESTART_KEY } from '../../src/input/controls';

describe('controles dos jogadores', () => {
  const all = [
    ...Object.entries(PLAYER_CONTROLS).flatMap(([id, c]) =>
      [...c.up, ...c.down, ...c.left, ...c.right, ...c.bomb, ...c.special, ...c.power].map((key) => ({ id, key })),
    ),
    { id: 'partida', key: RESTART_KEY },
    { id: 'partida', key: MUTE_KEY },
    { id: 'partida', key: PAUSE_KEY },
    { id: 'partida', key: QUIT_KEY },
  ];

  it('nenhuma tecla é usada por dois comandos (nem entre jogadores, nem com reiniciar/som)', () => {
    const seen = new Map<string, string>();
    for (const { id, key } of all) {
      expect(seen.has(key), `a tecla ${key} está repetida (${seen.get(key)} e ${id})`).toBe(false);
      seen.set(key, id);
    }
  });

  it('cada jogador tem as 4 direções, a bomba e o especial', () => {
    for (const controls of Object.values(PLAYER_CONTROLS)) {
      for (const direction of DIRECTIONS) expect(controls[direction].length).toBeGreaterThan(0);
      expect(controls.bomb.length).toBeGreaterThan(0);
      expect(controls.special.length).toBeGreaterThan(0);
      expect(controls.power.length).toBeGreaterThan(0);
    }
  });

  it('jogador 1: A S D W, Espaço (bomba), E (especial)', () => {
    expect(PLAYER_CONTROLS[1]).toEqual({ up: ['W'], down: ['S'], left: ['A'], right: ['D'], bomb: ['SPACE'], special: ['E'], power: ['F'] });
  });

  it('jogador 2: 8 2 4 6 (teclado numérico ou fileira de cima), Enter (bomba), 9 (especial); setas também andam', () => {
    const c = PLAYER_CONTROLS[2];
    expect(c.up).toEqual(expect.arrayContaining(['NUMPAD_EIGHT', 'EIGHT', 'UP']));
    expect(c.down).toEqual(expect.arrayContaining(['NUMPAD_TWO', 'TWO', 'DOWN']));
    expect(c.left).toEqual(expect.arrayContaining(['NUMPAD_FOUR', 'FOUR', 'LEFT']));
    expect(c.right).toEqual(expect.arrayContaining(['NUMPAD_SIX', 'SIX', 'RIGHT']));
    expect(c.bomb).toEqual(['ENTER']);
    expect(c.special).toEqual(expect.arrayContaining(['NUMPAD_NINE', 'NINE']));
  });
});
