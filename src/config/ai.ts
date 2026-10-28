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
  normal: { thinkEveryTicks: 6, safetyMarginTicks: 5, bombCooldownTicks: 85, blockBombChance: 0.35, enemyBombChance: 0.7, itemSeekSteps: 5, usesAbilities: true, speedScale: 0.53 },
  hard: { thinkEveryTicks: 5, safetyMarginTicks: 7, bombCooldownTicks: 62, blockBombChance: 0.55, enemyBombChance: 0.8, itemSeekSteps: 6, usesAbilities: true, speedScale: 0.62 },
  expert: { thinkEveryTicks: 1, safetyMarginTicks: 9, bombCooldownTicks: 38, blockBombChance: 0.8, enemyBombChance: 0.9, itemSeekSteps: 8, usesAbilities: true, speedScale: 0.85 },
  ultra: { thinkEveryTicks: 1, safetyMarginTicks: 10, bombCooldownTicks: 30, blockBombChance: 0.95, enemyBombChance: 0.97, itemSeekSteps: 9, usesAbilities: true, speedScale: 1 },
};

export const DEFAULT_AI_DIFFICULTY: AiDifficulty = 'normal';
