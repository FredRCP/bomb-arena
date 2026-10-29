import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DIFFICULTY_TAGLINES,
  MAX_VOLUME,
  changeValue,
  createMenu,
  canStart,
  describeRow,
  enemyRange,
  moveSelection,
  parseSettings,
  selectedRow,
  stageIssue,
  stepNumber,
  summaryLines,
  toGameConfig,
  totalSteps,
  visibleRows,
} from '../../src/menu/menuModel';
import { stageById } from '../../src/config/stages';
import { hasGameParams, parseGameConfig } from '../../src/menu/gameConfig';
import { loadSettings, saveSettings } from '../../src/menu/settingsStorage';
import type { StorageLike } from '../../src/menu/settingsStorage';

/** Leva a seleção até a linha pedida (dando a volta pelo menu). */
function goTo(menu: ReturnType<typeof createMenu>, row: string): void {
  // Cada linha mora numa tela; vai para a certa antes de procurar a linha.
  const screens: Record<string, 'rules' | 'stage' | 'options'> = { wins: 'rules', time: 'rules', sideline: 'rules', stage: 'stage', volume: 'options', music: 'options' };
  if (screens[row]) menu.screen = screens[row]!;
  menu.selected = 0;
  for (let i = 0; i < 12 && selectedRow(menu) !== row; i++) moveSelection(menu, 1);
  expect(selectedRow(menu)).toBe(row);
}

