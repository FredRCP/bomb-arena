import Phaser from 'phaser';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { PadNav } from '../input/padNav';
import { CHARACTERS, characterById } from '../characters/characters';
import { addCardArt, addCharacter } from '../render/CharacterView';
import { hasItemIcon, itemTexture } from '../render/ItemSprites';
import { placeArena, SCREEN_HEIGHT, SCREEN_WIDTH } from '../render/layout';
import { addMenuBackground } from '../render/menuBackground';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

const ITEMS = [
  { label: 'JOGAR', icon: 'bomb', go: 'Setup', data: { screen: 'participants' } },
  { label: 'OPÇÕES', icon: 'speed', go: 'Setup', data: { screen: 'options' } },
  { label: 'RANKING', icon: 'hero', go: 'Ranking', data: {} },
] as const;

/** Menu principal: Jogar (segue pelas telas de configuração), Ranking e Opções. */
export class MenuScene extends Phaser.Scene {
  private selected = 0;
  private buttons: Array<{ box: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image }> = [];
  private arrow!: Phaser.GameObjects.Text;
  private arrowRight!: Phaser.GameObjects.Text;
  private padNav!: PadNav;

  constructor() {
    super({ key: 'Menu' });
  }

  create(): void {
    music.playMenu();
    placeArena(this);
    this.selected = 0;
    addMenuBackground(this);
    const ox = this.cameras.main.scrollX;
    const oy = this.cameras.main.scrollY;
    this.addDecorations(ox, oy);

    // Painel atrás dos botões.
    const panel = this.add.graphics().setDepth(-50);
    panel.fillStyle(0x14163a, 0.5);
    panel.fillRoundedRect(ox + SCREEN_WIDTH / 2 - 330, oy + 345, 660, 440, 36);
    panel.lineStyle(4, 0xffffff, 0.18);
    panel.strokeRoundedRect(ox + SCREEN_WIDTH / 2 - 330, oy + 345, 660, 440, 36);

    const title = this.add
      .text(ox + SCREEN_WIDTH / 2, oy + 170, 'BOMB ARENA', { fontFamily: FONT, fontSize: '112px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 14 })
      .setOrigin(0.5)
      .setShadow(0, 8, '#0b0d26', 0, true, true);
    title.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 520, ease: 'Back.easeOut' });
    this.tweens.add({ targets: title, y: title.y - 8, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 600 });
    this.add.text(ox + SCREEN_WIDTH / 2, oy + 262, 'a batalha de bombas da família', { fontFamily: FONT, fontSize: '28px', fontStyle: 'italic', color: '#e3e7ff', stroke: '#1b1f3b', strokeThickness: 5 }).setOrigin(0.5);

    this.buttons = ITEMS.map((item, index) => {
      const x = ox + SCREEN_WIDTH / 2;
      const y = oy + 430 + index * 120;
      const bg = this.add.graphics();
      const label = this.add.text(18, 0, item.label, { fontFamily: FONT, fontSize: '54px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      const icon = this.add.image(-170, 0, itemTexture(item.icon)).setDisplaySize(62, 62);
      const box = this.add.container(x, y, [bg, icon, label]);
      box.setSize(480, 96);
      box.setInteractive({ useHandCursor: true });
      box.on('pointerover', () => {
        if (this.selected !== index) {
          this.selected = index;
          sfx.play('tick');
          this.render();
        }
      });
      box.on('pointerdown', () => {
        this.selected = index;
        this.confirm();
      });
      return { box, bg, label, icon };
    });
    this.arrow = this.add.text(0, 0, '▶', { fontFamily: FONT, fontSize: '44px', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 5 }).setOrigin(0.5);
    this.arrowRight = this.add.text(0, 0, '◀', { fontFamily: FONT, fontSize: '44px', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 5 }).setOrigin(0.5);
    this.tweens.add({ targets: [this.arrow], x: '+=10', duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add
      .text(ox + SCREEN_WIDTH / 2, oy + SCREEN_HEIGHT - 50, '↑ ↓ escolher     Enter confirmar     Esc voltar     (ou use o controle)', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 })
      .setOrigin(0.5);

    this.bindKeys();
    this.padNav = new PadNav(this);
    this.render();
  }

  /** Enfeites: a turma de corpo inteiro nas laterais, os 7 virtuais e os itens flutuando, e estrelinhas piscando. */
  private addDecorations(ox: number, oy: number): void {
    const bob = (target: Phaser.GameObjects.GameObject, dy: number, duration: number, delay: number): void => {
      this.tweens.add({ targets: target, y: `-=${dy}`, duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay });
    };
    for (let i = 0; i < 30; i++) {
      const star = this.add.text(ox + 30 + ((i * 193) % (SCREEN_WIDTH - 60)), oy + 25 + ((i * 117) % 800), '✦', { fontFamily: FONT, fontSize: `${12 + (i % 4) * 6}px`, color: i % 3 === 0 ? '#ffe66d' : '#ffffff' }).setOrigin(0.5).setAlpha(0.15).setDepth(-60);
      this.tweens.add({ targets: star, alpha: 0.9, scale: 1.3, duration: 700 + (i % 5) * 230, yoyo: true, repeat: -1, delay: (i * 131) % 1500 });
    }
    // A turma: três de cada lado (o Lucas, pequenininho, fica perto dos botões).
    const crew: Array<[string, number, number]> = [
      ['fred', 105, 640], ['vanessa', 255, 690], ['ana-julia', 395, 650],
      ['filippe', 1205, 650], ['waleska', 1345, 690], ['glaucio', 1495, 640],
      ['lucas', 1100, 720],
    ];
    crew.forEach(([id, x, y], index) => {
      const art = addCardArt(this, characterById(id), 0, 0, 52, id === 'lucas' ? 190 : 330);
      art.setPosition(ox + x, oy + y).setDepth(-20).setAlpha(0);
      this.tweens.add({ targets: art, alpha: 1, duration: 400, delay: 150 + index * 110 });
      bob(art, 12, 800 + index * 90, 500 + index * 100);
    });
    // Os 7 virtuais, no alto dos dois lados.
    const blobs = CHARACTERS.filter((c) => !c.custom);
    const places: Array<[number, number]> = [[90, 110], [235, 215], [385, 95], [1215, 95], [1365, 215], [1510, 110], [1480, 330]];
    blobs.forEach((blob, index) => {
      const place = places[index];
      if (!place) return;
      const piece = addCharacter(this, blob, ox + place[0], oy + place[1], 34).setDepth(-20);
      bob(piece, 14, 800 + index * 80, index * 130);
      this.tweens.add({ targets: piece, angle: index % 2 === 0 ? 6 : -6, duration: 1000 + index * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    // Itens (power-ups) girando devagar entre os personagens.
    const spots: Array<[number, number, string]> = [
      [130, 330, 'range'], [290, 400, 'speed'], [60, 470, 'bomb'], [1310, 400, 'vest'], [1470, 470, 'kick'], [1180, 330, 'ghost'], [560, 70, 'hero'], [1040, 70, 'pierce'], [800, 60, 'bomb'],
    ];
    spots.forEach(([x, y, kind], index) => {
      if (!hasItemIcon(this, kind)) return;
      const icon = this.add.image(ox + x, oy + y, itemTexture(kind)).setDisplaySize(54, 54).setDepth(-20);
      bob(icon, 12, 900 + index * 70, index * 110);
      this.tweens.add({ targets: icon, angle: index % 2 === 0 ? 12 : -12, duration: 1200 + index * 60, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
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
    this.buttons.forEach((button, index) => {
      const selected = index === this.selected;
      const { bg, label, box } = button;
      bg.clear();
      bg.fillStyle(0x000000, 0.3);
      bg.fillRoundedRect(-240, -42, 480, 96, 30);
      bg.fillStyle(selected ? 0xffd43b : 0x3b4a9c, 1);
      bg.fillRoundedRect(-240, -48, 480, 96, 30);
      bg.fillStyle(0xffffff, selected ? 0.35 : 0.14);
      bg.fillRoundedRect(-228, -42, 456, 36, 18);
      bg.lineStyle(5, selected ? 0xffffff : 0x1b1f3b, 1);
      bg.strokeRoundedRect(-240, -48, 480, 96, 30);
      label.setColor(selected ? '#2b1d00' : '#ffffff');
      this.tweens.killTweensOf(box);
      box.setScale(selected ? 1.07 : 1);
      if (selected) {
        this.tweens.add({ targets: box, scale: 1.12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.arrow.setPosition(box.x - 290, box.y);
        this.arrowRight.setPosition(box.x + 290, box.y);
      }
    });
  }
}
