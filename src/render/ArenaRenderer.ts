import { addCharacter, animateSprite, createSpriteView, hasSprites, isSpriteView } from './CharacterView';
import type { CharacterDef } from '../characters/characters';
import Phaser from 'phaser';
import { getCell, ringCells } from '../core';
import type { Arena, BombState, FlameState, GameState, ItemState, PlayerState } from '../core';
import { COLORS } from './palette';

// Aqui só se desenha o que o core já decidiu. Nenhuma regra do jogo mora neste arquivo.

/** Tamanho lógico de cada célula, em pixels. A tela inteira é depois escalada para caber na janela. */
export const TILE_SIZE = 64;

type Graphics = Phaser.GameObjects.Graphics;

function drawFloor(g: Graphics, x: number, y: number, col: number, row: number): void {
  g.fillStyle((col + row) % 2 === 0 ? COLORS.floorA : COLORS.floorB);
  g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
}

function drawWall(g: Graphics, x: number, y: number): void {
  const s = TILE_SIZE;
  g.fillStyle(COLORS.wallShadow);
  g.fillRoundedRect(x + 3, y + 6, s - 6, s - 8, 10);
  g.fillStyle(COLORS.wallFace);
  g.fillRoundedRect(x + 3, y + 3, s - 6, s - 12, 10);
  g.fillStyle(COLORS.wallHighlight, 0.5);
  g.fillRoundedRect(x + 10, y + 9, s - 20, 8, 4);
}

function drawBlock(g: Graphics, x: number, y: number): void {
  const s = TILE_SIZE;
  g.fillStyle(COLORS.blockShadow);
  g.fillRoundedRect(x + 5, y + 8, s - 10, s - 11, 8);
  g.fillStyle(COLORS.blockFace);
  g.fillRoundedRect(x + 5, y + 5, s - 10, s - 14, 8);

  g.lineStyle(3, COLORS.blockLine, 1);
  g.strokeRoundedRect(x + 9, y + 9, s - 18, s - 22, 5);
  g.lineBetween(x + 9, y + 9, x + s - 9, y + s - 13);
  g.lineBetween(x + s - 9, y + 9, x + 9, y + s - 13);
}

/** Desenha o piso e as paredes fixas (imagem estática: nada disso muda durante a partida). */
export function drawArena(scene: Phaser.Scene, arena: Arena): Graphics {
  const g = scene.add.graphics();

  for (let row = 0; row < arena.rows; row++) {
    for (let col = 0; col < arena.cols; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      drawFloor(g, x, y, col, row);
      if (getCell(arena, col, row) === 'wall') drawWall(g, x, y);
    }
  }

  g.setDepth(0);
  return g;
}

/** Camada dos blocos destrutíveis. Separada do piso porque blocos somem quando explodem. */
export function createBlocksView(scene: Phaser.Scene, arena: Arena): Graphics {
  const g = scene.add.graphics();
  g.setDepth(1);
  redrawBlocks(g, arena);
  return g;
}

/** Apaga e redesenha todos os blocos que ainda existem no estado do core. */
export function redrawBlocks(g: Graphics, arena: Arena): void {
  g.clear();
  for (let row = 0; row < arena.rows; row++) {
    for (let col = 0; col < arena.cols; col++) {
      if (getCell(arena, col, row) === 'block') drawBlock(g, col * TILE_SIZE, row * TILE_SIZE);
    }
  }
}

/** Camada das paredes que fecham a arena na morte súbita (acima dos blocos e abaixo dos jogadores). */
export function createClosedView(scene: Phaser.Scene): Graphics {
  const g = scene.add.graphics();
  g.setDepth(8);
  return g;
}

/** Desenha uma parede de morte súbita na célula. */
export function drawClosedWall(g: Graphics, col: number, row: number): void {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  drawFloor(g, x, y, col, row);
  drawWall(g, x, y);
}

/** Camada dos itens no chão (entre os blocos e as bombas). */
export function createItemsView(scene: Phaser.Scene): Graphics {
  const g = scene.add.graphics();
  g.setDepth(3);
  return g;
}

const ITEM_COLORS: Record<ItemState['kind'], number> = {
  bomb: COLORS.itemBomb,
  range: COLORS.itemRange,
  speed: COLORS.itemSpeed,
  kick: 0xf59f00,
  pierce: 0xe03131,
  remote: 0x9c36b5,
  throw: 0x0ca678,
  ghost: 0x868e96,
  invert: 0x7048e8,
  slow: 0x6b5b45,
  vest: 0x1c7ed6,
  hero: 0xf08c00,
};

/** Itens ruins ganham uma moldura vermelha para ninguém pegar sem querer. */
const BAD_KINDS: ReadonlyArray<ItemState['kind']> = ['invert', 'slow'];

