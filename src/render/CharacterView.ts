import Phaser from 'phaser';
import { CHARACTERS, characterImagePath, spriteImagePath } from '../characters/characters';
import { LOSE_VISIBLE_TICKS, MOVING_GRACE_TICKS, WALK_CYCLE_TILES, SPRITE_EXTRAS, SPRITE_POSES, BOMB_POSE_TICKS, chooseSpriteFrame, loseAlpha } from '../characters/poses';
import type { Direction } from '../core/types';
import type { CharacterDef } from '../characters/characters';
import { COLORS } from './palette';

const textureKey = (character: CharacterDef): string => `char-${character.id}`;

/**
 * Pede ao Phaser as imagens dos personagens caricatura (public/characters/<id>.png). Chame no `preload` da
 * primeira cena. Imagem que não existe é simplesmente ignorada: o personagem usa o desenho provisório.
 */
export function preloadCharacters(scene: Phaser.Scene): void {
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => undefined);
  for (const character of CHARACTERS) {
    if (!character.custom) continue;
    scene.load.image(textureKey(character), characterImagePath(character)); // com sprites, é o rosto normal
    if (!character.sprites) continue;
    for (const name of [...SPRITE_POSES, ...SPRITE_EXTRAS.filter((extra) => extra !== 'face')]) {
      scene.load.image(`${textureKey(character)}-${name}`, spriteImagePath(character, name));
    }
  }
}

/** O personagem tem a arte de corpo inteiro carregada (e não só o desenho provisório)? */
export function hasSprites(scene: Phaser.Scene, character: CharacterDef): boolean {
  return !!character.sprites && scene.textures.exists(`${textureKey(character)}-idle-down`);
}

function drawHat(g: Phaser.GameObjects.Graphics, hat: CharacterDef['hat'], r: number, accent: number): void {
  g.fillStyle(accent);
  g.lineStyle(Math.max(2, r * 0.1), accent, 1);
  switch (hat) {
    case 'antenna':
      g.lineBetween(0, -r * 0.9, 0, -r * 1.35);
      g.fillCircle(0, -r * 1.4, r * 0.16);
      break;
    case 'horns':
      g.fillTriangle(-r * 0.7, -r * 0.55, -r * 0.35, -r * 0.95, -r * 0.2, -r * 0.8);
      g.fillTriangle(r * 0.7, -r * 0.55, r * 0.35, -r * 0.95, r * 0.2, -r * 0.8);
      break;
    case 'leaf':
      g.fillEllipse(r * 0.15, -r * 1.1, r * 0.55, r * 0.3);
      g.lineBetween(0, -r * 0.9, r * 0.1, -r * 1.05);
      break;
    case 'crown':
      g.fillRect(-r * 0.5, -r * 1.05, r, r * 0.3);
      g.fillTriangle(-r * 0.5, -r * 1.05, -r * 0.35, -r * 1.4, -r * 0.15, -r * 1.05);
      g.fillTriangle(-r * 0.15, -r * 1.05, 0, -r * 1.5, r * 0.15, -r * 1.05);
      g.fillTriangle(r * 0.15, -r * 1.05, r * 0.35, -r * 1.4, r * 0.5, -r * 1.05);
      break;
    case 'cap':
      g.fillEllipse(0, -r * 0.85, r * 1.5, r * 0.8);
      g.fillRect(-r * 0.1, -r * 0.6, r * 1.1, r * 0.18);
      break;
    case 'bow':
      g.fillTriangle(-r * 0.15, -r * 0.95, -r * 0.7, -r * 1.2, -r * 0.7, -r * 0.7);
      g.fillTriangle(r * 0.15, -r * 0.95, r * 0.7, -r * 1.2, r * 0.7, -r * 0.7);
      g.fillCircle(0, -r * 0.95, r * 0.16);
      break;
    case 'headband':
      g.fillRect(-r * 0.95, -r * 0.55, r * 1.9, r * 0.22);
      break;
    case 'flower':
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        g.fillCircle(r * 0.55 + Math.cos(angle) * r * 0.2, -r * 0.8 + Math.sin(angle) * r * 0.2, r * 0.13);
      }
      g.fillStyle(0xffe66d);
      g.fillCircle(r * 0.55, -r * 0.8, r * 0.1);
      break;
    case 'star': {
      // Estrelinha de cinco pontas no alto da cabeça.
      const cy = -r * 1.15;
      const points: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r * 0.36 : r * 0.15;
        const angle = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        points.push({ x: Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
      }
      g.fillPoints(points, true);
      break;
    }
    case 'ears':
      // Orelhas de gato.
      g.fillTriangle(-r * 0.75, -r * 0.5, -r * 0.65, -r * 1.1, -r * 0.2, -r * 0.85);
      g.fillTriangle(r * 0.75, -r * 0.5, r * 0.65, -r * 1.1, r * 0.2, -r * 0.85);
      break;
    case 'tuft':
      // Topete de cabelo.
      g.fillTriangle(-r * 0.3, -r * 0.88, -r * 0.2, -r * 1.35, r * 0.0, -r * 0.92);
      g.fillTriangle(-r * 0.1, -r * 0.92, r * 0.1, -r * 1.45, r * 0.3, -r * 0.9);
      g.fillTriangle(r * 0.15, -r * 0.9, r * 0.38, -r * 1.25, r * 0.45, -r * 0.8);
      break;
    case 'none':
      break;
  }
}

