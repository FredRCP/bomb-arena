import Phaser from 'phaser';

// Peças de desenho compartilhadas pelos controles por toque (partida e menus).

/** Profundidade acima de tudo (a pausa usa 60 a 90). */
export const TOUCH_DEPTH = 200;

/**
 * Mostrar os controles por toque? Sim em telas de toque "grossas" (celular, tablet). `?touch=1` força ligar e `?touch=0`
 * desligar (para testar no computador).
 */
export function wantsTouchControls(): boolean {
  try {
    const flag = new URLSearchParams(window.location.search).get('touch');
    if (flag === '1') return true;
    if (flag === '0') return false;
    return window.matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
  } catch {
    return false;
  }
}

export interface TouchButton {
  x: number;
  y: number;
  r: number;
  g: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

/** Botão redondo semitransparente, fixo na tela (não acompanha a câmera). */
export function makeTouchButton(scene: Phaser.Scene, x: number, y: number, r: number, label: string, fontSize = 30): TouchButton {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(TOUCH_DEPTH);
  const text = scene.add
    .text(x, y, label, { fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif', fontSize: `${fontSize}px`, fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 5 })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(TOUCH_DEPTH + 1);
  const button: TouchButton = { x, y, r, g, text };
  drawTouchButton(button, false);
  return button;
}

export function drawTouchButton(button: TouchButton, pressed: boolean): void {
  button.g.clear();
  button.g.fillStyle(pressed ? 0xffe66d : 0x1b1f3b, pressed ? 0.6 : 0.4);
  button.g.fillCircle(button.x, button.y, button.r);
  button.g.lineStyle(4, 0xffffff, pressed ? 0.95 : 0.6);
  button.g.strokeCircle(button.x, button.y, button.r);
}

export function setTouchButtonVisible(button: TouchButton, visible: boolean): void {
  button.g.setVisible(visible);
  button.text.setVisible(visible);
}

/** Garante dedos suficientes (o Phaser começa com poucos) sem acumular a cada vez que a cena recomeça. */
export function ensureTouchPointers(scene: Phaser.Scene, total: number): void {
  const missing = total - scene.input.manager.pointersTotal;
  if (missing > 0) scene.input.addPointer(missing);
}
