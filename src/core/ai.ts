import { AI_SETTINGS, DEFAULT_AI_DIFFICULTY } from '../config/ai';
import type { AiDifficulty } from '../config/ai';
import { cellIndex, getCell } from './arena';
import { stepDistanceOf } from './movement';
import { REMOTE_FUSE_TICKS, SIDELINE_THROW_DISTANCE } from '../config/bombs';
import { BAD_ITEMS } from '../config/items';
import { findLanding, kickDestination, playerBlocksCell } from './bombs';
import { buildHazards, findEscape, hasHazard, hypotheticalBomb, isWalkable, neighborsOf } from './danger';
import type { HazardMap } from './danger';
import { blastOf } from './explosions';
import { createRng } from './random';
import { inwardDirection, ringCells, ringStep } from './sideline';
import type { BombState, Cell, Direction, GameState, PlayerId, PlayerIntent, PlayerState } from './types';

// Inimigo controlado pelo computador.
//
// A IA é um "jogador fantasma": a cada passo ela olha o estado do jogo e devolve uma intenção
// ({ move, placeBomb }), exatamente como o teclado faz. Não tem poderes especiais: anda na mesma
// velocidade, coloca bombas pelas mesmas regras e só enxerga o que está no estado.
//
// Prioridades a cada decisão:
// 1. FUGIR: se a célula em que está vai pegar fogo (bomba, cadeia ou chama), vai para o lugar seguro mais perto,
//    por um caminho que não cruze fogo na hora em que ela passar.
// 2. BOMBARDEAR: se há um inimigo na mira da cruz, ou um bloco a destruir, coloca a bomba — mas SÓ se, com essa
//    bomba, ainda existir um caminho de fuga seguro. É isto que impede o suicídio.
// 3. CAÇAR: anda em direção ao inimigo mais perto, evitando células que vão pegar fogo. Blocos no caminho contam
//    como "atravessáveis com bomba" (custo alto), então ela abre caminho explodindo.
//    Um item no chão perto (sem bloco nem fogo no caminho) vale o desvio: ela o pega antes de seguir o inimigo.
//
// Habilidades (normal e difícil; a fácil não usa): chuta bombas para longe de si ou para cima do inimigo, arremessa a
// bomba em que pisa quando o destino pega o inimigo, anda por dentro dos blocos enquanto dura o fantasma e detona a
// bomba-relógio. Ela evita os itens ruins e, se estiver com os controles invertidos, compensa a inversão.
// Bombas-relógio dos outros são tratadas como perigo permanente (ela não sabe quando serão detonadas).
//
// Memória: um sorteador com semente (para variar), a última direção, o tempo de espera entre bombas. Nada disso
// é regra do jogo, por isso fica aqui e não no GameState. Reiniciar a rodada cria IAs novas.

export interface AiController {
  readonly playerId: PlayerId;
  /** Decide a intenção deste passo. NÃO altera o estado. */
  decide(state: GameState): PlayerIntent;
}

/** Custo, no cálculo do caminho, de passar por um bloco (que precisará ser explodido). Livre custa 1. */
const BLOCK_COST = 8;
/** Penalidade extra para um bloco que ela não conseguiu bombardear com segurança há pouco. */
const FAILED_BLOCK_PENALTY = 25;
const FAILED_BLOCK_MEMORY_TICKS = 400;
/** Distância (em células) do centro a partir da qual ela considera "alinhado" e não corrige mais. Menor que a folga do corpo. */
const CENTER_TOLERANCE = 0.04;
/** Parada esperando algo por mais que isto => dá uma voltinha para não ficar travada. */
const MAX_WAIT_TICKS = 90;
const WANDER_TICKS = 40;

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;

function cellOf(player: PlayerState): Cell {
  return { col: Math.floor(player.x), row: Math.floor(player.y) };
}

/**
 * Qual tecla "apertar" para ir da posição atual até o centro da célula `target`.
 * Antes de andar na direção do passo, alinha o corpo à faixa por onde vai passar (o corpo mal cabe em um corredor).
 */