/** Escurece uma cor (para o acessório contrastar com o corpo). */
function darker(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (Math.floor(r * 0.6) << 16) | (Math.floor(g * 0.6) << 8) | Math.floor(b * 0.6);
}

/**
 * Cria o desenho de um personagem centrado em (x, y), com `radius` de raio. Usa a imagem do personagem se ela
 * foi carregada; senão, o desenho provisório (cabeça redonda com olhos, acessório e, nos da família, a inicial).
 * Devolve um Container: dá para mover, esconder e trocar a profundidade como qualquer objeto.
 */
export function addCharacter(scene: Phaser.Scene, character: CharacterDef, x: number, y: number, radius: number): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const shadow = scene.add.graphics();
  shadow.fillStyle(COLORS.shadow, 0.25);
  shadow.fillEllipse(0, radius * 0.8, radius * 1.55, radius * 0.46);
  parts.push(shadow);

  const key = textureKey(character);
  if (character.custom && scene.textures.exists(key) && scene.textures.get(key).key !== '__MISSING') {
    const image = scene.add.image(0, -radius * 0.1, key);
    image.setScale((radius * 2.4) / Math.max(image.width, image.height));
    image.setData('faceBase', { width: image.width, height: image.height, scale: image.scaleX });
    parts.push(image);
  } else {
    const g = scene.add.graphics();
    g.fillStyle(character.color);
    g.fillCircle(0, 0, radius);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(-radius * 0.35, -radius * 0.45, radius * 0.3);
    drawHat(g, character.hat, radius, darker(character.color));
    if (character.custom) {
      parts.push(g);
      parts.push(
        scene.add
          .text(0, radius * 0.25, character.name.charAt(0), { fontFamily: 'system-ui, sans-serif', fontSize: `${Math.round(radius * 1.05)}px`, fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: Math.max(2, radius * 0.12) })
          .setOrigin(0.5),
      );
    } else {
      g.fillStyle(COLORS.playerEye);
      g.fillCircle(-radius * 0.31, -radius * 0.08, radius * 0.23);
      g.fillCircle(radius * 0.31, -radius * 0.08, radius * 0.23);
      g.fillStyle(COLORS.playerPupil);
      g.fillCircle(-radius * 0.27, -radius * 0.04, radius * 0.11);
      g.fillCircle(radius * 0.35, -radius * 0.04, radius * 0.11);
      parts.push(g);
    }
  }
  const container = scene.add.container(x, y, parts);
  container.setData('faceCharacter', character.id);
  return container;
}

