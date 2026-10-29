// Fases (arenas temáticas). Importado pelo menu: sem Phaser e sem navegador.
// Cada fase tem o próprio tamanho de arena, o limite de jogadores, os perigos do terreno e as músicas.
// As "em breve" já aparecem na escolha, para a lista crescer sem mexer no menu.
// Para ativar uma fase: `available: true`, o tema dela em render/theme.ts e as imagens em public/themes/<tema>/.

import type { HazardOptions } from '../core/hazards';

export interface StageDef {
  id: string;
  name: string;
  available: boolean;
  /** Frase curta que acompanha a fase na tela de escolha. */
  tagline: string;
  /** Tema visual (pasta em public/themes e entrada em render/theme.ts). Padrão: o próprio id. */
  theme?: string;
  /** Colunas e linhas da arena, contando as paredes da borda (ímpares). */
  cols: number;
  rows: number;
  /** Máximo de jogadores (pessoas + computador) que cabem na fase. */
  maxPlayers: number;
  /** Cabe no celular? Arenas largas ficam desligadas em telas de toque (a arena ficaria pequena demais). */
  mobileOk: boolean;
  /** Perigos do terreno (veja core/hazards.ts). */
  hazards?: HazardOptions;
  /** Músicas da fase (relativas a public/). Uma é sorteada a cada partida. Vazio = sem música. */
  music: readonly string[];
}

export const STAGES: readonly StageDef[] = [
  { id: 'classic', name: 'Arena Clássica', available: true, tagline: 'Caixotes de madeira e blocos de pedra: o jeito clássico de jogar.', cols: 15, rows: 13, maxPlayers: 5, mobileOk: true, music: ['audio/classic.ogg'] },
  { id: 'classic17', name: 'Arena Clássica Grande', theme: 'classic', available: true, tagline: 'A clássica em tamanho família (17 x 13), com mais espaço para fugir.', cols: 17, rows: 13, maxPlayers: 5, mobileOk: false, music: ['audio/classic.ogg'] },
  { id: 'ice', name: 'Fase do Gelo', available: true, tagline: 'Piso gelado, blocos de neve e uma aurora no céu.', cols: 15, rows: 13, maxPlayers: 5, mobileOk: true, music: [] },
  {
    id: 'egypt',
    name: 'Fase do Egito',
    available: true,
    tagline: 'Pirâmides, esfinge, areia movediça e uma armadilha de dardos. Cuidado com o aviso!',
    cols: 17,
    rows: 13,
    maxPlayers: 4,
    mobileOk: false,
    hazards: { quicksand: true, dartRow: 5, sphinx: true },
    music: ['audio/egypt.ogg', 'audio/suez.ogg'],
  },
  { id: 'train', name: 'Fase do Trenzinho', available: false, tagline: 'Trilhos, vagões e muita fumaça.', cols: 15, rows: 13, maxPlayers: 5, mobileOk: true, music: [] },
];

export const DEFAULT_STAGE = 'classic';

/** Música tocada quando o tempo acaba e os blocos começam a fechar a arena (vale para todas as fases). */
export const SUDDEN_DEATH_MUSIC = 'audio/fechando_blocos.ogg';

export function stageById(id: string): StageDef {
  return STAGES.find((stage) => stage.id === id) ?? STAGES[0]!;
}

/** Tema visual da fase. */
export function themeIdOf(stage: StageDef): string {
  return stage.theme ?? stage.id;
}
