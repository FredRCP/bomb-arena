import Phaser from 'phaser';
import type { NavAction } from './padNavLogic';
import { REPEAT_DELAY_MS, REPEAT_RATE_MS } from './padNavLogic';
import { inCircle } from './touchLogic';
import { drawTouchButton, ensureTouchPointers, makeTouchButton } from './touchUi';
import type { TouchButton } from './touchUi';

// Botões na tela para navegar nos menus pelo toque: setas à esquerda, OK e VOLTAR à direita (nos painéis laterais,
// fora da área central). Segurar uma seta repete devagar, como uma tecla.

interface NavButton {
  action: NavAction;
  view: TouchButton;
  repeat: boolean;
}

export class TouchNav {
  private readonly buttons: NavButton[];
  private readonly held = new Map<number, { button: NavButton; nextFire: number }>();
  private readonly queue: NavAction[] = [];
  private lastNow = 0;

  constructor(scene: Phaser.Scene) {
    ensureTouchPointers(scene, 2);
    const make = (action: NavAction, x: number, y: number, r: number, label: string, repeat: boolean, size = 34): NavButton => ({
      action,
      view: makeTouchButton(scene, x, y, r, label, size),
      repeat,
    });
    this.buttons = [
      make('up', 165, 560, 50, '▲', true),
      make('down', 165, 790, 50, '▼', true),
      make('left', 64, 675, 50, '◀', true),
      make('right', 266, 675, 50, '▶', true),
      make('confirm', 1445, 700, 90, 'OK', false, 44),
      make('back', 1445, 540, 56, 'VOLTAR', false, 18),
    ];
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    const button = this.buttons.find((b) => inCircle(pointer.x, pointer.y, b.view.x, b.view.y, b.view.r + 18));
    if (!button) return;
    this.queue.push(button.action);
    drawTouchButton(button.view, true);
    if (button.repeat) this.held.set(pointer.id, { button, nextFire: this.lastNow + REPEAT_DELAY_MS });
    else this.held.set(pointer.id, { button, nextFire: Number.POSITIVE_INFINITY });
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const held = this.held.get(pointer.id);
    if (!held) return;
    drawTouchButton(held.button.view, false);
    this.held.delete(pointer.id);
  }

  /** Ações novas desde a última chamada (chame uma vez por quadro, com o tempo da cena em ms). */
  poll(nowMs: number): NavAction[] {
    this.lastNow = nowMs;
    for (const entry of this.held.values()) {
      while (nowMs >= entry.nextFire) {
        this.queue.push(entry.button.action);
        entry.nextFire += REPEAT_RATE_MS;
      }
    }
    return this.queue.splice(0, this.queue.length);
  }
}
