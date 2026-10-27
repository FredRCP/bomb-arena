import Phaser from 'phaser';
import type { Direction } from '../core';
import type { KeyboardInput } from './keyboardInput';
import { inCircle, stickDirection } from './touchLogic';
import { TOUCH_DEPTH, drawTouchButton, ensureTouchPointers, makeTouchButton, setTouchButtonVisible } from './touchUi';
import type { TouchButton } from './touchUi';

// Controle por toque do Jogador 1 na partida (celular/tablet): alavanca à esquerda, BOMBA e ESPECIAL à direita,
// e um botão de pausa. Cai nas mesmas "intenções" do teclado e do controle de videogame.

const STICK = { x: 165, y: 690, r: 120 };
/** Região da tela em que um toque começa a alavanca (generosa: o dedo não precisa acertar o desenho). */
const STICK_ZONE = { maxX: 330, minY: 250 };

type Role = 'stick' | 'bomb' | 'special' | 'pause' | 'menu';

export class TouchControls {
  private readonly bomb: TouchButton;
  private readonly special: TouchButton;
  private readonly pause: TouchButton;
  private readonly menu: TouchButton;
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Graphics;
  private readonly roles = new Map<number, Role>();
  private direction: Direction | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly input: KeyboardInput,
  ) {
    ensureTouchPointers(scene, 4); // alavanca, bomba, especial e pausa ao mesmo tempo

    this.base = scene.add.graphics().setScrollFactor(0).setDepth(TOUCH_DEPTH);
    this.knob = scene.add.graphics().setScrollFactor(0).setDepth(TOUCH_DEPTH + 1);
    this.drawStick(0, 0, false);

    this.bomb = makeTouchButton(scene, 1445, 700, 95, 'BOMBA', 30);
    this.special = makeTouchButton(scene, 1350, 535, 58, 'ESP.', 24);
    this.pause = makeTouchButton(scene, 1550, 40, 34, 'II', 28);
    this.menu = makeTouchButton(scene, 1445, 40, 34, 'MENU', 18);
    setTouchButtonVisible(this.menu, false);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  /** A cena avisa o estado a cada quadro: com a partida pausada ou a rodada acabada, aparecem "▶" e "MENU". */
  setState(paused: boolean, roundOver: boolean): void {
    const stopped = paused || roundOver;
    this.pause.text.setText(stopped ? '▶' : 'II');
    setTouchButtonVisible(this.menu, stopped);
  }

  private roleAt(x: number, y: number): Role | null {
    if (inCircle(x, y, this.bomb.x, this.bomb.y, this.bomb.r + 25)) return 'bomb';
    if (inCircle(x, y, this.special.x, this.special.y, this.special.r + 20)) return 'special';
    if (inCircle(x, y, this.pause.x, this.pause.y, this.pause.r + 18)) return 'pause';
    if (this.menu.text.visible && inCircle(x, y, this.menu.x, this.menu.y, this.menu.r + 18)) return 'menu';
    if (x <= STICK_ZONE.maxX && y >= STICK_ZONE.minY) return 'stick';
    return null;
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    const role = this.roleAt(pointer.x, pointer.y);
    if (!role) return;
    this.roles.set(pointer.id, role);
    if (role === 'bomb') {
      this.input.touchBomb(1);
      drawTouchButton(this.bomb, true);
    } else if (role === 'special') {
      this.input.touchSpecial(1);
      drawTouchButton(this.special, true);
    } else if (role === 'pause') {
      this.input.touchStart();
    } else if (role === 'menu') {
      this.input.touchQuit();
    } else {
      this.followStick(pointer);
    }
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (this.roles.get(pointer.id) === 'stick') this.followStick(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const role = this.roles.get(pointer.id);
    this.roles.delete(pointer.id);
    if (role === 'bomb') drawTouchButton(this.bomb, false);
    else if (role === 'special') drawTouchButton(this.special, false);
    else if (role === 'stick') {
      this.direction = null;
      this.input.setTouchMove(1, null);
      this.drawStick(0, 0, false);
    }
  }

  private followStick(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - STICK.x;
    const dy = pointer.y - STICK.y;
    this.direction = stickDirection(dx, dy, STICK.r);
    this.input.setTouchMove(1, this.direction);
    const length = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, STICK.r / length);
    this.drawStick(dx * k, dy * k, true);
  }

  private drawStick(dx: number, dy: number, active: boolean): void {
    this.base.clear();
    this.base.fillStyle(0x1b1f3b, 0.35);
    this.base.fillCircle(STICK.x, STICK.y, STICK.r);
    this.base.lineStyle(4, 0xffffff, 0.55);
    this.base.strokeCircle(STICK.x, STICK.y, STICK.r);
    this.knob.clear();
    this.knob.fillStyle(active ? 0xffe66d : 0xffffff, active ? 0.8 : 0.45);
    this.knob.fillCircle(STICK.x + dx, STICK.y + dy, 48);
  }
}
