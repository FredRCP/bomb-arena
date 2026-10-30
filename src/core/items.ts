import { DEFAULT_BOMB_RANGE, DEFAULT_MAX_BOMBS, GHOST_TICKS } from '../config/bombs';
import {
  HERO_TICKS,
  INVERT_TICKS,
  MIN_SPEED_BONUS,
  BOMB_RANGE_CAP,
  ITEM_DROP_CHANCE,
  ITEM_WEIGHTS,
  MAX_BOMBS_CAP,
  SPEED_ITEMS_CAP,
} from '../config/items';
import { cellIndex, getCell } from './arena';
import { createRng } from './random';
import type { Arena, GameState, ItemKind, ItemState, PlayerState } from './types';

// Itens: nascem escondidos em alguns blocos, aparecem quando o bloco é destruído e são pegos por quem pisa neles.
//
// Regras (testadas em tests/core/items.test.ts):
// - Quais blocos escondem item (e de que tipo) é decidido na criação da partida, pela semente: mesma semente,
//   mesmos itens. Em arena simétrica, blocos espelhados escondem o MESMO item (justo para os dois lados).
// - Destruir o bloco revela o item na mesma célula. Chamas não destroem itens.
// - Pegar = o centro do corpo estar na célula do item. Vale para humanos e para inimigos do computador.
// - Dois jogadores na mesma célula no mesmo passo: o de menor id pega.
// - Efeitos: +1 bomba simultânea, +1 de alcance (só das bombas colocadas dali em diante), +velocidade;
//   habilidades (chute, perfurante, bomba-relógio, arremesso) valem pelo resto da rodada; fantasma dura GHOST_TICKS.
//   Itens ruins: controles invertidos (INVERT_TICKS) e pedra (-1 de velocidade, mínimo MIN_SPEED_BONUS).
//   Todos têm limite (config/items.ts); no limite, o item é gasto sem efeito.

const ABILITY_FLAG = { kick: 'canKick', pierce: 'piercing', remote: 'remote', throw: 'canThrow' } as const;

const KINDS: readonly ItemKind[] = ['bomb', 'range', 'speed', 'kick', 'pierce', 'remote', 'throw', 'ghost', 'invert', 'slow', 'vest', 'hero'];

function pickKind(roll: number): ItemKind {
  const total = KINDS.reduce((sum, kind) => sum + ITEM_WEIGHTS[kind], 0);
  let acc = 0;
  for (const kind of KINDS) {
    acc += ITEM_WEIGHTS[kind];
    if (roll * total < acc) return kind;
  }
  return 'bomb';
}

/**
 * Sorteia, com semente, quais blocos escondem item. Usa um sorteador próprio (derivado da semente), então
 * não mexe no sorteio dos blocos da arena. Chame logo depois de criar a arena.
 */
export function generateHiddenItems(arena: Arena, seed: number, symmetric: boolean, dropChance = ITEM_DROP_CHANCE): ItemState[] {
  const rng = createRng(seed * 2654435761 + 40503);
  const byIndex = new Map<number, ItemKind>();
  const hidden: ItemState[] = [];

  for (let index = 0; index < arena.cells.length; index++) {
    if (arena.cells[index] !== 'block') continue;
    const mirror = arena.cells.length - 1 - index;
    let kind: ItemKind | undefined;
    if (symmetric && mirror < index && arena.cells[mirror] === 'block') {
      // O espelho já foi decidido (está antes na lista): copia.
      kind = byIndex.get(mirror);
    } else if (rng() < dropChance) {
      kind = pickKind(rng());
    } else {
      rng(); // mantém o consumo do sorteador igual com ou sem item, para a sequência não depender do resultado
    }
    if (kind !== undefined) {
      byIndex.set(index, kind);
      hidden.push({ col: index % arena.cols, row: Math.floor(index / arena.cols), kind });
    }
  }
  return hidden;
}