function steer(me: PlayerState, target: Cell): Direction | null {
  // Com itens de velocidade o passo cresce: a tolerância acompanha (metade do passo), senão ela passaria do
  // centro, voltaria, passaria de novo... sem nunca parar. O passo máximo (config/items.ts) mantém isto < folga do corpo.
  const tolerance = Math.max(CENTER_TOLERANCE, stepDistanceOf(me) / 2 + 1e-6);
  const dx = target.col + 0.5 - me.x;
  const dy = target.row + 0.5 - me.y;
  const here = cellOf(me);

  let horizontal: boolean;
  if (target.row === here.row && target.col !== here.col) horizontal = true;
  else if (target.col === here.col && target.row !== here.row) horizontal = false;
  else horizontal = Math.abs(dx) >= Math.abs(dy);

  if (horizontal) {
    if (Math.abs(dy) > tolerance) return dy < 0 ? 'up' : 'down';
    if (Math.abs(dx) > tolerance) return dx < 0 ? 'left' : 'right';
  } else {
    if (Math.abs(dx) > tolerance) return dx < 0 ? 'left' : 'right';
    if (Math.abs(dy) > tolerance) return dy < 0 ? 'up' : 'down';
  }
  return null;
}

interface HuntPlan {
  /** Células a percorrer até parar diante de um bloco (exclusive) ou chegar ao inimigo. */
  path: Cell[];
  /** O próximo passo do caminho é um bloco: ela está encostada nele e precisa explodi-lo. */
  nextIsBlock: boolean;
  /** Primeira célula do caminho (bloco ou não). */
  next: Cell;
}

/**
 * Caminho mais barato até um dos `targets` (índices de célula). Blocos custam caro (ela os explodirá) quando
 * `throughBlocks`; senão são parede. Ela nunca planeja pisar em célula que vai pegar fogo, nem para chegar ao alvo.
 * `adjacent`: parar numa célula vizinha ao alvo basta (para caçar: a bomba pega o inimigo pela cruz);
 * senão precisa chegar à própria célula (para pegar item).
 */
function planRoute(
  state: GameState,
  hazards: HazardMap,
  me: PlayerState,
  penalties: ReadonlyMap<number, number>,
  tick: number,
  targets: ReadonlySet<number>,
  mode: { adjacent: boolean; throughBlocks: boolean; ghost?: boolean },
): HuntPlan | null {
  const { arena } = state;
  const size = arena.cols * arena.rows;
  if (targets.size === 0) return null;

  const start = cellIndex(arena, Math.floor(me.x), Math.floor(me.y));
  // Itens ruins no chão não são pisados (a não ser que sejam o próprio destino).
  const badCells = new Set(state.items.filter((item) => (BAD_ITEMS as readonly string[]).includes(item.kind)).map((item) => cellIndex(arena, item.col, item.row)));
  const nextToTarget = (index: number): boolean =>
    neighborsOf({ col: index % arena.cols, row: Math.floor(index / arena.cols) }).some((n) =>
      targets.has(cellIndex(arena, n.col, n.row)),
    );
  const dist = new Array<number>(size).fill(Infinity);
  const prev = new Array<number>(size).fill(-1);
  const done = new Array<boolean>(size).fill(false);
  dist[start] = 0;

  for (;;) {
    let best = -1;
    for (let i = 0; i < size; i++) {
      if (!done[i] && dist[i]! < Infinity && (best === -1 || dist[i]! < dist[best]!)) best = i;
    }
    if (best === -1) return null;
    done[best] = true;

    if (best !== start && (targets.has(best) || (mode.adjacent && nextToTarget(best)))) {
      const full: Cell[] = [];
      for (let current = best; current !== start; current = prev[current]!) {
        full.unshift({ col: current % arena.cols, row: Math.floor(current / arena.cols) });
      }
      // Com o fantasma ativo o bloco não atrapalha: o caminho segue por dentro dele.
      const firstBlock = mode.ghost ? -1 : full.findIndex((cell) => getCell(arena, cell.col, cell.row) === 'block');
      const path = firstBlock === -1 ? full : full.slice(0, firstBlock);
      return { path, next: full[0]!, nextIsBlock: firstBlock === 0 };
    }

    const from = { col: best % arena.cols, row: Math.floor(best / arena.cols) };
    for (const n of neighborsOf(from)) {
      const kind = getCell(arena, n.col, n.row);
      if (kind === 'wall' || (kind === 'block' && !mode.throughBlocks)) continue;
      const index = cellIndex(arena, n.col, n.row);
      if (hazards.bombs.some((bomb) => bomb.col === n.col && bomb.row === n.row)) continue;
      if (hasHazard(hazards, index)) continue;
      if (badCells.has(index) && !targets.has(index)) continue;

      let cost = 1;
      if (kind === 'block' && mode.ghost) cost = 1;
      else if (kind === 'block') {
        cost = BLOCK_COST;
        const until = penalties.get(index);
        if (until !== undefined && until > tick) cost += FAILED_BLOCK_PENALTY;
      }
      if (dist[best]! + cost < dist[index]!) {
        dist[index] = dist[best]! + cost;
        prev[index] = best;
      }
    }
  }
}

