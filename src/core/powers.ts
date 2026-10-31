import { AIRPLANE_BOMBS, AIRPLANE_DROP_TICKS, AIRPLANE_END_SCALE, AIRPLANE_ENTRY_TICKS, AIRPLANE_FIRST_DROP, AIRPLANE_LAPS, AIRPLANE_LAP_TICKS, CONFUSE_POWER_TICKS, ELEPHANT_MAX_BLOCKS, ELEPHANT_SPEED, POWER_CHARGE_TICKS, SHIELD_POWER_TICKS, STORK_FAR_ITEMS, STORK_ITEMS, STORK_RADIUS, FREEZE_POWER_TICKS, GHOST_POWER_TICKS } from '../config/powers';
import { cellIndex, getCell, isTunnel } from './arena';
import { dropBomb } from './bombs';
import { createRng } from './random';
import { freeItemCells, revealItem } from './items';
import type { Direction, GameState, PlayerState, PowerKind } from './types';

// Superpoderes. Cada jogador pode ter um poder (veja `givePower`) que carrega sozinho em POWER_CHARGE_TICKS e é
// disparado pela intenção `power`. Poder atual:
// - airplane (Lucas): um avião sobrevoa a arena inteira em 4 voltas, largando 6 bombas em células aleatórias.
// - shield (Fred): invencível 10 s. freeze (Van): congela as bombas dos outros por 10 s. stork (Wal): solta 4 itens bons (3 perto, 1 longe).
//   confuse (Glauceste): todos os outros ficam com os controles invertidos por 10 s. ghost (Filippe): atravessa blocos por 10 s.
// - elephant (Ana): um elefantinho sai correndo na direção para onde o jogador olha, em linha reta, e quebra todos os
//   blocos do caminho (os itens escondidos aparecem). Ele não machuca ninguém e para ao bater numa parede.

const VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** Dá o poder ao jogador, com a carga zerada. */
export function givePower(player: PlayerState, kind: PowerKind): void {
  player.power = { kind, charge: 0 };
}

export function powerReady(player: Pick<PlayerState, 'power' | 'alive'>): boolean {
  return player.alive && !!player.power && player.power.charge >= POWER_CHARGE_TICKS;
}

/** Fração carregada (0 a 1). */
export function powerFraction(player: Pick<PlayerState, 'power'>): number {
  return player.power ? Math.min(1, player.power.charge / POWER_CHARGE_TICKS) : 0;
}

/** Usa o poder se estiver pronto (aperto do botão de poder). */
export function usePower(state: GameState, player: PlayerState): void {
  if (!powerReady(player) || !player.power) return;
  player.power.charge = 0;
  const col = Math.floor(player.x);
  const row = Math.floor(player.y);
  const kind = player.power.kind;
  if (kind === 'airplane') {
    // O avião sai da mão do jogador, vai para a pista (uma elipse que cobre a arena toda) e dá 4 voltas fechando para o centro.
    const planes = (state.planes ??= []);
    planes.push({
      id: state.tick * 8 + player.id,
      owner: player.id,
      x: player.x,
      y: player.y,
      dir: 'right',
      cx: state.arena.cols / 2,
      cy: state.arena.rows / 2,
      ox: player.x,
      oy: player.y,
      start: Math.atan2(player.y - state.arena.rows / 2, player.x - state.arena.cols / 2),
      age: 0,
      dropsLeft: AIRPLANE_BOMBS,
      nextDrop: AIRPLANE_FIRST_DROP,
    });
    state.events.push({ type: 'powerUsed', playerId: player.id, kind, col, row, dir: player.facing });
    return;
  }
  if (kind !== 'elephant') {
    usePersonalPower(state, player, kind);
    state.events.push({ type: 'powerUsed', playerId: player.id, kind, col, row, dir: player.facing });
    return;
  }
  const elephants = (state.elephants ??= []);
  const id = state.tick * 8 + player.id; // único por jogador e passo
  elephants.push({ id, owner: player.id, x: col + 0.5, y: row + 0.5, dir: player.facing, broken: 0 });
  state.events.push({ type: 'powerUsed', playerId: player.id, kind: player.power.kind, col, row, dir: player.facing });
}

/**
 * Passo dos poderes: a carga sobe (só com a rodada em disputa) e os elefantes andam, quebrando os blocos que pisam.
 */
