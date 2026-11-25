import { SHOCK_FADE_TICKS, SHOCK_GROW_TICKS, SHOCK_RADIUS, SHOCK_TICKS } from '../config/powers';
import type { GameState, PlayerState } from './types';

// Poder do Bolt: um círculo de choque nasce nele e cresce até SHOCK_RADIUS células. Quem o círculo alcança (sem escudo/herói)
// leva um choque e fica imobilizado SHOCK_TICKS (estrelinhas, não gelo). Cada jogador só leva uma vez por círculo.

/** Raio atual (em células) do círculo, dado o tempo de vida dele. */
export function shockRadius(ticks: number): number {
  return SHOCK_RADIUS * Math.min(1, ticks / SHOCK_GROW_TICKS);
}

export function spawnShockwave(state: GameState, owner: PlayerState): void {
  (state.shockwaves ??= []).push({ owner: owner.id, ticks: 0, hit: [] });
}

export function updateShockwaves(state: GameState): void {
  const waves = state.shockwaves;
  if (!waves || waves.length === 0) return;
  for (const wave of [...waves]) {
    const owner = state.players.find((p) => p.id === wave.owner);
    wave.ticks += 1;
    if (!owner || !owner.alive || wave.ticks > SHOCK_GROW_TICKS + SHOCK_FADE_TICKS) {
      waves.splice(waves.indexOf(wave), 1);
      continue;
    }
    const radius = shockRadius(wave.ticks);
    for (const o of state.players) {
      if (o.id === owner.id || !o.alive || o.sideline !== null || wave.hit.includes(o.id)) continue;
      if (Math.hypot(o.x - owner.x, o.y - owner.y) > radius) continue;
      wave.hit.push(o.id);
      if (o.shieldTicks > 0 || o.heroTicks > 0) continue;
      o.frozenTicks = Math.max(o.frozenTicks ?? 0, SHOCK_TICKS);
      o.stunned = true;
      o.slide = null;
      state.events.push({ type: 'shocked', playerId: o.id, by: owner.id });
    }
  }
}
