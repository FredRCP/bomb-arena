import { advanceSlidingBombs, blockedCellsFor, placeBomb, releaseBombs, tryKick, useSpecial, walkThroughCellsFor } from './bombs';
import { advanceExplosions, applyFlameDamage } from './explosions';
import { speedFactorAt, updateHazards } from './hazards';
import { collectItems } from './items';
import { collidesAt, movePlayer } from './movement';
import { updateRound } from './round';
import { sidelineAct, updateSidelines } from './sideline';
import type { GameState, Intents } from './types';

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
    if (player.alive && intents[player.id]?.placeBomb) placeBomb(state, player);
    if (player.alive && intents[player.id]?.special) useSpecial(state, player);
    if (!player.alive) sidelineAct(state, player, intents[player.id]);
  }

  for (const player of state.players) {
    let move = intents[player.id]?.move ?? null;
    // Controles invertidos (item ruim): esquerda vira direita, cima vira baixo.
    if (move !== null && player.invertTicks > 0) move = OPPOSITE[move];
    if (player.alive && move !== null) {
      player.facing = move;
      movePlayer(state.arena, player, move, blockedCellsFor(state, player.id), walkThroughCellsFor(state, player.id), speedFactorAt(state, player));
      tryKick(state, player, move);
    }
  }

  advanceSlidingBombs(state);
  collectItems(state);
  releaseBombs(state);
  tickGhost(state);
  tickEffects(state);
  advanceExplosions(state);
  applyFlameDamage(state);
  updateHazards(state);
  updateRound(state);
  updateSidelines(state);
  state.tick += 1;
}

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;

/** Efeitos temporários simples: controles invertidos e proteção de quem voltou à arena. */
function tickEffects(state: GameState): void {
  for (const player of state.players) {
    if (player.invertTicks > 0) player.invertTicks -= 1;
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
