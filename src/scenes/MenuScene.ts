import Phaser from 'phaser';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { ARENA_COLS, ARENA_ROWS } from '../config/arena';
import { PadNav } from '../input/padNav';
import { TILE_SIZE } from '../render/ArenaRenderer';
import { characterById } from '../characters/characters';
import { addCharacter } from '../render/CharacterView';
import { placeArena } from '../render/layout';
import { addMenuBackground, addPanel } from '../render/menuBackground';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const WIDTH = ARENA_COLS * TILE_SIZE;
const HEIGHT = ARENA_ROWS * TILE_SIZE;

const ITEMS = [
  { label: 'JOGAR', go: 'Setup', data: { screen: 'participants' } },
  { label: 'OPÇÕES', go: 'Setup', data: { screen: 'options' } },
  { label: 'RANKING', go: 'Ranking', data: {} },
] as const;

/** Menu principal: Jogar (segue pelas telas de configuração), Ranking e Opções. */
export class MenuScene extends Phaser.Scene {
  private selected = 0;
  private texts: Phaser.GameObjects.Text[] = [];
  private arrow!: Phaser.GameObjects.Text;
  private padNav!: PadNav;

  constructor() {
    super({ key: 'Menu' });
  }

  create(): void {
    music.playMenu();
    placeArena(this);
    this.selected = 0;
    addMenuBackground(this);
    addPanel(this, WIDTH / 2, 480, 560, 330);
    const spots: Array<[number, number, string]> = [
      [90, 90, 'pipoca'], [WIDTH - 90, 90, 'bolt'], [90, HEIGHT - 150, 'musgo'], [WIDTH - 90, HEIGHT - 150, 'violeta'],
    ];
    for (const [x, y, id] of spots) addCharacter(this, characterById(id), x, y, 34);
    this.add
      .text(WIDTH / 2, 150, 'BOMB ARENA', { fontFamily: FONT, fontSize: '88px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 10 })
      .setOrigin(0.5);

    this.texts = ITEMS.map((item, index) =>
      this.add
        .text(WIDTH / 2, 350 + index * 90, item.label, { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#e3e7ff', stroke: '#1b1f3b', strokeThickness: 6 })
        .setOrigin(0.5),
    );
    this.arrow = this.add.text(0, 0, '▶', { fontFamily: FONT, fontSize: '44px', color: '#ffe66d' }).setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT - 60, '↑ ↓ escolher     Enter confirmar     Esc voltar     (ou use o controle)', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 })
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
    bind(['UP', 'W'], () => this.move(-1));
    bind(['DOWN', 'S'], () => this.move(1));
    bind(['ENTER', 'SPACE'], () => this.confirm());
    bind(['ESC', 'BACKSPACE'], () => this.back());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.removeAllKeys(true));
  }

  update(time: number): void {
    if (!this.padNav) return;
    for (const { action } of this.padNav.poll(time)) {
      if (action === 'up') this.move(-1);
      else if (action === 'down') this.move(1);
      else if (action === 'confirm') this.confirm();
      else if (action === 'back') this.back();
    }
  }

  private move(delta: -1 | 1): void {
    this.selected = (this.selected + delta + ITEMS.length) % ITEMS.length;
    sfx.play('tick');
    this.render();
  }

  private confirm(): void {
    sfx.play('confirm');
    const item = ITEMS[this.selected]!;
    this.scene.start(item.go, item.data);
  }

  private back(): void {
    this.scene.start('Title');
  }

  private render(): void {
    this.texts.forEach((text, index) => {
      const selected = index === this.selected;
      text.setColor(selected ? '#ffe66d' : '#e3e7ff');
      if (selected) this.arrow.setPosition(WIDTH / 2 - text.width / 2 - 50, text.y);
    });
  }
}
