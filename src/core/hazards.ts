import { BOULDER_FIRST_DELAY_TICKS, BOULDER_HIT_HALF, BOULDER_STUN_TICKS, BOULDER_PERIOD_TICKS, BOULDER_SPEED, BOULDER_WARN_TICKS, CHASM_WIDTH, PYRAMID_SIZE, BLOCK_REGROW_TICKS, ROLLER_BREAKS_BLOCKS, ROLLER_PERIOD_TICKS, ROLLER_SPEED, ICE_CRACK_LEVELS, ICE_PATCHES, DART_FIRST_DELAY_TICKS, DART_HIT_HALF, DART_SLOW_TICKS, DART_PERIOD_TICKS, DART_SPEED, DART_WARN_TICKS, QUICKSAND_PATCHES, QUICKSAND_SPEED_FACTOR, BRIDGE_DOWN_TICKS, BRIDGE_FIRST_TICKS, BRIDGE_PERIOD_TICKS, BRIDGE_WARN_TICKS } from '../config/hazards';
import type { TrafficKind } from '../config/hazards';
import { cellIndex, getCell, isTunnel } from './arena';
import { applyExtraHazards, updateExtraHazards } from './extraHazards';
import { dropPowerups, revealItem } from './items';
import { bodyOverlapsCell, collidesAt } from './movement';
import { createRng } from './random';
import type { Arena, Cell, GameState, HazardsState, PlayerState } from './types';

// Perigos do terreno. Só existem nas arenas que pedem (veja config/stages.ts); sem `state.hazards` nada disso acontece.
// - Areia movediça: células em que o jogador anda bem mais devagar.
// - Armadilha de dardos: uma fileira SEM blocos; de tempos em tempos pisca um aviso nas bordas e, 2 s depois, dardos
//   varrem a fileira de um lado a outro (alternando o lado). Quem estiver na frente é atingido (colete e escudo valem).
// - Pirâmide: quadrado 3 x 3 no centro com túnel em cruz. Iglus: dois, no alto da arena, com a porta para baixo.
// - Gelo escorregadio: uma única pista, que muda de lugar a cada rodada (veja slipperyCells).

export interface HazardOptions {
  /** Espalha manchas de areia movediça. */
  quicksand?: boolean;
  /** Linha (ímpar) da armadilha de dardos; a fileira fica livre de blocos. */
  dartRow?: number;
  /** Esfinge no alto da arena, no meio: três paredes na primeira fileira. */
  sphinx?: boolean;
  /** Pirâmide de 3 x 3 no centro, com um túnel em cruz (quatro portais) por onde os jogadores passam escondidos. */
  pyramid?: boolean;
  /** Convés de navio 5 x 5 no centro (só enfeite): a área fica livre de blocos e pilares. */
  deck?: boolean;
  /** Dois iglus de 3 x 1 (mais a borda de cima) no alto da arena, com a porta para baixo. */
  igloo?: boolean;
  /** A neve faz crescer de novo, aos poucos, os blocos destrutíveis que foram quebrados. */
  regrow?: boolean;
  /** Faixas de gelo escorregadio (duas, de 4 células). */
  slippery?: boolean;
  /** Gelo fino: células que racham a cada passagem e viram buraco. */
  thinIce?: boolean;
  /** Abismo no meio da arena (3 colunas) com três pontes de corda. */
  chasm?: boolean;
  /** Pedras gigantes que descem por uma coluna de cada lado do abismo esmagando tudo (avisam 2,5 s antes). */
  boulder?: boolean;
  /** Fundo do mar: duas faixas de correnteza (uma em cima, outra embaixo, em sentidos opostos). */
  currents?: boolean;
  /** Vulcão: a cada 60 s um rio de lava desce por uma coluna sorteada, de ponta a ponta da arena. */
  lava?: boolean;
  /** Ilha dos Piratas: canhões do navio disparam bolas com sombra no chão. */
  cannons?: boolean;
  /** Templo: de 60 em 60 s uma das pontes cai (com aviso) e volta 10 s depois. Precisa de `chasm`. */
  bridgeFall?: boolean;
  /** Tráfego de veículos nas faixas da arena (carros, trem, trator, bolas ou troncos). */
  traffic?: TrafficKind;
  /** Vulcão de pedra 3 x 3 no meio da arena, que entra em erupção lançando bolas de lava. */
  volcano?: boolean;
  /** Templo 3 x 3 no meio do abismo, com um túnel (a ponte do meio passa por dentro dele). Precisa de `chasm`. */
  island?: boolean;
}