/** Caça: vai até ficar ao lado do inimigo mais perto, abrindo caminho pelos blocos. */
function planHunt(
  state: GameState,
  hazards: HazardMap,
  me: PlayerState,
  penalties: ReadonlyMap<number, number>,
  tick: number,
): HuntPlan | null {
  const targets = new Set<number>();
  for (const other of state.players) {
    if (other.alive && other.team !== me.team) targets.add(cellIndex(state.arena, Math.floor(other.x), Math.floor(other.y)));
  }
  // Fantasma ativo (com tempo de sobra para chegar): atravessa os blocos em vez de explodi-los.
  const ghost = me.ghostTicks > GHOST_MIN_TICKS_TO_ROUTE;
  return planRoute(state, hazards, me, penalties, tick, targets, { adjacent: true, throughBlocks: true, ghost });
}

/** Item no chão alcançável sem blocos e sem fogo, a no máximo `maxSteps` células. */
function planItem(state: GameState, hazards: HazardMap, me: PlayerState, maxSteps: number): Cell[] | null {
  if (maxSteps <= 0 || state.items.length === 0) return null;
  const targets = new Set(
    state.items.filter((item) => !(BAD_ITEMS as readonly string[]).includes(item.kind)).map((item) => cellIndex(state.arena, item.col, item.row)),
  );
  const plan = planRoute(state, hazards, me, new Map(), state.tick, targets, { adjacent: false, throughBlocks: false });
  return plan && plan.path.length <= maxSteps ? plan.path : null;
}

/** Sem fuga completa: ao menos vai para o vizinho cujo fogo chega mais tarde (ou nunca). */
function desperateTarget(state: GameState, hazards: HazardMap, me: PlayerState): Cell | null {
  const firstFire = (index: number): number =>
    hazards.windows[index]!.reduce((earliest, [from]) => Math.min(earliest, from), Infinity);
  const here = cellOf(me);
  let bestScore = firstFire(cellIndex(state.arena, here.col, here.row));
  let bestTarget: Cell | null = null;
  for (const n of neighborsOf(here)) {
    if (!isWalkable(state, hazards, n.col, n.row)) continue;
    const score = firstFire(cellIndex(state.arena, n.col, n.row));
    if (score > bestScore) {
      bestScore = score;
      bestTarget = n;
    }
  }
  return bestTarget;
}

/** Só planeja caminho por dentro dos blocos com o fantasma se ainda restar este tempo (o fantasma também só termina com o corpo fora do bloco). */
const GHOST_MIN_TICKS_TO_ROUTE = 90;

/** O corpo (centro) do jogador está dentro da cruz desta bomba hipotética? */
function blastCatches(state: GameState, blastCells: ReadonlySet<number>, player: PlayerState): boolean {
  return blastCells.has(cellIndex(state.arena, Math.floor(player.x), Math.floor(player.y)));
}

