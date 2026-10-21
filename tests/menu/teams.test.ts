import { describe, expect, it } from 'vitest';
import { createGameState, SOLO_TEAM_BASE } from '../../src/core/state';
import { createMatch, recordRound } from '../../src/core';
import { isTeamGame, scoreLine, teamName } from '../../src/render/outcomeText';
import {
  createTeams,
  isValidTeams,
  moveSide,
  moveTeamSelection,
  needsTeamsScreen,
  sidesFromAssignment,
  slotLabels,
  teamAssignment,
} from '../../src/menu/teamsModel';

describe('tela de times', () => {
  it('todos começam no meio; ← → empurram o jogador selecionado e param nas pontas', () => {
    const teams = createTeams(4);
    expect(teams.sides).toEqual([0, 0, 0, 0]);
    expect(moveSide(teams, -1)).toBe(true);
    expect(teams.sides[0]).toBe(-1);
    expect(moveSide(teams, -1)).toBe(false); // já está na ponta esquerda
    moveTeamSelection(teams, 1);
    moveSide(teams, 1);
    moveSide(teams, 1);
    expect(teams.sides).toEqual([-1, 1, 0, 0]);
    moveSide(teams, -1);
    expect(teams.sides[1]).toBe(0); // voltou para o meio
  });

  it('a seleção dá a volta na lista', () => {
    const teams = createTeams(3);
    moveTeamSelection(teams, -1);
    expect(teams.selected).toBe(2);
    moveTeamSelection(teams, 1);
    expect(teams.selected).toBe(0);
  });

  it('esquerda = time 1, direita = time 2, meio = time próprio de cada um', () => {
    expect(teamAssignment([-1, 1, 0, -1])).toEqual([1, 2, SOLO_TEAM_BASE + 3, 1]);
    expect(new Set(teamAssignment([0, 0, 0])).size).toBe(3);
  });

  it('só vale com pelo menos dois times', () => {
    expect(isValidTeams([0, 0, 0])).toBe(true); // cada um por si
    expect(isValidTeams([-1, -1, -1])).toBe(false); // todos no mesmo time
    expect(isValidTeams([1, 1, 1, 1])).toBe(false);
    expect(isValidTeams([-1, -1, 0])).toBe(true); // um time contra quem joga sozinho
    expect(isValidTeams([-1, 1, 1])).toBe(true);
  });

  it('o caminho de volta recupera os lados; sem escolha, todos no meio', () => {
    const sides = [-1, 1, 0, -1] as const;
    expect(sidesFromAssignment(teamAssignment(sides), 4)).toEqual(sides);
    expect(sidesFromAssignment(undefined, 3)).toEqual([0, 0, 0]);
    expect(createTeams(4, sides).sides).toEqual(sides);
  });

  it('nomes das vagas e quando a tela aparece', () => {
    expect(slotLabels(1, 4)).toEqual(['Você', 'CPU 1', 'CPU 2', 'CPU 3']);
    expect(slotLabels(2, 4)).toEqual(['Jogador 1', 'Jogador 2', 'CPU 1', 'CPU 2']);
    expect(needsTeamsScreen(1, 1)).toBe(false);
    expect(needsTeamsScreen(2, 0)).toBe(false);
    expect(needsTeamsScreen(1, 2)).toBe(true);
    expect(needsTeamsScreen(2, 3)).toBe(true);
  });
});

describe('times escolhidos entram na partida', () => {
  it('createGameState usa teamAssignment (e ignora um tamanho errado)', () => {
    const state = createGameState({ seed: 1, players: 2, enemies: 2, teamAssignment: [1, 2, 2, SOLO_TEAM_BASE + 4] });
    expect(state.players.map((p) => p.team)).toEqual([1, 2, 2, SOLO_TEAM_BASE + 4]);
    const wrong = createGameState({ seed: 1, players: 2, enemies: 2, teams: 'free', teamAssignment: [1, 2] });
    expect(wrong.players.map((p) => p.team)).toEqual([1, 2, 3, 4]);
  });

  it('quem joga sozinho no meio é chamado pelo próprio nome; o time de verdade tem cor', () => {
    const players = createGameState({ seed: 1, players: 1, enemies: 3, teamAssignment: [1, 1, 2, SOLO_TEAM_BASE + 4] }).players;
    expect(isTeamGame(players)).toBe(true);
    expect(teamName(1, players)).toBe('Time Azul');
    expect(teamName(2, players)).toBe('CPU 2'); // sozinho no time vermelho
    expect(teamName(SOLO_TEAM_BASE + 4, players)).toBe('CPU 3');
    const match = createMatch(2);
    recordRound(match, { kind: 'win', winner: 3 }, players);
    expect(scoreLine(match, players)).toBe('Time Azul: 0  ·  CPU 2: 1  ·  CPU 3: 0');
  });

  it('a rodada só acaba quando sobra um time (aliados vivos continuam)', () => {
    const players = createGameState({ seed: 1, players: 1, enemies: 3, teamAssignment: [1, 1, 2, SOLO_TEAM_BASE + 4] }).players;
    expect(new Set(players.map((p) => p.team)).size).toBe(3);
  });
});