/** Células da esfinge: três na horizontal, na fileira de cima, no meio da arena (opção antiga, hoje a esfinge fica na borda). */
export function sphinxCells(cols: number, _rows: number): Cell[] {
  const col = Math.floor(cols / 2);
  return [-1, 0, 1].map((d) => ({ col: col + d, row: 1 }));
}

/** Canto superior esquerdo da pirâmide (quadrado de PYRAMID_SIZE células, centrado na arena). */
/** Células do convés 5 x 5 no centro da arena. */
export function deckCells(cols: number, rows: number): Cell[] {
  const c = Math.floor(cols / 2);
  const m = Math.floor(rows / 2);
  const out: Cell[] = [];
  for (let row = m - 2; row <= m + 2; row++) for (let col = c - 2; col <= c + 2; col++) out.push({ col, row });
  return out;
}

export function pyramidOrigin(cols: number, rows: number): Cell {
  const half = Math.floor(PYRAMID_SIZE / 2);
  return { col: Math.floor(cols / 2) - half, row: Math.floor(rows / 2) - half };
}

/**
 * Túnel da pirâmide: uma cruz pelo meio (linha e coluna centrais). As quatro pontas são as portas, uma no meio de cada lado.
 */
export function pyramidTunnelCells(cols: number, rows: number): Cell[] {
  const o = pyramidOrigin(cols, rows);
  const half = Math.floor(PYRAMID_SIZE / 2);
  const out: Cell[] = [];
  for (let d = 0; d < PYRAMID_SIZE; d++) {
    out.push({ col: o.col + d, row: o.row + half });
    if (d !== half) out.push({ col: o.col + half, row: o.row + d });
  }
  return out;
}

/** Células de parede da pirâmide (o quadrado, menos o túnel). */
export function pyramidWallCells(cols: number, rows: number): Cell[] {
  const o = pyramidOrigin(cols, rows);
  const tunnel = new Set(pyramidTunnelCells(cols, rows).map((c) => c.row * cols + c.col));
  const out: Cell[] = [];
  for (let r = 0; r < PYRAMID_SIZE; r++) for (let c = 0; c < PYRAMID_SIZE; c++) if (!tunnel.has((o.row + r) * cols + o.col + c)) out.push({ col: o.col + c, row: o.row + r });
  return out;
}

/** As quatro células logo à frente das portas da pirâmide (a saída de cada porta): ficam sempre livres, sem pilar nem bloco. */
export function pyramidExitCells(cols: number, rows: number): Cell[] {
  const o = pyramidOrigin(cols, rows);
  const half = Math.floor(PYRAMID_SIZE / 2);
  return [
    { col: o.col + half, row: o.row - 1 },
    { col: o.col + half, row: o.row + PYRAMID_SIZE },
    { col: o.col - 1, row: o.row + half },
    { col: o.col + PYRAMID_SIZE, row: o.row + half },
  ];
}

/**
 * Células dos dois iglus dentro da arena: três paredes cada, na fileira 1 (a borda de cima completa o iglu), simétricos.
 * Em 15 colunas: colunas 4-6 e 8-10 (a porta de cada um fica na coluna do meio dele: 5 e 9).
 */
export function iglooCells(cols: number, _rows: number): Cell[] {
  const c = Math.floor(cols / 2);
  return [c - 3, c - 2, c - 1, c + 1, c + 2, c + 3].map((col) => ({ col, row: 1 }));
}

/** Portas dos iglus: logo abaixo da coluna do meio de cada um, nas colunas livres 5 e 9; ficam voltadas uma para a outra. */
export function iglooDoors(cols: number, _rows: number): Cell[] {
  const c = Math.floor(cols / 2);
  return [c - 2, c + 2].map((col) => ({ col, row: 2 }));
}

/**
 * Pista de gelo escorregadio: UMA só, de 4 células, em fileira (ou coluna) sem pilar. O lugar sai da semente, então muda a
 * cada rodada (a semente muda a cada rodada), assim como os buracos de gelo fino.
 */