/** Mapa de bombas por célula, trocando (opcionalmente) a posição de uma delas. */
function bombMap(state: GameState, moved?: { bomb: BombState; col: number; row: number }): Map<number, BombState> {
  const byCell = new Map<number, BombState>();
  for (const bomb of state.bombs) {
    if (moved && bomb === moved.bomb) continue;
    byCell.set(cellIndex(state.arena, bomb.col, bomb.row), bomb);
  }
  if (moved) byCell.set(cellIndex(state.arena, moved.col, moved.row), { ...moved.bomb, col: moved.col, row: moved.row });
  return byCell;
}

/**
 * Chute com propósito: tem o item de chute e há uma bomba parada colada nela. Chuta se, depois de deslizar, a
 * explosão não pega nem ela nem os aliados e (a) ela estava na cruz da bomba (fuga) ou (b) pega um inimigo (ataque).
 */
const AHEAD: Record<Direction, { dc: number; dr: number }> = { up: { dc: 0, dr: -1 }, down: { dc: 0, dr: 1 }, left: { dc: -1, dr: 0 }, right: { dc: 1, dr: 0 } };

function planKick(state: GameState, me: PlayerState, inDanger: boolean, canFlee: () => boolean): Direction | null {
  if (!me.canKick) return null;
  const here = cellOf(me);
  for (const n of neighborsOf(here)) {
    const bomb = state.bombs.find((b) => b.col === n.col && b.row === n.row);
    if (!bomb || bomb.slide || bomb.walkThrough.includes(me.id)) continue;
    const to = kickDestination(state, bomb, n.direction);
    if (to.col === bomb.col && to.row === bomb.row) continue; // sem espaço para deslizar
    const ahead = AHEAD[n.direction];
    if (playerBlocksCell(state, bomb.col + ahead.dc, bomb.row + ahead.dr)) continue; // alguém parado na frente: a bomba não sai do lugar
    const blast = blastOf(state.arena, { ...bomb, col: to.col, row: to.row }, bombMap(state, { bomb, col: to.col, row: to.row }));
    const cells = new Set(blast.cells);
    if (blastCatches(state, cells, me)) continue;
    if (state.players.some((p) => p.alive && p.id !== me.id && p.team === me.team && blastCatches(state, cells, p))) continue;
    const hitsEnemy = state.players.some((p) => p.alive && p.team !== me.team && blastCatches(state, cells, p));
    if (hitsEnemy) return n.direction;
    // Só para se salvar: se dá para fugir andando, foge (chutar a própria bomba à toa a mandaria embora e travaria o jogo).
    if (inDanger && !canFlee()) return n.direction;
  }
  return null;
}

/**
 * Arremesso com propósito: em cima da própria bomba, com o item de arremesso, joga-a (na direção em que olha) se a
 * explosão no destino pegar um inimigo sem pegar ela nem os aliados.
 */
function wantsThrow(state: GameState, me: PlayerState): boolean {
  if (!me.canThrow) return false;
  const here = cellOf(me);
  const bomb = state.bombs.find((b) => b.owner === me.id && b.col === here.col && b.row === here.row && !b.slide);
  if (!bomb || bomb.ticksLeft <= 20) return false;
  const landing = findLanding(state, here.col, here.row, me.facing);
  if (!landing) return false;
  const blast = blastOf(state.arena, { ...bomb, col: landing.col, row: landing.row }, bombMap(state, { bomb, col: landing.col, row: landing.row }));
  const cells = new Set(blast.cells);
  if (blastCatches(state, cells, me)) return false;
  if (state.players.some((p) => p.alive && p.id !== me.id && p.team === me.team && blastCatches(state, cells, p))) return false;
  return state.players.some((p) => p.alive && p.team !== me.team && blastCatches(state, cells, p));
}

