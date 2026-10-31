import { FLAME_TICKS } from '../config/bombs';
import { VEST_BREAK_SHIELD_TICKS } from '../config/items';
import { cellIndex, getCell } from './arena';
import { dropPowerups, revealItem } from './items';
import { revive } from './sideline';
import type { Arena, BombState, Direction, GameState, PlayerId } from './types';

// Explosões: contagem das bombas, propagação em cruz, reação em cadeia, chamas e dano.
//
// Regras (todas testadas em tests/core/explosions.test.ts):
// - A explosão sai da bomba para as 4 direções, até o alcance. Parede para a chama (sem entrar nela).
//   Itens no chão nas casas atingidas são destruídos (os que os blocos revelam agora, não).
//   Bloco entra em chamas, é destruído e para a chama (a perfurante atravessa todos os blocos do alcance). Outra bomba também para a chama e explode junto.
// - Reação em cadeia: bombas atingidas explodem NO MESMO PASSO, qualquer que seja a distância entre elas.
// - Explosões simultâneas: todas são calculadas com a arena como ela estava ANTES do passo. Os blocos
//   destruídos só somem no fim. Assim o resultado não depende da ordem das bombas na lista.
// - Chama acesa dura FLAME_TICKS passos e machuca quem estiver nela (pelo centro do corpo), inclusive
//   quem ENTRAR nela depois. Uma nova explosão sobre uma chama acesa renova o tempo dela.

const DIRECTIONS: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

/** O que uma explosão atinge, antes de qualquer efeito: só cálculo. */
export interface Blast {
  /** Células em chamas (índices de arena.cells), incluindo a da própria bomba. */
  cells: number[];
  /** Blocos que seriam destruídos (índices de arena.cells). */
  blocks: number[];
  /** Outras bombas atingidas (explodem junto). */
  bombsHit: BombState[];
}

/**
 * Calcula a cruz de uma bomba. Não altera o estado. É a ÚNICA definição de "o que uma explosão atinge":
 * o jogo e a IA usam esta mesma função, então nunca discordam das regras.
 * `bombByCell` diz onde há bombas (índice da célula -> bomba) para a chama parar nelas.
 */
export function blastOf(
  arena: Arena,
  bomb: Pick<BombState, 'col' | 'row' | 'range'> & { pierce?: boolean },
  bombByCell: ReadonlyMap<number, BombState>,
): Blast {
  const cells = [cellIndex(arena, bomb.col, bomb.row)];
  const blocks: number[] = [];
  const bombsHit: BombState[] = [];

  for (const { dc, dr } of Object.values(DIRECTIONS)) {
    for (let distance = 1; distance <= bomb.range; distance++) {
      const col = bomb.col + dc * distance;
      const row = bomb.row + dr * distance;
      const cell = getCell(arena, col, row);
      if (cell === 'wall') break;

      const index = cellIndex(arena, col, row);
      cells.push(index);

      if (cell === 'block') {
        blocks.push(index);
        if (bomb.pierce) continue; // explosão perfurante: destrói o bloco e segue em frente
        break;
      }
      const other = bombByCell.get(index);
      if (other) {
        bombsHit.push(other);
        break;
      }
    }
  }
  return { cells, blocks, bombsHit };
}

interface Detonation {
  exploded: BombState[];
  /** Células em chamas (índices de arena.cells), em ordem crescente. */
  flameCells: number[];
  /** Blocos destruídos (índices de arena.cells), em ordem crescente. */
  destroyedBlocks: number[];
  /** Donos das bombas que atingem cada célula em chamas (índice da célula -> ids). */
  flameOwners: Map<number, PlayerId[]>;
}

/** Calcula tudo que acontece quando `due` explode, incluindo a cadeia. Não altera o estado. */
function computeDetonation(state: GameState, due: BombState[]): Detonation {
  const { arena } = state;
  const bombByCell = new Map<number, BombState>();
  for (const bomb of state.bombs) bombByCell.set(cellIndex(arena, bomb.col, bomb.row), bomb);

  const exploded = new Set<BombState>(due);
  const queue = [...due];
  const flames = new Set<number>();
  const destroyed = new Set<number>();
  const flameOwners = new Map<number, PlayerId[]>();

  // A fila cresce enquanto novas bombas são atingidas: ao terminar, temos a cadeia completa.
  for (let i = 0; i < queue.length; i++) {
    const blast = blastOf(arena, queue[i]!, bombByCell);
    for (const index of blast.cells) {
      flames.add(index);
      const owners = flameOwners.get(index) ?? [];
      if (!owners.includes(queue[i]!.owner)) owners.push(queue[i]!.owner);
      flameOwners.set(index, owners);
    }
    for (const index of blast.blocks) destroyed.add(index);
    for (const other of blast.bombsHit) {
      if (!exploded.has(other)) {
        exploded.add(other);
        queue.push(other);
      }
    }
  }

  return {
    exploded: queue,
    flameCells: [...flames].sort((a, b) => a - b),
    destroyedBlocks: [...destroyed].sort((a, b) => a - b),
    flameOwners,
  };
}

