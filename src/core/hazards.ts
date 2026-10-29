import { BLOCK_REGROW_TICKS, ROLLER_BREAKS_BLOCKS, ROLLER_PERIOD_TICKS, ROLLER_SPEED, ICE_CRACK_LEVELS, ICE_PATCHES, DART_FIRST_DELAY_TICKS, DART_HIT_HALF, DART_PERIOD_TICKS, DART_SPEED, DART_WARN_TICKS, QUICKSAND_PATCHES, QUICKSAND_SPEED_FACTOR } from '../config/hazards';
import { VEST_BREAK_SHIELD_TICKS } from '../config/items';
import { cellIndex, getCell, isTunnel } from './arena';
import { dropPowerups, revealItem } from './items';
import { bodyOverlapsCell, collidesAt } from './movement';
import { createRng } from './random';
import type { Arena, Cell, GameState, HazardsState, PlayerState } from './types';

// Perigos do terreno. Só existem nas arenas que pedem (veja config/stages.ts); sem `state.hazards` nada disso acontece.
// - Areia movediça: células em que o jogador anda bem mais devagar.
// - Armadilha de dardos: uma fileira SEM blocos; de tempos em tempos pisca um aviso nas bordas e, 2 s depois, dardos
//   varrem a fileira de um lado a outro (alternando o lado). Quem estiver na frente é atingido (colete e escudo valem).
// - Esfinge: três células de parede no alto da arena. Pirâmide: quadrado 5 x 5 no centro com túnel em cruz. Iglu: 3 x 3.
// - Gelo escorregadio: só em poucas faixas marcadas (veja slipperyCells).

export interface HazardOptions {
  /** Espalha manchas de areia movediça. */
  quicksand?: boolean;
  /** Linha (ímpar) da armadilha de dardos; a fileira fica livre de blocos. */
  dartRow?: number;
  /** Esfinge no alto da arena, no meio: três paredes na primeira fileira. */
  sphinx?: boolean;
  /** Pirâmide de 5 x 5 no centro, com um túnel em cruz (quatro portais) por onde os jogadores passam escondidos. */
  pyramid?: boolean;
  /** Iglu de 3 x 1 (mais a borda de cima) no meio do alto da arena, com a porta para baixo. */
  igloo?: boolean;
  /** A neve faz crescer de novo, aos poucos, os blocos destrutíveis que foram quebrados. */
  regrow?: boolean;
  /** Faixas de gelo escorregadio (duas, de 4 células). */
  slippery?: boolean;
  /** Gelo fino: células que racham a cada passagem e viram buraco. */
  thinIce?: boolean;
}

/** Células da esfinge: três na horizontal, na fileira de cima, no meio da arena. */
export function sphinxCells(cols: number, _rows: number): Cell[] {
  const col = Math.floor(cols / 2);
  return [-1, 0, 1].map((d) => ({ col: col + d, row: 1 }));
}

/** Canto superior esquerdo da pirâmide (5 x 5, centrada na arena). */
export function pyramidOrigin(cols: number, rows: number): Cell {
  return { col: Math.floor(cols / 2) - 2, row: Math.floor(rows / 2) - 2 };
}

/**
 * Túnel da pirâmide: uma cruz pelo meio (linha e coluna centrais). Os quatro portais ficam nas pontas, em células
 * ligadas às fileiras livres do mapa (a de cima, a de baixo e as colunas dos lados).
 */
export function pyramidTunnelCells(cols: number, rows: number): Cell[] {
  const o = pyramidOrigin(cols, rows);
  const out: Cell[] = [];
  for (let d = 0; d < 5; d++) {
    out.push({ col: o.col + d, row: o.row + 2 });
    if (d !== 2) out.push({ col: o.col + 2, row: o.row + d });
  }
  return out;
}