describe('menu: linhas e seleção', () => {
  it('cada tela tem as suas linhas; a dificuldade só com inimigo do computador', () => {
    const base = { ...DEFAULT_SETTINGS };
    expect(visibleRows({ ...base, players: 1, enemies: 1 }, 'participants')).toEqual(['players', 'enemies', 'difficulty', 'next']);
    expect(visibleRows({ ...base, players: 2, enemies: 0 }, 'participants')).toEqual(['players', 'enemies', 'next']);
    expect(visibleRows({ ...base, players: 2, enemies: 2 }, 'participants')).toEqual(['players', 'enemies', 'difficulty', 'next']);
    expect(visibleRows(base, 'rules')).toEqual(['wins', 'time', 'sideline', 'next']);
    expect(visibleRows(base, 'stage')).toEqual(['stage', 'next']);
    expect(visibleRows(base, 'options')).toEqual(['volume', 'music', 'controls', 'next']);
  });

  it('faixa de inimigos: 1 pessoa 1 a 4; 2 pessoas 0 a 3 (máximo 5 no total)', () => {
    expect(enemyRange(1)).toEqual({ min: 1, max: 4 });
    expect(enemyRange(2)).toEqual({ min: 0, max: 3 });
  });

  it('cada tela começa no botão de baixo (Enter já avança com as escolhas guardadas)', () => {
    expect(selectedRow(createMenu())).toBe('next');
    expect(selectedRow(createMenu(DEFAULT_SETTINGS, 'stage'))).toBe('next');
  });

  it('cima/baixo dão a volta nas pontas', () => {
    const menu = createMenu();
    moveSelection(menu, 1);
    expect(selectedRow(menu)).toBe('players');
    moveSelection(menu, -1);
    expect(selectedRow(menu)).toBe('next');
  });

  it('esquerda/direita mudam o valor da linha: inimigos 1 a 4 e dando a volta', () => {
    const menu = createMenu();
    goTo(menu, 'enemies');
    changeValue(menu, 1);
    expect(menu.settings.enemies).toBe(2);
    changeValue(menu, 1);
    changeValue(menu, 1);
    expect(menu.settings.enemies).toBe(4);
    changeValue(menu, 1);
    expect(menu.settings.enemies).toBe(1);
    changeValue(menu, -1);
    expect(menu.settings.enemies).toBe(4);
  });

  it('dificuldade percorre os 5 níveis e volta ao primeiro', () => {
    const menu = createMenu();
    goTo(menu, 'difficulty');
    expect(menu.settings.difficulty).toBe('normal');
    for (const next of ['hard', 'expert', 'ultra', 'easy', 'normal']) {
      changeValue(menu, 1);
      expect(menu.settings.difficulty).toBe(next);
    }
  });

  it('volume sobe e desce de 1 em 1 e trava nas pontas', () => {
    const menu = createMenu();
    goTo(menu, 'volume');
    for (let i = 0; i < 20; i++) changeValue(menu, 1);
    expect(menu.settings.volume).toBe(MAX_VOLUME);
    expect(changeValue(menu, 1)).toBe(false);
    for (let i = 0; i < 20; i++) changeValue(menu, -1);
    expect(menu.settings.volume).toBe(0);
    expect(describeRow(menu.settings, 'volume').value).toBe('mudo');
  });

  it('trocar de modo mantém a seleção válida', () => {
    const menu = createMenu();
    goTo(menu, 'players');
    changeValue(menu, 1);
    expect(menu.settings.players).toBe(2);
    menu.settings.enemies = 0; // sem inimigos, a linha de dificuldade some
    expect(visibleRows(menu.settings, menu.screen)).toHaveLength(3);
    expect(menu.selected).toBeLessThan(3);
    changeValue(menu, -1);
    expect(menu.settings.players).toBe(1);
  });

  it('no botão de baixo, esquerda/direita não mudam nada', () => {
    const menu = createMenu();
    expect(changeValue(menu, 1)).toBe(false);
    expect(menu.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('o menu não altera as configurações padrão compartilhadas', () => {
    const menu = createMenu();
    menu.settings.volume = 1;
    expect(DEFAULT_SETTINGS.volume).not.toBe(1);
  });
});

describe('menu: partida, tempo e laterais', () => {
  it('partida: única, melhor de 2, melhor de 3 (vitórias para vencer), dando a volta', () => {
    const menu = createMenu();
    goTo(menu, 'wins');
    expect(describeRow(menu.settings, 'wins')).toEqual({ label: 'Partida', value: 'Melhor de 2' });
    changeValue(menu, 1);
    expect(menu.settings.wins).toBe(3);
    changeValue(menu, 1);
    expect(menu.settings.wins).toBe(1);
    expect(describeRow(menu.settings, 'wins').value).toBe('Partida única');
    changeValue(menu, -1);
    expect(menu.settings.wins).toBe(3);
  });

  it('tempo da rodada percorre 1:00, 1:30, 2:00, 3:00, 4:00, 5:00 e sem limite', () => {
    const menu = createMenu();
    goTo(menu, 'time');
    expect(describeRow(menu.settings, 'time').value).toBe('3:00');
    changeValue(menu, 1);
    expect(menu.settings.time).toBe(240);
    changeValue(menu, 1);
    expect(menu.settings.time).toBe(300);
    changeValue(menu, 1);
    expect(menu.settings.time).toBe(0);
    expect(describeRow(menu.settings, 'time').value).toBe('sem limite');
    changeValue(menu, 1);
    expect(describeRow(menu.settings, 'time').value).toBe('1:00');
    changeValue(menu, -1);
    expect(menu.settings.time).toBe(0);
    goTo(menu, 'time');
    for (let i = 0; i < 4; i++) changeValue(menu, -1);
    expect(describeRow(menu.settings, 'time').value).toBe('2:00');
  });

  it('sem limite de tempo vale também no resumo e na configuração da partida', () => {
    expect(toGameConfig({ ...DEFAULT_SETTINGS, time: 0 })).toMatchObject({ time: 0 });
    expect(summaryLines({ ...DEFAULT_SETTINGS, time: 0 })[1]).toContain('sem limite de tempo');
    expect(parseSettings(JSON.stringify({ time: 0 }))).toEqual({ ...DEFAULT_SETTINGS, time: 0 });
    expect(parseGameConfig('?time=0')).toMatchObject({ time: 0 });
  });

  it('repescagem liga e desliga com esquerda/direita', () => {
    const menu = createMenu();
    goTo(menu, 'sideline');
    expect(describeRow(menu.settings, 'sideline').value).toBe('Ligada');
    changeValue(menu, 1);
    expect(menu.settings.sideline).toBe(false);
    expect(describeRow(menu.settings, 'sideline').value).toBe('Desligada');
    changeValue(menu, -1);
    expect(menu.settings.sideline).toBe(true);
  });

  it('as escolhas vão para a configuração da partida', () => {
    expect(toGameConfig({ ...DEFAULT_SETTINGS, wins: 1, time: 90, sideline: false })).toMatchObject({ wins: 1, time: 90, sideline: false });
    expect(toGameConfig(DEFAULT_SETTINGS)).toMatchObject({ wins: 2, time: 180, sideline: true });
  });

  it('endereço: wins e sideline', () => {
    expect(parseGameConfig('?wins=3')).toMatchObject({ wins: 3 });
    expect(parseGameConfig('?wins=9')).toMatchObject({ wins: 3 });
    expect(parseGameConfig('?sideline=0')).toMatchObject({ sideline: false });
    expect(parseGameConfig('?sideline=1')).not.toHaveProperty('sideline');
    expect(parseGameConfig('')).not.toHaveProperty('wins');
    expect(hasGameParams('?wins=1')).toBe(true);
  });

  it('configurações guardadas: valores novos inválidos voltam ao padrão', () => {
    expect(parseSettings(JSON.stringify({ wins: 7, time: 77, sideline: 'sim' }))).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ wins: 1, time: 60, sideline: false }))).toEqual({ ...DEFAULT_SETTINGS, wins: 1, time: 60, sideline: false });
  });
});