export function slipperyCells(cols: number, rows: number, seed = 1): Cell[] {
  const rng = createRng(seed * 31 + 5);
  const out: Cell[] = [];
  if (rng() < 0.5) {
    const row = 3 + 2 * Math.floor(rng() * Math.floor((rows - 5) / 2)); // fileiras ímpares, abaixo dos iglus
    const col0 = 1 + Math.floor(rng() * (cols - 5));
    for (let d = 0; d < 4; d++) out.push({ col: col0 + d, row });
  } else {
    const col = 1 + 2 * Math.floor(rng() * Math.floor((cols - 1) / 2));
    const row0 = 3 + Math.floor(rng() * (rows - 8));
    for (let d = 0; d < 4; d++) out.push({ col, row: row0 + d });
  }
  return out;
}

/** Células do abismo: CHASM_WIDTH colunas no meio, da primeira à última fileira de dentro. */
export function chasmCells(cols: number, rows: number): Cell[] {
  const first = Math.floor(cols / 2) - Math.floor(CHASM_WIDTH / 2);
  const out: Cell[] = [];
  for (let col = first; col < first + CHASM_WIDTH; col++) for (let row = 1; row < rows - 1; row++) out.push({ col, row });
  return out;
}

/** Fileiras das pontes: três, simétricas em relação ao centro (3, 6 e 9 em 13 fileiras). */
export function bridgeRows(rows: number): number[] {
  return [3, Math.floor(rows / 2), rows - 4];
}

/** Colunas por onde a pedra pode descer: as ímpares (sem pilar no caminho) que não são do abismo. */
export function boulderColumns(cols: number): number[] {
  const first = Math.floor(cols / 2) - Math.floor(CHASM_WIDTH / 2);
  const out: number[] = [];
  for (let col = 1; col < cols - 1; col += 2) if (col < first || col >= first + CHASM_WIDTH) out.push(col);
  return out;
}

/** Colunas centrais possíveis da pedra (ela ocupa 3 colunas), de cada lado do abismo: a pedra nunca invade o abismo nem a borda. */
export function boulderSides(cols: number): [number[], number[]] {
  const first = Math.floor(cols / 2) - Math.floor(CHASM_WIDTH / 2);
  const left: number[] = [];
  const right: number[] = [];
  for (let col = 2; col <= first - 2; col++) left.push(col);
  for (let col = first + CHASM_WIDTH + 1; col <= cols - 3; col++) right.push(col);
  return [left, right];
}

/** Células do templo no meio do abismo: um quadrado 3 x 3 com a fileira do meio livre (o túnel, que é a ponte do meio). */
export function templeCells(cols: number, rows: number): { walls: Cell[]; tunnel: Cell[] } {
  const c = Math.floor(cols / 2);
  const m = Math.floor(rows / 2);
  const walls: Cell[] = [];
  const tunnel: Cell[] = [];
  for (let d = -1; d <= 1; d++) {
    walls.push({ col: c + d, row: m - 1 }, { col: c + d, row: m + 1 });
    tunnel.push({ col: c + d, row: m });
  }
  return { walls, tunnel };
}

function nearSpawn(cell: Cell, cols: number, rows: number): boolean {
  // Cantos de nascimento: nada de areia a menos de 4 células (distância de grade) deles.
  const corners: Cell[] = [{ col: 1, row: 1 }, { col: cols - 2, row: 1 }, { col: 1, row: rows - 2 }, { col: cols - 2, row: rows - 2 }];
  return corners.some((c) => Math.abs(c.col - cell.col) + Math.abs(c.row - cell.row) < 5);
}

/**
 * Prepara o terreno: ajusta as células da arena (esfinge, fileira de dardos limpa) e devolve o estado dos perigos.
 * Chame ANTES de sortear os itens escondidos (para não restar item dentro de um bloco que sumiu).
 * Devolve undefined se a arena não tem perigo nenhum.
 */
