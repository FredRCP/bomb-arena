import { CHARACTERS } from './characters';
import type { CharacterChoices } from './characters';
import type { Rng } from '../core/random';

// Lógica da tela de escolha de personagem (sem Phaser, com teste). Cada pessoa tem um cursor sobre a grade
// de personagens e confirma o seu. Duas pessoas não podem ficar com o mesmo personagem.

// 7 colunas: com 14 personagens a grade fica em duas fileiras de 7 e cabe na tela (1600 x 900).
export const PICKER_COLUMNS = 7;

export interface PickerState {
  /** Posição do cursor de cada pessoa (índice em CHARACTERS). */
  cursor: number[];
  /** Quem já confirmou. */
  confirmed: boolean[];
}

export function createPicker(humans: number): PickerState {
  return {
    cursor: Array.from({ length: humans }, (_, index) => index % CHARACTERS.length),
    confirmed: Array.from({ length: humans }, () => false),
  };
}

/** Move o cursor: esquerda/direita dão a volta na lista; cima/baixo andam uma linha (e ficam parados na borda). Quem já confirmou não anda. */
export function moveCursor(state: PickerState, who: number, dx: -1 | 0 | 1, dy: -1 | 0 | 1): void {
  if (state.confirmed[who]) return;
  const count = CHARACTERS.length;
  let next = state.cursor[who]!;
  if (dx !== 0) next = (next + dx + count) % count;
  if (dy !== 0) {
    const target = next + dy * PICKER_COLUMNS;
    if (target >= 0 && target < count) next = target;
  }
  state.cursor[who] = next;
}

/** Confirma a escolha. Recusa (devolve false) se outra pessoa já confirmou esse mesmo personagem. */
export function confirmPick(state: PickerState, who: number): boolean {
  if (state.confirmed[who]) return true;
  const mine = state.cursor[who]!;
  if (state.confirmed.some((done, other) => other !== who && done && state.cursor[other] === mine)) return false;
  state.confirmed[who] = true;
  return true;
}

/** Desfaz a confirmação. Devolve false se não havia o que desfazer (aí o "voltar" sai da tela). */
export function cancelPick(state: PickerState, who: number): boolean {
  if (!state.confirmed[who]) return false;
  state.confirmed[who] = false;
  return true;
}

export function allConfirmed(state: PickerState): boolean {
  return state.confirmed.every(Boolean);
}

/**
 * Monta a escolha final: as pessoas ficam com os personagens confirmados (jogadores 1..N) e cada inimigo do
 * computador recebe um personagem sorteado que ninguém está usando. `rng` vem de fora (a cena sorteia).
 */
export function finalizeChoices(state: PickerState, enemies: number, rng: Rng): CharacterChoices {
  const choices: CharacterChoices = {};
  const used = new Set<number>();
  state.cursor.forEach((index, who) => {
    choices[who + 1] = CHARACTERS[index]!.id;
    used.add(index);
  });
  const free = CHARACTERS.map((_, index) => index).filter((index) => !used.has(index));
  for (let e = 0; e < enemies; e++) {
    const pick = free.splice(Math.floor(rng() * free.length), 1)[0] ?? 0;
    choices[state.cursor.length + 1 + e] = CHARACTERS[pick]!.id;
  }
  return choices;
}