/** Desenha um item: uma plaquinha clara com o símbolo do tipo, que "flutua" de leve. */
function drawItem(g: Graphics, item: ItemState, tick: number): void {
  const cx = (item.col + 0.5) * TILE_SIZE;
  const cy = (item.row + 0.5) * TILE_SIZE + Math.sin(tick / 12 + item.col + item.row) * 2.5;

  g.fillStyle(COLORS.shadow, 0.22);
  g.fillEllipse(cx, cy + 22, 34, 9);
  drawItemPlate(g, item.kind, cx, cy);
}

/** O símbolo de cada tipo de item (sem a plaquinha). Também usado pelos painéis laterais, para combinar com o que está no chão. */
export function drawItemSymbol(g: Graphics, kind: ItemState['kind'], cx: number, cy: number): void {
  const color = ITEM_COLORS[kind];
  g.fillStyle(color);
  g.lineStyle(4, color, 1);
  if (kind === 'bomb') {
    // bomba pequena com um "+"
    g.fillCircle(cx - 2, cy + 3, 9);
    g.lineBetween(cx + 6, cy - 8, cx + 6, cy - 2);
    g.lineBetween(cx + 3, cy - 5, cx + 9, cy - 5);
  } else if (kind === 'range') {
    // chama: gota apontada para cima
    g.fillTriangle(cx, cy - 13, cx - 9, cy + 4, cx + 9, cy + 4);
    g.fillCircle(cx, cy + 5, 9);
  } else if (kind === 'speed') {
    // raio
    g.fillTriangle(cx + 3, cy - 14, cx - 8, cy + 2, cx + 1, cy + 2);
    g.fillTriangle(cx - 3, cy + 14, cx + 8, cy - 2, cx - 1, cy - 2);
  } else if (kind === 'kick') {
    // bomba com uma seta empurrando
    g.fillCircle(cx + 5, cy + 2, 8);
    g.lineBetween(cx - 14, cy + 2, cx - 4, cy + 2);
    g.fillTriangle(cx - 4, cy - 5, cx - 4, cy + 9, cx + 1, cy + 2);
  } else if (kind === 'pierce') {
    // flecha atravessando um bloco
    g.fillRect(cx - 4, cy - 10, 8, 20);
    g.lineStyle(4, COLORS.itemPlate, 1);
    g.lineBetween(cx - 15, cy, cx + 12, cy);
    g.fillStyle(color);
    g.fillTriangle(cx + 15, cy, cx + 8, cy - 7, cx + 8, cy + 7);
  } else if (kind === 'remote') {
    // controle com botão: caixinha e um botão redondo claro
    g.fillRoundedRect(cx - 11, cy - 4, 22, 16, 4);
    g.fillStyle(COLORS.itemPlate);
    g.fillCircle(cx, cy + 4, 4);
    g.fillStyle(color);
    g.lineBetween(cx, cy - 4, cx, cy - 12);
    g.fillCircle(cx, cy - 13, 3);
  } else if (kind === 'throw') {
    // arco de arremesso com seta
    g.beginPath();
    g.arc(cx, cy + 8, 13, Math.PI * 1.1, Math.PI * 1.9, false);
    g.strokePath();
    g.fillCircle(cx - 12, cy + 4, 4);
    g.fillTriangle(cx + 14, cy + 6, cx + 6, cy + 3, cx + 12, cy - 3);
  } else if (kind === 'invert') {
    // setas trocadas: uma para cada lado, uma contra a outra
    g.lineBetween(cx - 12, cy - 6, cx + 8, cy - 6);
    g.fillTriangle(cx + 14, cy - 6, cx + 6, cy - 12, cx + 6, cy);
    g.lineBetween(cx + 12, cy + 7, cx - 8, cy + 7);
    g.fillTriangle(cx - 14, cy + 7, cx - 6, cy + 1, cx - 6, cy + 13);
  } else if (kind === 'slow') {
    // pedra: polígono irregular com uma seta para baixo
    g.fillPoints(
      [
        new Phaser.Math.Vector2(cx - 12, cy + 8),
        new Phaser.Math.Vector2(cx - 9, cy - 5),
        new Phaser.Math.Vector2(cx, cy - 11),
        new Phaser.Math.Vector2(cx + 10, cy - 4),
        new Phaser.Math.Vector2(cx + 12, cy + 8),
      ],
      true,
    );
    g.fillStyle(COLORS.itemPlate);
    g.fillRect(cx - 2, cy - 4, 4, 8);
    g.fillTriangle(cx - 6, cy + 4, cx + 6, cy + 4, cx, cy + 11);
  } else if (kind === 'vest') {
    // colete/escudo: brasão com uma faixa clara no meio
    g.fillPoints(
      [
        new Phaser.Math.Vector2(cx - 12, cy - 11),
        new Phaser.Math.Vector2(cx + 12, cy - 11),
        new Phaser.Math.Vector2(cx + 12, cy + 2),
        new Phaser.Math.Vector2(cx, cy + 14),
        new Phaser.Math.Vector2(cx - 12, cy + 2),
      ],
      true,
    );
    g.fillStyle(COLORS.itemPlate);
    g.fillRect(cx - 2.5, cy - 7, 5, 15);
    g.fillRect(cx - 8, cy - 3, 16, 5);
  } else if (kind === 'hero') {
    // estrela de cinco pontas
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? 14 : 6;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      points.push(new Phaser.Math.Vector2(cx + Math.cos(angle) * radius, cy + 1 + Math.sin(angle) * radius));
    }
    g.fillPoints(points, true);
  } else {
    // fantasma
    g.fillCircle(cx, cy - 3, 10);
    g.fillRect(cx - 10, cy - 3, 20, 13);
    g.fillStyle(COLORS.itemPlate);
    g.fillCircle(cx - 4, cy - 4, 2.5);
    g.fillCircle(cx + 4, cy - 4, 2.5);
    g.fillTriangle(cx - 10, cy + 10, cx - 5, cy + 10, cx - 7.5, cy + 5);
    g.fillTriangle(cx - 2.5, cy + 10, cx + 2.5, cy + 10, cx, cy + 5);
    g.fillTriangle(cx + 5, cy + 10, cx + 10, cy + 10, cx + 7.5, cy + 5);
  }
}