/** Troca a expressão do rosto (normal, feliz, triste) de um personagem desenhado por addCharacter, se houver a imagem. */
export function setFace(scene: Phaser.Scene, view: Phaser.GameObjects.Container, mood: 'normal' | 'happy' | 'sad'): void {
  const id = view.getData('faceCharacter') as string | undefined;
  const image = view.list.find((part): part is Phaser.GameObjects.Image => part instanceof Phaser.GameObjects.Image);
  if (!id || !image) return;
  const key = mood === 'normal' ? `char-${id}` : `char-${id}-face-${mood}`;
  if (!scene.textures.exists(key) || image.texture.key === key) return;
  const base = image.getData('faceBase') as { height: number; scale: number } | undefined;
  image.setTexture(key);
  if (base) image.setScale((base.height * base.scale) / image.height); // mantém a mesma altura na tela
}

/** Desenho grande para o cartão da escolha de personagem: a arte do personagem (se houver) ou o rosto/desenho provisório. */
export function addCardArt(scene: Phaser.Scene, character: CharacterDef, x: number, y: number, radius: number, artHeight: number): Phaser.GameObjects.Container {
  const key = `${textureKey(character)}-art`;
  if (character.sprites && scene.textures.exists(key)) {
    const image = scene.add.image(0, 0, key);
    image.setScale(artHeight / image.height);
    return scene.add.container(x, y, [image]);
  }
  return addCharacter(scene, character, x, y, radius);
}

// ---------- Personagens com corpo inteiro (sprites) ----------

/** Altura em que o corpo parado é desenhado na arena (a casa tem 64 px: a cabeça passa um pouco para cima, como em jogos de arena). */
const SPRITE_BODY_HEIGHT = 88;
/** Quanto os pés ficam abaixo do centro da casa. */
const SPRITE_FEET_OFFSET = 30;

interface SpriteData {
  id: string;
  image: Phaser.GameObjects.Image;
  pose: string | null;
  /** Escala fixa (calculada na pose parada), para todas as poses terem o mesmo tamanho de traço. */
  scale: number;
  lastX: number;
  lastY: number;
  lastMoveTick: number;
  /** Ciclos de corrida acumulados pela distância andada (0 quando começa a andar). */
  walkPhase: number;
  bombUntil: number;
  deadTicks: number;
}

/** Cria o personagem de corpo inteiro da arena, centrado em (x, y), com pés na base da casa. */
/** Distância de um ciclo de corrida. O endereço pode trazer ?cycle=NUMERO só para testar o ritmo dos passos. */
let cachedCycle: number | null = null;
/** Diagnóstico (?debug=1): última pose de corrida escolhida e o ritmo usado, para conferir na máquina de quem joga. */
export const spriteDebug = { text: '' };
function walkCycleTiles(): number {
  if (cachedCycle !== null) return cachedCycle;
  cachedCycle = WALK_CYCLE_TILES;
  try {
    const value = Number(new URLSearchParams(window.location.search).get('cycle'));
    if (value >= 0.3 && value <= 6) cachedCycle = value;
  } catch {
    /* sem endereço (testes): usa o padrão */
  }
  return cachedCycle;
}

export function createSpriteView(scene: Phaser.Scene, character: CharacterDef, x: number, y: number): Phaser.GameObjects.Container {
  const shadow = scene.add.graphics();
  shadow.fillStyle(COLORS.shadow, 0.25);
  shadow.fillEllipse(0, SPRITE_FEET_OFFSET - 2, 40, 13);
  const image = scene.add.image(0, SPRITE_FEET_OFFSET, `${textureKey(character)}-idle-down`).setOrigin(0.5, 1);
  const scale = (SPRITE_BODY_HEIGHT * (character.spriteScale ?? 1)) / image.height;
  image.setScale(scale);
  const container = scene.add.container(x, y, [shadow, image]);
  const data: SpriteData = { id: character.id, image, pose: 'idle-down', scale, lastX: Number.NaN, lastY: Number.NaN, lastMoveTick: -100, walkPhase: 0, bombUntil: -1, deadTicks: 0 };
  container.setData('sprite', data);
  return container;
}

