// Tipos do core. Aqui não há Phaser, nem janela, nem documento: só dados.

/** O que existe em cada célula da arena. */
/** `hole`: buraco no gelo (impede a passagem, mas o fogo atravessa). */
export type CellType = 'empty' | 'wall' | 'block' | 'hole';

/** Posição de uma célula na grade (col = coluna, row = linha; começam em 0 no canto superior esquerdo). */
export interface Cell {
  col: number;
  row: number;
}

export interface Arena {
  readonly cols: number;
  readonly rows: number;
  /** Células em ordem de linhas: o índice de (col, row) é row * cols + col. */
  cells: CellType[];
}

/** 1 e 2 são jogadores humanos; de 3 a 5 só existem como inimigos controlados pelo computador (máximo de 5 na arena). */
export type PlayerId = 1 | 2 | 3 | 4 | 5;

export type Direction = 'up' | 'down' | 'left' | 'right';

/** O que o jogador quer fazer neste instante. O core recebe intenções, nunca teclas. */
export interface PlayerIntent {
  /** Direção em que quer andar, ou null se quer ficar parado. Uma direção por vez (sem diagonais). */
  move: Direction | null;
  /** Quer colocar uma bomba neste passo? É um aperto único (segurar a tecla não coloca várias). */
  placeBomb?: boolean;
  /** Quer usar a habilidade especial neste passo (detonar bomba-relógio ou arremessar a bomba em que pisa)? Aperto único. */
  special?: boolean;
  /** Quer usar o superpoder do personagem neste passo (se estiver carregado)? Aperto único. */
  power?: boolean;
}

/** Intenção de cada jogador; quem não aparece fica parado. */
export type Intents = Partial<Record<PlayerId, PlayerIntent>>;

export interface PlayerState {
  id: PlayerId;
  /**
   * Posição do centro do jogador em unidades de célula (não em pixels).
   * x = col + 0.5 é o centro da coluna `col`; y = row + 0.5 é o centro da linha `row`.
   */
  x: number;
  y: number;
  /**
   * Time do jogador. A rodada só termina quando sobra um único time vivo. Veja `TeamMode` em state.ts: cada um por
   * si (o número do time é o id do jogador), pessoas contra o computador (times 1 e 2) ou times misturados.
   */
  team: number;
  /** Controlado pelo computador (a IA)? Falso para pessoas. */
  cpu: boolean;
  /** Falso depois de ser atingido por uma chama. Quem morreu não anda nem coloca bombas. */
  alive: boolean;
  /** Alcance das bombas que este jogador coloca (cada item de alcance soma 1). */
  bombRange: number;
  /** Máximo de bombas dele ao mesmo tempo na arena (cada item de bomba soma 1). */
  maxBombs: number;
  /** Quantos itens de velocidade ele pegou (cada um soma SPEED_PER_ITEM células/s; veja config/items.ts). */
  speedBonus: number;
  /** Multiplicador da velocidade base (1 = normal). Inimigos do computador fáceis/normais andam mais devagar. */
  speedScale: number;
  /** Para onde está olhando (a última direção em que andou): é a direção do arremesso. */
  facing: Direction;
  /** Item de chute: andar contra uma bomba a empurra. */
  canKick: boolean;
  /** Item perfurante: as bombas colocadas dali em diante atravessam os blocos. */
  piercing: boolean;
  /** Item bomba-relógio: as bombas colocadas dali em diante só explodem quando o dono aperta o especial. */
  remote: boolean;
  /** Item de arremesso: o especial, em cima da própria bomba, a joga para a frente. */
  canThrow: boolean;
  /** Passos que faltam do item fantasma (atravessar blocos destrutíveis). 0 = sem efeito. */
  ghostTicks: number;
  /** Passos que faltam do item ruim "controles invertidos". 0 = controles normais. */
  invertTicks: number;
  /** Passos de proteção contra chamas (depois de voltar à arena). 0 = sem proteção. */
  shieldTicks: number;
  /** Colete à prova de bala: aguenta uma explosão e se desfaz. */
  vest: boolean;
  /** Passos que faltam do super-herói (imune às chamas). 0 = sem efeito. */
  heroTicks: number;
  /** Casa em que o jogador nasceu: é para onde ele volta quando renasce. */
  spawn: Cell;
  /**
   * Eliminado, mas ainda jogando das laterais: índice da casa do anel de borda onde ele está (veja sideline.ts).
   * null = não está nas laterais (vivo, ou eliminado sem direito a voltar).
   */
  sideline: number | null;
  /** Passos até poder andar de novo no anel (só nas laterais). */
  sidelineCooldown: number;
  /** Piso de gelo: direção em que o jogador está deslizando (null/ausente = parado). */
  slide?: Direction | null;
  /** Superpoder do personagem e a carga dele (0 a POWER_CHARGE_TICKS). Ausente = sem poder. */
  power?: { kind: PowerKind; charge: number };
}

