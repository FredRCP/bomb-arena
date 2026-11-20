import Phaser from 'phaser';
import { MUMMY_WARN_TICKS, MUMMY_WRAP_TICKS } from '../config/hazards';
import type { GameState } from '../core';
import { TILE_SIZE, sphinxBustBox } from './ArenaRenderer';
import { has, themeById, themeKey } from './theme';

// Desenho do evento da múmia (Egito): o sarcófago que treme e abre, a múmia andando, o quadro de "ataque" quando enfaixa alguém,
// o desfazer em ataduras quando uma explosão a pega e o brilho nos olhos da esfinge enquanto o evento está ativo.
// Só desenho; as regras estão em core/mummy.ts. Sem as imagens, nada é desenhado (o evento continua valendo).

const COCOON_HEIGHT = 92; // altura do casulo em pixels (cobre o boneco inteiro)
const ACTION_BOOST = 1.22; // ataque e desmanche são desenhados menores que a caminhada
const MUMMY_HEIGHT = 80; // altura da múmia em pixels (o desenho original é do tamanho de um boneco da arena)
const COFFIN_HEIGHT = 84;
const WALK_FRAME_TICKS = 8;
const ATTACK_TICKS = 45;
const DEATH_MS = 800;

interface Death {
  image: Phaser.GameObjects.Image;
  start: number;
  flip: boolean;
}

export class MummyView {
  private readonly theme = themeById('egypt');
  private readonly body: Phaser.GameObjects.Image;
  private readonly coffin: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly eyes: Phaser.GameObjects.Graphics;
  private readonly deaths: Death[] = [];
  private readonly ready: boolean;
  /** Última direção vertical da caminhada (a imagem de frente/costas continua enquanto ela só parou um instante). */
  private vertical: 'Front' | 'Back' | null = null;
  private readonly cocoons = new Map<number, Phaser.GameObjects.Image>();
  private lastPos: { x: number; y: number; flip: boolean } | null = null;

  constructor(private readonly scene: Phaser.Scene, state: GameState) {
    const t = this.theme;
    this.ready = !!state.hazards?.mummy && has(scene, t, 'mummyWalk1') && has(scene, t, 'coffin1');
    this.shadow = scene.add.graphics().setDepth(9.15);
    this.body = scene.add.image(0, 0, themeKey(t, 'mummyWalk1')).setOrigin(0.5, 1).setDepth(9.2).setVisible(false);
    this.coffin = scene.add.image(0, 0, themeKey(t, 'coffin1')).setOrigin(0.5, 1).setDepth(9.1).setVisible(false);
    this.eyes = scene.add.graphics().setDepth(6.7).setBlendMode(Phaser.BlendModes.ADD);
    if (!this.ready) {
      this.body.setVisible(false);
      this.coffin.setVisible(false);
    }
  }

  update(state: GameState): void {
    const mm = state.hazards?.mummy;
    if (!mm) return;
    this.updateEyes(state);
    if (!this.ready) return;
    this.updateCocoons(state);
    const t = this.theme;
    const tick = state.tick;

    // Sarcófago: fechado (treme) → rachado e brilhando → aberto (a tampa cai ao lado) → some.
    const coffin = mm.coffin;
    if (coffin) {
      let frame = 1;
      let shake = 0;
      let alpha = 1;
      if (coffin.ticks > 0) {
        const left = coffin.ticks;
        frame = left > MUMMY_WARN_TICKS / 2 ? 1 : 2;
        shake = Math.sin(tick * 1.7) * (left > MUMMY_WARN_TICKS / 2 ? 1.2 : 2.6);
      } else {
        frame = 3;
        alpha = Math.min(1, coffin.open / 18);
      }
      const x = (coffin.col + 0.5) * TILE_SIZE + shake;
      const y = (coffin.row + 1) * TILE_SIZE - 4;
      this.coffin.setTexture(themeKey(t, `coffin${frame}`)).setPosition(x, y).setAlpha(alpha).setVisible(true);
      this.coffin.setScale(COFFIN_HEIGHT / this.scene.textures.get(themeKey(t, 'coffin1')).getSourceImage().height);
    } else {
      this.coffin.setVisible(false);
    }

    // Múmia andando (ou "atacando" logo depois de enfaixar alguém).
    const body = mm.mummy;
    this.shadow.clear();
    if (body) {
      const x = body.x * TILE_SIZE;
      const y = body.y * TILE_SIZE + 24;
      const moving = body.tcol !== body.col || body.trow !== body.row;
      const recent = Math.min(...Object.values(mm.wrappedAt).map((at) => tick - (at ?? -9999)), 9999);
      let key: string;
      if (recent < ATTACK_TICKS) key = `mummyAtk${recent < ATTACK_TICKS / 2 ? 2 : 3}`;
      else {
        // Andando para baixo aparece de frente, para cima de costas, para os lados de perfil (com as imagens que existirem).
        const frame = moving ? 1 + (Math.floor(tick / WALK_FRAME_TICKS) % 6) : 1;
        if (body.dy !== 0) this.vertical = body.dy > 0 ? 'Front' : 'Back';
        else if (body.dx !== 0) this.vertical = null;
        const hasVertical = this.vertical !== null && has(this.scene, t, `mummy${this.vertical}1`);
        key = hasVertical ? `mummy${this.vertical}${frame}` : `mummyWalk${frame}`;
      }
      const walkH = this.scene.textures.get(themeKey(t, 'mummyWalk1')).getSourceImage().height;
      this.body.setTexture(themeKey(t, key)).setPosition(x, y).setFlipX(body.facing < 0 && !key.startsWith('mummyFront') && !key.startsWith('mummyBack')).setVisible(true);
      this.body.setScale((MUMMY_HEIGHT / walkH) * (key.startsWith('mummyAtk') ? ACTION_BOOST : 1)); // os quadros de ataque são menores no desenho: ampliados para a cabeça ficar do mesmo tamanho
      this.shadow.fillStyle(0x000000, 0.28).fillEllipse(x, y - 2, 40, 11);
      this.lastPos = { x, y, flip: body.facing < 0 };
    } else {
      this.body.setVisible(false);
      if (this.lastPos) {
        // Desfeita: o desenho se desmancha em ataduras (4 quadros) no lugar em que estava.
        const image = this.scene.add.image(this.lastPos.x, this.lastPos.y, themeKey(t, 'mummyDie1')).setOrigin(0.5, 1).setDepth(9.3).setFlipX(this.lastPos.flip);
        image.setScale((MUMMY_HEIGHT / this.scene.textures.get(themeKey(t, 'mummyWalk1')).getSourceImage().height) * ACTION_BOOST);
        this.deaths.push({ image, start: this.scene.time.now, flip: this.lastPos.flip });
        this.lastPos = null;
      }
    }

    for (const death of [...this.deaths]) {
      const age = (this.scene.time.now - death.start) / DEATH_MS;
      if (age >= 1) {
        death.image.destroy();
        this.deaths.splice(this.deaths.indexOf(death), 1);
        continue;
      }
      death.image.setTexture(themeKey(t, `mummyDie${1 + Math.min(3, Math.floor(age * 4))}`));
      death.image.setAlpha(age > 0.75 ? 1 - (age - 0.75) * 4 : 1);
    }
  }

