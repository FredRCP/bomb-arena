import Phaser from 'phaser';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { characterById } from '../characters/characters';
import { PadNav } from '../input/padNav';
import { createTeams, isValidTeams, moveSide, moveTeamSelection, sidesFromAssignment, slotLabels, teamAssignment } from '../menu/teamsModel';
import type { Side, TeamsState } from '../menu/teamsModel';
import { loadSettings } from '../menu/settingsStorage';
import { totalSteps } from '../menu/menuModel';
import { addCharacter } from '../render/CharacterView';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../render/layout';
import { addMenuBackground } from '../render/menuBackground';
import type { GameSession } from './GameScene';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const COLUMN_W = 440;
const COLUMN_TOP = 200;
const COLUMN_H = 540;
const ROW_STEP = 84;
/** Centro de cada coluna, na ordem dos lados: -1 (Time Azul), 0 (sem time), 1 (Time Vermelho). */
const COLUMN_X: Record<Side, number> = { [-1]: SCREEN_WIDTH / 2 - 500, 0: SCREEN_WIDTH / 2, 1: SCREEN_WIDTH / 2 + 500 };
const COLUMN_STYLE: Record<Side, { title: string; fill: number; hex: string }> = {
  [-1]: { title: 'TIME AZUL', fill: 0x2f7fd8, hex: '#9bd1ff' },
  0: { title: 'SEM TIME', fill: 0x14163a, hex: '#e3e7ff' },
  1: { title: 'TIME VERMELHO', fill: 0xd8453f, hex: '#ffb3ad' },
};

/**
 * Tela de times (como no Bomberman clássico): todos começam no meio; ↑ ↓ escolhem o jogador e ← → o mandam para o
 * Time Azul (esquerda) ou o Time Vermelho (direita). Vale para pessoas e computador. Só aparece com 3 ou mais
 * jogadores. A lógica está em menu/teamsModel.ts (com testes); esta cena só desenha.
 */
export class TeamsScene extends Phaser.Scene {
  private session!: GameSession;
  private teams!: TeamsState;
  private labels: string[] = [];
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private warning!: Phaser.GameObjects.Text;
  private padNav!: PadNav;

  constructor() {
    super({ key: 'Teams' });
  }

  init(data: GameSession): void {
    this.session = data;
  }

  create(): void {
    music.playMenu();
    const { config } = this.session;
    const total = config.players + config.enemies;
    this.teams = createTeams(total, sidesFromAssignment(config.teamAssignment, total));
    this.labels = slotLabels(config.players, total);
    this.dynamic = [];
    addMenuBackground(this);
    const steps = totalSteps({ ...loadSettings(), players: config.players, enemies: config.enemies });
    this.add
      .text(SCREEN_WIDTH / 2, 70, 'FORMAR OS TIMES', { fontFamily: FONT, fontSize: '60px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 8 })
      .setOrigin(0.5);
    this.add.text(SCREEN_WIDTH / 2, 128, `Passo 4 de ${steps}`, { fontFamily: FONT, fontSize: '24px', color: '#e3e7ff' }).setOrigin(0.5);

    for (const side of [-1, 0, 1] as const) {
      const style = COLUMN_STYLE[side];
      const g = this.add.graphics();
      g.fillStyle(style.fill, side === 0 ? 0.5 : 0.55);
      g.fillRoundedRect(COLUMN_X[side] - COLUMN_W / 2, COLUMN_TOP, COLUMN_W, COLUMN_H, 28);
      this.add
        .text(COLUMN_X[side], COLUMN_TOP + 38, style.title, { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: style.hex, stroke: '#0b0c1a', strokeThickness: 4 })
        .setOrigin(0.5);
    }
    this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 138, 'Quem fica no meio joga por conta própria.', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 })
      .setOrigin(0.5);
    this.warning = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 102, '', { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 4 }).setOrigin(0.5);
    this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 60, '↑ ↓ escolher jogador     ← → mandar para o time     Enter continuar     Esc voltar     (ou use o controle)', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 })
      .setOrigin(0.5);

    this.bindKeys();
    this.padNav = new PadNav(this);
    this.render();
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const bind = (names: readonly string[], action: () => void): void => {
      for (const name of names) keyboard.addKey(name).on('down', action);
    };
    bind(['UP', 'W'], () => this.select(-1));
    bind(['DOWN', 'S'], () => this.select(1));
    bind(['LEFT', 'A'], () => this.push(-1));
    bind(['RIGHT', 'D'], () => this.push(1));
    bind(['ENTER', 'SPACE'], () => this.confirm());
    bind(['ESC', 'BACKSPACE'], () => this.back());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.removeAllKeys(true));
  }

  update(time: number): void {
    if (!this.padNav) return;
    for (const { action } of this.padNav.poll(time)) {
      if (action === 'up') this.select(-1);
      else if (action === 'down') this.select(1);
      else if (action === 'left') this.push(-1);
      else if (action === 'right') this.push(1);
      else if (action === 'confirm') this.confirm();
      else if (action === 'back') this.back();
    }
  }

  private select(delta: -1 | 1): void {
    moveTeamSelection(this.teams, delta);
    sfx.play('tick');
    this.render();
  }

  private push(delta: -1 | 1): void {
    if (moveSide(this.teams, delta)) sfx.play('tick');
    this.render();
  }

  private confirm(): void {
    if (!isValidTeams(this.teams.sides)) {
      sfx.play('hit');
      return;
    }
    sfx.play('confirm');
    const config = { ...this.session.config, teamAssignment: teamAssignment(this.teams.sides) };
    this.scene.start('Setup', { screen: 'stage', session: { ...this.session, config } });
  }

  private back(): void {
    sfx.play('tick');
    this.scene.start('Select', { config: this.session.config, match: this.session.match });
  }

  private render(): void {
    for (const object of this.dynamic) object.destroy();
    this.dynamic = [];
    this.teams.sides.forEach((side, index) => {
      // Cada jogador tem a sua linha fixa em qualquer coluna: o 1º fica na 1ª linha, o 2º na 2ª, e assim por diante.
      const x = COLUMN_X[side];
      const y = COLUMN_TOP + 110 + index * ROW_STEP;
      const selected = index === this.teams.selected;
      const character = characterById(this.session.characters?.[index + 1] ?? 'pipoca');
      if (selected) {
        const frame = this.add.rectangle(x, y, COLUMN_W - 40, ROW_STEP - 12, 0xffffff, 0.22).setStrokeStyle(4, 0xffe66d);
        this.dynamic.push(frame);
      }
      this.dynamic.push(addCharacter(this, character, x - 130, y, 28));
      this.dynamic.push(
        this.add.text(x - 80, y, this.labels[index]!, { fontFamily: FONT, fontSize: '32px', fontStyle: selected ? 'bold' : 'normal', color: '#ffffff', stroke: '#0b0c1a', strokeThickness: 4 }).setOrigin(0, 0.5),
      );
    });
    this.warning.setText(isValidTeams(this.teams.sides) ? '' : 'Coloque alguém em outro time (ou no meio) para continuar.');
  }
}