/** Superpoderes que existem: o elefantinho da Ana. */
export type PowerKind = 'elephant' | 'airplane';

/** Elefantinho em disparada: o centro dele (em células) e a direção. */
/** Porta de um iglu: de onde saem as bolas de neve e os pinguins, com os passos até a próxima saída e quantas já saíram. */
export interface IglooDoor {
  col: number;
  row: number;
  timer: number;
  count: number;
}

export type RollerKind = 'snowball' | 'penguin';

/** Bola de neve ou pinguim que desce do iglu: (x, y) é o centro, em células. */
export interface RollerState {
  id: number;
  kind: RollerKind;
  x: number;
  y: number;
}

/** Avião do Lucas (superpoder): voa em linha reta pela arena largando bombas em células aleatórias perto da linha de voo. */
export interface PlaneState {
  id: number;
  owner: PlayerId;
  /** Posição do centro, em células (pode estar fora da arena, na entrada e na saída). */
  x: number;
  y: number;
  dir: Direction;
  /** Passos até a próxima bomba. */
  nextDrop: number;
}

export interface ElephantState {
  id: number;
  owner: PlayerId;
  x: number;
  y: number;
  dir: Direction;
  /** Quantos blocos já quebrou. */
  broken?: number;
}

/**
 * Tipos de item: +1 bomba simultânea, +1 de alcance, +velocidade, e as habilidades: chute (kick), explosão
 * perfurante (pierce), bomba-relógio (remote), arremesso (throw) e fantasma (ghost: atravessa blocos por um tempo).
 */
export type ItemKind = 'bomb' | 'range' | 'speed' | 'kick' | 'pierce' | 'remote' | 'throw' | 'ghost' | 'invert' | 'slow' | 'vest' | 'hero';

/** Um item numa célula: escondido num bloco (`hiddenItems`) ou já no chão (`items`). */
export interface ItemState {
  col: number;
  row: number;
  kind: ItemKind;
}

export interface BombState {
  owner: PlayerId;
  /** Célula em que a bomba está (bombas ficam sempre numa célula inteira). */
  col: number;
  row: number;
  /** Passos que faltam para explodir. */
  ticksLeft: number;
  /** Alcance da explosão, fixado no momento em que a bomba foi colocada. */
  range: number;
  /**
   * Jogadores que ainda estão em cima da bomba e por isso podem sair dela. Quando o corpo de um deles
   * deixa a célula, ele sai desta lista e a bomba passa a bloqueá-lo como bloqueia todo mundo.
   */
  walkThrough: PlayerId[];
  /** Explosão perfurante: atravessa (e destrói) todos os blocos dentro do alcance. */
  pierce?: boolean;
  /** Bomba-relógio: só explode quando o dono detona (ou quando o pavio longo de segurança acaba). */
  remote?: boolean;
  /** Bomba chutada deslizando: direção e passos desde o último deslize. null/ausente = parada. */
  slide?: { direction: Direction; ticks: number } | null;
}

