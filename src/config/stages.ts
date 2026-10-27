// Fases (arenas temáticas). Importado pelo menu: sem Phaser e sem navegador.
// A clássica e a do gelo existem; as outras já aparecem na escolha como "em breve" para a lista crescer sem
// mexer no menu. Para ativar uma fase, ponha `available: true` e implemente o tema dela.

export interface StageDef {
  id: string;
  name: string;
  available: boolean;
  /** Frase curta que acompanha a fase na tela de escolha. */
  tagline: string;
}

export const STAGES: readonly StageDef[] = [
  { id: 'classic', name: 'Arena Clássica', available: true, tagline: 'Caixotes de madeira e blocos de pedra: o jeito clássico de jogar.' },
  { id: 'ice', name: 'Fase do Gelo', available: true, tagline: 'Piso gelado, blocos de neve e uma aurora no céu.' },
  { id: 'egypt', name: 'Fase do Egito', available: false, tagline: 'Areia, pedras antigas e tesouros escondidos.' },
  { id: 'train', name: 'Fase do Trenzinho', available: false, tagline: 'Trilhos, vagões e muita fumaça.' },
];

export const DEFAULT_STAGE = 'classic';

export function stageById(id: string): StageDef {
  return STAGES.find((stage) => stage.id === id) ?? STAGES[0]!;
}
