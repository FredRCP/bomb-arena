import { SPEED_ITEMS_CAP, SPEED_PER_ITEM } from '../config/items';
import { PLAYER_HALF_SIZE, PLAYER_SPEED, TICKS_PER_SECOND } from '../config/simulation';
import { getCell, isSolid } from './arena';
import type { Arena, Direction, PlayerState } from './types';

// Movimento do jogador: suave (não pula de célula em célula), mas sempre respeitando a grade.
// O corpo é um quadrado; paredes e blocos são células inteiras. Tudo em unidades de célula.

/** Tolerância de arredondamento: encostar na borda de uma célula não conta como invadi-la. */
const EPS = 1e-9;

/** Distância percorrida por passo de simulação, em células, SEM itens de velocidade (a velocidade base). */
export const STEP_DISTANCE = PLAYER_SPEED / TICKS_PER_SECOND;

/**
 * Teto de distância por passo: a de uma pessoa com todos os itens de velocidade (5,9 células por segundo).
 * Acima de ~6 células/s o passo passaria de 0,1 e a IA não conseguiria mais parar no centro da célula.
 */
export const MAX_STEP_DISTANCE = (PLAYER_SPEED + SPEED_ITEMS_CAP * SPEED_PER_ITEM) / TICKS_PER_SECOND;

/** Distância por passo deste jogador: a base (vezes `speedScale`) mais o que os itens de velocidade somam, até o teto. */
export function stepDistanceOf(player: Pick<PlayerState, 'speedBonus'> & { speedScale?: number }): number {
  const raw = (PLAYER_SPEED * (player.speedScale ?? 1) + player.speedBonus * SPEED_PER_ITEM) / TICKS_PER_SECOND;
  return Math.min(raw, MAX_STEP_DISTANCE);
}

const VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** Uma célula de bomba em que o jogador ainda está "em cima": ele pode sair dela, mas não atravessá-la. */
export interface SoftCell {
  col: number;
  row: number;
}

/**
 * Verdadeiro se andar de (x, y) para (nx, ny) aprofundaria o jogador numa das bombas em que ele está em cima
 * (o centro dele chegaria mais perto do centro da bomba, em algum dos eixos), estando o centro dele fora da célula.
 * Sair da bomba é sempre permitido; atravessá-la, não: antes, quem estava só com a pontinha do corpo sobre a bomba (por exemplo, encurralado por ela
 * logo depois de colocada) podia andar por dentro da célula e sair do outro lado.
 */
export function goesDeeperIntoBomb(x: number, y: number, nx: number, ny: number, soft: readonly SoftCell[]): boolean {
  for (const cell of soft) {
    // Quem tem o CENTRO dentro da célula (quem acabou de colocar a bomba) anda livre: é assim que ele corre para a saída.
    // A trava vale para quem está só com a pontinha do corpo sobre a bomba, com o centro ainda fora dela.
    if (Math.floor(x) === cell.col && Math.floor(y) === cell.row) continue;
    const cx = cell.col + 0.5;
    const cy = cell.row + 0.5;
    if (Math.abs(nx - cx) < Math.abs(x - cx) - EPS) return true;
    if (Math.abs(ny - cy) < Math.abs(y - cy) - EPS) return true;
  }
  return false;
}

/** Verdadeiro se o corpo do jogador, com centro em (x, y), invade (mesmo que só um pouco) a célula (col, row). */
export function bodyOverlapsCell(x: number, y: number, col: number, row: number): boolean {
  return (
    Math.floor(x - PLAYER_HALF_SIZE + EPS) <= col &&
    col <= Math.floor(x + PLAYER_HALF_SIZE - EPS) &&
    Math.floor(y - PLAYER_HALF_SIZE + EPS) <= row &&
    row <= Math.floor(y + PLAYER_HALF_SIZE - EPS)
  );
}

/**
 * Verdadeiro se o corpo do jogador, com centro em (x, y), invade alguma célula sólida (parede ou bloco).
 * `blocked` são células extras que também bloqueiam (as das bombas), como índices de `arena.cells`.
 */
export function collidesAt(arena: Arena, x: number, y: number, blocked?: ReadonlySet<number>, ghost = false): boolean {
  const firstCol = Math.floor(x - PLAYER_HALF_SIZE + EPS);
  const lastCol = Math.floor(x + PLAYER_HALF_SIZE - EPS);
  const firstRow = Math.floor(y - PLAYER_HALF_SIZE + EPS);
  const lastRow = Math.floor(y + PLAYER_HALF_SIZE - EPS);

  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      // Fantasma: blocos destrutíveis não impedem a passagem (paredes e pilares continuam impedindo).
      if (ghost ? getCell(arena, col, row) === 'wall' : isSolid(arena, col, row)) return true;
      if (blocked?.has(row * arena.cols + col)) return true;
    }
  }
  return false;
}

