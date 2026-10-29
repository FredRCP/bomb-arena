import { AIRPLANE_DROP_TICKS, AIRPLANE_SPEED, AIRPLANE_SPREAD, ELEPHANT_MAX_BLOCKS, ELEPHANT_SPEED, POWER_CHARGE_TICKS } from '../config/powers';
import { cellIndex, getCell } from './arena';
import { dropBomb } from './bombs';
import { createRng } from './random';
import { revealItem } from './items';
import type { Direction, GameState, PlayerState, PowerKind } from './types';

// Superpoderes. Cada jogador pode ter um poder (veja `givePower`) que carrega sozinho em POWER_CHARGE_TICKS e é
// disparado pela intenção `power`. Poder atual:
// - airplane (Lucas): um avião cruza a arena na linha do jogador largando bombas em células aleatórias perto dela.
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
  if (player.power.kind === 'airplane') {
    // O avião entra pela borda de trás e cruza a arena na linha (ou coluna) do jogador, na direção em que ele olha.
    const { dx, dy } = VECTORS[player.facing];
    const planes = (state.planes ??= []);
    const x = dx === 0 ? col + 0.5 : dx > 0 ? -1.5 : state.arena.cols + 1.5;
    const y = dy === 0 ? row + 0.5 : dy > 0 ? -1.5 : state.arena.rows + 1.5;
    planes.push({ id: state.tick * 8 + player.id, owner: player.id, x, y, dir: player.facing, nextDrop: 1 });
    state.events.push({ type: 'powerUsed', playerId: player.id, kind: 'airplane', col, row, dir: player.facing });
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

/** Aviões: voam e, de tempos em tempos, largam uma bomba numa célula livre aleatória perto da linha de voo. */
function updatePlanes(state: GameState): void {
  const planes = state.planes;
  if (!planes || planes.length === 0) return;
  const arena = state.arena;
  for (const plane of [...planes]) {
    const { dx, dy } = VECTORS[plane.dir];
    plane.x += dx * AIRPLANE_SPEED;
    plane.y += dy * AIRPLANE_SPEED;
    const along = dx !== 0 ? plane.x : plane.y;
    const length = dx !== 0 ? arena.cols : arena.rows;
    if (along < -2 || along > length + 2) {
      planes.splice(planes.indexOf(plane), 1);
      state.events.push({ type: 'planeGone', id: plane.id });
      continue;
    }
    plane.nextDrop -= 1;
    if (plane.nextDrop > 0 || along < 0.5 || along > length - 0.5) continue;
    plane.nextDrop = AIRPLANE_DROP_TICKS;
    const owner = state.players.find((p) => p.id === plane.owner);
    if (!owner) continue;
    const rng = createRng(state.tick * 131 + plane.id);
    for (let attempt = 0; attempt < 8; attempt++) {
      const offset = Math.floor(rng() * (2 * AIRPLANE_SPREAD + 1)) - AIRPLANE_SPREAD;
      const col = dx !== 0 ? Math.floor(plane.x) + (rng() < 0.5 ? 0 : 1) : Math.floor(plane.x) + offset;
      const row = dx !== 0 ? Math.floor(plane.y) + offset : Math.floor(plane.y) + (rng() < 0.5 ? 0 : 1);
      if (Math.abs(col - Math.floor(owner.x)) + Math.abs(row - Math.floor(owner.y)) <= 1) continue; // nada colado no dono
      if (dropBomb(state, owner, col, row)) break;
    }
  }
}

/**
 * Para o computador: vale a pena soltar o poder? Sim se, na linha à frente dele (até 8 células, sem parede no meio),
 * há pelo menos 2 blocos.
 */
export function aiShouldUsePower(state: GameState, player: PlayerState): boolean {
  if (!powerReady(player)) return false;
  if (player.power?.kind === 'airplane') {
    // Avião: vale a pena com algum inimigo por perto (as bombas caem perto da linha de voo).
    return state.players.some((p) => p.alive && p.team !== player.team && Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 7);
  }
  const { dx, dy } = VECTORS[player.facing];
  let col = Math.floor(player.x);
  let row = Math.floor(player.y);
  let blocks = 0;
  for (let i = 0; i < 8; i++) {
    col += dx;
    row += dy;
    const cell = getCell(state.arena, col, row);
    if (cell === 'wall') break;
    if (cell === 'block') blocks += 1;
  }
  return blocks >= 2;
}