export function createHazards(arena: Arena, options: HazardOptions | undefined, seed: number): HazardsState | undefined {
  if (!options) return undefined;
  const { cols, rows } = arena;

  if (options.sphinx) {
    for (const cell of sphinxCells(cols, rows)) arena.cells[cellIndex(arena, cell.col, cell.row)] = 'wall';
  }

  let dartTrap: HazardsState['dartTrap'] = null;
  let dartDir: 1 | -1 = 1;
  // A fileira da armadilha de dardos é sorteada a cada rodada (ímpar, sem tocar a pirâmide) e o primeiro lado também.
  let dartRow = options.dartRow;
  if (dartRow !== undefined) {
    const pick = createRng(seed * 5 + 19);
    const mid = Math.floor(rows / 2);
    const candidates: number[] = [];
    for (let row = 3; row <= rows - 4; row += 2) if (!options.pyramid || Math.abs(row - mid) >= 3) candidates.push(row);
    if (candidates.length > 0) dartRow = candidates[Math.floor(pick() * candidates.length)]!;
    dartDir = pick() < 0.5 ? 1 : -1;
  }
  if (dartRow !== undefined) {
    const row = dartRow;
    for (let col = 1; col < cols - 1; col++) {
      if (getCell(arena, col, row) === 'block') arena.cells[cellIndex(arena, col, row)] = 'empty';
    }
    dartTrap = { row, phase: 'idle', timer: DART_FIRST_DELAY_TICKS - DART_WARN_TICKS, dir: dartDir, x: 0 };
  }

  let tunnel: number[] | undefined;
  if (options.pyramid) {
    for (const cell of pyramidWallCells(cols, rows)) arena.cells[cellIndex(arena, cell.col, cell.row)] = 'wall';
    tunnel = pyramidTunnelCells(cols, rows).map((cell) => cellIndex(arena, cell.col, cell.row));
    for (const index of tunnel) arena.cells[index] = 'empty';
    // A saída de cada porta nunca nasce tapada (pilar ou bloco).
    for (const cell of pyramidExitCells(cols, rows)) arena.cells[cellIndex(arena, cell.col, cell.row)] = 'empty';
  }

  if (options.deck) {
    for (const cell of deckCells(cols, rows)) arena.cells[cellIndex(arena, cell.col, cell.row)] = 'empty';
  }

  let doors: Cell[] | undefined;
  if (options.igloo) {
    for (const cell of iglooCells(cols, rows)) arena.cells[cellIndex(arena, cell.col, cell.row)] = 'wall';
    doors = iglooDoors(cols, rows);
    for (const door of doors) arena.cells[cellIndex(arena, door.col, door.row)] = 'empty'; // a porta nunca nasce tapada
  }

  let chasm: number[] | undefined;
  let bridges: number[] | undefined;
  let islandTunnel: number[] | undefined;
  if (options.chasm) {
    // Abismo = `hole` (ninguém pisa, o fogo passa); nas fileiras das pontes as células ficam livres e os pilares das margens saem.
    const rowsOfBridge = bridgeRows(rows);
    chasm = [];
    bridges = [];
    for (const cell of chasmCells(cols, rows)) {
      const index = cellIndex(arena, cell.col, cell.row);
      if (rowsOfBridge.includes(cell.row)) {
        arena.cells[index] = 'empty';
        bridges.push(index);
      } else {
        arena.cells[index] = 'hole';
        chasm.push(index);
      }
    }
    if (options.island) {
      const { walls, tunnel: inside } = templeCells(cols, rows);
      const wallIndexes = new Set(walls.map((c) => cellIndex(arena, c.col, c.row)));
      for (const index of wallIndexes) arena.cells[index] = 'wall';
      chasm = chasm.filter((index) => !wallIndexes.has(index));
      const tunnelIndexes = inside.map((c) => cellIndex(arena, c.col, c.row));
      bridges = bridges.filter((index) => !tunnelIndexes.includes(index));
      islandTunnel = tunnelIndexes;
    }
    const first = Math.floor(cols / 2) - Math.floor(CHASM_WIDTH / 2);
    for (const row of rowsOfBridge) for (const col of [first - 1, first + CHASM_WIDTH]) arena.cells[cellIndex(arena, col, row)] = 'empty';
  }

  const rng = createRng(seed * 7 + 13);
  // Células que não recebem areia movediça nem gelo fino: o túnel da pirâmide e as faixas escorregadias.
  const reserved = new Set<number>(tunnel ?? []);
  if (options.slippery) for (const cell of slipperyCells(cols, rows, seed)) reserved.add(cellIndex(arena, cell.col, cell.row));
  for (const door of doors ?? []) reserved.add(cellIndex(arena, door.col, door.row));
  const taken = new Set<number>();
  const free = (cell: Cell): boolean =>
    getCell(arena, cell.col, cell.row) !== 'wall' && !reserved.has(cellIndex(arena, cell.col, cell.row)) && cell.row !== dartRow && !nearSpawn(cell, cols, rows) && !taken.has(cellIndex(arena, cell.col, cell.row));
  /** Espalha `patches` manchas de 1 a 2 células (sem bloco por cima, à mostra desde o começo). */
  const scatter = (patches: number, pair: boolean): number[] => {
    const out: number[] = [];
    let guard = 0;
    for (let patch = 0; patch < patches && guard++ < 600; ) {
      const cell = { col: 1 + Math.floor(rng() * (cols - 2)), row: 1 + Math.floor(rng() * (rows - 2)) };
      if (!free(cell)) continue;
      const side = rng() < 0.5 ? { col: cell.col + 1, row: cell.row } : { col: cell.col, row: cell.row + 1 };
      const mark = (c: Cell): void => {
        const index = cellIndex(arena, c.col, c.row);
        taken.add(index);
        out.push(index);
        arena.cells[index] = 'empty';
      };
      mark(cell);
      if (pair && free(side)) mark(side);
      patch += 1;
    }
    return out;
  };

  const quicksand = options.quicksand ? scatter(QUICKSAND_PATCHES, true) : [];
  const hazards: HazardsState = { quicksand, dartTrap };
  if (chasm && bridges) {
    hazards.chasm = chasm;
    hazards.bridges = bridges;
  }
  if (islandTunnel) hazards.tunnel = islandTunnel;
  if (options.bridgeFall && bridges) hazards.bridgeFall = { phase: 'idle', timer: BRIDGE_FIRST_TICKS - BRIDGE_WARN_TICKS, row: 0 };
  if (options.boulder) hazards.boulder = { phase: 'idle', timer: BOULDER_FIRST_DELAY_TICKS - BOULDER_WARN_TICKS, cols: [], y: 0, last: [] };
  if (tunnel) hazards.tunnel = tunnel;
  if (doors) {
    // O segundo iglu sai 10 s depois do primeiro e começa pelo pinguim.
    hazards.doors = doors.map((door, i) => ({ col: door.col, row: door.row, timer: i === 0 ? ROLLER_PERIOD_TICKS : ROLLER_PERIOD_TICKS / 2, count: i }));
    hazards.rollers = [];
  }
  if (options.slippery) {
    // As faixas ficam sem blocos (aparecem inteiras desde o começo).
    hazards.slippery = slipperyCells(cols, rows, seed).map((cell) => cellIndex(arena, cell.col, cell.row));
    for (const index of hazards.slippery) if (arena.cells[index] === 'block') arena.cells[index] = 'empty';
  }
  if (options.thinIce) {
    hazards.thinIce = scatter(ICE_PATCHES, true);
    hazards.cracks = {};
    hazards.lastCell = {};
  }
  if (options.regrow) {
    hazards.blockSpots = [];
    arena.cells.forEach((cell, index) => {
      if (cell === 'block') hazards.blockSpots!.push(index);
    });
    hazards.regrowTimer = BLOCK_REGROW_TICKS;
  }
  applyExtraHazards(arena, options, seed, hazards);
  return hazards;
}

