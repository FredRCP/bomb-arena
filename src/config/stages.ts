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

const STAGES_BASE: readonly StageDef[] = [
  { id: 'classic', name: 'Arena Clássica', available: true, tagline: 'Caixotes de madeira e blocos de pedra: o jeito clássico de jogar.', cols: 15, rows: 13, maxPlayers: 5, mobileOk: true, music: ['audio/100_victories.ogg'] },
  { id: 'classic17', name: 'Arena Clássica Grande', theme: 'classic', available: true, tagline: 'A clássica em tamanho família (19 x 13), com mais espaço para fugir.', cols: 19, rows: 13, maxPlayers: 7, mobileOk: false, music: ['audio/100_victories.ogg'] },
  { id: 'ice', name: 'Fase do Gelo', available: true, tagline: 'Neve caindo, faixas escorregadias, gelo fino que racha e dois iglus que soltam bola de neve e pinguim!', cols: 15, rows: 13, maxPlayers: 5, mobileOk: true, hazards: { slippery: true, thinIce: true, igloo: true, regrow: true }, music: ['audio/gelo_loop.ogg', 'audio/gelo_intro.ogg'] },
  {
    id: 'egypt',
    name: 'Fase do Egito',
    available: true,
    tagline: 'Pirâmide com túneis secretos, areia redemoinho e flechas que deixam você lento. Cuidado com o aviso!',
    cols: 17,
    rows: 13,
    maxPlayers: 6,
    mobileOk: true,
    hazards: { quicksand: true, dartRow: 9, pyramid: true },
    music: ['audio/egypt.ogg', 'audio/suez.ogg'],
  },
  {
    id: 'temple',
    name: 'Templo Perdido',
    available: true,
    tagline: 'Abismo com templo no meio, pontes de corda que desabam (avisam antes!) e pedras gigantes que descem atordoando tudo. Atenção ao tremor!',
    cols: 17,
    rows: 13,
    maxPlayers: 4,
    mobileOk: true,
    hazards: { chasm: true, boulder: true, island: true, bridgeFall: true },
    music: ['audio/temple_a.ogg', 'audio/temple_b.ogg', 'audio/sinister_abode.ogg'],
  },
  {
    id: 'pirates',
    name: 'Ilha dos Piratas',
    available: true,
    tagline: 'Cofres, barris e baús na areia e 3 canhões nas margens que bombardeiam a arena (a sombra avisa 2 s antes)!',
    cols: 17,
    rows: 13,
    maxPlayers: 7,
    mobileOk: true,
    hazards: { cannons: true },
    music: ['audio/pirata_adventure.ogg', 'audio/piratas.ogg'],
  },
  {
    id: 'sea',
    name: 'Fundo do Mar',
    available: true,
    tagline: 'Correntezas empurram em linha, bolhas escondem itens e as bombas são minas marinhas. Bolhas de ar por toda parte!',
    cols: 17,
    rows: 13,
    maxPlayers: 7,
    mobileOk: false,
    hazards: { currents: true },
    music: ['audio/mar.ogg'],
  },
  {
    id: 'volcano',
    name: 'Vulcão',
    available: true,
    tagline: 'Dois rios de lava cruzam a arena (e acionam as bombas que tocam), o vulcão entra em erupção e lança bolas de fogo (a sombra avisa 2 s antes) e a tela treme. Nuvens de fumaça e fagulhas por toda parte!',
    cols: 17,
    rows: 13,
    maxPlayers: 6,
    mobileOk: true,
    hazards: { lava: true, volcano: true },
    music: ['audio/vulcao.ogg'],
  },
  {
    id: 'jungle',
    name: 'Selva',
    available: true,
    tagline: 'Troncos gigantes rolam pelas trilhas de lama (a trilha pisca antes!). Cipós, folhas e muita vegetação para esconder itens.',
    cols: 17,
    rows: 13,
    maxPlayers: 6,
    mobileOk: false,
    hazards: { traffic: 'log' },
    music: ['audio/temple_b.ogg'],
  },
  {
    id: 'racing',
    name: 'Pista de Corrida',
    available: true,
    tagline: 'Duas pistas de asfalto com carros de corrida em alta velocidade, cada uma numa mão. Quando as luzes piscam, saia da pista!',
    cols: 17,
    rows: 13,
    maxPlayers: 7,
    mobileOk: false,
    hazards: { traffic: 'cars' },
    music: ['audio/8bit_bossa.mp3'],
  },
  {
    id: 'construction',
    name: 'Canteiro de Obras',
    available: true,
    tagline: 'Tratores de esteira abrem caminho pelas duas trilhas de terra, bem devagar mas esmagando tudo. Capacete e atenção!',
    cols: 17,
    rows: 13,
    maxPlayers: 6,
    mobileOk: false,
    hazards: { traffic: 'bulldozer' },
    music: ['audio/classic.ogg'],
  },
  {
    id: 'playground',
    name: 'Parquinho',
    available: true,
    tagline: 'Bolas gigantes rolam pelas quatro trilhas de areia. Areia, castelinhos e muita bagunça: cuidado com a bola!',
    cols: 15,
    rows: 13,
    maxPlayers: 5,
    mobileOk: true,
    hazards: { traffic: 'ball' },
    music: ['audio/100_victories.ogg'],
  },
  {
    id: 'train',
    name: 'Trenzinho',
    available: true,
    tagline: 'Um trem cruza a estação por uma linha horizontal e outra vertical. A sirene toca e as luzes piscam antes: não fique nos trilhos!',
    cols: 17,
    rows: 13,
    maxPlayers: 6,
    mobileOk: false,
    hazards: { traffic: 'train' },
    music: ['audio/suez.ogg'],
  },
];

/** Versão grande (19 x 13) de uma fase: mesmo tema e perigos, mais espaço e mais jogadores. */
function bigVersion(id: string, name: string, maxPlayers: number): StageDef {
  const base = STAGES_BASE.find((stage) => stage.id === id)!;
  return { ...base, id: `${id}19`, name, theme: themeIdOf(base), cols: 19, maxPlayers, mobileOk: false, tagline: `${base.name} em tamanho família (19 x 13), com mais espaço e até ${maxPlayers} jogadores.` };
}

const BIG: Record<string, [string, number]> = {
  ice: ['Fase do Gelo Grande', 7],
  egypt: ['Fase do Egito Grande', 7],
  temple: ['Templo Perdido Grande', 6],
  volcano: ['Vulcão Grande', 7],
};

/** A lista final: cada fase com versão grande aparece logo depois da versão normal. */
export const STAGES: readonly StageDef[] = STAGES_BASE.flatMap((stage) => {
  const big = BIG[stage.id];
  return big ? [stage, bigVersion(stage.id, big[0], big[1])] : [stage];
});

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
