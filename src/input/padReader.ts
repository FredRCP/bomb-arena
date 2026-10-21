import type Phaser from 'phaser';
import type { PadSnapshot } from './gamepad';

/** Converte um controle do Phaser na "foto" simples usada pelo resto do jogo. Controle ausente = null. */
export function readPad(pad: Phaser.Input.Gamepad.Gamepad | null | undefined): PadSnapshot | null {
  if (!pad || !pad.connected) return null;
  const pressed: boolean[] = [];
  for (let i = 0; i < 17; i++) pressed[i] = (pad.buttons[i]?.pressed ?? false) || (pad.buttons[i]?.value ?? 0) > 0.6;
  return {
    stickX: pad.axes[0]?.getValue() ?? 0,
    stickY: pad.axes[1]?.getValue() ?? 0,
    pressed,
  };
}