/** Fator de velocidade do jogador: reduzido em cima da areia movediça (pela célula do centro do corpo). */
export function speedFactorAt(state: GameState, player: Pick<PlayerState, 'x' | 'y'>): number {
  const quicksand = state.hazards?.quicksand;
  if (!quicksand || quicksand.length === 0) return 1;
  return quicksand.includes(cellIndex(state.arena, Math.floor(player.x), Math.floor(player.y))) ? QUICKSAND_SPEED_FACTOR : 1;
}

/** Avança os perigos um passo (chamado uma vez por passo, pelo `step`). */
export function updateHazards(state: GameState): void {
  if (state.round.phase === 'over') return;
  updateThinIce(state);
  updateDartTrap(state);
  updateRollers(state);
  updateRegrow(state);
  updateBoulder(state);
  updateBridgeFall(state);
  updateExtraHazards(state);
}

/** Ponte que cai: avisa (a ponte pisca e balança), vira abismo por BRIDGE_DOWN_TICKS (quem estiver nela morre) e se refaz. */
function updateBridgeFall(state: GameState): void {
  const fall = state.hazards?.bridgeFall;
  const bridges = state.hazards?.bridges;
  if (!fall || !bridges || state.round.phase !== 'playing') return;
  const arena = state.arena;
  const cellsOf = (row: number): number[] => bridges.filter((index) => Math.floor(index / arena.cols) === row);
  fall.timer -= 1;
  if (fall.timer > 0) return;
  if (fall.phase === 'idle') {
    const rows = [...new Set(bridges.map((index) => Math.floor(index / arena.cols)))];
    if (rows.length === 0) return;
    const rng = createRng(state.tick * 41 + 3);
    fall.row = rows[Math.floor(rng() * rows.length)]!;
    fall.phase = 'warn';
    fall.timer = BRIDGE_WARN_TICKS;
    state.events.push({ type: 'bridgeWarn', row: fall.row });
  } else if (fall.phase === 'warn') {
    fall.phase = 'down';
    fall.timer = BRIDGE_DOWN_TICKS;
    for (const index of cellsOf(fall.row)) {
      const col = index % arena.cols;
      arena.cells[index] = 'hole';
      state.bombs = state.bombs.filter((bomb) => !(bomb.col === col && bomb.row === fall.row));
      state.items = state.items.filter((item) => !(item.col === col && item.row === fall.row));
      for (const player of state.players) {
        if (!player.alive || Math.floor(player.x) !== col || Math.floor(player.y) !== fall.row) continue;
        player.alive = false;
        state.events.push({ type: 'playerHit', playerId: player.id, killers: [], crushed: true });
        dropPowerups(state, player);
      }
    }
    state.events.push({ type: 'bridgeFall', row: fall.row });
  } else {
    for (const index of cellsOf(fall.row)) arena.cells[index] = 'empty';
    state.events.push({ type: 'bridgeRestored', row: fall.row });
    fall.phase = 'idle';
    fall.timer = Math.max(60, BRIDGE_PERIOD_TICKS - BRIDGE_WARN_TICKS - BRIDGE_DOWN_TICKS);
  }
}