/** Um bloco foi destruído em (col, row): se escondia um item, ele passa a existir no chão. */
export function revealItem(state: GameState, col: number, row: number): void {
  const at = state.hiddenItems.findIndex((item) => item.col === col && item.row === row);
  if (at === -1) return;
  const [item] = state.hiddenItems.splice(at, 1);
  state.items.push(item!);
  state.events.push({ type: 'itemSpawned', col, row, kind: item!.kind });
}

/** Aplica o efeito de um item ao jogador. Devolve false se já estava no limite (item gasto sem efeito). */
export function applyItem(player: PlayerState, kind: ItemKind): boolean {
  if (kind === 'bomb') {
    if (player.maxBombs >= MAX_BOMBS_CAP) return false;
    player.maxBombs += 1;
  } else if (kind === 'range') {
    if (player.bombRange >= BOMB_RANGE_CAP) return false;
    player.bombRange += 1;
  } else if (kind === 'speed') {
    if (player.speedBonus >= SPEED_ITEMS_CAP) return false;
    player.speedBonus += 1;
  } else if (kind === 'invert') {
    // Pegar de novo renova o tempo.
    player.invertTicks = INVERT_TICKS;
  } else if (kind === 'slow') {
    if (player.speedBonus <= MIN_SPEED_BONUS) return false;
    player.speedBonus -= 1;
  } else if (kind === 'vest') {
    if (player.vest) return false;
    player.vest = true;
  } else if (kind === 'hero') {
    // Pegar de novo renova o tempo.
    player.heroTicks = HERO_TICKS;
  } else if (kind === 'ghost') {
    // Pegar de novo renova o tempo.
    player.ghostTicks = GHOST_TICKS;
  } else {
    // Habilidades que se têm ou não se têm; pegar de novo gasta o item sem efeito.
    const flag = ABILITY_FLAG[kind];
    if (player[flag]) return false;
    player[flag] = true;
  }
  return true;
}

/**
 * Jogador eliminado: todos os seus itens (bombas, alcance, velocidade e habilidades) voltam ao chão, espalhados em
 * casas livres sorteadas, e ele fica de novo "do zero" (quem voltar das laterais volta sem nada). Itens que acabam
 * sozinhos (fantasma, controles invertidos) e a pedra simplesmente somem. O sorteio usa só o passo e o id do jogador,
 * então o resultado é sempre o mesmo para a mesma partida.
 * Casas que servem: livres, sem bomba, sem chama e sem outro item. Se não houver casas para todos, o resto se perde.
 */
export function dropPowerups(state: GameState, player: PlayerState): void {
  const drops: ItemKind[] = [];
  if (player.vest) drops.push('vest');
  for (let n = DEFAULT_MAX_BOMBS; n < player.maxBombs; n++) drops.push('bomb');
  for (let n = DEFAULT_BOMB_RANGE; n < player.bombRange; n++) drops.push('range');
  for (let n = 0; n < player.speedBonus; n++) drops.push('speed');
  for (const [kind, flag] of Object.entries(ABILITY_FLAG) as Array<[keyof typeof ABILITY_FLAG, (typeof ABILITY_FLAG)[keyof typeof ABILITY_FLAG]]>) {
    if (player[flag]) drops.push(kind);
  }

  // O jogador volta ao zero (inclusive se for voltar das laterais depois).
  player.maxBombs = DEFAULT_MAX_BOMBS;
  player.bombRange = DEFAULT_BOMB_RANGE;
  player.speedBonus = 0;
  player.canKick = false;
  player.piercing = false;
  player.remote = false;
  player.canThrow = false;
  player.ghostTicks = 0;
  player.invertTicks = 0;
  player.vest = false;
  player.heroTicks = 0;
  if (drops.length === 0) return;

  const free = freeItemCells(state);

  const { arena } = state;
  const rng = createRng(state.tick * 7919 + player.id * 104729 + 12345);
  for (const kind of drops) {
    if (free.length === 0) return;
    const pick = Math.floor(rng() * free.length);
    const [index] = free.splice(pick, 1);
    const col = index! % arena.cols;
    const row = Math.floor(index! / arena.cols);
    state.items.push({ col, row, kind });
    state.events.push({ type: 'itemSpawned', col, row, kind });
  }
}

