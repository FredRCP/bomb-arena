import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './render/layout';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { RankingScene } from './scenes/RankingScene';
import { SelectScene } from './scenes/SelectScene';
import { SetupScene } from './scenes/SetupScene';
import { TeamsScene } from './scenes/TeamsScene';
import { TitleScene } from './scenes/TitleScene';

new Phaser.Game({
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
