import { ELEPHANT_SPEED, POWER_CHARGE_TICKS } from '../config/powers';
import { cellIndex, getCell } from './arena';
import { revealItem } from './items';
import type { Direction, GameState, PlayerState, PowerKind } from './types';

// Superpoderes. Cada jogador pode ter um poder (veja `givePower`) que carrega sozinho em POWER_CHARGE_TICKS e é
// disparado pela intenção `power`. Poder atual:
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
  const elephants = (state.elephants ??= []);
  const id = state.tick * 8 + player.id; // único por jogador e passo
  elephants.push({ id, owner: player.id, x: col + 0.5, y: row + 0.5, dir: player.facing });
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
    if (cell === 'wall') {
      elephants.splice(elephants.indexOf(elephant), 1);
      state.events.push({ type: 'elephantGone', id: elephant.id, col: Math.floor(elephant.x), row: Math.floor(elephant.y) });
    } else if (cell === 'block') {
      arena.cells[cellIndex(arena, frontCol, frontRow)] = 'empty';
      state.events.push({ type: 'blockDestroyed', col: frontCol, row: frontRow });
      revealItem(state, frontCol, frontRow);
    }
  }
}

/**
 * Para o computador: vale a pena soltar o poder? Sim se, na linha à frente dele (até 8 células, sem parede no meio),
 * há pelo menos 2 blocos.
 */
export function aiShouldUsePower(state: GameState, player: PlayerState): boolean {
  if (!powerReady(player)) return false;
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
