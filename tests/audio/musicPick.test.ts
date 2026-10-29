import { beforeEach, describe, expect, it } from 'vitest';
import { pickTrack, resetPick } from '../../src/audio/musicPick';

describe('sorteio da música da partida', () => {
  beforeEach(() => resetPick());

  it('fase com uma música sempre devolve ela', () => {
    expect(pickTrack('classic', () => 0.9)).toBe('audio/100_victories.ogg');
    expect(pickTrack('classic', () => 0.1)).toBe('audio/100_victories.ogg');
    expect(['audio/gelo_loop.ogg', 'audio/gelo_intro.ogg']).toContain(pickTrack('ice', () => 0)); // o gelo tem duas
  });

  it('fase com mais de uma música sorteia entre elas e não repete a anterior', () => {
    const first = pickTrack('egypt', () => 0);
    const second = pickTrack('egypt', () => 0);
    expect(['audio/egypt.ogg', 'audio/suez.ogg']).toContain(first);
    expect(second).not.toBe(first);
    const seen = new Set<string | undefined>();
    for (let i = 0; i < 6; i++) seen.add(pickTrack('egypt', Math.random));
    expect(seen.size).toBe(2);
  });
});
