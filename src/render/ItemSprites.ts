import Phaser from 'phaser';
import type { GameState, ItemKind } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Ícones dos itens em imagem (public/items/<tipo>.png, desenhados pela Gemini). Item sem imagem usa o desenho
// provisório feito em código; assim dá para trocar um ícone de cada vez.

export const ITEM_KINDS: readonly ItemKind[] = ['bomb', 'range', 'speed', 'kick', 'pierce', 'remote', 'throw', 'ghost', 'invert', 'slow', 'vest', 'hero'];

export const itemTexture = (kind: ItemKind | string): string => `item-${kind}`;

export function preloadItems(scene: Phaser.Scene): void {
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => undefined);
  for (const kind of ITEM_KINDS) scene.load.image(itemTexture(kind), `items/${kind}.png`);
}

export const hasItemIcon = (scene: Phaser.Scene, kind: ItemKind | string): boolean => scene.textures.exists(itemTexture(kind));

/** Os itens que estão no chão, como imagens (com um leve balanço para cima e para baixo). */
export class ItemSprites {
  private readonly pool: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  update(state: GameState): void {
    let used = 0;
    for (const item of state.items) {
      if (!hasItemIcon(this.scene, item.kind)) continue;
      let image = this.pool[used];
      if (!image) {
        image = this.scene.add.image(0, 0, itemTexture(item.kind)).setDepth(3.1);
        this.pool.push(image);
      }
      used++;
      image.setTexture(itemTexture(item.kind)).setVisible(true).setDisplaySize(46, 46);
      image.setPosition((item.col + 0.5) * TILE_SIZE, (item.row + 0.5) * TILE_SIZE + Math.sin(state.tick / 12 + item.col + item.row) * 2.5);
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i]!.setVisible(false);
  }
}
