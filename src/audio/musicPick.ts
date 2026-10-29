import { stageById } from '../config/stages';

// Sorteio da música da partida. Separado de music.ts (que toca o áudio) para poder ser testado sem navegador.

/** Última faixa sorteada: o sorteio da partida seguinte evita repeti-la quando a fase tem mais de uma. */
let lastPicked: string | null = null;

/**
 * Sorteia a música da partida entre as da fase (config/stages.ts), evitando repetir a última sorteada.
 * Devolve undefined se a fase não tem música. `random` é injetável para testar.
 */
export function pickTrack(stageId: string, random: () => number = Math.random): string | undefined {
  const pool = stageById(stageId).music;
  if (pool.length === 0) return undefined;
  const options = pool.length > 1 ? pool.filter((file) => file !== lastPicked) : pool;
  const choice = options[Math.min(options.length - 1, Math.floor(random() * options.length))]!;
  lastPicked = choice;
  return choice;
}


/** Esquece a última faixa sorteada (para os testes). */
export function resetPick(): void {
  lastPicked = null;
}