export function updatePowers(state: GameState): void {
  if (state.round.phase === 'playing') {
    for (const player of state.players) {
      if (player.alive && player.power && player.power.charge < POWER_CHARGE_TICKS) player.power.charge += 1;
    }
  }
  updatePlanes(state);
  const elephants = state.elephants;
  if (!elephants || elephants.length === 0) return;
  const arena = state.arena;
  for (const elephant of [...elephants]) {
    const { dx, dy } = VECTORS[elephant.dir];
    elephant.x += dx * ELEPHANT_SPEED;
    elephant.y += dy * ELEPHANT_SPEED;
    // A célula à frente do corpo: quando a frente entra num bloco, ele quebra; numa parede, o elefante para.
    const frontCol = Math.floor(elephant.x + dx * 0.45);
    const frontRow = Math.floor(elephant.y + dy * 0.45);
    const cell = getCell(arena, frontCol, frontRow);
    if (cell === 'wall' || cell === 'hole') {
      elephants.splice(elephants.indexOf(elephant), 1);
      state.events.push({ type: 'elephantGone', id: elephant.id, col: Math.floor(elephant.x), row: Math.floor(elephant.y) });
    } else if (cell === 'block') {
      arena.cells[cellIndex(arena, frontCol, frontRow)] = 'empty';
      state.events.push({ type: 'blockDestroyed', col: frontCol, row: frontRow });
      revealItem(state, frontCol, frontRow);
      elephant.broken = (elephant.broken ?? 0) + 1;
      if (elephant.broken >= ELEPHANT_MAX_BLOCKS) {
        elephants.splice(elephants.indexOf(elephant), 1);
        state.events.push({ type: 'elephantGone', id: elephant.id, col: Math.floor(elephant.x), row: Math.floor(elephant.y) });
      }
    }
  }
}

/** Poderes que agem no próprio jogador, nos inimigos ou no chão em volta (tudo instantâneo). */
function usePersonalPower(state: GameState, player: PlayerState, kind: Exclude<PlayerState['power'], undefined>['kind']): void {
  const arena = state.arena;
  const rng = createRng(state.tick * 977 + player.id * 31 + 5);
  if (kind === 'shield') {
    player.shieldTicks = Math.max(player.shieldTicks, SHIELD_POWER_TICKS);
  } else if (kind === 'ghost') {
    player.ghostTicks = Math.max(player.ghostTicks, GHOST_POWER_TICKS);
  } else if (kind === 'confuse') {
    for (const other of state.players) if (other.alive && other.id !== player.id) other.invertTicks = Math.max(other.invertTicks, CONFUSE_POWER_TICKS);
  } else if (kind === 'freeze') {
    // Congela as bombas de todo mundo, menos as dela.
    for (const bomb of state.bombs) if (bomb.owner !== player.id) bomb.frozenTicks = FREEZE_POWER_TICKS;
  } else if (kind === 'stork') {
    const col0 = Math.floor(player.x);
    const row0 = Math.floor(player.y);
    const free = freeItemCells(state).filter((index) => {
      const col = index % arena.cols;
      const row = Math.floor(index / arena.cols);
      return !isTunnel(state.hazards?.tunnel, arena, col, row) && Math.max(Math.abs(col - col0), Math.abs(row - row0)) <= STORK_RADIUS;
    });
    const good = ['bomb', 'range', 'speed', 'vest', 'kick'] as const;
    // Mais um item em qualquer célula livre da arena (sorteado), além dos que caem perto dela.
    const anywhere = freeItemCells(state).filter((index) => !isTunnel(state.hazards?.tunnel, arena, index % arena.cols, Math.floor(index / arena.cols)) && !free.includes(index));
    const picks: number[] = [];
    for (let n = 0; n < STORK_ITEMS && free.length > 0; n++) picks.push(free.splice(Math.floor(rng() * free.length), 1)[0]!);
    for (let n = 0; n < STORK_FAR_ITEMS; n++) {
      const pool = anywhere.length > 0 ? anywhere : free;
      if (pool.length > 0) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
    }
    for (const index of picks) {
      const col = index % arena.cols;
      const row = Math.floor(index / arena.cols);
      const itemKind = good[Math.floor(rng() * good.length)]!;
      state.items.push({ col, row, kind: itemKind });
      state.events.push({ type: 'itemSpawned', col, row, kind: itemKind });
    }
  }
}

