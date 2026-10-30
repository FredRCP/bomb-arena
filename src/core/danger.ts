import { BOMB_FUSE_TICKS, FLAME_TICKS } from '../config/bombs';
import { BOULDER_SPEED } from '../config/hazards';
import { cellIndex, getCell } from './arena';
import { slideProjection } from './bombs';
import { blastOf } from './explosions';
import { STEP_DISTANCE, stepDistanceOf } from './movement';
import { closingHazards } from './shrink';
import type { BombState, Cell, Direction, GameState, PlayerId, PlayerState } from './types';

// "Onde vai pegar fogo, e quando" — usado pela IA para fugir e para decidir se pode colocar uma bomba.
// Tudo aqui só LÊ o estado. As regras da explosão vêm de `blastOf` (a mesma do jogo), inclusive a cadeia.

/**
 * Bomba-relógio de outro jogador: a qualquer momento ela pode explodir, então a IA conta com o pior caso razoável:
 * a cruz pega fogo daqui a UNKNOWN_REMOTE_TICKS passos (e fica perigosa dali em diante). Dá tempo de atravessar a cruz
 * correndo para sair dela, mas não de ficar parada nela nem de passear por ela.
 */
const UNKNOWN_REMOTE_TICKS = 40;

/** Passos que o jogador leva para atravessar uma célula (andando reto). */
export const CELL_TICKS = Math.ceil(1 / STEP_DISTANCE);

/** Janela de perigo de uma célula, em passos A PARTIR DE AGORA: de `from` (inclusive) até `to` (exclusive). */
export type Window = readonly [from: number, to: number];

export interface HazardMap {
  /** Janelas de perigo de cada célula (índice de arena.cells). Lista vazia = nunca pega fogo, até onde se sabe. */
  windows: Window[][];
  /** Quando cada bomba explode, contando a cadeia (mesma ordem de `bombs`). */
  explodeAt: number[];
  bombs: BombState[];
}

/**
 * Monta o mapa de perigo. `extraBomb` é uma bomba hipotética ("e se eu colocasse uma bomba aqui?").
 * - Chama acesa agora: perigo de 0 até o fim dela.
 * - Bomba: perigo da hora em que explode até FLAME_TICKS depois, em toda a cruz.
 * - Cadeia: uma bomba atingida por outra explode no mesmo instante que ela (ou antes, se o pavio dela é menor).
 * - Bomba chutada (deslizando): conta como já estando onde vai parar na hora em que explodir (veja slideProjection).
 * - Bomba-relógio de OUTRO jogador (`selfId` é quem pergunta): ninguém sabe quando ela vai ser detonada, então a
 *   cruz dela é perigosa a partir de UNKNOWN_REMOTE_TICKS passos e para sempre (até a bomba sumir). As bombas-relógio do próprio jogador
 *   seguem o pavio, porque é ele quem decide detoná-las.
 */
export function buildHazards(state: GameState, extraBomb?: BombState, selfId?: PlayerId): HazardMap {
  const { arena } = state;
  const real = state.bombs.map((bomb) => {
    if (!bomb.slide) return bomb;
    const at = slideProjection(state, bomb, bomb.ticksLeft);
    return { ...bomb, col: at.col, row: at.row, slide: null };
  });
  const bombs = extraBomb ? [...real, extraBomb] : real;
  const unknownRemote = bombs.map((bomb) => bomb.remote === true && selfId !== undefined && bomb.owner !== selfId);
  const bombByCell = new Map<number, BombState>();
  for (const bomb of bombs) bombByCell.set(cellIndex(arena, bomb.col, bomb.row), bomb);

  const blasts = bombs.map((bomb) => blastOf(arena, bomb, bombByCell));
  const explodeAt = bombs.map((bomb, i) => (unknownRemote[i] ? UNKNOWN_REMOTE_TICKS : bomb.ticksLeft));

  // Relaxa até estabilizar: quem é atingido por uma bomba que explode antes explode junto com ela.
  let changed = true;
  while (changed) {
    changed = false;
    blasts.forEach((blast, i) => {
      for (const hit of blast.bombsHit) {
        const j = bombs.indexOf(hit);
        if (j >= 0 && explodeAt[i]! < explodeAt[j]!) {
          explodeAt[j] = explodeAt[i]!;
          changed = true;
        }
      }
    });
  }

  const windows: Window[][] = Array.from({ length: arena.cols * arena.rows }, () => []);
  for (const flame of state.flames) windows[cellIndex(arena, flame.col, flame.row)]!.push([0, flame.ticksLeft]);
  blasts.forEach((blast, i) => {
    for (const index of blast.cells) windows[index]!.push([explodeAt[i]!, unknownRemote[i] ? Number.MAX_SAFE_INTEGER : explodeAt[i]! + FLAME_TICKS]);
  });

  // Pedra gigante: a coluna dela é perigosa do aviso até ela passar (a IA sai do caminho).
  const boulder = state.hazards?.boulder;
  if (boulder && boulder.phase !== 'idle') {
    const rollTicks = Math.ceil((arena.rows - 0.5) / BOULDER_SPEED);
    const from = boulder.phase === 'warn' ? Math.max(0, boulder.timer - 30) : 0;
    const to = boulder.phase === 'warn' ? boulder.timer + rollTicks : Math.ceil((arena.rows - boulder.y) / BOULDER_SPEED);
    for (const col of boulder.cols) for (let row = 1; row < arena.rows - 1; row++) windows[cellIndex(arena, col, row)]!.push([from, to]);
  }

  // Morte súbita: as células que vão virar parede são perigosas dali em diante, para sempre.
  for (const { cell, closesIn } of closingHazards(state)) windows[cellIndex(arena, cell.col, cell.row)]!.push([closesIn, Number.MAX_SAFE_INTEGER]);

  return { windows, explodeAt, bombs };
}

