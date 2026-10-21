import { ARENA_COLS, ARENA_ROWS } from '../config/arena';
import { TILE_SIZE } from './ArenaRenderer';

// Medidas da tela, em pixels lógicos (1600 x 900, a proporção dos monitores). A arena fica no meio; em cima fica uma
// barra fina com os jogadores (nome, pontos e vitórias) e o relógio. Dos lados sobra só o fundo colorido.
//
//   ┌──────── barra superior: jogadores · relógio · jogadores ────────┐
//   │            (fundo)       arena       (fundo)                    │
//   └─────────────────────────────────────────────────────────────────┘
//
// As coordenadas do jogo continuam tendo a arena em (0, 0): a câmera é que desliza a tela
// (`cameras.main.setScroll(-SIDE_WIDTH, -TOP_HEIGHT)`), então a barra e os painéis ficam em coordenadas negativas
// ou além da arena. Assim nada do desenho da arena precisou mudar.

export const ARENA_WIDTH = ARENA_COLS * TILE_SIZE;
export const ARENA_HEIGHT = ARENA_ROWS * TILE_SIZE;
export const SIDE_WIDTH = 320;
export const TOP_HEIGHT = 68;

export const SCREEN_WIDTH = ARENA_WIDTH + 2 * SIDE_WIDTH;
export const SCREEN_HEIGHT = ARENA_HEIGHT + TOP_HEIGHT;

/** Põe a arena no lugar certo da tela. Chame no `create` de toda cena que desenha em coordenadas da arena. */
export function placeArena(scene: { cameras: { main: { setScroll(x: number, y: number): unknown } } }): void {
  scene.cameras.main.setScroll(-SIDE_WIDTH, -TOP_HEIGHT);
}
