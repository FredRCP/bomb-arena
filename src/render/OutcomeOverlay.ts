import Phaser from 'phaser';
import type { OutcomeText } from './outcomeText';

const TONE_COLORS: Record<OutcomeText['tone'], string> = {
  good: '#ffe66d',
  bad: '#ff8fa3',
  neutral: '#ffffff',
};

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

/**
 * Escurece a arena e mostra um texto no centro: título grande, placar embaixo dele e a dica de teclas.
 * Serve para o resultado da rodada/partida e para a pausa. Devolve os objetos criados (para quem precisar
 * removê-los, como a pausa).
 */
export function showOutcomeOverlay(
  scene: Phaser.Scene,
  width: number,
  height: number,
  text: OutcomeText,
): Phaser.GameObjects.GameObject[] {
  const cx = width / 2;
  const cy = height / 2;
  const lines = text.lines ?? [];
  const panelW = 640;
  const titleH = 110;
  const subtitleH = text.subtitle ? 56 : 0;
  const linesH = lines.length * 44 + (lines.length > 0 ? 16 : 0);
  const hintH = 92;
  const panelH = titleH + subtitleH + linesH + hintH + 24;
  const top = cy - panelH / 2;
  const accent = text.tone === 'good' ? 0xffe66d : text.tone === 'bad' ? 0xff8fa3 : 0xffffff;

  const shade = scene.add.rectangle(cx, cy, width, height, 0x0b0c1a, 0.62).setDepth(100);
  const g = scene.add.graphics().setDepth(100.2);
  g.fillStyle(0x000000, 0.35).fillRoundedRect(cx - panelW / 2 + 6, top + 10, panelW, panelH, 30);
  g.fillStyle(0x1a1d45, 0.97).fillRoundedRect(cx - panelW / 2, top, panelW, panelH, 30);
  g.fillStyle(0x2a2f6b, 1).fillRoundedRect(cx - panelW / 2, top, panelW, titleH, { tl: 30, tr: 30, bl: 0, br: 0 });
  g.fillStyle(accent, 1).fillRoundedRect(cx - 44, top + titleH - 6, 88, 6, 3);
  g.lineStyle(3, 0x5560c8, 1).strokeRoundedRect(cx - panelW / 2, top, panelW, panelH, 30);

  // Títulos longos ("Jogador 2 venceu a partida!") diminuem a letra para caber no cartão.
  const title = scene.add
    .text(cx, top + titleH / 2 - 2, text.title, {
      fontFamily: FONT,
      fontSize: text.title.length > 22 ? '40px' : text.title.length > 14 ? '54px' : '64px',
      fontStyle: 'bold',
      color: TONE_COLORS[text.tone],
      stroke: '#1b1f3b',
      strokeThickness: 7,
    })
    .setOrigin(0.5)
    .setDepth(101);

  const objects: Phaser.GameObjects.GameObject[] = [shade, g, title];
  let y = top + titleH + 14;
  if (text.subtitle) {
    objects.push(scene.add.text(cx, y + 22, text.subtitle, { fontFamily: FONT, fontSize: text.subtitle.length > 34 ? '22px' : text.subtitle.length > 24 ? '27px' : '34px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(101));
    y += subtitleH;
  }
  lines.forEach((content, index) => {
    const rowY = y + index * 44 + 20;
    g.fillStyle(0x252a5c, 0.85).fillRoundedRect(cx - 280, rowY - 18, 560, 36, 18);
    objects.push(scene.add.text(cx, rowY, content, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#e3e7ff' }).setOrigin(0.5).setDepth(101));
  });
  y += linesH;
  const hint = text.hint ?? 'Pressione R para jogar de novo';
  g.fillStyle(0xffe66d, 1).fillRoundedRect(cx - 270, y + 16, 540, 50, 25);
  objects.push(scene.add.text(cx, y + 41, hint, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#1b1f3b' }).setOrigin(0.5).setDepth(101));
  for (const object of objects) (object as Phaser.GameObjects.GameObject & { setAlpha?: (a: number) => unknown }).setAlpha?.(0);
  scene.tweens.add({ targets: objects, alpha: 1, duration: 220 });
  return objects;
}