/** Uma célula em chamas. Machuca quem estiver nela enquanto `ticksLeft` for maior que zero. */
export interface FlameState {
  col: number;
  row: number;
  ticksLeft: number;
  /** Donos das bombas que acenderam esta chama (para saber quem eliminou quem). */
  owners?: PlayerId[];
}

/** Fatos que aconteceram, para o desenho e o som reagirem. Não são regras: a regra já está no estado. */
export type GameEvent =
  | { type: 'bombPlaced'; col: number; row: number; owner: PlayerId }
  | { type: 'bombExploded'; col: number; row: number; owner: PlayerId }
  | { type: 'blockDestroyed'; col: number; row: number }
  /** `killers` = donos das bombas que o eliminaram (sem ele mesmo); vazio = ele mesmo; `crushed` = esmagado pela morte súbita. */
  | { type: 'playerHit'; playerId: PlayerId; killers: PlayerId[]; crushed?: boolean; dart?: boolean }
  /** O colete aguentou uma explosão e se desfez (o jogador segue vivo). */
  | { type: 'vestBroken'; playerId: PlayerId }
  /** Um jogador eliminado voltou à arena (porque uma bomba dele eliminou alguém). */
  | { type: 'playerRevived'; playerId: PlayerId; col: number; row: number }
  | { type: 'itemSpawned'; col: number; row: number; kind: ItemKind }
  /** Uma explosão destruiu o item que estava no chão. */
  | { type: 'itemDestroyed'; col: number; row: number; kind: ItemKind }
  /** `changed` é falso quando o jogador já estava no limite e o item foi gasto sem efeito. */
  | { type: 'itemPicked'; playerId: PlayerId; kind: ItemKind; col: number; row: number; changed: boolean }
  | { type: 'bombKicked'; col: number; row: number }
  | { type: 'bombThrown'; fromCol: number; fromRow: number; col: number; row: number }
  /** Uma bomba arremessada caiu em cima de um jogador; `lost` é o item que ele perdeu (null = não tinha nenhum). */
  | { type: 'thrownHit'; playerId: PlayerId; lost: ItemKind | null }
  /** Armadilha de dardos: aviso (a fileira vai ser varrida em instantes) e disparo. `dir` = 1 (da esquerda para a direita) ou -1. */
  | { type: 'dartWarn'; row: number; dir: 1 | -1 }
  | { type: 'dartFired'; row: number; dir: 1 | -1 }
  /** Gelo fino: a célula rachou (nível 1 a 3) ou virou buraco. */
  | { type: 'iceCracked'; col: number; row: number; level: number }
  | { type: 'iceBroken'; col: number; row: number }
  /** Do iglu: saiu uma bola de neve ou um pinguim; e ele parou (bateu em algo). */
  | { type: 'rollerSpawned'; id: number; kind: RollerKind; col: number; row: number }
  /** A neve fez crescer um bloco destrutível. */
  | { type: 'blockGrown'; col: number; row: number }
  | { type: 'rollerGone'; id: number; col: number; row: number }
  /** Um jogador soltou o superpoder (a carga zerou). */
  | { type: 'powerUsed'; playerId: PlayerId; kind: PowerKind; col: number; row: number; dir: Direction }
  | { type: 'elephantGone'; id: number; col: number; row: number }
  | { type: 'planeGone'; id: number }
  /** Morte súbita: a célula virou parede. */
  | { type: 'cellClosed'; col: number; row: number }
  | { type: 'roundEnded'; outcome: RoundOutcome };

/**
 * Resultado de uma rodada.
 * - win: sobrou apenas um time vivo; `winner` é o jogador vivo de menor id desse time.
 * - draw: ninguém sobrou, ou os últimos morreram juntos (ou durante a espera final).
 * - defeat: partida de um jogador só (sem adversário) e ele morreu.
 */
export type RoundOutcome = { kind: 'win'; winner: PlayerId } | { kind: 'draw' } | { kind: 'defeat' };

