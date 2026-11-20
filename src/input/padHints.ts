import type Phaser from 'phaser';

// Dicas de comandos que acompanham o aparelho: com um controle ligado, todas as telas falam dos botões dele (A, B, Start...),
// sem o teclado. Sem controle, mostram as teclas.

/** Há um controle de videogame ligado agora? */
export function padConnected(scene: Phaser.Scene): boolean {
  return (scene.input.gamepad?.total ?? 0) > 0;
}

/** A dica certa para este momento (teclado ou controle). */
export function pickHint(scene: Phaser.Scene, keyboard: string, pad: string): string {
  return padConnected(scene) ? pad : keyboard;
}

/** Liga um texto da tela à dica: troca sozinho quando um controle é ligado ou desligado (confere duas vezes por segundo). */
export function bindPadHint(scene: Phaser.Scene, text: Phaser.GameObjects.Text, keyboard: string, pad: string): void {
  let showing = padConnected(scene);
  text.setText(showing ? pad : keyboard);
  scene.time.addEvent({
    delay: 400,
    loop: true,
    callback: () => {
      const now = padConnected(scene);
      if (now === showing) return;
      showing = now;
      text.setText(now ? pad : keyboard);
    },
  });
}