export function isSpriteView(view: unknown): view is Phaser.GameObjects.Container {
  return view instanceof Phaser.GameObjects.Container && view.getData('sprite') !== undefined;
}

/** Marca que o jogador acabou de colocar uma bomba (mostra a pose por alguns passos). */
export function triggerBombPose(view: unknown, tick: number): void {
  if (!isSpriteView(view)) return;
  (view.getData('sprite') as SpriteData).bombUntil = tick + BOMB_POSE_TICKS;
}

export interface SpritePlayer {
  x: number;
  y: number;
  facing: Direction;
  alive: boolean;
}

/**
 * Atualiza a pose do personagem de corpo inteiro. Devolve se ele deve continuar visível (quem foi eliminado
 * fica deitado na pose de derrota por um instante e some).
 */
export function animateSprite(scene: Phaser.Scene, view: Phaser.GameObjects.Container, player: SpritePlayer, tick: number, mode: 'play' | 'idle' | 'win'): boolean {
  const data = view.getData('sprite') as SpriteData;
  const dx = player.x - data.lastX;
  const dy = player.y - data.lastY;
  const distance = Math.hypot(dx, dy);
  const moved = distance > 0.001 && !Number.isNaN(data.lastX);
  const wasMoving = tick - data.lastMoveTick <= MOVING_GRACE_TICKS;
  if (moved) {
    data.lastMoveTick = tick;
    data.bombUntil = -1; // saiu andando: some a pose de colocar bomba (senão ele corre "carregando" a bomba)
    if (!wasMoving) data.walkPhase = 0; // recomeça sempre no primeiro quadro (pé no chão)
    if (distance < 1) data.walkPhase += distance / walkCycleTiles(); // saltos grandes (volta à arena) não contam
  }
  data.lastX = player.x;
  data.lastY = player.y;
  const dead = mode === 'play' && !player.alive;
  data.deadTicks = dead ? data.deadTicks + 1 : 0;
  const moving = tick - data.lastMoveTick <= MOVING_GRACE_TICKS;
  const frame = chooseSpriteFrame({ alive: player.alive, mode, facing: player.facing, moving, walkPhase: data.walkPhase, tick, bombUntil: data.bombUntil });
  let key = `char-${data.id}-${frame.pose}`;
  if (!scene.textures.exists(key)) key = `char-${data.id}-idle-down`; // arte incompleta: cai na pose parada
  if (key !== data.pose) {
    data.image.setTexture(key);
    data.pose = key;
  }
  data.image.setFlipX(frame.flipX);
  if (moving && mode === 'play') spriteDebug.text = `${frame.pose} fase ${data.walkPhase.toFixed(2)} cycle ${walkCycleTiles()}`;
  // Os quadros já trazem a corrida e a bomba; por código ficam só um pulinho ao andar, a "respiração" parado e os pulos de alegria na vitória.
  let bounce = 0;
  let squash = 1 + Math.sin(tick / 14) * 0.012;
  if (frame.pose === 'win') bounce = Math.abs(Math.sin(tick / 5)) * 8;
  else if (moving && mode === 'play' && frame.pose.startsWith('run')) {
    bounce = Math.abs(Math.sin(data.walkPhase * Math.PI * 4)) * 1.5; // pulinho leve a cada passo
    squash = 1;
  }
  data.image.setScale(data.scale * (2 - squash), data.scale * squash);
  data.image.setY(SPRITE_FEET_OFFSET - bounce);
  if (dead) {
    const alpha = loseAlpha(data.deadTicks);
    data.image.setAlpha(alpha);
    return data.deadTicks < LOSE_VISIBLE_TICKS && alpha > 0;
  }
  data.image.setAlpha(1);
  return true;
}
