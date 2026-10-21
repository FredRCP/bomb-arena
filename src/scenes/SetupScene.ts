import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { ARENA_COLS, ARENA_ROWS } from '../config/arena';
import { createMatch } from '../core';
import { PadNav } from '../input/padNav';
import { DIFFICULTY_TAGLINES, NEXT_LABELS, SCREEN_TITLES, canStart, changeValue, createMenu, describeRow, moveSelection, selectedRow, stepNumber, summaryLines, toGameConfig, totalSteps, visibleRows } from '../menu/menuModel';
import type { MenuScreen, MenuState } from '../menu/menuModel';
import { needsTeamsScreen } from '../menu/teamsModel';
import { loadSettings, saveSettings } from '../menu/settingsStorage';
import { TILE_SIZE } from '../render/ArenaRenderer';
import { placeArena } from '../render/layout';
import { addMenuBackground, addPanel } from '../render/menuBackground';
import type { GameSession } from './GameScene';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const WIDTH = ARENA_COLS * TILE_SIZE;
const HEIGHT = ARENA_ROWS * TILE_SIZE;
const ROW_TOP = 290;
const ROW_STEP = 66;

interface SetupData {
  screen?: MenuScreen;
  /** Na tela da fase: a partida já montada (com os personagens escolhidos). */
  session?: GameSession;
}

/**
 * Telas de configuração em lista: Quem vai jogar -> Regras -> (personagens) -> Fase, e as Opções. A lógica (linhas,
 * valores, resumo) está em menu/menuModel.ts, que tem testes; esta cena só desenha e repassa as teclas.
 * Esc volta um passo; Enter no botão de baixo (ou em qualquer linha) avança.
 */
export class SetupScene extends Phaser.Scene {
  private menu!: MenuState;
  private session: GameSession | undefined;
  private texts: Phaser.GameObjects.Text[] = [];
  private arrow!: Phaser.GameObjects.Text;
  private padNav!: PadNav;

  constructor() {
    super({ key: 'Setup' });
  }

  init(data: SetupData): void {
    this.menu = createMenu(loadSettings(), data?.screen ?? 'participants');
    this.session = data?.session;
  }

