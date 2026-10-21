import { parseRanking } from './ranking';
import type { RankingEntry } from './ranking';
import type { StorageLike } from './settingsStorage';

// Guarda o Top 10 no navegador (localStorage). Qualquer falha é ignorada: o jogo só deixa de lembrar o ranking.

const KEY = 'bomb-arena:ranking';

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadRanking(storage: StorageLike | null = defaultStorage()): RankingEntry[] {
  try {
    return parseRanking(storage ? storage.getItem(KEY) : null);
  } catch {
    return [];
  }
}

export function saveRanking(entries: readonly RankingEntry[], storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(entries));
  } catch {
    // sem armazenamento: tudo bem
  }
}