/** Gelo fino: cada entrada numa célula racha um nível; no último nível a célula vira buraco assim que ficar livre. */
function updateThinIce(state: GameState): void {
  const hz = state.hazards;
  if (!hz?.thinIce || !hz.cracks || !hz.lastCell) return;
  const arena = state.arena;
  for (const player of state.players) {
    if (!player.alive) {
      delete hz.lastCell[player.id];
      continue;
    }
    const index = cellIndex(arena, Math.floor(player.x), Math.floor(player.y));
    if (hz.lastCell[player.id] === index) continue;
    hz.lastCell[player.id] = index;
    if (!hz.thinIce.includes(index) || arena.cells[index] !== 'empty') continue;
    const level = Math.min(ICE_CRACK_LEVELS, (hz.cracks[index] ?? 0) + 1);
    hz.cracks[index] = level;
    state.events.push({ type: 'iceCracked', col: index % arena.cols, row: Math.floor(index / arena.cols), level });
  }
  for (const key of Object.keys(hz.cracks)) {
    const index = Number(key);
    if (hz.cracks[index]! < ICE_CRACK_LEVELS || arena.cells[index] !== 'empty') continue;
    const col = index % arena.cols;
    const row = Math.floor(index / arena.cols);
    // Só quebra com a célula livre (sem ninguém em cima, sem bomba): ninguém cai no buraco.
    if (state.players.some((p) => p.alive && bodyOverlapsCell(p.x, p.y, col, row))) continue;
    if (state.bombs.some((b) => b.col === col && b.row === row)) continue;
    arena.cells[index] = 'hole';
    state.items = state.items.filter((item) => !(item.col === col && item.row === row));
    state.events.push({ type: 'iceBroken', col, row });
  }
}

/**
 * Iglu: a cada 20 s (com a rodada em disputa) sai pela porta de cada iglu uma bola de neve ou um pinguim (alternando) que desce em
 * linha reta. Quem estiver no caminho é empurrado junto, sem dano. Quebra os blocos do caminho e para ao bater em parede, bomba ou buraco
 * (ou se o jogador empurrado não puder andar mais).
 */