/**
 * Computador eliminado, jogando das laterais: escolhe a casa do anel de onde a bomba jogada cai melhor — que pegue
 * inimigos (e nenhum aliado) ou, não dando, que caia perto de um inimigo — sem se afastar demais da casa atual.
 * Devolve a direção para andar no anel (null = já está na melhor casa) e se deve jogar a bomba ali.
 */
function sidelinePlan(state: GameState, me: PlayerState, bombChance: number, roll: number): { move: Direction | null; placeBomb: boolean } {
  const { arena } = state;
  const ring = ringCells(arena);
  const here = me.sideline!;
  const enemies = state.players.filter((p) => p.alive && p.team !== me.team);
  const allies = state.players.filter((p) => p.alive && p.id !== me.id && p.team === me.team);
  if (enemies.length === 0) return { move: null, placeBomb: false };
  const byCell = bombMap(state);

  let best = -1;
  let bestScore = -Infinity;
  let bestHits = 0;
  let bestNear = Infinity;
  ring.forEach((from, index) => {
    const landing = findLanding(state, from.col, from.row, inwardDirection(arena, index), SIDELINE_THROW_DISTANCE);
    if (!landing) return;
    const cells = new Set(blastOf(arena, { col: landing.col, row: landing.row, range: me.bombRange }, byCell).cells);
    const hits = enemies.filter((p) => blastCatches(state, cells, p)).length;
    const friends = allies.filter((p) => blastCatches(state, cells, p)).length;
    const near = Math.min(...enemies.map((p) => Math.abs(Math.floor(p.x) - landing.col) + Math.abs(Math.floor(p.y) - landing.row)));
    const forward = (index - here + ring.length) % ring.length;
    const walk = Math.min(forward, ring.length - forward);
    const score = hits * 100 - friends * 150 - near * 2 - walk * 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = index;
      bestHits = hits;
      bestNear = near;
    }
  });
  if (best < 0) return { move: null, placeBomb: false };

  if (best === here) {
    const worthIt = bestHits > 0 || bestNear <= me.bombRange + 2;
    return { move: null, placeBomb: worthIt && roll < bombChance };
  }
  const forward = (best - here + ring.length) % ring.length;
  const next = forward <= ring.length - forward ? (here + 1) % ring.length : (here - 1 + ring.length) % ring.length;
  const move = (['up', 'down', 'left', 'right'] as const).find((d) => ringStep(arena, here, d) === next) ?? null;
  return { move, placeBomb: false };
}

/** Bomba-relógio da IA: detona a mais antiga quando ela e os aliados estão fora do alcance (inclusive da cadeia) e vale a pena. */
const REMOTE_MIN_ARMED_TICKS = 40;
const REMOTE_PATIENCE_TICKS = 90;

function wantsDetonate(state: GameState, me: PlayerState): boolean {
  const mine = state.bombs.filter((bomb) => bomb.owner === me.id && bomb.remote && bomb.ticksLeft > 1);
  const bomb = mine[0];
  if (!bomb) return false;
  const armedFor = REMOTE_FUSE_TICKS - bomb.ticksLeft;
  if (armedFor < REMOTE_MIN_ARMED_TICKS) return false;

  // Alcance total da explosão, com a cadeia.
  const { arena } = state;
  const byCell = new Map<number, BombState>();
  for (const other of state.bombs) byCell.set(cellIndex(arena, other.col, other.row), other);
  const cells = new Set<number>();
  const seen = new Set<BombState>([bomb]);
  const queue = [bomb];
  for (let i = 0; i < queue.length; i++) {
    const blast = blastOf(arena, queue[i]!, byCell);
    for (const index of blast.cells) cells.add(index);
    for (const hit of blast.bombsHit) {
      if (!seen.has(hit)) {
        seen.add(hit);
        queue.push(hit);
      }
    }
  }

  const inside = (player: PlayerState): boolean => cells.has(cellIndex(arena, Math.floor(player.x), Math.floor(player.y)));
  if (inside(me)) return false;
  if (state.players.some((other) => other.alive && other.id !== me.id && other.team === me.team && inside(other))) return false;
  const enemyHit = state.players.some((other) => other.alive && other.team !== me.team && inside(other));
  return enemyHit || armedFor >= REMOTE_PATIENCE_TICKS;
}