/** A plaquinha clara com o símbolo, no tamanho do item do chão (usada nos painéis laterais). */
export function drawItemPlate(g: Graphics, kind: ItemState['kind'], cx: number, cy: number): void {
  const color = BAD_KINDS.includes(kind) ? 0xe03131 : ITEM_COLORS[kind];
  g.fillStyle(color);
  g.fillRoundedRect(cx - 21, cy - 21, 42, 42, 11);
  g.fillStyle(COLORS.itemPlate);
  g.fillRoundedRect(cx - 17, cy - 17, 34, 34, 8);
  drawItemSymbol(g, kind, cx, cy);
}

/** Redesenha os itens que estão no chão. */
export function drawItems(g: Graphics, state: GameState): void {
  g.clear();
  for (const item of state.items) drawItem(g, item, state.tick);
}

/** Camada de bombas e chamas, redesenhada do zero a cada passo (poucos objetos, custo desprezível). */
export function createEffectsView(scene: Phaser.Scene): Graphics {
  const g = scene.add.graphics();
  g.setDepth(5);
  return g;
}

function drawBomb(g: Graphics, bomb: BombState, tick: number): void {
  const cx = (bomb.col + 0.5) * TILE_SIZE;
  const cy = (bomb.row + 0.5) * TILE_SIZE;

  // A bomba "pulsa" e pulsa mais rápido quando falta pouco para explodir.
  const urgency = bomb.ticksLeft < 60 ? 3 : 1;
  const pulse = 1 + 0.07 * Math.sin((tick / 7) * urgency);
  const r = 22 * pulse;

  g.fillStyle(COLORS.shadow, 0.25);
  g.fillEllipse(cx, cy + 20, 40, 12);
  if (bomb.pierce) {
    // perfurante: aro laranja em volta
    g.lineStyle(4, 0xe03131, 1);
    g.strokeCircle(cx, cy + 3, r + 4);
  }
  g.fillStyle(COLORS.bombBody);
  g.fillCircle(cx, cy + 3, r);
  if (bomb.remote) {
    // bomba-relógio: luz roxa piscando no meio
    g.fillStyle(tick % 30 < 15 ? 0xd0a0ff : 0x9c36b5);
    g.fillCircle(cx, cy + 5, 6);
  }
  g.fillStyle(COLORS.bombHighlight, 0.6);
  g.fillCircle(cx - 8, cy - 6, 6);

  // Pavio com uma faísca que pisca.
  g.lineStyle(4, COLORS.bombFuse, 1);
  g.lineBetween(cx + 6, cy - r + 6, cx + 14, cy - r - 4);
  g.fillStyle(COLORS.bombSpark);
  g.fillCircle(cx + 15, cy - r - 6, tick % 8 < 4 ? 5 : 3);
}

function drawFlame(g: Graphics, flame: FlameState): void {
  const x = flame.col * TILE_SIZE;
  const y = flame.row * TILE_SIZE;
  // Esmaece no fim, para dar para ver que a chama está acabando.
  const alpha = Math.min(1, flame.ticksLeft / 10);

  g.fillStyle(COLORS.flameOuter, 0.9 * alpha);
  g.fillRoundedRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8, 14);
  g.fillStyle(COLORS.flameInner, alpha);
  g.fillRoundedRect(x + 16, y + 16, TILE_SIZE - 32, TILE_SIZE - 32, 8);
}