/** Casas onde um item pode cair: livres, sem bomba, sem chama e sem outro item (índices de célula). */
export function freeItemCells(state: GameState): number[] {
  const { arena } = state;
  const taken = new Set<number>();
  for (const bomb of state.bombs) taken.add(cellIndex(arena, bomb.col, bomb.row));
  for (const flame of state.flames) taken.add(cellIndex(arena, flame.col, flame.row));
  for (const item of state.items) taken.add(cellIndex(arena, item.col, item.row));
  const free: number[] = [];
  for (let index = 0; index < arena.cells.length; index++) {
    const col = index % arena.cols;
    const row = Math.floor(index / arena.cols);
    if (getCell(arena, col, row) === 'empty' && !taken.has(index)) free.push(index);
  }
  return free;
}

/**
 * Jogador acertado por uma bomba arremessada: perde UM item permanente (colete, bomba, alcance, velocidade ou uma
 * habilidade; cada tipo que ele tem tem a mesma chance) e o item cai numa casa livre sorteada da arena, para qualquer
 * um pegar. Devolve o tipo perdido (ou null se ele não tinha nada, ou se não há casa livre: então nada se perde).
 * Itens temporários (fantasma, herói, controles invertidos) não contam. O sorteio usa só o passo e o id do jogador.
 */
export function loseRandomPowerup(state: GameState, player: PlayerState): ItemKind | null {
  const owned: ItemKind[] = [];
  if (player.vest) owned.push('vest');
  if (player.maxBombs > DEFAULT_MAX_BOMBS) owned.push('bomb');
  if (player.bombRange > DEFAULT_BOMB_RANGE) owned.push('range');
  if (player.speedBonus > 0) owned.push('speed');
  for (const [kind, flag] of Object.entries(ABILITY_FLAG) as Array<[keyof typeof ABILITY_FLAG, (typeof ABILITY_FLAG)[keyof typeof ABILITY_FLAG]]>) {
    if (player[flag]) owned.push(kind);
  }
  if (owned.length === 0) return null;
  const free = freeItemCells(state);
  if (free.length === 0) return null;

  const rng = createRng(state.tick * 6151 + player.id * 7919 + 4242);
  const kind = owned[Math.floor(rng() * owned.length)]!;
  if (kind === 'vest') player.vest = false;
  else if (kind === 'bomb') player.maxBombs -= 1;
  else if (kind === 'range') player.bombRange -= 1;
  else if (kind === 'speed') player.speedBonus -= 1;
  else player[ABILITY_FLAG[kind as keyof typeof ABILITY_FLAG]] = false;

  const index = free[Math.floor(rng() * free.length)]!;
  const col = index % state.arena.cols;
  const row = Math.floor(index / state.arena.cols);
  state.items.push({ col, row, kind });
  state.events.push({ type: 'itemSpawned', col, row, kind });
  return kind;
}

/** Quem está em cima de um item o pega. Roda uma vez por passo, depois do movimento. */
export function collectItems(state: GameState): void {
  if (state.items.length === 0) return;
  for (const player of state.players) {
    if (!player.alive) continue;
    const col = Math.floor(player.x);
    const row = Math.floor(player.y);
    const at = state.items.findIndex((item) => item.col === col && item.row === row);
    if (at === -1) continue;
    const [item] = state.items.splice(at, 1);
    const changed = applyItem(player, item!.kind);
    state.events.push({ type: 'itemPicked', playerId: player.id, kind: item!.kind, col, row, changed });
  }
}

/** Índice da célula do item (para conjuntos de células). */
export function itemCellIndex(arena: Arena, item: Pick<ItemState, 'col' | 'row'>): number {
  return cellIndex(arena, item.col, item.row);
}