describe('menu: configuração da partida', () => {
  it('os inimigos escolhidos valem nos dois modos, respeitando o máximo de 5 jogadores', () => {
    expect(toGameConfig({ ...DEFAULT_SETTINGS, players: 1, enemies: 3, difficulty: 'hard' })).toMatchObject({ players: 1, enemies: 3, difficulty: 'hard', items: true });
    expect(toGameConfig({ ...DEFAULT_SETTINGS, players: 1, enemies: 4 })).toMatchObject({ players: 1, enemies: 4 });
    expect(toGameConfig({ ...DEFAULT_SETTINGS, players: 2, enemies: 3 })).toMatchObject({ players: 2, enemies: 3 });
    expect(toGameConfig({ ...DEFAULT_SETTINGS, players: 2, enemies: 4 })).toMatchObject({ players: 2, enemies: 3 });
    expect(toGameConfig({ ...DEFAULT_SETTINGS, players: 2, enemies: 0 })).toMatchObject({ players: 2, enemies: 0 });
  });

  it('trocar o modo ajusta os inimigos à faixa: 1 pessoa nunca fica com 0; 2 pessoas nunca passam de 3', () => {
    const menu = createMenu({ ...DEFAULT_SETTINGS, players: 2, enemies: 0 });
    moveSelection(menu, 1); // players
    changeValue(menu, 1);
    expect(menu.settings).toMatchObject({ players: 1, enemies: 1 });
    menu.settings.enemies = 4;
    changeValue(menu, 1);
    expect(menu.settings).toMatchObject({ players: 2, enemies: 3 });
  });
});

describe('endereço (?players=1&...)', () => {
  it('sem parâmetros: 2 pessoas, sem inimigos, normal, itens ligados, semente padrão', () => {
    expect(parseGameConfig('')).toMatchObject({ players: 2, enemies: 0, difficulty: 'normal', items: true, seed: 1 });
    expect(hasGameParams('')).toBe(false);
  });

  it('players=1 sem enemies => 1 inimigo; enemies, ai, seed, items, bombs e range são lidos', () => {
    expect(parseGameConfig('?players=1')).toMatchObject({ players: 1, enemies: 1 });
    expect(parseGameConfig('?players=1&enemies=3&ai=hard&seed=7&items=0&bombs=3&range=4')).toEqual({
      players: 1, enemies: 3, difficulty: 'hard', teams: 'free', seed: 7, items: false, bombs: 3, range: 4,
    });
    for (const level of ['easy', 'normal', 'hard', 'expert', 'ultra']) expect(parseGameConfig(`?ai=${level}`).difficulty).toBe(level);
    expect(parseGameConfig('?ai=banana').difficulty).toBe('normal');
    expect(parseGameConfig('?players=1&enemies=3&teams=mixed').teams).toBe('mixed');
    expect(parseGameConfig('?teams=banana').teams).toBe('free');
    expect(parseGameConfig('?power=kick,ghost,banana,kick')).toMatchObject({ power: ['kick', 'ghost'] });
    expect(parseGameConfig('?players=2&enemies=4')).toMatchObject({ players: 2, enemies: 3 });
    expect(parseGameConfig('?players=1&enemies=4')).toMatchObject({ players: 1, enemies: 4 });
    expect(hasGameParams('?power=kick')).toBe(true);
    expect(parseGameConfig('?time=20')).toMatchObject({ time: 20 });
    expect(parseGameConfig('?time=99999')).toMatchObject({ time: 600 });
    expect(parseGameConfig('')).not.toHaveProperty('time');
    expect(hasGameParams('?time=20')).toBe(true);
    expect(parseGameConfig('?countdown=0')).toMatchObject({ countdown: 0 });
    expect(parseGameConfig('?countdown=99')).toMatchObject({ countdown: 10 });
    expect(parseGameConfig('')).not.toHaveProperty('countdown');
    expect(hasGameParams('?countdown=0')).toBe(true);
    expect(hasGameParams('?players=1')).toBe(true);
    expect(hasGameParams('?foo=1')).toBe(false);
  });

  it('valores inválidos ou fora da faixa viram o padrão ou são limitados', () => {
    expect(parseGameConfig('?players=7&enemies=99&ai=banana&bombs=0&range=500')).toMatchObject({
      players: 5, enemies: 0, difficulty: 'normal', bombs: 1, range: 12,
    });
    expect(parseGameConfig('?players=abc&seed=xyz')).toMatchObject({ players: 2, seed: 1 });
  });
});