/** Avança chamas e bombas um passo e resolve as explosões que vencem agora. */
export function advanceExplosions(state: GameState): void {
  // Chamas envelhecem primeiro: as criadas neste passo ficam com o tempo cheio.
  for (const flame of state.flames) flame.ticksLeft -= 1;
  state.flames = state.flames.filter((flame) => flame.ticksLeft > 0);

  for (const bomb of state.bombs) {
    if (bomb.frozenTicks && bomb.frozenTicks > 0) bomb.frozenTicks -= 1; // congelada: o pavio fica parado
    else bomb.ticksLeft -= 1;
  }
  const due = state.bombs.filter((bomb) => bomb.ticksLeft <= 0);
  if (due.length === 0) return;

  const { arena } = state;
  const result = computeDetonation(state, due);

  const explodedSet = new Set(result.exploded);
  state.bombs = state.bombs.filter((bomb) => !explodedSet.has(bomb));
  for (const bomb of result.exploded) {
    state.events.push({ type: 'bombExploded', col: bomb.col, row: bomb.row, owner: bomb.owner });
  }

  // Itens que estavam no chão nas casas atingidas são destruídos. Isto vem ANTES de revelar os itens dos blocos
  // que explodiram agora: esses surgem inteiros (só uma explosão futura os destrói).
  const burning = new Set(result.flameCells);
  state.items = state.items.filter((item) => {
    if (!burning.has(cellIndex(arena, item.col, item.row))) return true;
    state.events.push({ type: 'itemDestroyed', col: item.col, row: item.row, kind: item.kind });
    return false;
  });

  for (const index of result.destroyedBlocks) {
    arena.cells[index] = 'empty';
    const col = index % arena.cols;
    const row = Math.floor(index / arena.cols);
    state.events.push({ type: 'blockDestroyed', col, row });
    revealItem(state, col, row);
  }

  for (const index of result.flameCells) {
    const col = index % arena.cols;
    const row = Math.floor(index / arena.cols);
    const existing = state.flames.find((flame) => flame.col === col && flame.row === row);
    const owners = result.flameOwners.get(index) ?? [];
    if (existing) {
      existing.ticksLeft = FLAME_TICKS;
      existing.owners ??= [];
      for (const owner of owners) if (!existing.owners.includes(owner)) existing.owners.push(owner);
    } else state.flames.push({ col, row, ticksLeft: FLAME_TICKS, owners: [...owners] });
  }
}

/**
 * Quem está numa célula em chamas morre (a não ser com colete, que se desfaz, ou como super-herói). Roda todo passo,
 * então quem entra na chama também é atingido. O evento `playerHit` diz quem eliminou: os donos das bombas cujas chamas
 * pegaram o jogador (menos ele mesmo). Só quem elimina um INIMIGO (outro time) volta das laterais.
 */
export function applyFlameDamage(state: GameState): void {
  const killers = new Set<PlayerId>();
  for (const player of state.players) {
    if (!player.alive || player.shieldTicks > 0 || player.heroTicks > 0) continue;
    const col = Math.floor(player.x);
    const row = Math.floor(player.y);
    const flame = state.flames.find((f) => f.col === col && f.row === row);
    if (flame && player.vest) {
      // O colete aguenta esta explosão e se desfaz; a proteção curta cobre a chama que ainda está acesa.
      player.vest = false;
      player.shieldTicks = VEST_BREAK_SHIELD_TICKS;
      state.events.push({ type: 'vestBroken', playerId: player.id });
    } else if (flame) {
      player.alive = false;
      const owners = [...new Set(flame.owners ?? [])].filter((owner) => owner !== player.id);
      state.events.push({ type: 'playerHit', playerId: player.id, killers: owners });
      dropPowerups(state, player);
      for (const owner of owners) {
        const killer = state.players.find((p) => p.id === owner);
        if (killer && killer.team !== player.team) killers.add(owner);
      }
    }
  }

  // Quem estava nas laterais e eliminou alguém volta para a arena (só enquanto a rodada está em disputa).
  if (state.round.phase !== 'playing') return;
  for (const player of state.players) {
    if (!player.alive && player.sideline !== null && killers.has(player.id)) revive(state, player);
  }
}