  /**
   * Casulo sobre quem foi enfaixado: alterna entre o de ataduras e o de teia (pelo instante em que foi pego) e some quando
   * o jogador se solta. Sem as imagens, o contorno de ataduras de Effects.ts continua valendo.
   */
  private updateCocoons(state: GameState): void {
    const t = this.theme;
    const mm = state.hazards?.mummy;
    if (!mm || !has(this.scene, t, 'cocoon1') || !has(this.scene, t, 'cocoon2')) return;
    for (const p of state.players) {
      const wrapAt = mm.wrappedAt[p.id];
      const on = p.alive && wrapAt !== undefined && state.tick - wrapAt <= MUMMY_WRAP_TICKS + 2 && (p.frozenTicks ?? 0) > 0;
      let image = this.cocoons.get(p.id);
      if (!on) {
        image?.setVisible(false);
        continue;
      }
      if (!image) {
        image = this.scene.add.image(0, 0, themeKey(t, 'cocoon1')).setOrigin(0.5, 1).setDepth(10.4);
        this.cocoons.set(p.id, image);
      }
      const key = themeKey(t, `cocoon${1 + (wrapAt! % 2)}`);
      const tex = this.scene.textures.get(key).getSourceImage();
      const shake = (p.frozenTicks ?? 0) < 40 ? Math.sin(state.tick * 1.6) * 2 : 0; // quase solto: o casulo treme
      image.setTexture(key).setScale(COCOON_HEIGHT / tex.height).setPosition(p.x * TILE_SIZE + shake, p.y * TILE_SIZE + 32).setVisible(true);
    }
  }

  /** Os olhos da esfinge acendem (dourado pulsando) quando o sarcófago avisa e enquanto a múmia está em campo. */
  private updateEyes(state: GameState): void {
    const mm = state.hazards?.mummy;
    const g = this.eyes;
    g.clear();
    if (!mm || !has(this.scene, this.theme, 'sphinx')) return;
    const warning = !!mm.coffin && mm.coffin.ticks > 0;
    const active = !!mm.mummy || (!!mm.coffin && mm.coffin.open > 0);
    if (!warning && !active) return;
    const box = sphinxBustBox(state.arena.cols);
    const pulse = 0.55 + 0.45 * Math.sin(state.tick * (warning ? 0.35 : 0.12));
    // Os olhos ficam a ~28,5% da altura do busto, a 41% e 59% da largura.
    const top = box.bottom - box.width * 0.975;
    const y = top + box.width * 0.285;
    for (const dx of [-0.09, 0.09]) {
      const x = box.cx + dx * box.width;
      g.fillStyle(0xffc933, 0.16 * pulse).fillCircle(x, y, 11);
      g.fillStyle(0xffe27a, 0.4 * pulse).fillCircle(x, y, 6);
      g.fillStyle(0xffffff, 0.8 * pulse).fillCircle(x, y, 2.4);
    }
  }
}