describe('configurações guardadas', () => {
  function fakeStorage(initial: string | null = null): StorageLike & { value: string | null } {
    const box = { value: initial, getItem: () => box.value, setItem: (_k: string, v: string) => void (box.value = v) };
    return box;
  }

  it('guardar e ler devolve as mesmas escolhas', () => {
    const storage = fakeStorage();
    const settings = { players: 2 as const, enemies: 3 as const, difficulty: 'hard' as const, wins: 3 as const, time: 120, sideline: false, stage: 'classic', volume: 4, music: 2 };
    saveSettings(settings, storage);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it('vazio, texto inválido, tipos errados e valores fora da faixa viram o padrão campo a campo', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{não é json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('123')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ players: 9, enemies: '2', difficulty: 'insano', volume: 99 }))).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ players: 2, volume: 3 }))).toEqual({ ...DEFAULT_SETTINGS, players: 2, volume: 3 });
    expect(parseSettings(JSON.stringify({ volume: 2.5 }))).toEqual(DEFAULT_SETTINGS);
  });

  it('sem armazenamento, ou armazenamento que dá erro, o jogo segue com o padrão', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, null)).not.toThrow();
    const broken: StorageLike = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('cheio'); },
    };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, broken)).not.toThrow();
  });
});

describe('menu: níveis', () => {
  it('o menu mostra os cinco níveis em ordem crescente, com nomes previsíveis', () => {
    const labels = (['easy', 'normal', 'hard', 'expert', 'ultra'] as const).map((difficulty) => describeRow({ ...DEFAULT_SETTINGS, difficulty }, 'difficulty').value);
    expect(labels).toEqual(['Fácil', 'Normal', 'Difícil', 'Hardcore', 'Impossível']);
    expect(new Set(labels).size).toBe(5);
    for (const difficulty of ['easy', 'normal', 'hard', 'expert', 'ultra'] as const) expect(DIFFICULTY_TAGLINES[difficulty].length).toBeGreaterThan(5);
  });

  it('o nível guardado volta; valor inválido vira o padrão; a escolha antiga de equipes é ignorada', () => {
    expect(parseSettings(JSON.stringify({ difficulty: 'ultra' }))).toMatchObject({ difficulty: 'ultra' });
    expect(parseSettings(JSON.stringify({ teams: 'mixed', difficulty: 'impossível' }))).toEqual(DEFAULT_SETTINGS);
  });

  it('a configuração da partida não traz equipes (elas vêm da tela de times)', () => {
    expect(toGameConfig({ ...DEFAULT_SETTINGS, players: 1, enemies: 3 }).teams).toBe('free');
    expect(toGameConfig({ ...DEFAULT_SETTINGS, players: 1, enemies: 3 }).teamAssignment).toBeUndefined();
  });

  it('o rótulo da opção de voltar à arena é Repescagem', () => {
    expect(describeRow(DEFAULT_SETTINGS, 'sideline')).toEqual({ label: 'Repescagem', value: 'Ligada' });
    expect(describeRow({ ...DEFAULT_SETTINGS, sideline: false }, 'sideline').value).toBe('Desligada');
  });

  it('quantidade de passos: a tela de times só entra com 3 ou mais jogadores', () => {
    expect(totalSteps({ ...DEFAULT_SETTINGS, players: 1, enemies: 1 })).toBe(4);
    expect(totalSteps({ ...DEFAULT_SETTINGS, players: 1, enemies: 2 })).toBe(5);
    expect(stepNumber('participants', DEFAULT_SETTINGS)).toBe(1);
    expect(stepNumber('rules', DEFAULT_SETTINGS)).toBe(2);
    expect(stepNumber('stage', { ...DEFAULT_SETTINGS, players: 2, enemies: 2 })).toBe(5);
    expect(stepNumber('options', DEFAULT_SETTINGS)).toBeNull();
  });
});

