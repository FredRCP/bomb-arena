// Gerador de números pseudoaleatórios com semente (algoritmo mulberry32).
// O core nunca usa o sorteio nativo do navegador: com semente, a mesma partida se repete
// igualzinha, o que é essencial para testes e, no futuro, para jogo online.

/** Função que devolve um número em [0, 1) a cada chamada. */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