/** Uma bomba hipotética colocada agora na célula, com o alcance e o dono dados. */
export function hypotheticalBomb(cell: Cell, owner: BombState['owner'], range: number, pierce = false): BombState {
  return { owner, col: cell.col, row: cell.row, ticksLeft: BOMB_FUSE_TICKS, range, walkThrough: [owner], pierce };
}

/** A célula pega fogo em algum momento (do que se sabe até agora)? */
export function hasHazard(hazards: HazardMap, index: number): boolean {
  return hazards.windows[index]!.length > 0;
}

/**
 * Estar na célula durante [arrive - occupy, arrive + occupy] cruza alguma janela de perigo?
 * `occupy` cobre o tempo que o corpo leva atravessando a célula, mais a folga de segurança.
 */
export function unsafeAt(hazards: HazardMap, index: number, arrive: number, occupy: number): boolean {
  return hazards.windows[index]!.some(([from, to]) => arrive + occupy > from && arrive - occupy < to);
}

const NEIGHBORS: ReadonlyArray<{ direction: Direction; dc: number; dr: number }> = [
  { direction: 'up', dc: 0, dr: -1 },
  { direction: 'down', dc: 0, dr: 1 },
  { direction: 'left', dc: -1, dr: 0 },
  { direction: 'right', dc: 1, dr: 0 },
];

export function neighborsOf(cell: Cell): Array<Cell & { direction: Direction }> {
  return NEIGHBORS.map(({ direction, dc, dr }) => ({ col: cell.col + dc, row: cell.row + dr, direction }));
}

/** Pode pisar na célula? Livre (sem parede nem bloco) e sem bomba. */
export function isWalkable(state: GameState, hazards: HazardMap, col: number, row: number): boolean {
  if (getCell(state.arena, col, row) !== 'empty') return false;
  return !hazards.bombs.some((bomb) => bomb.col === col && bomb.row === row);
}

const MAX_ESCAPE_STEPS = 9;

/** Onde está o corpo de quem foge: posição exata (em células) e quantos itens de velocidade tem. */
export type Body = Pick<PlayerState, 'x' | 'y' | 'speedBonus'> & { speedScale?: number };

/**
 * Quando o CENTRO do corpo está dentro da primeira célula do caminho (a vizinha, na `direction`), em passos a
 * partir de agora: de `early` (o mais cedo possível: andando reto) até `late` (o mais tarde: alinhando o corpo ao
 * corredor antes de andar, e levando uma célula inteira para sair dela). A k-ésima célula soma (k-1) células de tempo.
 * Dano é pelo centro do corpo (veja applyFlameDamage), então é este intervalo que não pode cruzar o fogo.
 * Usa a posição REAL dentro da célula e a velocidade REAL: quem está colado na borda entra na vizinha em poucos
 * passos, e quem tem item de velocidade anda mais depressa que a base.
 */