/**
 * Fase da rodada:
 * - playing: em andamento;
 * - ending: já está decidida, mas o jogo segue rodando até `endsAtTick` (veja ROUND_END_DELAY_TICKS);
 * - over: acabou. O `outcome` vale e a simulação fica congelada até começar outra rodada.
 */
export interface RoundState {
  phase: 'playing' | 'ending' | 'over';
  endsAtTick: number | null;
  outcome: RoundOutcome | null;
  /** Passos que faltam para o tempo da rodada acabar (só conta enquanto a fase é 'playing'). */
  ticksLeft: number;
  /** O tempo acabou: começou a morte súbita (as paredes fecham a arena de fora para dentro). */
  suddenDeath: boolean;
  /** Quantas posições da espiral de fechamento já foram percorridas (veja shrink.ts). */
  closedCount: number;
  /** Passos até a próxima célula fechar (só na morte súbita). */
  nextCloseIn: number;
}

/**
 * Armadilha de dardos de uma fileira: parada (idle) até o aviso (warn), depois os dardos varrem a fileira (fly).
 * `timer` = passos até a próxima fase; `x` = posição do dardo em células (só em fly); `dir` alterna a cada disparo.
 */
export interface DartTrap {
  row: number;
  phase: 'idle' | 'warn' | 'fly';
  timer: number;
  dir: 1 | -1;
  x: number;
}

/** Perigos do terreno de algumas arenas (veja hazards.ts). */
export interface HazardsState {
  /** Células de areia movediça (índices de `arena.cells`): quem pisa anda bem mais devagar. */
  quicksand: number[];
  dartTrap: DartTrap | null;
  /** Piso escorregadio: quem começa a andar desliza até bater em algo. */
  /** Células (índices) do gelo escorregadio. */
  slippery?: number[];
  /** Portas dos iglus (célula de onde saem a bola de neve e o pinguim), cada uma com o seu relógio. */
  doors?: IglooDoor[];
  rollers?: RollerState[];
  /** Células (índices) que começaram com bloco: é nelas que a neve faz blocos novos crescerem. */
  blockSpots?: number[];
  /** Passos até crescer o próximo bloco de neve. */
  regrowTimer?: number;
  /** Células (índices) do túnel da pirâmide: escondem quem passa e não aceitam bombas. */
  tunnel?: number[];
  /** Células de gelo fino (índices de `arena.cells`): racham a cada passagem e, na terceira, viram buraco. */
  thinIce?: number[];
  /** Nível de rachadura (1 a 3) de cada célula de gelo fino já pisada. */
  cracks?: Record<number, number>;
  /** Última célula em que cada jogador esteve (para contar uma passagem só quando ele ENTRA na célula). */
  lastCell?: Partial<Record<PlayerId, number>>;
}

/** Fonte única de verdade da partida. A renderização apenas lê este estado. */
export interface GameState {
  arena: Arena;
  players: PlayerState[];
  bombs: BombState[];
  flames: FlameState[];
  /** Itens no chão, prontos para serem pegos. */
  items: ItemState[];
  /** Itens ainda escondidos em blocos (aparecem quando o bloco é destruído). */
  hiddenItems: ItemState[];
  /** Eventos acumulados desde a última leitura; use `drainEvents` para pegá-los e esvaziar a lista. */
  events: GameEvent[];
  round: RoundState;
  /** Perigos do terreno (areia movediça, dardos). Ausente = arena sem perigos. */
  hazards?: HazardsState;
  /** Elefantinhos em disparada (poder da Ana). */
  elephants?: ElephantState[];
  planes?: PlaneState[];
  /** Quem é eliminado pode jogar das laterais e tentar voltar (veja sideline.ts)? Ausente = sim. */
  sidelineEnabled?: boolean;
  /** Quantos passos de simulação já aconteceram. Será a base dos temporizadores (bombas, chamas). */
  tick: number;
}
