import { addCharacter, animateSprite, createSpriteView, hasSprites, isSpriteView } from './CharacterView';
import type { CharacterDef } from '../characters/characters';
import Phaser from 'phaser';
import { getCell, inwardDirection, ringCells } from '../core';
import type { Arena, BombState, FlameState, GameState, HazardsState, ItemState, PlayerState } from '../core';
import { iglooCells, pyramidOrigin, pyramidWallCells, sphinxCells } from '../core';
import { COLORS } from './palette';
import { has, loadedBlockVariants, themeById, themeKey } from './theme';
import type { ThemeDef } from './theme';

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

/** Põe uma parede em imagem: base alinhada ao pé da célula, subindo um pouco para cima (visão de frente). */
function addWallImage(scene: Phaser.Scene, theme: ThemeDef, col: number, row: number, depth: number): Phaser.GameObjects.Image {
  const image = scene.add.image((col + 0.5) * TILE_SIZE, (row + 1) * TILE_SIZE - 1, themeKey(theme, 'wall')).setOrigin(0.5, 1).setDepth(depth);
  image.setScale(theme.wallWidth / image.width);
  return image;
}

/**
 * Desenha o piso e as paredes fixas (nada disso muda durante a partida). Com imagens da fase, o piso vira um tabuleiro
 * de duas imagens e cada parede uma imagem; sem elas, o desenho provisório em código.
 */