  create(): void {
    placeArena(this);
    sfx.setLevel(this.menu.settings.volume);
    this.texts = [];
    addMenuBackground(this);
    addPanel(this, WIDTH / 2, 470, WIDTH - 200, 440);
    this.add
      .text(WIDTH / 2, 100, SCREEN_TITLES[this.menu.screen], { fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 8 })
      .setOrigin(0.5);
    const step = stepNumber(this.menu.screen, this.menu.settings);
    const total = this.session ? totalSteps({ ...this.menu.settings, players: this.session.config.players, enemies: this.session.config.enemies }) : totalSteps(this.menu.settings);
    if (step) this.add.text(WIDTH / 2, 160, `Passo ${step} de ${total}`, { fontFamily: FONT, fontSize: '24px', color: '#e3e7ff' }).setOrigin(0.5);
    this.arrow = this.add.text(0, 0, '▶', { fontFamily: FONT, fontSize: '34px', color: '#ffe66d' }).setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT - 70, '↑ ↓ escolher     ← → mudar     Enter continuar     Esc voltar     (ou use o controle)', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 })
      .setOrigin(0.5);

    this.bindKeys();
    this.padNav = new PadNav(this);
    this.render();
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const bind = (names: readonly string[], action: () => void, repeat = false): void => {
      for (const name of names) {
        keyboard.addKey(name).on('down', (_key: unknown, event: KeyboardEvent) => {
          if (!event?.repeat || repeat) action();
        });
      }
    };
    bind(['UP', 'W'], () => this.navigate(-1));
    bind(['DOWN', 'S'], () => this.navigate(1));
    bind(['LEFT', 'A'], () => this.change(-1), true);
    bind(['RIGHT', 'D'], () => this.change(1), true);
    bind(['ENTER', 'SPACE'], () => this.confirm());
    bind(['ESC', 'BACKSPACE'], () => this.back());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.removeAllKeys(true));
  }

  update(time: number): void {
    if (!this.padNav) return;
    for (const { action } of this.padNav.poll(time)) {
      if (action === 'up') this.navigate(-1);
      else if (action === 'down') this.navigate(1);
      else if (action === 'left') this.change(-1);
      else if (action === 'right') this.change(1);
      else if (action === 'confirm') this.confirm();
      else if (action === 'back') this.back();
    }
  }

  private navigate(delta: -1 | 1): void {
    moveSelection(this.menu, delta);
    sfx.play('tick');
    this.render();
  }

  private change(delta: -1 | 1): void {
    if (!changeValue(this.menu, delta)) return;
    sfx.setLevel(this.menu.settings.volume);
    sfx.play('tick');
    saveSettings(this.menu.settings);
    this.render();
  }

  /** Enter: avança para a próxima tela (a fase "em breve" não deixa começar). */
  private confirm(): void {
    const { screen, settings } = this.menu;
    saveSettings(settings);
    if (screen === 'stage' && !canStart(settings)) {
      sfx.play('hit');
      return;
    }
    sfx.play('confirm');
    if (screen === 'participants') this.scene.start('Setup', { screen: 'rules' });
    else if (screen === 'rules') {
      // Semente nova a cada partida, para a arena não ser sempre a mesma. (A cena pode usar o relógio; o core, não.)
      const seed = Math.floor(Math.random() * 1_000_000);
      this.scene.start('Select', { config: toGameConfig(settings, seed), match: createMatch(settings.wins) });
    } else if (screen === 'stage') {
      if (!this.session) return;
      this.scene.start('Game', { ...this.session, config: { ...this.session.config, stage: toGameConfig(settings).stage } });
    } else this.scene.start('Menu');
  }

  /** Esc: volta um passo (da fase, para a escolha de personagem; da primeira tela, para o menu). */
  private back(): void {
    sfx.play('tick');
    const { screen } = this.menu;
    if (screen === 'rules') this.scene.start('Setup', { screen: 'participants' });
    else if (screen === 'stage') {
      if (!this.session) this.scene.start('Menu');
      else if (needsTeamsScreen(this.session.config.players, this.session.config.enemies)) this.scene.start('Teams', this.session);
      else this.scene.start('Select', { config: this.session.config, match: this.session.match });
    } else this.scene.start('Menu');
  }

  private render(): void {
    for (const text of this.texts) text.destroy();
    this.texts = [];
    const rows = visibleRows(this.menu.settings, this.menu.screen);
    const current = selectedRow(this.menu);
    rows.forEach((row, index) => {
      const y = ROW_TOP + index * ROW_STEP;
      const selected = row === current;
      if (row === 'next') {
        const blocked = this.menu.screen === 'stage' && !canStart(this.menu.settings);
        const label = NEXT_LABELS[this.menu.screen];
        const color = blocked ? '#6c7293' : selected ? '#ffe66d' : '#c9a93a';
        this.texts.push(this.add.text(WIDTH / 2, y + 24, label, { fontFamily: FONT, fontSize: '50px', fontStyle: 'bold', color, stroke: '#1b1f3b', strokeThickness: 6 }).setOrigin(0.5));
        if (selected) this.arrow.setPosition(WIDTH / 2 - 130, y + 24);
        return;
      }
      const { label, value } = describeRow(this.menu.settings, row);
      const color = selected ? '#ffffff' : '#e3e7ff';
      const style = { fontFamily: FONT, fontSize: '32px', fontStyle: selected ? 'bold' : 'normal', color };
      this.texts.push(
        this.add.text(150, y, label, style).setOrigin(0, 0.5),
        this.add.text(WIDTH - 150, y, selected ? `◀  ${value}  ▶` : value, style).setOrigin(1, 0.5),
      );
      if (selected) this.arrow.setPosition(110, y);
    });

    // Na tela de participantes, uma frase de humor sobre o nível escolhido.
    if (this.menu.screen === 'participants' && rows.includes('difficulty')) {
      const top = ROW_TOP + rows.length * ROW_STEP + 30;
      this.texts.push(this.add.text(WIDTH / 2, top, `“${DIFFICULTY_TAGLINES[this.menu.settings.difficulty]}”`, { fontFamily: FONT, fontSize: '28px', fontStyle: 'italic', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 4 }).setOrigin(0.5));
    }

    // Na tela da fase, o resumo da partida logo abaixo das linhas.
    if (this.menu.screen === 'stage') {
      const top = ROW_TOP + rows.length * ROW_STEP + 40;
      summaryLines(this.menu.settings).forEach((line, index) => {
        this.texts.push(this.add.text(WIDTH / 2, top + index * 36, line, { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 }).setOrigin(0.5));
      });
    }
  }
}
