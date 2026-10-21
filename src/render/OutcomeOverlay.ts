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
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x0b0c1a, 0.62).setDepth(100);

  // Títulos longos ("Jogador 2 venceu a partida!") diminuem a letra para caber na largura da arena.
  const title = scene.add
    .text(width / 2, height / 2 - 40, text.title, {
      fontFamily: FONT,
      fontSize: text.title.length > 18 ? '48px' : '72px',
      fontStyle: 'bold',
      color: TONE_COLORS[text.tone],
      stroke: '#1b1f3b',
      strokeThickness: 8,
    })
    .setOrigin(0.5)
    .setDepth(101);

  const objects: Phaser.GameObjects.GameObject[] = [shade, title];
  const line = (y: number, content: string, size: string): void => {
    objects.push(
      scene.add
        .text(width / 2, y, content, { fontFamily: FONT, fontSize: size, color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 5 })
        .setOrigin(0.5)
        .setDepth(101),
    );
  };
  if (text.subtitle) line(height / 2 + 28, text.subtitle, '36px');
  const lines = text.lines ?? [];
  lines.forEach((content, index) => line(height / 2 + 78 + index * 34, content, '26px'));
  line(height / 2 + 88 + (lines.length > 0 ? lines.length * 34 + 10 : 0), text.hint ?? 'Pressione R para jogar de novo', '26px');
  return objects;
}
