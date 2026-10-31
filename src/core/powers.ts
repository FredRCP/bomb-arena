import { AIRPLANE_BOMBS, AIRPLANE_DROP_TICKS, AIRPLANE_END_SCALE, AIRPLANE_ENTRY_TICKS, AIRPLANE_FIRST_DROP, AIRPLANE_LAPS, AIRPLANE_LAP_TICKS, CONFUSE_POWER_TICKS, CHOCOLATE_BLOCKS, FOG_POWER_TICKS, GHOST_PUSH_CELLS, GHOST_PUSH_RADIUS, INVISIBLE_POWER_TICKS, JUMP_CELLS, SLIME_CELLS, SLIME_TICKS, SPRINT_POWER_TICKS, TWIN_BOMB_RANGE, ELEPHANT_MAX_BLOCKS, ELEPHANT_SPEED, POWER_CHARGE_TICKS, SHIELD_POWER_TICKS, STORK_FAR_ITEMS, STORK_ITEMS, STORK_RADIUS, FREEZE_POWER_TICKS, GHOST_POWER_TICKS } from '../config/powers';
import { BOMB_FUSE_TICKS } from '../config/bombs';
import { cellIndex, getCell, isTunnel } from './arena';
import { dropBomb } from './bombs';
import { bodyOverlapsCell, collidesAt } from './movement';
import { createRng } from './random';
import { freeItemCells, revealItem } from './items';
import type { Direction, GameState, PlayerState, PowerKind } from './types';

