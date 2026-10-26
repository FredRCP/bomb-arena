import { TICKS_PER_SECOND } from '../config/simulation';
import type { MatchState, RankedPlayer, PlayerId, PlayerState, RoundOutcome } from '../core';

// Textos da tela de resultado. Função pura (sem Phaser), por isso tem teste.

export interface OutcomeText {
  title: string;
  /** Combina com o tom do resultado, para a cena escolher a cor. */
  tone: 'good' | 'bad' | 'neutral';
  /** Linha abaixo do título (placar). */
  subtitle?: string;
  /** Classificação por pontos (uma linha por jogador), abaixo do placar. */
  lines?: string[];
  /** Instrução de teclas, na parte de baixo. */
  hint?: string;
}

/** Nomes dos dois times quando a partida é em equipes (modos "pessoas × computador" e "times misturados"). */
export const TEAM_NAMES: Record<number, string> = { 1: 'Time Azul', 2: 'Time Vermelho' };

type Roster = readonly Pick<PlayerState, 'id' | 'team' | 'cpu'>[];

/** Partida em equipes = alguém tem pelo menos um aliado. Sem isso, é cada um por si. */
export function isTeamGame(players: Roster): boolean {
  return players.some((p) => players.some((q) => q.id !== p.id && q.team === p.team));
}

/** Pessoas na partida. */
export function humansOf(players: Roster): PlayerId[] {
  return players.filter((player) => !player.cpu).map((player) => player.id);
}

/**
 * Nomes dos personagens que o computador está jogando nesta partida (id do jogador -> nome do personagem).
 * A tela da partida preenche isto ao começar; sem isso (ou nos testes), o computador aparece como "CPU k".
 */
let cpuNames: Readonly<Record<number, string>> = {};
export function setCpuNames(names: Readonly<Record<number, string>>): void {
  cpuNames = names;
}

/** Nome de um jogador nos painéis e no placar: "Você" (uma pessoa só), "Jogador N", o nome do personagem do computador ou "CPU k". */
export function playerLabel(player: Pick<PlayerState, 'id' | 'cpu'>, players: Roster): string {
  if (player.cpu && cpuNames[player.id]) return cpuNames[player.id]!;
  if (player.cpu) return `CPU ${players.filter((p) => p.cpu).findIndex((p) => p.id === player.id) + 1}`;
  return humansOf(players).length === 1 ? 'Você' : `Jogador ${player.id}`;
}

/** Nome de um time: "Time Azul"/"Time Vermelho" em equipes; cada um por si, o nome do único jogador do time. */
export function teamName(team: number, players: Roster): string {
  const members = players.filter((p) => p.team === team);
  // Time de verdade (2 ou mais): "Time Azul"/"Time Vermelho". Quem está sozinho no time é chamado pelo próprio nome.
  if (members.length > 1) return TEAM_NAMES[team] ?? `Time ${team}`;
  return members[0] ? playerLabel(members[0], players) : `Time ${team}`;
}

/** Os times do placar, na ordem em que aparecem (o time do jogador 1 primeiro). */
export function scoreTeams(players: Roster): number[] {
  return [...new Set(players.map((player) => player.team))];
}

/** "Você 1 x 0 CPU 1" (dois times), "Você: 1  ·  CPU 1: 0  ·  CPU 2: 0" (mais de dois) ou "Rodada N" (sem adversário). */
export function scoreLine(match: MatchState, players: Roster): string {
  const teams = scoreTeams(players);
  if (teams.length < 2) return `Rodada ${match.round}`;
  if (teams.length > 2) return teams.map((team) => `${teamName(team, players)}: ${match.wins[team] ?? 0}`).join('  ·  ');
  const [a, b] = teams as [number, number];
  return `${teamName(a, players)} ${match.wins[a] ?? 0} x ${match.wins[b] ?? 0} ${teamName(b, players)}`;
}

/**
 * Título do resultado de uma rodada. Quem pode "vencer" é um time: se ele tem uma pessoa e só há uma pessoa jogando,
 * é "Vitória!"; sem pessoa no time vencedor, "Derrota" (uma pessoa só) ou o nome de quem venceu.
 */
export function describeOutcome(outcome: RoundOutcome, players: Roster): OutcomeText {
  if (outcome.kind === 'draw') return { title: 'Empate!', tone: 'neutral' };
  if (outcome.kind === 'defeat') return { title: 'Derrota', tone: 'bad' };
  const winner = players.find((p) => p.id === outcome.winner);
  if (!winner) return { title: 'Fim da rodada', tone: 'neutral' };
  const humans = humansOf(players);
  const winnerHasHuman = players.some((p) => p.team === winner.team && !p.cpu);
  if (humans.length === 1) {
    if (!winnerHasHuman) return { title: 'Derrota', tone: 'bad' };
    return { title: isTeamGame(players) ? `${teamName(winner.team, players)} venceu!` : 'Vitória!', tone: 'good' };
  }
  const title = `${teamName(winner.team, players)} venceu${isTeamGame(players) ? ' a rodada' : '!'}`;
  return { title, tone: winnerHasHuman ? 'good' : 'bad' };
}

/**
 * Texto do fim de uma rodada. Se a partida acabou, o título é o resultado da PARTIDA e a dica é "nova partida";
 * senão é o resultado da rodada com a dica "próxima rodada". Chame depois de registrar a rodada no placar.
 */
export function describeRoundEnd(outcome: RoundOutcome, match: MatchState, players: Roster): OutcomeText {
  const subtitle = scoreLine(match, players);

  if (!match.finished) {
    return { ...describeOutcome(outcome, players), subtitle, hint: 'R: próxima rodada   Q: menu' };
  }

  const hint = 'R: nova partida   Q: menu';
  if (match.winnerTeam === null) return { title: 'Partida empatada', tone: 'neutral', subtitle, hint };
  const humans = humansOf(players);
  const winnerHasHuman = players.some((p) => p.team === match.winnerTeam && !p.cpu);
  const name = teamName(match.winnerTeam, players);
  if (humans.length === 1) {
    if (!winnerHasHuman) return { title: `${name} venceu a partida`, tone: 'bad', subtitle, hint };
    return { title: isTeamGame(players) ? `${name} venceu a partida!` : 'Você venceu a partida!', tone: 'good', subtitle, hint };
  }
  return { title: `${name} venceu a partida!`, tone: winnerHasHuman ? 'good' : 'bad', subtitle, hint };
}

/** Linhas da classificação por pontos: "1º Você  ·  800 pts  ·  3 elim." (empatados dividem a posição). */
export function rankingLines(ranked: readonly RankedPlayer[], players: Roster): string[] {
  return ranked.map((row) => {
    const player = players.find((p) => p.id === row.id);
    const name = player ? playerLabel(player, players) : `Jogador ${row.id}`;
    return `${row.position}º ${name}  ·  ${row.points} pts  ·  ${row.kills} elim.`;
  });
}

/** Tempo restante no formato do relógio ("3:00"). Arredonda para cima: com 0,3 s sobrando ainda mostra 0:01. */
export function formatClock(ticksLeft: number): string {
  const seconds = Math.ceil(Math.max(0, ticksLeft) / TICKS_PER_SECOND);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
