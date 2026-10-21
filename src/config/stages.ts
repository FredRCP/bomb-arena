// Fases (arenas temáticas). Importado pelo menu: sem Phaser e sem navegador.
// Por enquanto só a clássica existe; as outras já aparecem na escolha como "em breve" para a lista crescer sem
// mexer no menu. Para ativar uma fase, ponha `available: true` e implemente o tema dela.

export interface StageDef {
  id: string;
  name: string;
  available: boolean;
}

export const STAGES: readonly StageDef[] = [
  { id: 'classic', name: 'Arena Clássica', available: true },
  { id: 'ice', name: 'Fase do Gelo', available: false },
  { id: 'egypt', name: 'Fase do Egito', available: false },
  { id: 'train', name: 'Fase do Trenzinho', available: false },
];

export const DEFAULT_STAGE = 'classic';

export function stageById(id: string): StageDef {
  return STAGES.find((stage) => stage.id === id) ?? STAGES[0]!;
}