/**
 * Ajuda de canto. Se o jogador bate na quina de uma parede mas a faixa em que ele está majoritariamente
 * tem caminho livre à frente, empurra-o suavemente para o centro dessa faixa. Isso evita ficar "agarrado"
 * ao passar por esquinas. Devolve true se empurrou.
 */
function slideAroundCorner(
  arena: Arena,
  player: PlayerState,
  dx: number,
  dy: number,
  blocked: ReadonlySet<number> | undefined,
  stepDistance: number,
  ghost: boolean,
  soft: readonly SoftCell[],
): boolean {
  // Andando na horizontal, o que importa é a linha (y); andando na vertical, a coluna (x).
  const horizontal = dx !== 0;
  const across = horizontal ? player.y : player.x;
  const laneCenter = Math.floor(across) + 0.5;
  const offset = laneCenter - across;

  // Já alinhado: então é parede mesmo, bem de frente. Não há o que ajudar.
  if (Math.abs(offset) < EPS) return false;

  // Só empurra se, alinhado no centro da faixa, o caminho à frente estiver livre.
  const alignedX = horizontal ? player.x : laneCenter;
  const alignedY = horizontal ? laneCenter : player.y;
  if (collidesAt(arena, alignedX, alignedY, blocked, ghost)) return false;
  if (collidesAt(arena, alignedX + dx * stepDistance, alignedY + dy * stepDistance, blocked, ghost)) return false;

  const target = Math.abs(offset) <= stepDistance ? laneCenter : across + Math.sign(offset) * stepDistance;
  const nextX = horizontal ? player.x : target;
  const nextY = horizontal ? target : player.y;
  if (collidesAt(arena, nextX, nextY, blocked, ghost)) return false;
  if (goesDeeperIntoBomb(player.x, player.y, nextX, nextY, soft)) return false;

  player.x = nextX;
  player.y = nextY;
  return true;
}

/** Posição em que o corpo encosta no obstáculo à frente, sem invadi-lo. */
function snapToObstacle(player: PlayerState, dx: number, dy: number, stepDistance: number): { x: number; y: number } {
  let { x, y } = player;
  if (dx > 0) x = Math.floor(x + PLAYER_HALF_SIZE + stepDistance - EPS) - PLAYER_HALF_SIZE;
  else if (dx < 0) x = Math.floor(x - PLAYER_HALF_SIZE - stepDistance + EPS) + 1 + PLAYER_HALF_SIZE;
  else if (dy > 0) y = Math.floor(y + PLAYER_HALF_SIZE + stepDistance - EPS) - PLAYER_HALF_SIZE;
  else y = Math.floor(y - PLAYER_HALF_SIZE - stepDistance + EPS) + 1 + PLAYER_HALF_SIZE;
  return { x, y };
}

/**
 * Move o jogador um passo de simulação na direção pedida (altera o jogador recebido).
 * 1) caminho livre: anda o passo inteiro;
 * 2) bateu numa quina: a ajuda de canto o empurra para a faixa livre;
 * 3) bateu de frente: encosta no obstáculo e para.
 * `blocked`: células de bombas que bloqueiam ESTE jogador (veja blockedCellsFor em bombs.ts).
 * `soft`: bombas em que ele ainda está em cima (walkThrough): ele pode se afastar delas, mas não ir mais fundo.
 */
export function movePlayer(
  arena: Arena,
  player: PlayerState,
  direction: Direction,
  blocked?: ReadonlySet<number>,
  soft: readonly SoftCell[] = [],
  speedFactor = 1,
): void {
  const { dx, dy } = VECTORS[direction];

  const stepDistance = stepDistanceOf(player) * speedFactor;
  const ghost = player.ghostTicks > 0;
  const nextX = player.x + dx * stepDistance;
  const nextY = player.y + dy * stepDistance;
  if (!collidesAt(arena, nextX, nextY, blocked, ghost)) {
    if (goesDeeperIntoBomb(player.x, player.y, nextX, nextY, soft)) return;
    player.x = nextX;
    player.y = nextY;
    return;
  }

  if (slideAroundCorner(arena, player, dx, dy, blocked, stepDistance, ghost, soft)) return;

  const snapped = snapToObstacle(player, dx, dy, stepDistance);
  if (!collidesAt(arena, snapped.x, snapped.y, blocked, ghost)) {
    player.x = snapped.x;
    player.y = snapped.y;
  }
}