function presence(body: Body, from: Cell, direction: Direction, ticksPerCell: number, stepDistance: number): [number, number] {
  const horizontal = direction === 'left' || direction === 'right';
  const along = horizontal ? body.x : body.y;
  const across = horizontal ? body.y : body.x;
  const cellStart = horizontal ? from.col : from.row;
  const towardEnd = direction === 'right' || direction === 'down';
  const toBoundary = towardEnd ? cellStart + 1 - along : along - cellStart;
  const lateral = Math.abs(Math.floor(across) + 0.5 - across);
  return [toBoundary / stepDistance, (toBoundary + lateral) / stepDistance + ticksPerCell];
}

/** O centro do corpo estar na célula entre `early` e `late` (menos/mais a folga) cruza alguma janela de perigo? */
function unsafeDuring(hazards: HazardMap, index: number, early: number, late: number, marginTicks: number): boolean {
  return hazards.windows[index]!.some(([from, to]) => early - marginTicks < to && late + marginTicks > from);
}

/**
 * Caminho de fuga: o menor número de passos até uma célula que NUNCA pega fogo, de modo que o centro do corpo
 * não esteja numa célula do caminho enquanto ela pega fogo. Devolve as células do caminho (sem a de partida)
 * ou null se não houver. A bomba na própria célula de partida não atrapalha (quem a colocou sai dela).
 * `who` é o jogador (posição e velocidade reais) ou só a célula de partida, com o corpo no centro e velocidade base.
 * `marginTicks` é a folga de segurança.
 */
export function findEscape(state: GameState, hazards: HazardMap, who: Body | Cell, marginTicks: number): Cell[] | null {
  const body: Body = 'x' in who ? who : { x: who.col + 0.5, y: who.row + 0.5, speedBonus: 0 };
  const from: Cell = { col: Math.floor(body.x), row: Math.floor(body.y) };
  const stepDistance = stepDistanceOf(body);
  const ticksPerCell = 1 / stepDistance;
  const arena = state.arena;
  const size = arena.cols * arena.rows;

  // Um "estado" da busca é (célula, direção do primeiro passo): o tempo para entrar na primeira célula depende
  // da posição real e da direção, e os passos seguintes herdam esse atraso.
  const first = new Map<Direction, [number, number]>();
  for (const n of neighborsOf(from)) first.set(n.direction, presence(body, from, n.direction, ticksPerCell, stepDistance));
  const directions = [...first.keys()];
  const keyOf = (cell: number, direction: Direction): number => directions.indexOf(direction) * size + cell;

  // Camada k = estados alcançáveis em exatamente k passos; cada um guarda o estado de onde veio.
  let layer = new Map<number, number>();
  const history: Array<Map<number, number>> = [new Map(), layer]; // history[k] = camada do passo k
  for (const n of neighborsOf(from)) {
    if (!isWalkable(state, hazards, n.col, n.row)) continue;
    const nIndex = cellIndex(arena, n.col, n.row);
    const [early, late] = first.get(n.direction)!;
    if (unsafeDuring(hazards, nIndex, early, late, marginTicks)) continue;
    layer.set(keyOf(nIndex, n.direction), -1);
  }

  for (let step = 1; step <= MAX_ESCAPE_STEPS; step++) {
    if (layer.size === 0) return null;

    // Chegou numa célula segura para sempre? Remonta o caminho de trás para frente.
    for (const key of layer.keys()) {
      if (hasHazard(hazards, key % size)) continue;
      const path: Cell[] = [];
      let current = key;
      for (let k = step; k >= 1; k--) {
        const cell = current % size;
        path.unshift({ col: cell % arena.cols, row: Math.floor(cell / arena.cols) });
        current = history[k]!.get(current)!;
      }
      return path;
    }
    if (step === MAX_ESCAPE_STEPS) return null;

    const next = new Map<number, number>();
    for (const key of layer.keys()) {
      const cell = key % size;
      const direction = directions[Math.floor(key / size)]!;
      const [earlyFirst, lateFirst] = first.get(direction)!;
      for (const n of neighborsOf({ col: cell % arena.cols, row: Math.floor(cell / arena.cols) })) {
        if (!isWalkable(state, hazards, n.col, n.row)) continue;
        const nIndex = cellIndex(arena, n.col, n.row);
        const nKey = keyOf(nIndex, direction);
        if (next.has(nKey)) continue;
        if (unsafeDuring(hazards, nIndex, earlyFirst + step * ticksPerCell, lateFirst + step * ticksPerCell, marginTicks)) continue;
        next.set(nKey, key);
      }
    }
    history.push(next);
    layer = next;
  }
  return null;
}
