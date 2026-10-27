import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './render/layout';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { RankingScene } from './scenes/RankingScene';
import { SelectScene } from './scenes/SelectScene';
import { SetupScene } from './scenes/SetupScene';
import { TeamsScene } from './scenes/TeamsScene';
import { TitleScene } from './scenes/TitleScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  // Tamanho lógico = arena + barra superior + painéis laterais (veja render/layout.ts). Tudo cabe numa tela só.
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  backgroundColor: '#3a4fd0',
  // Controles de videogame (Xbox, PlayStation, genéricos): o Phaser os detecta quando algum botão é apertado.
  input: { gamepad: true },
  scale: {
    // FIT: escala para caber na janela mantendo a proporção da tela (sobram faixas escuras, nunca distorce).
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // A primeira cena da lista começa sozinha: a abertura. Ela leva ao menu, às telas de configuração e à partida.
  scene: [TitleScene, MenuScene, SetupScene, SelectScene, TeamsScene, GameScene, RankingScene],
});

// Só na versão publicada (não no `npm run dev`): registra o service worker, que deixa o jogo abrir offline e
// ser instalado como aplicativo. Falha em silêncio (navegador antigo, modo privado, http sem localhost).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

// Celular: depois de girar o aparelho (ou de a barra do navegador aparecer/sumir) o tamanho disponível muda depois do
// evento; recalcula o ajuste da tela algumas vezes para ela sempre ocupar toda a área visível.
const refreshScale = (): void => {
  for (const delay of [50, 250, 700]) window.setTimeout(() => game.scale.refresh(), delay);
};
window.addEventListener('orientationchange', refreshScale);
window.addEventListener('resize', refreshScale);
window.visualViewport?.addEventListener('resize', refreshScale);

// Na primeira toque (só em telas de toque), tenta tela cheia e trava deitado onde o navegador permite
// (Android/Chrome e iPad). O iPhone no Safari não permite: lá vale "Adicionar à Tela de Início".
if (window.matchMedia('(pointer: coarse)').matches) {
  window.addEventListener(
    'pointerdown',
    () => {
      const root = document.documentElement;
      if (document.fullscreenElement || !root.requestFullscreen) return;
      root
        .requestFullscreen()
        .then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
        .catch(() => undefined);
    },
    { once: true },
  );
}
