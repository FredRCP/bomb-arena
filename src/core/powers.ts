import { AIRPLANE_BOMBS, AIRPLANE_DROP_TICKS, AIRPLANE_ENTRY_TICKS, AIRPLANE_FIRST_DROP, AIRPLANE_LAPS, AIRPLANE_LAP_TICKS, AIRPLANE_RADIUS, ELEPHANT_MAX_BLOCKS, ELEPHANT_SPEED, POWER_CHARGE_TICKS } from '../config/powers';
import { cellIndex, getCell } from './arena';
import { dropBomb } from './bombs';
import { createRng } from './random';
import { revealItem } from './items';
import type { Direction, GameState, PlayerState, PowerKind } from './types';

// Superpoderes. Cada jogador pode ter um poder (veja `givePower`) que carrega sozinho em POWER_CHARGE_TICKS e é
// disparado pela intenção `power`. Poder atual:
// - airplane (Lucas): um avião dá 2 voltas em círculo em volta do jogador, largando 5 bombas em células aleatórias.
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
    // O avião sai da mão do jogador e gira em torno desse ponto (o centro é ajustado para o círculo caber na arena).
    const planes = (state.planes ??= []);
    const cx = Math.min(Math.max(player.x, AIRPLANE_RADIUS + 0.5), Math.max(AIRPLANE_RADIUS + 0.5, state.arena.cols - AIRPLANE_RADIUS - 0.5));
    const cy = Math.min(Math.max(player.y, AIRPLANE_RADIUS + 0.5), Math.max(AIRPLANE_RADIUS + 0.5, state.arena.rows - AIRPLANE_RADIUS - 0.5));
    const start = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[player.facing];
    planes.push({
      id: state.tick * 8 + player.id,
      owner: player.id,
      x: player.x,
      y: player.y,
      dir: 'right',
      cx,
      cy,
      start,
      age: 0,
      dropsLeft: AIRPLANE_BOMBS,
      nextDrop: AIRPLANE_FIRST_DROP,
    });
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

/** Aviões: giram em círculo (espiral para fora, 2 voltas, espiral para dentro) e largam uma bomba de tempos em tempos perto de onde estão. */
function updatePlanes(state: GameState): void {
  const planes = state.planes;
  if (!planes || planes.length === 0) return;
  const total = AIRPLANE_LAPS * AIRPLANE_LAP_TICKS;
  for (const plane of [...planes]) {
    plane.age += 1;
    if (plane.age >= total) {
      planes.splice(planes.indexOf(plane), 1);
      state.events.push({ type: 'planeGone', id: plane.id });
      continue;
    }
    const grow = Math.min(1, plane.age / AIRPLANE_ENTRY_TICKS, (total - plane.age) / AIRPLANE_ENTRY_TICKS);
    const radius = AIRPLANE_RADIUS * grow * grow * (3 - 2 * grow);
    const theta = plane.start + (2 * Math.PI * plane.age) / AIRPLANE_LAP_TICKS;
    plane.x = plane.cx + Math.cos(theta) * radius;
    plane.y = plane.cy + Math.sin(theta) * radius;
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
  if (!powerReady(player)) return false;
  if (player.power?.kind === 'airplane') {
    // Avião: vale a pena com algum inimigo por perto (as bombas caem num círculo em volta do dono).
    return state.players.some((p) => p.alive && p.team !== player.team && Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 6);
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