/** As 16 células de parede da pirâmide (as 25 do quadrado, menos o túnel). */
export function pyramidWallCells(cols: number, rows: number): Cell[] {
  const o = pyramidOrigin(cols, rows);
  const tunnel = new Set(pyramidTunnelCells(cols, rows).map((c) => c.row * cols + c.col));
  const out: Cell[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (!tunnel.has((o.row + r) * cols + o.col + c)) out.push({ col: o.col + c, row: o.row + r });
  return out;
}

/**
 * Células dos dois iglus dentro da arena: dois pares na fileira 1 (a borda de cima completa cada iglu), simétricos e
 * com o mesmo espaço entre eles e as laterais. Em 15 colunas: colunas 4-5 e 9-10.
 */
export function iglooCells(cols: number, _rows: number): Cell[] {
  const c = Math.floor(cols / 2);
  return [c - 3, c - 2, c + 2, c + 3].map((col) => ({ col, row: 1 }));
}

/** Portas dos iglus: logo abaixo, nas colunas (livres) 5 e 9; elas ficam voltadas uma para a outra. */
export function iglooDoors(cols: number, _rows: number): Cell[] {
  const c = Math.floor(cols / 2);
  return [c - 2, c + 2].map((col) => ({ col, row: 2 }));
}

/** Faixas de gelo escorregadio: duas, de 4 células cada, em fileiras livres e opostas em relação ao centro. */
export function slipperyCells(cols: number, rows: number): Cell[] {
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const out: Cell[] = [];
  for (let d = 2; d <= 5; d++) out.push({ col: cx - d, row: cy - 1 }, { col: cx + d, row: cy + 1 });
  return out;
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
  if (options.dartRow !== undefined) {
    const row = options.dartRow;
    for (let col = 1; col < cols - 1; col++) {
      if (getCell(arena, col, row) === 'block') arena.cells[cellIndex(arena, col, row)] = 'empty';
    }
    dartTrap = { row, phase: 'idle', timer: DART_FIRST_DELAY_TICKS - DART_WARN_TICKS, dir: 1, x: 0 };
  }

  let tunnel: number[] | undefined;
  if (options.pyramid) {
    for (const cell of pyramidWallCells(cols, rows)) arena.cells[cellIndex(arena, cell.col, cell.row)] = 'wall';
    tunnel = pyramidTunnelCells(cols, rows).map((cell) => cellIndex(arena, cell.col, cell.row));
    for (const index of tunnel) arena.cells[index] = 'empty';
  }

  let doors: Cell[] | undefined;
  if (options.igloo) {
    for (const cell of iglooCells(cols, rows)) arena.cells[cellIndex(arena, cell.col, cell.row)] = 'wall';
    doors = iglooDoors(cols, rows);
    for (const door of doors) arena.cells[cellIndex(arena, door.col, door.row)] = 'empty'; // a porta nunca nasce tapada
  }

  const rng = createRng(seed * 7 + 13);
  // Células que não recebem areia movediça nem gelo fino: o túnel da pirâmide e as faixas escorregadias.
  const reserved = new Set<number>(tunnel ?? []);
  if (options.slippery) for (const cell of slipperyCells(cols, rows)) reserved.add(cellIndex(arena, cell.col, cell.row));
  for (const door of doors ?? []) reserved.add(cellIndex(arena, door.col, door.row));
  const taken = new Set<number>();
  const free = (cell: Cell): boolean =>
    getCell(arena, cell.col, cell.row) !== 'wall' && !reserved.has(cellIndex(arena, cell.col, cell.row)) && cell.row !== options.dartRow && !nearSpawn(cell, cols, rows) && !taken.has(cellIndex(arena, cell.col, cell.row));
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
  if (tunnel) hazards.tunnel = tunnel;
  if (doors) {
    // O segundo iglu sai 10 s depois do primeiro e começa pelo pinguim.
    hazards.doors = doors.map((door, i) => ({ col: door.col, row: door.row, timer: i === 0 ? ROLLER_PERIOD_TICKS : ROLLER_PERIOD_TICKS / 2, count: i }));
    hazards.rollers = [];
  }
  if (options.slippery) {
    // As faixas ficam sem blocos (aparecem inteiras desde o começo).
    hazards.slippery = slipperyCells(cols, rows).map((cell) => cellIndex(arena, cell.col, cell.row));
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
    if (player.vest) {
      player.vest = false;
      player.shieldTicks = VEST_BREAK_SHIELD_TICKS;
      state.events.push({ type: 'vestBroken', playerId: player.id });
    } else {
      player.alive = false;
      state.events.push({ type: 'playerHit', playerId: player.id, killers: [], dart: true });
      dropPowerups(state, player);
    }
  }
  if (trap.x < -0.5 || trap.x > state.arena.cols + 0.5) {
    trap.phase = 'idle';
    trap.timer = DART_PERIOD_TICKS - DART_WARN_TICKS;
    trap.dir = trap.dir === 1 ? -1 : 1;
  }
}
