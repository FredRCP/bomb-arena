import { describe, expect, it } from 'vitest';
import { addToRanking, parseRanking, rankingPosition } from '../../src/menu/ranking';
import type { RankingEntry } from '../../src/menu/ranking';
import { loadRanking, saveRanking } from '../../src/menu/rankingStorage';

const entry = (points: number, date = '2026-10-20', name = 'Fred'): RankingEntry => ({ name, points, kills: 1, difficulty: 'normal', date });

describe('ranking (Top 10)', () => {
  it('ordena por pontos e corta em 10', () => {
    let list: RankingEntry[] = [];
    for (let i = 1; i <= 12; i++) list = addToRanking(list, entry(i * 100));
    expect(list).toHaveLength(10);
    expect(list[0]!.points).toBe(1200);
    expect(list[9]!.points).toBe(300);
  });

  it('empate de pontos: a mais antiga fica na frente', () => {
    const list = addToRanking([entry(500, '2026-10-01', 'Antiga')], entry(500, '2026-10-20', 'Nova'));
    expect(list.map((e) => e.name)).toEqual(['Antiga', 'Nova']);
  });

  it('rankingPosition: devolve a posição ou null se não entra', () => {
    const full = Array.from({ length: 10 }, (_, i) => entry(1000 - i * 10));
    expect(rankingPosition(full, entry(2000))).toBe(1);
    expect(rankingPosition(full, entry(955))).toBe(6);
    expect(rankingPosition(full, entry(10))).toBeNull();
  });

  it('ler texto estranho nunca quebra: lista vazia ou só as entradas válidas', () => {
    expect(parseRanking(null)).toEqual([]);
    expect(parseRanking('não é json')).toEqual([]);
    expect(parseRanking('{"a":1}')).toEqual([]);
    expect(parseRanking(JSON.stringify([entry(100), { name: 1 }, null, entry(300)]))).toHaveLength(2);
    expect(parseRanking(JSON.stringify([entry(100), entry(300)]))[0]!.points).toBe(300);
  });

  it('guardar e ler devolve a mesma lista; armazenamento quebrado é ignorado', () => {
    const box = new Map<string, string>();
    const storage = { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v) };
    saveRanking([entry(700)], storage);
    expect(loadRanking(storage)).toEqual([entry(700)]);
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(loadRanking(broken)).toEqual([]);
    expect(() => saveRanking([entry(1)], broken)).not.toThrow();
    expect(loadRanking(null)).toEqual([]);
  });
});