function updateRollers(state: GameState): void {
  const hz = state.hazards;
  if (!hz?.doors || !hz.rollers) return;
  const arena = state.arena;
  if (state.round.phase === 'playing') {
    for (const door of hz.doors) {
      door.timer -= 1;
      if (door.timer > 0) continue;
      door.timer = ROLLER_PERIOD_TICKS;
      const kind = door.count % 2 === 0 ? 'snowball' : 'penguin';
      const id = state.tick * 16 + door.col;
      door.count += 1;
      hz.rollers.push({ id, kind, x: door.col + 0.5, y: door.row + 0.5 });
      state.events.push({ type: 'rollerSpawned', id, kind, col: door.col, row: door.row });
    }
  }
  for (const roller of [...hz.rollers]) {
    const speed = ROLLER_SPEED[roller.kind];
    const y = roller.y + speed;
    const col = Math.floor(roller.x);
    const frontRow = Math.floor(y + 0.5);
    if (ROLLER_BREAKS_BLOCKS && getCell(arena, col, frontRow) === 'block') {
      arena.cells[cellIndex(arena, col, frontRow)] = 'empty';
      state.events.push({ type: 'blockDestroyed', col, row: frontRow });
      revealItem(state, col, frontRow);
    }
    const stop =
      getCell(arena, col, frontRow) !== 'empty' || state.bombs.some((b) => b.col === col && b.row === frontRow && frontRow > Math.floor(roller.y));
    let stopped = stop;
    if (!stop) {
      roller.y = y;
      // Empurra quem está na frente: o jogador fica sempre a ~0,9 célula à frente do rolo.
      for (const player of state.players) {
        if (!player.alive || Math.abs(player.x - roller.x) > 0.8) continue;
        const ahead = player.y - roller.y;
        if (ahead < -0.1 || ahead > 0.95) continue;
        const target = roller.y + 0.9;
        if (target <= player.y) continue;
        const blocked = new Set(state.bombs.map((b) => cellIndex(arena, b.col, b.row)));
        if (collidesAt(arena, player.x, target, blocked)) {
          stopped = true;
          break;
        }
        player.y = target;
      }
    }
    if (stopped) {
      hz.rollers.splice(hz.rollers.indexOf(roller), 1);
      state.events.push({ type: 'rollerGone', id: roller.id, col, row: Math.floor(roller.y) });
    }
  }
}

/**
 * Pedra gigante (Templo Perdido): a cada BOULDER_PERIOD_TICKS uma coluna sorteada treme (aviso de 2,5 s) e a pedra desce por ela de
 * cima a baixo, esmagando tudo: ocupa 3 colunas, quebra os blocos (os itens aparecem e também são esmagados), some com bombas e itens e ATORDOA
 * quem estiver no caminho (controles trocados por 6 s; o escudo e o herói protegem).
 */
function updateBoulder(state: GameState): void {
  const boulder = state.hazards?.boulder;
  if (!boulder) return;
  const arena = state.arena;
  if (boulder.phase === 'idle') {
    if (state.round.phase !== 'playing') return;
    boulder.timer -= 1;
    if (boulder.timer > 0) return;
    // Uma pedra de cada lado do abismo, sempre em colunas diferentes das da queda anterior.
    const rng = createRng(state.tick * 13 + 7);
    boulder.cols = boulderSides(arena.cols).map((side) => {
      const options = side.filter((col) => !boulder.last.includes(col));
      const pool = options.length > 0 ? options : side;
      return pool[Math.floor(rng() * pool.length)]!;
    });
    boulder.last = [...boulder.cols];
    boulder.phase = 'warn';
    boulder.timer = BOULDER_WARN_TICKS;
    for (const col of boulder.cols) state.events.push({ type: 'boulderWarn', col });
    return;
  }
  if (boulder.phase === 'warn') {
    boulder.timer -= 1;
    if (boulder.timer > 0) return;
    boulder.phase = 'roll';
    boulder.y = 0.5;
    for (const col of boulder.cols) state.events.push({ type: 'boulderRoll', col });
    return;
  }
  boulder.y += BOULDER_SPEED;
  const front = Math.floor(boulder.y + 0.45);
  const done = (col: number): void => {
    boulder.cols = boulder.cols.filter((c) => c !== col);
    state.events.push({ type: 'boulderGone', col });
  };
  for (const col of [...boulder.cols]) {
    if (front >= arena.rows - 1) {
      done(col);
      continue;
    }
    if (front >= 1) {
      // A pedra passa por cima dos pilares (a coluna do meio pode ser par e ter pilar): ela nunca some no meio da descida.
      for (let c = col - 1; c <= col + 1; c++) {
        if (getCell(arena, c, front) === 'block') {
          arena.cells[cellIndex(arena, c, front)] = 'empty';
          state.events.push({ type: 'blockDestroyed', col: c, row: front });
          revealItem(state, c, front);
        }
      }
    }
    const under = (row: number): boolean => Math.abs(row + 0.5 - boulder.y) < 0.75;
    state.bombs = state.bombs.filter((bomb) => !(Math.abs(bomb.col - col) <= 1 && under(bomb.row)));
    state.items = state.items.filter((item) => !(Math.abs(item.col - col) <= 1 && under(item.row)));
    for (const player of state.players) {
      if (!player.alive || player.shieldTicks > 0 || player.heroTicks > 0) continue;
      if (Math.abs(player.x - (col + 0.5)) > BOULDER_HIT_HALF || Math.abs(player.y - boulder.y) > 0.95) continue;
      // A pedra não mata: atordoa (controles trocados). Só avisa na primeira pancada.
      if (player.invertTicks < BOULDER_STUN_TICKS - 60) state.events.push({ type: 'stunned', playerId: player.id });
      player.invertTicks = Math.max(player.invertTicks, BOULDER_STUN_TICKS);
    }
  }
  if (boulder.cols.length === 0) {
    boulder.phase = 'idle';
    boulder.timer = BOULDER_PERIOD_TICKS - BOULDER_WARN_TICKS;
  }
}

