import type Phaser from 'phaser';
import { characterById } from '../characters/characters';
import type { GameState, PlayerId } from '../core';
import { createPlayerView, syncPlayerView } from './ArenaRenderer';

// Sósias da Pipoca: cada uma é um desenho igual ao do dono (mesma imagem, mesmo quique), em cima da posição dela.

export class DecoysView {
  private readonly views = new Map<number, Phaser.GameObjects.Container>();

  constructor(private readonly scene: Phaser.Scene, private readonly characters: Partial<Record<PlayerId, string>>) {}

  /** Apaga todas as sósias (nova rodada). */
  destroy(): void {
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
  }

  update(state: GameState): void {
    const decoys = state.decoys ?? [];
    const live = new Set<number>();
    for (const decoy of decoys) {
      const owner = state.players.find((p) => p.id === decoy.owner);
      if (!owner) continue;
      live.add(decoy.id);
      // O "jogador" da sósia é uma cópia do dono, só que na posição dela: assim ela mostra o mesmo desenho e a mesma animação.
      const ghost = { ...owner, x: decoy.x, y: decoy.y, alive: true };
      let view = this.views.get(decoy.id);
      if (!view) {
        view = createPlayerView(this.scene, ghost, characterById(this.characters[decoy.owner] ?? ''));
        this.views.set(decoy.id, view);
      }
      syncPlayerView(view, ghost, state.arena, state.tick, false);
    }
    for (const [id, view] of [...this.views]) {
      if (live.has(id)) continue;
      view.destroy();
      this.views.delete(id);
    }
  }
}
