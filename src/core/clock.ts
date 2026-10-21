import { MAX_TICKS_PER_FRAME, TICKS_PER_SECOND } from '../config/simulation';

// Passo fixo: transforma o tempo real de cada quadro (que varia) num número inteiro de passos de
// simulação (que não varia). Quem chama passa quantos milissegundos se passaram; o relógio acumula
// o resto e diz quantos passos rodar agora. Não lê o relógio do sistema: recebe o tempo de fora.

/** Tolerância para somas de milissegundos com erro de arredondamento. */
const EPS = 1e-6;

export interface FixedStepper {
  /** Informa que passaram `deltaMs` milissegundos e devolve quantos passos de simulação rodar. */
  advance(deltaMs: number): number;
  /** Esquece o tempo acumulado (útil ao reiniciar a partida). */
  reset(): void;
}

export function createFixedStepper(
  ticksPerSecond: number = TICKS_PER_SECOND,
  maxTicksPerFrame: number = MAX_TICKS_PER_FRAME,
): FixedStepper {
  const stepMs = 1000 / ticksPerSecond;
  let accumulated = 0;

  return {
    advance(deltaMs: number): number {
      if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;

      accumulated += deltaMs;
      let ticks = Math.floor((accumulated + EPS) / stepMs);
      accumulated = Math.max(0, accumulated - ticks * stepMs);

      // Depois de uma pausa longa, descarta o atraso em vez de tentar "recuperar" tudo de uma vez.
      if (ticks > maxTicksPerFrame) {
        ticks = maxTicksPerFrame;
        accumulated = 0;
      }
      return ticks;
    },

    reset(): void {
      accumulated = 0;
    },
  };
}
