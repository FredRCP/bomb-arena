import { RANKING_SIZE } from '../config/score';

// Ranking (Top 10) das melhores pontuações de partidas. Funções puras: quem guarda no navegador é rankingStorage.ts.
// Só pessoas entram (a pontuação do computador não vale recorde).

export interface RankingEntry {
  /** Nome do personagem de quem jogou. */
  name: string;
  points: number;
  kills: number;
  /** Nível da IA da partida (chave de AI_SETTINGS), ou null se não havia computador. */
  difficulty: string | null;
  /** Data da partida, "AAAA-MM-DD". */
  date: string;
}

/** Põe a pontuação na lista, ordena (mais pontos primeiro; empate: a mais antiga fica na frente) e corta no Top 10. */
export function addToRanking(entries: readonly RankingEntry[], entry: RankingEntry, size = RANKING_SIZE): RankingEntry[] {
  return [...entries, entry].sort((a, b) => b.points - a.points || a.date.localeCompare(b.date)).slice(0, size);
}

/** Posição (1 = primeiro) que a pontuação teria no ranking atual, ou null se não entra no Top 10. */
export function rankingPosition(entries: readonly RankingEntry[], entry: RankingEntry, size = RANKING_SIZE): number | null {
  const next = addToRanking(entries, entry, size);
  const at = next.indexOf(entry);
  return at === -1 ? null : at + 1;
}

function isEntry(value: unknown): value is RankingEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    typeof v.points === 'number' &&
    Number.isFinite(v.points) &&
    typeof v.kills === 'number' &&
    (typeof v.difficulty === 'string' || v.difficulty === null) &&
    typeof v.date === 'string'
  );
}

/** Lê o texto guardado. Qualquer coisa estranha vira lista vazia (ou só as entradas válidas), nunca quebra o jogo. */
export function parseRanking(raw: string | null, size = RANKING_SIZE): RankingEntry[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter(isEntry)
    .map((e) => ({ name: e.name.slice(0, 24), points: Math.round(e.points), kills: Math.max(0, Math.round(e.kills)), difficulty: e.difficulty, date: e.date.slice(0, 10) }))
    .sort((a, b) => b.points - a.points || a.date.localeCompare(b.date))
    .slice(0, size);
}