export function drawArena(scene: Phaser.Scene, arena: Arena, themeId = 'classic', hazards?: HazardsState): Graphics {
  const theme = themeById(themeId);
  const g = scene.add.graphics();
  const floorFull = !!theme.floorFull && has(scene, theme, 'floorFull');
  const floorImages = !floorFull && theme.floors && has(scene, theme, 'floorA') && has(scene, theme, 'floorB');
  if (floorFull) scene.add.image(0, 0, themeKey(theme, 'floorFull')).setOrigin(0, 0).setDisplaySize(arena.cols * TILE_SIZE, arena.rows * TILE_SIZE).setDepth(0);
  const wallImages = theme.wall && has(scene, theme, 'wall');
  const pillarImages = !!theme.pillar && has(scene, theme, 'pillar');
  const sphinxOn = !!theme.sphinx && has(scene, theme, 'sphinx') && !!hazards;
  const glyphs = theme.borderGlyphs ?? 0;
  const glyphImages = glyphs > 0 && has(scene, theme, 'glyph1');
  const pyramidOn = !!theme.pyramid && has(scene, theme, 'pyramid') && !!hazards?.tunnel;
  const iglooOn = !!theme.igloo && has(scene, theme, 'igloo') && !!hazards;
  // Células que ficam sob uma imagem grande (pirâmide, iglu): a parede delas não é desenhada uma a uma.
  const pyramidAt = new Set([
    ...(pyramidOn ? pyramidWallCells(arena.cols, arena.rows) : []),
    ...(iglooOn ? iglooCells(arena.cols, arena.rows) : []),
  ].map((c) => c.row * arena.cols + c.col));
  const sphinxAt = new Set(sphinxOn ? sphinxCells(arena.cols, arena.rows).map((c) => c.row * arena.cols + c.col) : []);

  for (let row = 0; row < arena.rows; row++) {
    for (let col = 0; col < arena.cols; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      if (floorImages) scene.add.image(x + TILE_SIZE / 2, y + TILE_SIZE / 2, themeKey(theme, (col + row) % 2 === 0 ? 'floorA' : 'floorB')).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(0);
      else if (!floorFull) drawFloor(g, x, y, col, row);
      if (getCell(arena, col, row) !== 'wall') continue;
      if (sphinxAt.has(row * arena.cols + col) || pyramidAt.has(row * arena.cols + col)) continue; // imagens grandes, desenhadas depois
      const inner = col > 0 && row > 0 && col < arena.cols - 1 && row < arena.rows - 1;
      if (!inner && glyphImages) {
        // Borda em blocos de hieróglifo (a variação depende só da posição).
        // Alterna os blocos indestrutíveis da fase (maioria) com blocos de hieróglifo (1 a cada 4); só depende da posição.
        const pick = col * 5 + row * 11;
        const glyph = (col + row) % 4 === 0 || !wallImages;
        const key = glyph ? themeKey(theme, `glyph${1 + (pick % glyphs)}`) : themeKey(theme, 'wall');
        const image = scene.add.image((col + 0.5) * TILE_SIZE, (row + 1) * TILE_SIZE - 1, key).setOrigin(0.5, 1).setDepth(6);
        image.setScale(theme.wallWidth / image.width);
        continue;
      }
      // A parede em imagem é mais alta que a célula: fica na frente das chamas e das bombas (depth 6), para o fogo nunca cobri-la.
      if (pillarImages && inner) addPillarImage(scene, theme, col, row, 6);
      else if (wallImages) addWallImage(scene, theme, col, row, 6);
      else drawWall(g, x, y);
    }
  }

  if (pyramidOn) {
    // 5 x 5 células, por cima dos jogadores: quem anda no túnel some enquanto passa por dentro.
    const o = pyramidOrigin(arena.cols, arena.rows);
    scene.add.image((o.col + 2.5) * TILE_SIZE, (o.row + 2.5) * TILE_SIZE, themeKey(theme, 'pyramid')).setDisplaySize(5 * TILE_SIZE, 5 * TILE_SIZE).setDepth(10.5);
  }

  if (iglooOn) {
    // Dois iglus na lateral de cima, simétricos, com a porta para baixo e voltada para o meio (o da esquerda é espelhado).
    const cells = iglooCells(arena.cols, arena.rows); // [esq, esq, dir, dir]
    [{ first: cells[0]!, flip: true }, { first: cells[2]!, flip: false }].forEach(({ first, flip }) => {
      const image = scene.add.image(first.col * TILE_SIZE - 11 + 75, (first.row + 1) * TILE_SIZE, themeKey(theme, 'igloo')).setOrigin(0.5, 1).setDepth(6);
      image.setScale(150 / image.width).setFlipX(flip);
    });
  }

  if (sphinxOn) {
    const centre = sphinxCells(arena.cols, arena.rows)[1]!;
    const image = scene.add.image((centre.col + 0.5) * TILE_SIZE, (centre.row + 1) * TILE_SIZE - 1, themeKey(theme, 'sphinx')).setOrigin(0.5, 1).setDepth(6);
    image.setScale((3 * TILE_SIZE) / image.width);
  }

  if (theme.columns && has(scene, theme, 'column')) {
    // Colunas egípcias nos quatro cantos, com o dobro da altura de um bloco (por cima da borda).
    for (const [col, row] of [[0, 0], [arena.cols - 1, 0], [0, arena.rows - 1], [arena.cols - 1, arena.rows - 1]] as const) {
      const image = scene.add.image((col + 0.5) * TILE_SIZE, (row + 1) * TILE_SIZE - 1, themeKey(theme, 'column')).setOrigin(0.5, 1).setDepth(6.5);
      image.setScale(theme.wallWidth / image.width); // 124 x 248 desenhados em 62 x 124
    }
  }

  if (hazards && theme.quicksand && has(scene, theme, 'quicksand')) {
    for (const index of hazards.quicksand) {
      const col = index % arena.cols;
      const row = Math.floor(index / arena.cols);
      scene.add.image((col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE, themeKey(theme, 'quicksand')).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(0.5);
    }
  }

  g.setDepth(0);
  return g;
}

/** Pilar em imagem (a pirâmide do Egito): base na base da célula, subindo um pouco. */
function addPillarImage(scene: Phaser.Scene, theme: ThemeDef, col: number, row: number, depth: number): Phaser.GameObjects.Image {
  const image = scene.add.image((col + 0.5) * TILE_SIZE, (row + 1) * TILE_SIZE - 1, themeKey(theme, 'pillar')).setOrigin(0.5, 1).setDepth(depth);
  image.setScale((theme.pillarWidth ?? theme.wallWidth) / image.width);
  return image;
}

/** Camada dos blocos destrutíveis. Separada do piso porque blocos somem quando explodem. */
export interface BlocksView {
  scene: Phaser.Scene;
  theme: ThemeDef;
  g: Graphics;
  images: Map<number, Phaser.GameObjects.Image>;
  variants: number;
}

export function createBlocksView(scene: Phaser.Scene, arena: Arena, themeId = 'classic'): BlocksView {
  const g = scene.add.graphics();
  g.setDepth(1);
  const theme = themeById(themeId);
  const view: BlocksView = { scene, theme, g, images: new Map(), variants: loadedBlockVariants(scene, theme) };
  redrawBlocks(view, arena);
  return view;
}

/** Atualiza os blocos: desenha os que ainda existem no estado do core e tira os que sumiram. */
export function redrawBlocks(view: BlocksView, arena: Arena): void {
  view.g.clear();
  for (let row = 0; row < arena.rows; row++) {
    for (let col = 0; col < arena.cols; col++) {
      const index = row * arena.cols + col;
      const isBlock = getCell(arena, col, row) === 'block';
      const image = view.images.get(index);
      if (!isBlock) {
        if (image) {
          image.destroy();
          view.images.delete(index);
        }
      } else if (view.variants > 0) {
        if (!image) {
          // A variação depende só da posição (sem sorteio): o desenho é sempre o mesmo para a mesma célula.
          const variant = 1 + ((col * 7 + row * 13) % view.variants);
          const made = view.scene.add.image((col + 0.5) * TILE_SIZE, (row + 1) * TILE_SIZE - 1, themeKey(view.theme, `block${variant}`)).setOrigin(0.5, 1).setDepth(1);
          made.setScale(view.theme.blockWidth / made.width);
          view.images.set(index, made);
        }
      } else {
        drawBlock(view.g, col * TILE_SIZE, row * TILE_SIZE);
      }
    }
  }
}

/** Camada das paredes que fecham a arena na morte súbita (acima dos blocos e abaixo dos jogadores). */
export interface ClosedView {
  scene: Phaser.Scene;
  theme: ThemeDef;
  g: Graphics;
}

export function createClosedView(scene: Phaser.Scene, themeId = 'classic'): ClosedView {
  const g = scene.add.graphics();
  g.setDepth(8);
  return { scene, theme: themeById(themeId), g };
}

/** Desenha uma parede de morte súbita na célula. */
export function drawClosedWall(view: ClosedView, col: number, row: number): void {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const { scene, theme, g } = view;
  if (theme.floorFull && has(scene, theme, 'floorFull')) {
    // o piso inteiro já está embaixo: nada a acrescentar
  } else if (theme.floors && has(scene, theme, 'floorA') && has(scene, theme, 'floorB')) {
    scene.add.image(x + TILE_SIZE / 2, y + TILE_SIZE / 2, themeKey(theme, (col + row) % 2 === 0 ? 'floorA' : 'floorB')).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(7.5);
  } else {
    drawFloor(g, x, y, col, row);
  }
  if (theme.wall && has(scene, theme, 'wall')) addWallImage(scene, theme, col, row, 8);
  else drawWall(g, x, y);
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
function drawItem(g: Graphics, item: ItemState, tick: number, icon: boolean): void {
  const cx = (item.col + 0.5) * TILE_SIZE;
  const cy = (item.row + 0.5) * TILE_SIZE + Math.sin(tick / 12 + item.col + item.row) * 2.5;

  g.fillStyle(COLORS.shadow, 0.22);
  g.fillEllipse(cx, cy + 22, 34, 9);
  if (!icon) {
    drawItemPlate(g, item.kind, cx, cy);
    return;
  }
  // Com ícone em imagem (ItemSprites.ts) só falta o aro vermelho dos itens ruins.
  if (BAD_KINDS.includes(item.kind)) {
    g.lineStyle(4, 0xe03131, 1);
    g.strokeCircle(cx, cy, 26);
  }
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
export function drawItems(g: Graphics, state: GameState, hasIcon: (kind: ItemState['kind']) => boolean = () => false): void {
  g.clear();
  for (const item of state.items) drawItem(g, item, state.tick, hasIcon(item.kind));
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
    // perfurante: mina marítima (como o ícone do item): corpo azul-marinho com oito pontas
    const spike = 8;
    for (let k = 0; k < 8; k++) {
      const angle = (k * Math.PI) / 4 + Math.PI / 8;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const base = r - 3;
      const tip = r + 8;
      g.fillStyle(0x3b4468);
      g.fillTriangle(cx - uy * spike * 0.5 + ux * base, cy + 3 + ux * spike * 0.5 + uy * base, cx + uy * spike * 0.5 + ux * base, cy + 3 - ux * spike * 0.5 + uy * base, cx + ux * tip, cy + 3 + uy * tip);
      g.fillStyle(0x9aa6cf);
      g.fillCircle(cx + ux * (tip - 1), cy + 3 + uy * (tip - 1), 2.4);
    }
  }
  g.fillStyle(bomb.pierce ? 0x232a45 : COLORS.bombBody);
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

// ---------------------------------------------------------------------------------------------------------------
// Fogo. Cada célula em chamas é um "corpo" de fogo com o contorno ondulando (por isso parece chama, e não um
// quadrado) e quatro camadas de cor, de fora para dentro: vermelho, laranja, amarelo e um miolo quase branco.
// Entre duas células vizinhas em fogo, as bordas se alongam até a vizinha e o fogo vira uma faixa contínua.
// A ondulação depende da posição NO MAPA (e do tempo), não da célula: assim, as bordas de células vizinhas
// combinam e a emenda não aparece.
// ---------------------------------------------------------------------------------------------------------------

const FLAME_LAYERS = [
  { color: 0xd9480f, inset: 3, wobble: 6 },
  { color: 0xff8c1a, inset: 10, wobble: 5 },
  { color: 0xffd43b, inset: 21, wobble: 4 },
  { color: 0xfff9db, inset: 31, wobble: 3 },
] as const;

/** Ondulação suave, de -1 a 1, que muda com o lugar do mapa e com o tempo (o fogo "dança"). */
function fireNoise(wx: number, wy: number, tick: number): number {
  return 0.5 * Math.sin(wx * 0.17 + tick * 0.31 + Math.sin(wy * 0.09 + tick * 0.13) * 2) + 0.5 * Math.sin(wy * 0.15 - tick * 0.27 + wx * 0.06);
}

/** Contorno de uma camada do fogo de uma célula: pontos ao redor, ondulados, alongados para as vizinhas em fogo. */
function flameOutline(cx: number, cy: number, inset: number, wobble: number, tick: number, links: { right: boolean; left: boolean; down: boolean; up: boolean }): Phaser.Types.Math.Vector2Like[] {
  const h = TILE_SIZE / 2 - inset;
  const steps = 6;
  const raw: Array<[number, number]> = [];
  for (let i = 0; i < steps; i++) raw.push([-h + (2 * h * i) / steps, -h]); // em cima, da esquerda para a direita
  for (let i = 0; i < steps; i++) raw.push([h, -h + (2 * h * i) / steps]); // à direita, de cima para baixo
  for (let i = 0; i < steps; i++) raw.push([h - (2 * h * i) / steps, h]); // embaixo, da direita para a esquerda
  for (let i = 0; i < steps; i++) raw.push([-h, h - (2 * h * i) / steps]); // à esquerda, de baixo para cima
  const eps = 1e-6;
  return raw.map(([dx, dy]) => {
    let x = dx;
    let y = dy;
    // Alonga o lado que tem vizinha em fogo: o ponto vai até a borda correspondente da vizinha.
    if (links.right && dx >= h - eps) x += TILE_SIZE;
    if (links.left && dx <= -h + eps) x -= TILE_SIZE;
    if (links.down && dy >= h - eps) y += TILE_SIZE;
    if (links.up && dy <= -h + eps) y -= TILE_SIZE;
    // Ondula para fora (ou para dentro), na direção do ponto em relação ao centro da célula.
    const length = Math.hypot(dx, dy) || 1;
    const push = fireNoise(cx + x, cy + y, tick) * wobble;
    // O fogo nunca passa da célula (nem das vizinhas em fogo): senão a ondulação cobriria as paredes ao lado.
    const half = TILE_SIZE / 2;
    const px = Math.min(Math.max(x + (dx / length) * push, -half - (links.left ? TILE_SIZE : 0)), half + (links.right ? TILE_SIZE : 0));
    const py = Math.min(Math.max(y + (dy / length) * push, -half - (links.up ? TILE_SIZE : 0)), half + (links.down ? TILE_SIZE : 0));
    return { x: cx + px, y: cy + py };
  });
}

/** Desenha todas as chamas: primeiro todo o vermelho, depois o laranja, o amarelo e o miolo (para as camadas não se cruzarem). */
function drawFlames(g: Graphics, flames: readonly FlameState[], tick: number): void {
  if (flames.length === 0) return;
  const byCell = new Map<string, FlameState>();
  for (const flame of flames) byCell.set(`${flame.col},${flame.row}`, flame);
  const has = (col: number, row: number): boolean => byCell.has(`${col},${row}`);
  for (const layer of FLAME_LAYERS) {
    for (const flame of flames) {
      const cx = (flame.col + 0.5) * TILE_SIZE;
      const cy = (flame.row + 0.5) * TILE_SIZE;
      const links = { right: has(flame.col + 1, flame.row), left: has(flame.col - 1, flame.row), down: has(flame.col, flame.row + 1), up: has(flame.col, flame.row - 1) };
      // Esmaece no fim, para dar para ver que a chama está acabando.
      g.fillStyle(layer.color, Math.min(1, flame.ticksLeft / 10));
      g.fillPoints(flameOutline(cx, cy, layer.inset, layer.wobble, tick, links), true);
    }
  }
}

/** Desenha as chamas e as bombas do estado atual. */
export function drawEffects(g: Graphics, state: GameState, spriteFlames = false): void {
  g.clear();
  if (!spriteFlames) drawFlames(g, state.flames, state.tick);
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
    if (isSpriteView(view)) animateSprite(view.scene, view, { x: ring.col, y: ring.row, facing: inwardDirection(arena!, player.sideline!), alive: true }, tick, 'idle');
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