describe('menu: fase e resumo', () => {
  it('a fase percorre a lista; só o trenzinho ainda mostra "em breve"', () => {
    const menu = createMenu(DEFAULT_SETTINGS, 'stage');
    goTo(menu, 'stage');
    const expected: Array<[string, boolean]> = [['Arena Clássica', true], ['Arena Clássica Grande', true], ['Fase do Gelo', true], ['Fase do Egito', true], ['Fase do Trenzinho (em breve)', false]];
    for (const [name, playable] of expected) {
      expect(describeRow(menu.settings, 'stage').value).toBe(name);
      expect(canStart(menu.settings)).toBe(playable);
      changeValue(menu, 1);
    }
    expect(menu.settings.stage).toBe('classic'); // deu a volta nas 5 fases
  });

  it('stageIssue: celular não joga arena grande; fase pequena demais não comporta todos', () => {
    const big = stageById('egypt');
    expect(stageIssue(big, 2, false)).toBeNull();
    expect(stageIssue(big, 2, true)).toMatch(/grande demais para celular/);
    expect(stageIssue(big, 5, false)).toMatch(/até 4 jogadores/);
    expect(stageIssue(stageById('classic'), 5, true)).toBeNull();
    expect(stageIssue(stageById('train'), 2, false)).toBe('Em breve!');
  });

  it('a fase vai na configuração da partida e é guardada; fase desconhecida volta à clássica', () => {
    expect(toGameConfig({ ...DEFAULT_SETTINGS, stage: 'ice' }).stage).toBe('ice');
    expect(parseSettings(JSON.stringify({ stage: 'egypt' })).stage).toBe('egypt');
    expect(parseSettings(JSON.stringify({ stage: 'lua' })).stage).toBe('classic');
  });

  it('resumo da partida em linhas curtas', () => {
    expect(summaryLines({ ...DEFAULT_SETTINGS, players: 1, enemies: 1, wins: 2, time: 180, sideline: true })).toEqual([
      '1 pessoa + 1 do computador (Normal)',
      'Melhor de 2 · rodadas de 3:00 · repescagem ligada',
    ]);
    expect(summaryLines({ ...DEFAULT_SETTINGS, players: 2, enemies: 2, wins: 1, time: 90, sideline: false, difficulty: 'ultra' })).toEqual([
      '2 pessoas + 2 do computador (Impossível)',
      'Partida única · rodadas de 1:30 · repescagem desligada',
    ]);
    expect(summaryLines({ ...DEFAULT_SETTINGS, players: 2, enemies: 0 })[0]).toBe('2 pessoas');
  });
});

describe('volume da música', () => {
  it('é uma linha própria das opções, de 0 (mudo) a 10, guardada junto com as outras escolhas', () => {
    const menu = createMenu(DEFAULT_SETTINGS, 'options');
    menu.selected = 1;
    expect(selectedRow(menu)).toBe('music');
    expect(describeRow(menu.settings, 'music').label).toBe('Volume da música');
    for (let i = 0; i < 20; i++) changeValue(menu, 1);
    expect(menu.settings.music).toBe(10);
    expect(changeValue(menu, 1)).toBe(false);
    for (let i = 0; i < 20; i++) changeValue(menu, -1);
    expect(describeRow(menu.settings, 'music').value).toBe('mudo');
    expect(parseSettings(JSON.stringify({ music: 3 }))).toEqual({ ...DEFAULT_SETTINGS, music: 3 });
    expect(parseSettings(JSON.stringify({ music: 99 }))).toEqual(DEFAULT_SETTINGS);
  });
});

describe('mais pessoas com controles de videogame', () => {
  it('sem controles sobrando a lista de jogadores só tem 1 e 2; com 4 controles vai até 4', () => {
    const menu = createMenu();
    goTo(menu, 'players');
    changeValue(menu, 1);
    expect(menu.settings.players).toBe(2);
    changeValue(menu, 1);
    expect(menu.settings.players).toBe(1);
    menu.maxHumans = 4;
    changeValue(menu, -1);
    expect(menu.settings.players).toBe(4);
    expect(describeRow(menu.settings, 'players').value).toBe('4 jogadores (com controles)');
    // As vagas dos inimigos respeitam o total de 5.
    expect(enemyRange(4)).toEqual({ min: 0, max: 1 });
  });

  it('a configuração aceita 3 a 5 pessoas', () => {
    expect(parseGameConfig('?players=4&enemies=3')).toMatchObject({ players: 4, enemies: 1 });
    expect(parseSettings(JSON.stringify({ players: 3 }))).toEqual({ ...DEFAULT_SETTINGS, players: 3, enemies: 1 });
    expect(summaryLines({ ...DEFAULT_SETTINGS, players: 3, enemies: 0 })[0]).toBe('3 pessoas');
  });
});
