import { BOMB_FUSE_TICKS, KICK_SLIDE_TICKS, REMOTE_FUSE_TICKS, THROW_DISTANCE } from '../config/bombs';
import { cellIndex, getCell, inBounds } from './arena';
import { PLAYER_HALF_SIZE } from '../config/simulation';
import { bodyOverlapsCell } from './movement';
import type { BombState, Direction, GameState, PlayerId, PlayerState } from './types';

const VECTORS: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

/** Distância do centro à borda do corpo (metade do lado). */
const PLAYER_EDGE = PLAYER_HALF_SIZE;

// Colocar bombas e decidir por onde cada jogador pode passar por causa delas.

/**
 * Células de bomba que bloqueiam este jogador. Uma bomba não bloqueia quem ainda está em cima dela
 * (`walkThrough`): é assim que o jogador consegue sair da bomba que acabou de colocar.
 */
export function blockedCellsFor(state: GameState, playerId: PlayerId): Set<number> {
  const blocked = new Set<number>();
  for (const bomb of state.bombs) {
    if (!bomb.walkThrough.includes(playerId)) blocked.add(cellIndex(state.arena, bomb.col, bomb.row));
  }
  return blocked;
}

/**
 * Tenta colocar uma bomba na célula em que está o centro do jogador. Devolve true se colocou.
 * Não coloca se: o jogador morreu; já tem o máximo de bombas; já há bomba na célula; a célula está em chamas.
 */
export function placeBomb(state: GameState, player: PlayerState): boolean {
  if (!player.alive) return false;

  const col = Math.floor(player.x);
  const row = Math.floor(player.y);
  if (getCell(state.arena, col, row) !== 'empty') return false;
  if (state.bombs.some((bomb) => bomb.col === col && bomb.row === row)) return false;
  if (state.flames.some((flame) => flame.col === col && flame.row === row)) return false;
  if (state.bombs.filter((bomb) => bomb.owner === player.id).length >= player.maxBombs) return false;

  // Quem estiver com o corpo sobre a célula agora (o dono e, se houver, o outro jogador) pode sair dela.
  const walkThrough = state.players
    .filter((other) => other.alive && bodyOverlapsCell(other.x, other.y, col, row))
    .map((other) => other.id);

  // Bomba-relógio só na primeira: enquanto uma bomba-relógio sua está na arena, as outras são normais.
  const remote = player.remote && !state.bombs.some((bomb) => bomb.owner === player.id && bomb.remote);

  state.bombs.push({
    owner: player.id,
    col,
    row,
    ticksLeft: remote ? REMOTE_FUSE_TICKS : BOMB_FUSE_TICKS,
    range: player.bombRange,
    walkThrough,
    pierce: player.piercing,
    remote,
  });
  state.events.push({ type: 'bombPlaced', col, row, owner: player.id });
  return true;
}

/** Tira da lista `walkThrough` quem já saiu de cima da bomba (a partir daí a bomba o bloqueia). */
export function releaseBombs(state: GameState): void {
  for (const bomb of state.bombs) {
    bomb.walkThrough = bomb.walkThrough.filter((id) => {
      const player = state.players.find((p) => p.id === id);
      return player !== undefined && player.alive && bodyOverlapsCell(player.x, player.y, bomb.col, bomb.row);
    });
  }
}

/** A célula aceita uma bomba que chega (chutada ou arremessada)? Vazia, sem outra bomba. */
function isFreeForBomb(state: GameState, col: number, row: number): boolean {
  return getCell(state.arena, col, row) === 'empty' && !state.bombs.some((bomb) => bomb.col === col && bomb.row === row);
}

/**
 * Chute: o jogador com o item, andando contra uma bomba (colado nela), a põe para deslizar na direção em que anda.
 * Chame depois do movimento do jogador. Só chuta se a bomba tem espaço para andar pelo menos uma célula.
 */
export function tryKick(state: GameState, player: PlayerState, direction: Direction): boolean {
  if (!player.alive || !player.canKick) return false;
  const { dc, dr } = VECTORS[direction];
  const col = Math.floor(player.x) + dc;
  const row = Math.floor(player.y) + dr;
  const bomb = state.bombs.find((b) => b.col === col && b.row === row);
  if (!bomb || bomb.slide || bomb.walkThrough.includes(player.id)) return false;

  // "Colado": a borda do corpo encosta na célula da bomba (senão o jogador ainda está chegando).
  const gap = dc !== 0 ? (dc > 0 ? col - (player.x + PLAYER_EDGE) : player.x - PLAYER_EDGE - (col + 1)) : dr > 0 ? row - (player.y + PLAYER_EDGE) : player.y - PLAYER_EDGE - (row + 1);
  if (gap > 1e-6) return false;
  if (!isFreeForBomb(state, col + dc, row + dr) || playerBlocksCell(state, col + dc, row + dr)) return false;

  bomb.slide = { direction, ticks: 0 };
  state.events.push({ type: 'bombKicked', col, row });
  return true;
}

/** Algum jogador vivo ocupa (mesmo que um pouco) esta célula? Uma bomba deslizando para ela não consegue entrar. */
export function playerBlocksCell(state: GameState, col: number, row: number): boolean {
  return state.players.some((p) => p.alive && bodyOverlapsCell(p.x, p.y, col, row));
}