/** Desenha as chamas e as bombas do estado atual. */
export function drawEffects(g: Graphics, state: GameState): void {
  g.clear();
  for (const flame of state.flames) drawFlame(g, flame);
  for (const bomb of state.bombs) drawBomb(g, bomb, state.tick);
  // Em equipes, um anel fino na cor do time embaixo de cada jogador (azul = time 1, vermelho = time 2).
  const teamGame = state.players.some((a) => state.players.some((b) => b.id !== a.id && b.team === a.team));
  if (teamGame) {
    for (const player of state.players) {
      if (!player.alive || player.sideline !== null) continue;
      // Só quem tem aliado ganha anel (quem joga sem time fica sem).
      if (!state.players.some((other) => other.id !== player.id && other.team === player.team)) continue;
      g.lineStyle(4, player.team === 1 ? 0x4dabf7 : 0xff6b6b, 1);
      g.strokeCircle(player.x * TILE_SIZE, player.y * TILE_SIZE, 29);
    }
  }
  // Auras: colete = anel branco; super-herói = brilho dourado que pulsa (pisca nos últimos 2 segundos).
  for (const player of state.players) {
    if (!player.alive || player.sideline !== null) continue;
    const px = player.x * TILE_SIZE;
    const py = player.y * TILE_SIZE;
    if (player.heroTicks > 0 && (player.heroTicks > 120 || state.tick % 12 < 8)) {
      const pulse = 1 + Math.sin(state.tick / 6) * 0.08;
      g.fillStyle(0xffd43b, 0.28);
      g.fillCircle(px, py, 38 * pulse);
      g.lineStyle(3, 0xffd43b, 0.9);
      g.strokeCircle(px, py, 38 * pulse);
    }
    if (player.vest) {
      g.lineStyle(3, 0xffffff, 0.95);
      g.strokeCircle(px, py, 34);
    }
  }
}

/** Qualquer coisa que se move e se esconde (o desenho do jogador é um Container). */
type Movable = { setPosition(x: number, y: number): unknown; setVisible(value: boolean): unknown; setAlpha(value: number): unknown };

/** Posiciona o desenho do jogador conforme o estado do core (que usa unidades de célula). */
export function syncPlayerView(view: Movable, player: PlayerState, arena?: Arena, tick = 0, celebrate = false): void {
  // Quem foi eliminado e joga das laterais aparece sobre a casa do anel de borda, meio transparente.
  const ring = player.sideline !== null && arena ? ringCells(arena)[player.sideline] : undefined;
  if (ring) {
    view.setPosition((ring.col + 0.5) * TILE_SIZE, (ring.row + 0.5) * TILE_SIZE);
    view.setVisible(true);
    view.setAlpha(0.6);
    // Personagem de corpo inteiro: quem está nas laterais fica sempre em pé, olhando para a arena.
    if (isSpriteView(view)) animateSprite(view.scene, view, { x: ring.col, y: ring.row, facing: player.facing, alive: true }, tick, 'idle');
    return;
  }
  view.setPosition(player.x * TILE_SIZE, player.y * TILE_SIZE);
  // Personagem de corpo inteiro: a pose (andando, bomba, vitória, derrota) vem do animateSprite, que também decide quando some.
  if (isSpriteView(view)) {
    view.setVisible(animateSprite(view.scene, view, player, tick, celebrate ? 'win' : 'play'));
    if (player.shieldTicks > 0) view.setAlpha(tick % 10 < 5 ? 0.35 : 1);
    else view.setAlpha(player.ghostTicks > 0 ? 0.5 : 1);
    return;
  }
  // Quem foi atingido some; o resultado da rodada aparece pela tela de resultado.
  view.setVisible(player.alive);
  // Fantasma (atravessando blocos): meio transparente. Recém-voltado à arena (proteção): pisca.
  if (player.shieldTicks > 0) view.setAlpha(tick % 10 < 5 ? 0.35 : 1);
  else view.setAlpha(player.ghostTicks > 0 ? 0.5 : 1);
}

/** Cria o desenho do jogador (o personagem escolhido) já na posição correta. */
export function createPlayerView(scene: Phaser.Scene, player: PlayerState, character: CharacterDef): Phaser.GameObjects.Container {
  const view = hasSprites(scene, character) ? createSpriteView(scene, character, 0, 0) : addCharacter(scene, character, 0, 0, 27);
  view.setDepth(10);
  syncPlayerView(view, player);
  return view;
}
