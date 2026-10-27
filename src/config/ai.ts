// Dificuldades da IA. Importado pelo core: sem Phaser e sem navegador.
// Tempo em passos de simulação (60 por segundo).

/** Cinco níveis, do mais calmo ao mais cruel. Os nomes exibidos ficam em menu/menuModel.ts. */
export type AiDifficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'ultra';

export interface AiSettings {
  /** A IA "pensa" a cada N passos e repete a última decisão nos outros. Maior = reação mais lenta. */
  thinkEveryTicks: number;
  /** Folga extra de tempo (passos) que ela exige ao julgar se um caminho é seguro. Maior = mais cautelosa. */
  safetyMarginTicks: number;
  /** Tempo mínimo entre uma bomba que ela coloca e a próxima. */
  bombCooldownTicks: number;
  /** Chance, a cada decisão, de bombardear o bloco que bloqueia o caminho até o inimigo (quando há saída segura). */
  blockBombChance: number;
  /** Chance, a cada decisão, de bombardear um inimigo que está na mira quando há saída segura. */
  enemyBombChance: number;
  /** Até quantas células de distância ela vai buscar um item no chão (0 = ignora itens). */
  itemSeekSteps: number;
  /** Usa de propósito as habilidades (chutar e arremessar bombas)? A fácil não. */
  usesAbilities: boolean;
  /** Velocidade base do inimigo em relação à das pessoas (1 = igual; 0,5 = metade; 1,2 = 20% mais rápido). */
  speedScale: number;
}

export const AI_SETTINGS: Record<AiDifficulty, AiSettings> = {
  easy: { thinkEveryTicks: 12, safetyMarginTicks: 0, bombCooldownTicks: 150, blockBombChance: 0.15, enemyBombChance: 0.5, itemSeekSteps: 4, usesAbilities: false, speedScale: 0.5 },
  normal: { thinkEveryTicks: 5, safetyMarginTicks: 6, bombCooldownTicks: 70, blockBombChance: 0.45, enemyBombChance: 0.85, itemSeekSteps: 6, usesAbilities: true, speedScale: 0.55 },
  hard: { thinkEveryTicks: 4, safetyMarginTicks: 8, bombCooldownTicks: 50, blockBombChance: 0.7, enemyBombChance: 0.9, itemSeekSteps: 7, usesAbilities: true, speedScale: 0.72 },
  expert: { thinkEveryTicks: 1, safetyMarginTicks: 10, bombCooldownTicks: 28, blockBombChance: 0.92, enemyBombChance: 0.96, itemSeekSteps: 9, usesAbilities: true, speedScale: 1 },
  ultra: { thinkEveryTicks: 1, safetyMarginTicks: 10, bombCooldownTicks: 24, blockBombChance: 1, enemyBombChance: 1, itemSeekSteps: 10, usesAbilities: true, speedScale: 1.1 },
};

export const DEFAULT_AI_DIFFICULTY: AiDifficulty = 'normal';