/**
 * Onde uma bomba que desliza estará daqui a `ticks` passos, se nada além de paredes, blocos e outras bombas a parar.
 * (Jogadores no caminho também a param, mas isso ninguém sabe prever.) Não altera o estado. Bomba parada: ela mesma.
 * Usado pela IA para saber onde a bomba chutada vai explodir.
 */
export function slideProjection(state: GameState, bomb: BombState, ticks: number): { col: number; row: number } {
  if (!bomb.slide) return { col: bomb.col, row: bomb.row };
  const { dc, dr } = VECTORS[bomb.slide.direction];
  const untilFirst = KICK_SLIDE_TICKS - bomb.slide.ticks;
  const wanted = ticks < untilFirst ? 0 : 1 + Math.floor((ticks - untilFirst) / KICK_SLIDE_TICKS);
  let col = bomb.col;
  let row = bomb.row;
  for (let k = 0; k < wanted; k++) {
    const nextCol = col + dc;
    const nextRow = row + dr;
    if (getCell(state.arena, nextCol, nextRow) !== 'empty') break;
    if (state.bombs.some((other) => other !== bomb && other.col === nextCol && other.row === nextRow)) break;
    col = nextCol;
    row = nextRow;
  }
  return { col, row };
}

/** Até onde uma bomba chutada na direção dada chegaria (sem limite de tempo). Parada logo de cara: a própria célula. */
export function kickDestination(state: GameState, bomb: BombState, direction: Direction): { col: number; row: number } {
  return slideProjection(state, { ...bomb, slide: { direction, ticks: 0 } }, 1_000_000);
}

/** Bombas chutadas andam uma célula a cada KICK_SLIDE_TICKS passos e param ao bater em parede, bloco, bomba ou jogador. */
export function advanceSlidingBombs(state: GameState): void {
  for (const bomb of state.bombs) {
    if (!bomb.slide) continue;
    bomb.slide.ticks += 1;
    if (bomb.slide.ticks < KICK_SLIDE_TICKS) continue;
    const { dc, dr } = VECTORS[bomb.slide.direction];
    const col = bomb.col + dc;
    const row = bomb.row + dr;
    if (!isFreeForBomb(state, col, row) || playerBlocksCell(state, col, row)) {
      bomb.slide = null;
      continue;
    }
    bomb.col = col;
    bomb.row = row;
    bomb.slide.ticks = 0;
  }
}

/**
 * Arremesso: com o item, em cima da PRÓPRIA bomba, o jogador a joga THROW_DISTANCE células para a frente (a direção em
 * que está olhando), por cima de tudo. Cai na primeira célula livre a partir daí (se a de destino estiver ocupada,
 * a bomba segue em frente); se não houver nenhuma, tenta mais perto. O pavio continua de onde estava.
 */
export function throwBomb(state: GameState, player: PlayerState): boolean {
  if (!player.alive || !player.canThrow) return false;
  const col = Math.floor(player.x);
  const row = Math.floor(player.y);
  const bomb = state.bombs.find((b) => b.owner === player.id && b.col === col && b.row === row && !b.slide);
  if (!bomb) return false;

  const landing = findLanding(state, col, row, player.facing);
  if (!landing) return false;
  bomb.col = landing.col;
  bomb.row = landing.row;
  // Quem estiver embaixo de onde a bomba caiu pode sair de lá.
  bomb.walkThrough = state.players.filter((p) => p.alive && bodyOverlapsCell(p.x, p.y, landing.col, landing.row)).map((p) => p.id);
  state.events.push({ type: 'bombThrown', fromCol: col, fromRow: row, col: landing.col, row: landing.row });
  return true;
}

/**
 * Onde cai uma bomba arremessada de (col, row) na direção dada: a primeira casa livre a partir de `distance`
 * (THROW_DISTANCE) casas (a bomba passa por cima de tudo); se não houver nenhuma adiante, tenta mais perto. Null se não cabe em lugar nenhum.
 * Não altera o estado. A IA e as laterais (sideline.ts) usam a mesma função.
 */
export function findLanding(
  state: GameState,
  col: number,
  row: number,
  direction: Direction,
  distance: number = THROW_DISTANCE,
): { col: number; row: number } | null {
  const { dc, dr } = VECTORS[direction];
  const reach = Math.max(state.arena.cols, state.arena.rows);
  const distances: number[] = [];
  for (let d = distance; d <= reach; d++) distances.push(d);
  for (let d = distance - 1; d >= 1; d--) distances.push(d);
  for (const d of distances) {
    const toCol = col + dc * d;
    const toRow = row + dr * d;
    if (inBounds(state.arena, toCol, toRow) && isFreeForBomb(state, toCol, toRow)) return { col: toCol, row: toRow };
  }
  return null;
}

/** Bomba-relógio: detona a bomba-relógio mais antiga do jogador (explode neste mesmo passo). */
export function detonateRemote(state: GameState, player: PlayerState): boolean {
  if (!player.alive) return false;
  const bomb = state.bombs.find((b) => b.owner === player.id && b.remote && b.ticksLeft > 1);
  if (!bomb) return false;
  bomb.ticksLeft = 1;
  return true;
}

/** Botão especial: primeiro tenta arremessar a bomba em que pisa; senão, detona uma bomba-relógio. */
export function useSpecial(state: GameState, player: PlayerState): boolean {
  return throwBomb(state, player) || detonateRemote(state, player);
}