/** Neve: a cada BLOCK_REGROW_TICKS cresce um bloco numa casa sorteada entre as que começaram com bloco e hoje estão livres. */
function updateRegrow(state: GameState): void {
  const hz = state.hazards;
  if (!hz?.blockSpots || state.round.phase !== 'playing') return;
  hz.regrowTimer = (hz.regrowTimer ?? BLOCK_REGROW_TICKS) - 1;
  if (hz.regrowTimer > 0) return;
  hz.regrowTimer = BLOCK_REGROW_TICKS;
  const arena = state.arena;
  const spots = hz.blockSpots.filter((index) => {
    if (arena.cells[index] !== 'empty') return false;
    const col = index % arena.cols;
    const row = Math.floor(index / arena.cols);
    if (isTunnel(hz.tunnel, arena, col, row) || hz.slippery?.includes(index)) return false;
    if (state.players.some((p) => bodyOverlapsCell(p.x, p.y, col, row) || (p.alive && Math.abs(Math.floor(p.x) - col) + Math.abs(Math.floor(p.y) - row) <= 1))) return false;
    if (state.bombs.some((b) => b.col === col && b.row === row)) return false;
    if (state.flames.some((f) => f.col === col && f.row === row)) return false;
    if (state.items.some((item) => item.col === col && item.row === row)) return false;
    if (hz.rollers?.some((r) => Math.floor(r.x) === col && Math.abs(r.y - row - 0.5) < 1.5)) return false;
    return true;
  });
  if (spots.length === 0) return;
  const rng = createRng(state.tick * 7 + spots.length);
  const index = spots[Math.floor(rng() * spots.length)]!;
  arena.cells[index] = 'block';
  state.events.push({ type: 'blockGrown', col: index % arena.cols, row: Math.floor(index / arena.cols) });
}

function updateDartTrap(state: GameState): void {
  const trap = state.hazards?.dartTrap;
  if (!trap) return;

  if (trap.phase === 'idle') {
    trap.timer -= 1;
    if (trap.timer <= 0) {
      trap.phase = 'warn';
      trap.timer = DART_WARN_TICKS;
      state.events.push({ type: 'dartWarn', row: trap.row, dir: trap.dir });
    }
    return;
  }

  if (trap.phase === 'warn') {
    trap.timer -= 1;
    if (trap.timer <= 0) {
      trap.phase = 'fly';
      trap.x = trap.dir === 1 ? 0.5 : state.arena.cols - 0.5;
      state.events.push({ type: 'dartFired', row: trap.row, dir: trap.dir });
    }
    return;
  }

  // Voando: o dardo avança e acerta quem está na fileira, perto dele.
  trap.x += trap.dir * DART_SPEED;
  for (const player of state.players) {
    if (!player.alive || player.shieldTicks > 0 || player.heroTicks > 0) continue;
    if (Math.floor(player.y) !== trap.row || Math.abs(player.x - trap.x) > DART_HIT_HALF + 0.3) continue;
    // A flecha não mata: deixa o jogador na velocidade mínima do jogo por DART_SLOW_TICKS (10 s).
    if (player.slowTicks <= 0) state.events.push({ type: 'slowed', playerId: player.id });
    player.slowTicks = DART_SLOW_TICKS;
  }
  if (trap.x < -0.5 || trap.x > state.arena.cols + 0.5) {
    trap.phase = 'idle';
    trap.timer = DART_PERIOD_TICKS - DART_WARN_TICKS;
    trap.dir = trap.dir === 1 ? -1 : 1;
  }
}