export function createAi(
  playerId: PlayerId,
  difficulty: AiDifficulty = DEFAULT_AI_DIFFICULTY,
  seed = 1,
): AiController {
  const settings = AI_SETTINGS[difficulty];
  const rng = createRng(seed * 7919 + playerId * 104729 + 17);
  // Cada IA pensa em um passo diferente do ciclo, para as reações não ficarem todas sincronizadas.
  const phase = Math.floor(rng() * settings.thinkEveryTicks);

  // Caminho decidido na última "pensada". Entre pensadas ela só pilota por ele (ver `follow`).
  let route: Cell[] = [];
  let nextBombTick = 0;
  let waitedTicks = 0;
  let wanderUntil = 0;
  let wanderTarget: Cell | null = null;
  const failedBlocks = new Map<number, number>();
  /** Direção no anel decidida na última "pensada", repetida entre elas (só nas laterais). */
  let sidelineMove: Direction | null = null;

  /** Direção para seguir `route` a partir da posição atual: descarta as células já alcançadas e mira na próxima. */
  function follow(me: PlayerState): Direction | null {
    const here = cellOf(me);
    while (route.length > 1 && route[0]!.col === here.col && route[0]!.row === here.row) route.shift();
    const target = route[0];
    return target ? steer(me, target) : null;
  }

  function decideMove(state: GameState): PlayerIntent {
    const me = state.players.find((player) => player.id === playerId);
    if (!me || !me.alive) return { move: null, placeBomb: false };

    // Entre uma decisão e outra só pilota pelo caminho já decidido (reação mais lenta nas dificuldades fáceis,
    // mas sem passar do ponto de curva).
    if ((state.tick + phase) % settings.thinkEveryTicks !== 0) return { move: follow(me), placeBomb: false };

    const { arena } = state;
    const hazards = buildHazards(state, undefined, me.id);
    const here = cellOf(me);
    const hereIndex = cellIndex(arena, here.col, here.row);
    let placeBomb = false;
    let kickDirection: Direction | null = null;
    route = [];

    const kick = settings.usesAbilities ? planKick(state, me, hasHazard(hazards, hereIndex), () => (findEscape(state, hazards, me, settings.safetyMarginTicks) ?? findEscape(state, hazards, me, 0)) !== null) : null;
    if (kick) {
      // 0. CHUTAR a bomba (para longe de si ou para cima do inimigo)
      kickDirection = kick;
      waitedTicks = 0;
    } else if (hasHazard(hazards, hereIndex)) {
      // 1. FUGIR
      // Com a folga de segurança; se ela deixar de existir no meio da fuga (o plano ficou apertado por poucos passos),
      // vale mais seguir pela fuga que ainda é possível sem folga do que dar meia-volta para um beco sem saída.
      const escape =
        findEscape(state, hazards, me, settings.safetyMarginTicks) ?? findEscape(state, hazards, me, 0);
      if (escape) route = escape;
      else {
        const target = desperateTarget(state, hazards, me);
        if (target) route = [target];
      }
      waitedTicks = 0;
    } else if (state.tick < wanderUntil && wanderTarget) {
      // Voltinha para destravar.
      route = [wanderTarget];
    } else {
      const hunt = planHunt(state, hazards, me, failedBlocks, state.tick);

      // 2. BOMBARDEAR (só com saída garantida)
      const ownBombs = state.bombs.filter((bomb) => bomb.owner === me.id).length;
      if (state.tick >= nextBombTick && ownBombs < me.maxBombs) {
        const bomb: BombState = hypotheticalBomb(here, me.id, me.bombRange, me.piercing);
        const byCell = new Map<number, BombState>();
        for (const existing of state.bombs) byCell.set(cellIndex(arena, existing.col, existing.row), existing);
        byCell.set(hereIndex, bomb);
        const blast = blastOf(arena, bomb, byCell);
        const hits = new Set(blast.cells);

        const inBlast = (other: PlayerState): boolean => hits.has(cellIndex(arena, Math.floor(other.x), Math.floor(other.y)));
        const enemyInSights = state.players.some((other) => other.alive && other.team !== me.team && inBlast(other));
        const alliesInBlast = state.players.filter((other) => other.alive && other.id !== me.id && other.team === me.team && inBlast(other));

        let wants = false;
        if (enemyInSights) wants = rng() < settings.enemyBombChance;
        // Só gasta bomba (e os ~4 s de espera dela) num bloco se ele estiver realmente no caminho do inimigo.
        else if (hunt?.nextIsBlock) wants = rng() < settings.blockBombChance;

        if (wants) {
          const withBomb = buildHazards(state, bomb, me.id);
          const myEscape = findEscape(state, withBomb, me, settings.safetyMarginTicks);
          // Aliado na cruz não impede a bomba, desde que ele também tenha por onde fugir (os aliados fogem sozinhos).
          const alliesCanEscape = alliesInBlast.every(
            (ally) => findEscape(state, withBomb, ally, settings.safetyMarginTicks) !== null,
          );
          if (myEscape && alliesCanEscape) {
            placeBomb = true;
            nextBombTick = state.tick + settings.bombCooldownTicks;
          } else if (hunt?.nextIsBlock) {
            // Não dá para bombardear daqui com segurança: lembra disso para tentar outro caminho.
            failedBlocks.set(cellIndex(arena, hunt.next.col, hunt.next.row), state.tick + FAILED_BLOCK_MEMORY_TICKS);
          }
        }
      }

      // 3. CAÇAR
      if (!placeBomb) {
        // Item por perto vale o desvio (mais bombas/alcance/velocidade); senão segue o inimigo.
        const toItem = planItem(state, hazards, me, settings.itemSeekSteps);
        if (toItem) route = toItem;
        else if (hunt) route = hunt.path;
      }

      // Parada esperando por muito tempo (bloco que não pode ser explodido, inimigo inalcançável...): dá uma voltinha.
      const hasEnemies = state.players.some((other) => other.alive && other.team !== me.team);
      if (placeBomb || route.length > 0 || !hasEnemies) waitedTicks = 0;
      else waitedTicks += settings.thinkEveryTicks;
      if (waitedTicks > MAX_WAIT_TICKS) {
        waitedTicks = 0;
        const options = neighborsOf(here).filter((n) => isWalkable(state, hazards, n.col, n.row) && !hasHazard(hazards, cellIndex(arena, n.col, n.row)));
        const pick = options[Math.floor(rng() * options.length)];
        if (pick) {
          wanderTarget = pick;
          wanderUntil = state.tick + WANDER_TICKS;
          route = [pick];
        }
      }
    }

    return { move: kickDirection ?? follow(me), placeBomb };
  }

  return {
    playerId,

    decide(state: GameState): PlayerIntent {
      const self = state.players.find((player) => player.id === playerId);
      // Eliminado e jogando das laterais: joga bombas de fora (veja sidelinePlan).
      if (self && !self.alive && self.sideline !== null) {
        if ((state.tick + phase) % settings.thinkEveryTicks !== 0) return { move: sidelineMove, placeBomb: false };
        const plan = sidelinePlan(state, self, settings.enemyBombChance, rng());
        sidelineMove = plan.move;
        return { move: plan.move, placeBomb: plan.placeBomb };
      }
      const intent = decideMove(state);
      const me = state.players.find((player) => player.id === playerId);
      if (me?.alive && settings.usesAbilities && wantsThrow(state, me)) intent.special = true;
      else if (me?.alive && wantsDetonate(state, me)) intent.special = true;
      // Controles invertidos (item ruim): a IA sabe disso e aperta o contrário do que quer.
      if (me && me.invertTicks > 0 && intent.move) intent.move = OPPOSITE[intent.move];
      return intent;
    },
  };
}
