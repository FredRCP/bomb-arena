import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { ARENA_COLS, ARENA_ROWS } from '../config/arena';
import { PadNav } from '../input/padNav';
import { TILE_SIZE } from '../render/ArenaRenderer';
import { placeArena } from '../render/layout';
import { addMenuBackground, addPanel } from '../render/menuBackground';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const WIDTH = ARENA_COLS * TILE_SIZE;
const HEIGHT = ARENA_ROWS * TILE_SIZE;

const PAGES = ['Teclado', 'Controle de videogame', 'Celular e tablet'] as const;

/**
 * Opções -> Controles: explica com desenhos as teclas, o controle de videogame e os toques na tela.
 * ← → trocam de página; Esc volta às Opções. As teclas valem de src/input/controls.ts e src/input/gamepad.ts
 * (se mudar um comando lá, mude aqui também).
 */
export class ControlsScene extends Phaser.Scene {
  private page = 0;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private padNav!: PadNav;

  constructor() {
    super({ key: 'Controls' });
  }

  create(): void {
    placeArena(this);
    this.page = 0;
    addMenuBackground(this);
    addPanel(this, WIDTH / 2, 440, WIDTH - 60, 650);
    this.add.text(WIDTH / 2, 70, 'CONTROLES', { fontFamily: FONT, fontSize: '60px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 8 }).setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT - 40, '← → trocar de página     Esc voltar     (ou use o controle)', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard;
    if (keyboard) {
      for (const name of ['LEFT', 'A']) keyboard.addKey(name).on('down', () => this.turn(-1));
      for (const name of ['RIGHT', 'D']) keyboard.addKey(name).on('down', () => this.turn(1));
      for (const name of ['ESC', 'BACKSPACE', 'ENTER']) keyboard.addKey(name).on('down', () => this.back());
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.removeAllKeys(true));
    }
    this.padNav = new PadNav(this);
    this.render();
  }

  update(time: number): void {
    if (!this.padNav) return;
    for (const { action } of this.padNav.poll(time)) {
      if (action === 'left') this.turn(-1);
      else if (action === 'right') this.turn(1);
      else if (action === 'back' || action === 'confirm') this.back();
    }
  }

  private turn(delta: -1 | 1): void {
    this.page = (this.page + delta + PAGES.length) % PAGES.length;
    sfx.play('tick');
    this.render();
  }

  private back(): void {
    sfx.play('tick');
    this.scene.start('Setup', { screen: 'options' });
  }

  // ---- desenho -----------------------------------------------------------------------------------------------

  private text(x: number, y: number, label: string, size = 26, color = '#ffffff', originX = 0.5): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, label, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, align: originX === 0 ? 'left' : 'center', stroke: '#1b1f3b', strokeThickness: 4 }).setOrigin(originX, 0.5);
    this.layer.push(t);
    return t;
  }

  /** Tecla desenhada (cap com sombra e a letra). */
  private key(x: number, y: number, label: string, width = 62, fill = 0xf1f3ff): void {
    const g = this.add.graphics();
    g.fillStyle(0x1b1f3b, 1).fillRoundedRect(x - width / 2, y - 27, width, 62, 10);
    g.fillStyle(fill, 1).fillRoundedRect(x - width / 2 + 2, y - 29, width - 4, 56, 9);
    this.layer.push(g);
    const t = this.add.text(x, y - 3, label, { fontFamily: FONT, fontSize: label.length > 3 ? '22px' : '30px', fontStyle: 'bold', color: '#1b1f3b' }).setOrigin(0.5);
    this.layer.push(t);
  }

  private panelTitle(x: number, y: number, label: string, color: string): void {
    this.text(x, y, label, 34, color);
  }

  private pageKeyboard(): void {
    // Jogador 1
    this.panelTitle(250, 200, 'JOGADOR 1', '#4dabf7');
    this.key(250, 270, 'W');
    this.key(180, 335, 'A');
    this.key(250, 335, 'S');
    this.key(320, 335, 'D');
    this.text(250, 388, 'andar', 24, '#e3e7ff');
    this.key(250, 450, 'Espaço', 210);
    this.text(250, 502, 'bomba', 24, '#e3e7ff');
    this.key(250, 560, 'E');
    this.text(250, 612, 'especial', 24, '#e3e7ff');
    // Jogador 2
    this.panelTitle(710, 200, 'JOGADOR 2', '#ff8fa3');
    this.key(710, 270, '↑');
    this.key(640, 335, '←');
    this.key(710, 335, '↓');
    this.key(780, 335, '→');
    this.text(710, 388, 'andar (ou 8 4 2 6 do teclado numérico)', 21, '#e3e7ff');
    this.key(710, 450, 'Enter', 150);
    this.text(710, 502, 'bomba', 24, '#e3e7ff');
    this.key(710, 560, '9');
    this.text(710, 612, 'especial', 24, '#e3e7ff');
    this.text(WIDTH / 2, 656, 'Especial: detonar bomba-relógio ou arremessar a bomba (com o item).', 21, '#ffe66d');
  }

  private pagePad(): void {
    const cx = WIDTH / 2;
    const g = this.add.graphics();
    this.layer.push(g);
    // Corpo do controle
    g.fillStyle(0x1b1f3b, 1).fillRoundedRect(cx - 230, 200, 460, 230, 90);
    g.fillStyle(0x3b4375, 1).fillRoundedRect(cx - 224, 204, 448, 220, 86);
    // Direcional
    g.fillStyle(0x151833, 1).fillRoundedRect(cx - 170, 292, 100, 32, 8).fillRoundedRect(cx - 136, 258, 32, 100, 8);
    // Alavanca
    g.fillStyle(0x151833, 1).fillCircle(cx - 70, 365, 34);
    g.fillStyle(0x6e78b8, 1).fillCircle(cx - 70, 365, 24);
    // Botões A B X Y
    const face: Array<[number, number, string, number]> = [[cx + 150, 322, 'A', 0x51cf66], [cx + 190, 290, 'B', 0xff6b6b], [cx + 110, 290, 'X', 0x4dabf7], [cx + 150, 258, 'Y', 0xffd43b]];
    for (const [x, y, label, color] of face) {
      g.fillStyle(0x151833, 1).fillCircle(x, y, 22);
      g.fillStyle(color, 1).fillCircle(x, y, 18);
      this.layer.push(this.add.text(x, y, label, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#1b1f3b' }).setOrigin(0.5));
    }
    // Select e Start
    g.fillStyle(0x151833, 1).fillRoundedRect(cx - 42, 238, 30, 12, 6).fillRoundedRect(cx + 12, 238, 30, 12, 6);
    this.text(cx - 27, 222, 'Select', 17, '#c9d1ff');
    this.text(cx + 27, 222, 'Start', 17, '#c9d1ff');

    this.text(cx - 330, 296, 'Direcional ou\nalavanca:\nandar', 24, '#e3e7ff');
    this.text(cx + 340, 296, 'A ou X:\nbomba', 24, '#51cf66');
    this.text(cx + 340, 372, 'B ou Y:\nespecial', 24, '#ff8fa3');
    this.text(cx - 27, 462, 'Select: volta ao menu (com o jogo pausado)', 24, '#e3e7ff');
    this.text(cx + 27, 500, 'Start: pausa e continua', 24, '#e3e7ff');
    this.text(cx, 566, 'O controle 1 comanda o jogador 1, o controle 2 o jogador 2, e assim por diante.', 22, '#ffe66d');
    this.text(cx, 600, 'Jogadores de 3 a 5 só jogam com controle de videogame.', 22, '#ffe66d');
    this.text(cx, 646, 'Nos menus: direcional ou alavanca navegam, A confirma, B volta.', 22, '#e3e7ff');
  }

  private pageTouch(): void {
    const g = this.add.graphics();
    this.layer.push(g);
    // Celular na horizontal
    g.fillStyle(0x1b1f3b, 1).fillRoundedRect(130, 190, 700, 340, 40);
    g.fillStyle(0x3a4fd0, 1).fillRoundedRect(148, 208, 664, 304, 26);
    g.fillStyle(0xffffff, 0.25).fillRoundedRect(330, 250, 300, 220, 12);
    this.text(480, 360, 'a arena', 26, '#e3e7ff');
    // Alavanca virtual
    g.fillStyle(0xffffff, 0.3).fillCircle(235, 420, 52).lineStyle(4, 0xffffff, 0.8).strokeCircle(235, 420, 52);
    g.fillStyle(0xffe66d, 0.9).fillCircle(235, 420, 22);
    // Botões
    g.fillStyle(0xff6b6b, 0.85).fillCircle(725, 430, 44).lineStyle(4, 0xffffff, 0.8).strokeCircle(725, 430, 44);
    g.fillStyle(0xffd43b, 0.85).fillCircle(655, 340, 28).lineStyle(4, 0xffffff, 0.8).strokeCircle(655, 340, 28);
    this.text(725, 430, 'BOMBA', 19, '#ffffff');
    this.text(655, 340, 'ESP.', 17, '#ffffff');
    this.text(745, 236, 'II', 22, '#ffffff');
    this.text(235, 560, 'Arraste o dedo\nno canto esquerdo:\nandar', 22, '#e3e7ff');
    this.text(725, 575, 'Toque para colocar\numa bomba', 22, '#ff8fa3');
    this.text(WIDTH / 2, 622, 'ESP.: especial (detonar ou arremessar).   II: pausa.', 22, '#e3e7ff');
    this.text(WIDTH / 2, 658, 'Arenas grandes (17 colunas ou mais) não aparecem no celular: ficariam pequenas demais.', 21, '#ffe66d');
  }

  private render(): void {
    for (const object of this.layer) object.destroy();
    this.layer = [];
    this.text(WIDTH / 2, 138, `${PAGES[this.page]}   (${this.page + 1}/${PAGES.length})`, 34, '#ffffff');
    // Setas clicáveis (celular/mouse)
    const arrowStyle = { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 6 };
    this.layer.push(
      this.add.text(70, 138, '◀', arrowStyle).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.turn(-1)),
      this.add.text(WIDTH - 70, 138, '▶', arrowStyle).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.turn(1)),
      this.add.text(110, 70, '◀ VOLTAR', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 5 }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.back()),
    );
    if (this.page === 0) this.pageKeyboard();
    else if (this.page === 1) this.pagePad();
    else this.pageTouch();
    this.keysStrip();
  }

  /** Teclas que valem durante a partida, para todos (no pé de todas as páginas). */
  private keysStrip(): void {
    const items: Array<[string, string]> = [['Esc', 'pausa'], ['R', 'reinicia'], ['Q', 'menu'], ['M', 'som']];
    const y = 722;
    let x = 190;
    for (const [label, what] of items) {
      this.key(x, y, label, label.length > 1 ? 70 : 52);
      this.text(x + 44, y, what, 22, '#e3e7ff', 0);
      x += 190;
    }
  }
}