// Superpoderes. Cada jogador pode ter um poder (veja `givePower`) que carrega sozinho em POWER_CHARGE_TICKS e é
// disparado pela intenção `power`. Poder atual:
// - airplane (Lucas): um avião sobrevoa a arena inteira em 4 voltas, largando 6 bombas em células aleatórias.
// - shield (Fred): teletransporta para uma célula livre sorteada e fica invencível 10 s. freeze (Van): congela as bombas dos outros por 10 s. stork (Wal): solta 4 itens bons (3 perto, 1 longe).
//   confuse (Glauceste): todos os outros ficam com os controles invertidos por 10 s. ghost (Filippe): atravessa blocos por 10 s e empurra os inimigos próximos 3 células para longe.
// - pipoca: pula bomba ou bloco; bolt: velocidade máxima 10 s; musgo: gosma em 3 células em cada direção; violeta: invisível 10 s;
//   fagulha: 2 bombas de alcance 8 (imune); nimbo: neblina 10 s; cacau: 3 blocos de chocolate à frente.
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
  if (player.power.kind === 'jump' && !jumpLanding(state, player)) return; // sem lugar para cair: não gasta a carga
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
  updateSlimeAndFog(state);
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
    // Teletransporte: vai para uma célula livre sorteada (sem bomba, chama, jogador ou perigo) e fica invencível.
    const spot = randomFreeCell(state, player, rng);
    if (spot) {
      player.x = spot.col + 0.5;
      player.y = spot.row + 0.5;
      if (player.slide !== undefined) player.slide = null;
    }
    player.shieldTicks = Math.max(player.shieldTicks, SHIELD_POWER_TICKS);
  } else if (kind === 'ghost') {
    player.ghostTicks = Math.max(player.ghostTicks, GHOST_POWER_TICKS);
    pushEnemiesAway(state, player);
  } else if (kind === 'jump') {
    const landing = jumpLanding(state, player);
    if (landing) {
      player.x = landing.col + 0.5;
      player.y = landing.row + 0.5;
    }
  } else if (kind === 'sprint') {
    player.sprintTicks = SPRINT_POWER_TICKS;
  } else if (kind === 'invisible') {
    player.invisibleTicks = INVISIBLE_POWER_TICKS;
  } else if (kind === 'slime') {
    const col0 = Math.floor(player.x);
    const row0 = Math.floor(player.y);
    const slime = (state.slime ??= []);
    const add = (col: number, row: number): void => {
      const kindHere = getCell(arena, col, row);
      if (kindHere !== 'empty' && kindHere !== 'block') return;
      slime.push({ col, row, owner: player.id, ticks: SLIME_TICKS });
    };
    add(col0, row0);
    for (const { dx, dy } of Object.values(VECTORS)) {
      for (let k = 1; k <= SLIME_CELLS; k++) {
        if (getCell(arena, col0 + dx * k, row0 + dy * k) === 'wall') break;
        add(col0 + dx * k, row0 + dy * k);
      }
    }
  } else if (kind === 'twinbombs') {
    const col0 = Math.floor(player.x);
    const row0 = Math.floor(player.y);
    const { dx, dy } = VECTORS[player.facing];
    const spots = [{ col: col0, row: row0 }, { col: col0 - dx, row: row0 - dy }, { col: col0 + dx, row: row0 + dy }];
    let placed = 0;
    for (const spot of spots) {
      if (placed >= 2 || !dropBomb(state, player, spot.col, spot.row)) continue;
      const bomb = state.bombs[state.bombs.length - 1]!;
      bomb.range = TWIN_BOMB_RANGE;
      placed += 1;
    }
    player.heroTicks = Math.max(player.heroTicks, BOMB_FUSE_TICKS + 90); // ela é imune às chamas até as bombas passarem
  } else if (kind === 'fog') {
    state.fog = { ticks: FOG_POWER_TICKS, owner: player.id };
  } else if (kind === 'chocolate') {
    const { dx, dy } = VECTORS[player.facing];
    const choc = (state.chocolate ??= []);
    for (let k = 1; k <= CHOCOLATE_BLOCKS; k++) {
      const col = Math.floor(player.x) + dx * k;
      const row = Math.floor(player.y) + dy * k;
      if (getCell(arena, col, row) !== 'empty') break;
      if (isTunnel(state.hazards?.tunnel, arena, col, row) || state.bombs.some((b) => b.col === col && b.row === row)) break;
      if (state.players.some((p) => p.alive && bodyOverlapsCell(p.x, p.y, col, row))) break;
      arena.cells[cellIndex(arena, col, row)] = 'block';
      state.items = state.items.filter((item) => !(item.col === col && item.row === row));
      choc.push(cellIndex(arena, col, row));
      state.events.push({ type: 'blockGrown', col, row });
    }
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

/** Para onde o pulo da Pipoca leva (2 células à frente), ou null se não houver lugar livre. */
export function jumpLanding(state: GameState, player: PlayerState): { col: number; row: number } | null {
  const arena = state.arena;
  const { dx, dy } = VECTORS[player.facing];
  const col0 = Math.floor(player.x);
  const row0 = Math.floor(player.y);
  const midKind = getCell(arena, col0 + dx, row0 + dy);
  if (midKind === 'wall') return null;
  const col = col0 + dx * JUMP_CELLS;
  const row = row0 + dy * JUMP_CELLS;
  if (getCell(arena, col, row) !== 'empty') return null;
  if (state.bombs.some((b) => b.col === col && b.row === row)) return null;
  if (isTunnel(state.hazards?.tunnel, arena, col, row)) return null;
  if (state.players.some((p) => p.alive && p.id !== player.id && bodyOverlapsCell(p.x, p.y, col, row))) return null;
  return { col, row };
}

/** Célula livre sorteada para o teletransporte: sem bomba, chama, jogador, item ruim ou perigo à vista. */
function randomFreeCell(state: GameState, player: PlayerState, rng: () => number): { col: number; row: number } | null {
  const arena = state.arena;
  const spots: Array<{ col: number; row: number }> = [];
  for (let row = 1; row < arena.rows - 1; row++) {
    for (let col = 1; col < arena.cols - 1; col++) {
      if (getCell(arena, col, row) !== 'empty') continue;
      if (isTunnel(state.hazards?.tunnel, arena, col, row)) continue;
      if (state.bombs.some((b) => b.col === col && b.row === row)) continue;
      if (state.flames.some((f) => f.col === col && f.row === row)) continue;
      if (state.players.some((p) => p.alive && p.id !== player.id && Math.abs(p.x - (col + 0.5)) < 2 && Math.abs(p.y - (row + 0.5)) < 2)) continue;
      const slip = state.hazards?.slippery;
      if (slip && slip.includes(cellIndex(arena, col, row))) continue;
      spots.push({ col, row });
    }
  }
  return spots.length > 0 ? spots[Math.floor(rng() * spots.length)]! : null;
}

/** Filippe: empurra para longe (GHOST_PUSH_CELLS células) todo inimigo a até GHOST_PUSH_RADIUS células, pelo eixo em que ele está mais longe. */
function pushEnemiesAway(state: GameState, player: PlayerState): void {
  for (const other of state.players) {
    if (!other.alive || other.id === player.id || other.team === player.team) continue;
    const ddx = other.x - player.x;
    const ddy = other.y - player.y;
    if (Math.abs(ddx) + Math.abs(ddy) > GHOST_PUSH_RADIUS + 0.5) continue;
    const horizontal = Math.abs(ddx) >= Math.abs(ddy);
    const sx = horizontal ? Math.sign(ddx) || 1 : 0;
    const sy = horizontal ? 0 : Math.sign(ddy) || 1;
    const blocked = new Set(state.bombs.map((b) => cellIndex(state.arena, b.col, b.row)));
    for (let k = 0; k < GHOST_PUSH_CELLS; k++) {
      if (collidesAt(state.arena, other.x + sx, other.y + sy, blocked)) break;
      other.x += sx;
      other.y += sy;
    }
    if (other.slide !== undefined) other.slide = null;
  }
}

/** Gosma (quem pisa, menos o dono, fica lento) e neblina: contam o tempo. */
function updateSlimeAndFog(state: GameState): void {
  if (state.chocolate && state.chocolate.length > 0) state.chocolate = state.chocolate.filter((index) => state.arena.cells[index] === 'block');
  if (state.round.phase !== 'playing') return;
  const slime = state.slime;
  if (slime && slime.length > 0) {
    for (const cell of slime) {
      cell.ticks -= 1;
      for (const p of state.players) {
        if (p.alive && p.id !== cell.owner && Math.floor(p.x) === cell.col && Math.floor(p.y) === cell.row) p.slowTicks = Math.max(p.slowTicks, 3);
      }
    }
    state.slime = slime.filter((cell) => cell.ticks > 0);
  }
  if (state.fog) {
    state.fog.ticks -= 1;
    if (state.fog.ticks <= 0) delete state.fog;
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
      return danger; // teletransporta para fora do perigo
    case 'jump':
      return false;
    case 'sprint':
    case 'invisible':
      return danger;
    case 'ghost':
      return danger || enemies.some((p) => Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 2.5);
    case 'slime':
      return enemies.some((p) => Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 4);
    case 'twinbombs':
      return enemies.some((p) => Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 5);
    case 'fog':
      return enemies.some((p) => Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 8);
    case 'chocolate':
      return danger;
    case 'freeze':
      return state.bombs.some((b) => b.owner !== player.id && !(b.frozenTicks && b.frozenTicks > 0));
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
