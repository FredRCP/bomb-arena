import { parseSettings } from './menuModel';
import type { MenuSettings } from './menuModel';

// Guarda as escolhas do menu no navegador (localStorage). Qualquer falha — navegador sem armazenamento, aba
// anônima, cota cheia — é ignorada: o jogo só deixa de lembrar as escolhas.

const KEY = 'bomb-arena:settings';

/** O mínimo que precisamos do localStorage (e que um objeto de teste consegue imitar). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(storage: StorageLike | null = defaultStorage()): MenuSettings {
  try {
    return parseSettings(storage ? storage.getItem(KEY) : null);
  } catch {
    return parseSettings(null);
  }
}

export function saveSettings(settings: MenuSettings, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // sem armazenamento: tudo bem
  }
}
