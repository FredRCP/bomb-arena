import { cellIndex } from './arena';
import { advanceFlights, advanceSlidingBombs, blockedCellsFor, placeBomb, releaseBombs, tryKick, useSpecial, walkThroughCellsFor } from './bombs';
import { advanceExplosions, applyFlameDamage } from './explosions';
import { speedFactorAt, updateHazards } from './hazards';
import { updatePowers, usePower } from './powers';
import { collectItems } from './items';
import { collidesAt, movePlayer, stepDistanceOf } from './movement';
import { MIN_SPEED_BONUS, SPEED_ITEMS_CAP } from '../config/items';
import { updateRound } from './round';
import { sidelineAct, updateSidelines } from './sideline';
import type { GameState, Intents, PlayerState } from './types';

/**
 * Avança a partida em UM passo de simulação (altera o estado recebido).
 * Quem chama decide quantos passos rodar por quadro (veja clock.ts); aqui não existe tempo real,
 * só a contagem de passos. É isso que mantém as regras iguais em qualquer computador.
 *
 * Ordem dentro do passo (importa para os casos simultâneos):
 * 1) bombas pedidas são colocadas (jogador 1 antes do 2: se os dois pedirem na mesma célula, vale o 1)
 *    e as habilidades especiais (arremessar, detonar bomba-relógio) são usadas;
 * 2) jogadores vivos andam, sem atravessar bombas (exceto a que ainda pisam); quem tem o chute empurra a bomba
 *    em que encosta, e as bombas chutadas deslizam;
 * 3) quem parou em cima de um item o pega (menor id primeiro);
 * 3b) quem já saiu de cima de uma bomba deixa de poder atravessá-la;
 * 3c) o fantasma (atravessar blocos) gasta um passo do tempo, mas só termina com o corpo fora de qualquer bloco;
 * 4) chamas e pavios andam um passo e as bombas vencidas explodem (com a cadeia);
 * 5) quem está numa chama é atingido;
 * 6) a rodada confere se já tem resultado (veja round.ts);
 * 7) quem foi eliminado e a rodada segue em disputa passa a jogar das laterais (veja sideline.ts).
 * Os jogadores das laterais andam no anel e jogam bombas no passo 1; quem eliminar alguém volta à arena no passo 5.
 */
export function step(state: GameState, intents: Intents = {}): void {
  // Rodada acabada: o estado fica congelado como está (o resultado já vale). Reiniciar = criar outro estado.
  if (state.round.phase === 'over') return;

  for (const player of state.players) {
    const frozen = (player.frozenTicks ?? 0) > 0;
    if (player.alive && !frozen && intents[player.id]?.placeBomb) placeBomb(state, player);
    if (player.alive && !frozen && intents[player.id]?.special) useSpecial(state, player);
    if (player.alive && !frozen && intents[player.id]?.power) usePower(state, player);
    if (!player.alive) sidelineAct(state, player, intents[player.id]);
  }

  for (const player of state.players) {
    let move = (player.frozenTicks ?? 0) > 0 ? null : intents[player.id]?.move ?? null;
    if (move === null && player.slide && (player.frozenTicks ?? 0) > 0) player.slide = null;
    // Controles invertidos (item ruim): esquerda vira direita, cima vira baixo.
    if (move !== null && player.invertTicks > 0) move = OPPOSITE[move];
    // Faixas de gelo: andando em cima de uma, o jogador desliza na direção em que começou até bater em algo (parede,
    // bloco, bomba, buraco) ou sair da faixa. Fora das faixas o piso é normal.
    const strips = state.hazards?.slippery;
    if (!player.alive) player.slide = null;
    if (player.alive && strips) {
      if (!strips.includes(cellIndex(state.arena, Math.floor(player.x), Math.floor(player.y)))) player.slide = null;
      else if (player.slide) move = player.slide;
      else if (move !== null) player.slide = move;
    }
    if (player.alive && move !== null) {
      player.facing = move;
      const beforeX = player.x;
      const beforeY = player.y;
      movePlayer(state.arena, player, move, blockedCellsFor(state, player.id), walkThroughCellsFor(state, player.id), speedFactorAt(state, player) * slowFactor(player));
      tryKick(state, player, move);
      if (strips && player.x === beforeX && player.y === beforeY) player.slide = null;
    }
  }

  advanceSlidingBombs(state);
  advanceFlights(state);
  collectItems(state);
  releaseBombs(state);
  tickGhost(state);
  tickEffects(state);
  advanceExplosions(state);
  applyFlameDamage(state);
  updateHazards(state);
  updatePowers(state);
  updateRound(state);
  updateSidelines(state);
  state.tick += 1;
}

/** Lentidão (flecha): enquanto durar, a velocidade cai para a mínima do jogo. */
function slowFactor(player: PlayerState): number {
  // Turbo do Bolt: velocidade máxima do jogo (vale mais que a lentidão).
  if ((player.sprintTicks ?? 0) > 0) return Math.max(1, stepDistanceOf({ speedBonus: SPEED_ITEMS_CAP, speedScale: player.speedScale }) / stepDistanceOf(player));
  if (player.slowTicks <= 0) return 1;
  const slowest = stepDistanceOf({ speedBonus: MIN_SPEED_BONUS, speedScale: player.speedScale });
  return Math.min(1, slowest / stepDistanceOf(player));
}

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;

/** Efeitos temporários simples: controles invertidos e proteção de quem voltou à arena. */
function tickEffects(state: GameState): void {
  for (const player of state.players) {
    if (player.invertTicks > 0) player.invertTicks -= 1;
    if (player.slowTicks > 0) player.slowTicks -= 1;
    if ((player.sprintTicks ?? 0) > 0) player.sprintTicks! -= 1;
    if ((player.invisibleTicks ?? 0) > 0) player.invisibleTicks! -= 1;
    if ((player.frozenTicks ?? 0) > 0) player.frozenTicks! -= 1;
    if (player.shieldTicks > 0) player.shieldTicks -= 1;
    if (player.heroTicks > 0) player.heroTicks -= 1;
  }
}

/** Fantasma: conta o tempo; ao acabar com o corpo dentro de um bloco, segue valendo até sair (senão ficaria preso). */
function tickGhost(state: GameState): void {
  for (const player of state.players) {
    if (!player.alive || player.ghostTicks <= 0) continue;
    player.ghostTicks -= 1;
    if (player.ghostTicks === 0 && collidesAt(state.arena, player.x, player.y)) player.ghostTicks = 1;
  }
}