/** Aviões: sobrevoam a arena em 4 voltas (elipse que vai fechando) e largam uma bomba de tempos em tempos perto de onde estão. */
function updatePlanes(state: GameState): void {
  const planes = state.planes;
  if (!planes || planes.length === 0) return;
  const total = AIRPLANE_LAPS * AIRPLANE_LAP_TICKS;
  const rx = (state.arena.cols - 3) / 2;
  const ry = (state.arena.rows - 3) / 2;
  for (const plane of [...planes]) {
    plane.age += 1;
    if (plane.age >= total) {
      planes.splice(planes.indexOf(plane), 1);
      state.events.push({ type: 'planeGone', id: plane.id });
      continue;
    }
    const theta = plane.start + (2 * Math.PI * plane.age) / AIRPLANE_LAP_TICKS;
    const scale = 1 - (1 - AIRPLANE_END_SCALE) * (plane.age / total);
    const trackX = plane.cx + Math.cos(theta) * rx * scale;
    const trackY = plane.cy + Math.sin(theta) * ry * scale;
    // No começo sai da mão do dono e no fim volta para ela.
    const grow = Math.min(1, plane.age / AIRPLANE_ENTRY_TICKS, (total - plane.age) / AIRPLANE_ENTRY_TICKS);
    const mix = grow * grow * (3 - 2 * grow);
    plane.x = plane.ox + (trackX - plane.ox) * mix;
    plane.y = plane.oy + (trackY - plane.oy) * mix;
    plane.dir = Math.sin(theta) < 0 ? 'right' : 'left';
    plane.nextDrop -= 1;
    if (plane.nextDrop > 0 || plane.dropsLeft <= 0) continue;
    const owner = state.players.find((p) => p.id === plane.owner);
    if (!owner) continue;
    const rng = createRng(state.tick * 131 + plane.id);
    let dropped = false;
    for (let attempt = 0; attempt < 10 && !dropped; attempt++) {
      const col = Math.floor(plane.x) + Math.floor(rng() * 3) - 1;
      const row = Math.floor(plane.y) + Math.floor(rng() * 3) - 1;
      if (Math.abs(col - Math.floor(owner.x)) + Math.abs(row - Math.floor(owner.y)) <= 1) continue; // nada colado no dono
      dropped = dropBomb(state, owner, col, row);
    }
    if (dropped) {
      plane.dropsLeft -= 1;
      plane.nextDrop = AIRPLANE_DROP_TICKS;
    } else {
      plane.nextDrop = 6; // sem lugar agora: tenta de novo daqui a pouco
    }
  }
}

/**
 * Para o computador: vale a pena soltar o poder? Sim se, na linha à frente dele (até 8 células, sem parede no meio),
 * há pelo menos 2 blocos.
 */
export function aiShouldUsePower(state: GameState, player: PlayerState): boolean {
  if (!powerReady(player) || !player.power) return false;
  const col = Math.floor(player.x);
  const row = Math.floor(player.y);
  const enemies = state.players.filter((p) => p.alive && p.team !== player.team);
  // Perigo por perto: bomba prestes a explodir a até 3 células, ou chama a até 2.
  const danger =
    state.bombs.some((b) => Math.abs(b.col - col) + Math.abs(b.row - row) <= 3 && b.ticksLeft < 90) ||
    state.flames.some((f) => Math.abs(f.col - col) + Math.abs(f.row - row) <= 2);
  switch (player.power.kind) {
    case 'airplane':
      return enemies.length > 0; // as bombas caem pela arena toda
    case 'confuse':
      return enemies.some((p) => Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 7);
    case 'stork':
      return !danger;
    case 'shield':
    case 'freeze':
      return state.bombs.some((b) => b.owner !== player.id && !(b.frozenTicks && b.frozenTicks > 0));
    case 'ghost':
      return danger;
    default:
      break;
  }
  const { dx, dy } = VECTORS[player.facing];
  let c = col;
  let r = row;
  let blocks = 0;
  for (let i = 0; i < 8; i++) {
    c += dx;
    r += dy;
    const cell = getCell(state.arena, c, r);
    if (cell === 'wall') break;
    if (cell === 'block') blocks += 1;
  }
  return blocks >= 2;
}
