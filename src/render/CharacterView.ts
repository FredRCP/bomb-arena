import Phaser from 'phaser';
import { CHARACTERS, characterImagePath } from '../characters/characters';
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
    if (character.custom) scene.load.image(textureKey(character), characterImagePath(character));
  }
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
  return scene.add.container(x, y, parts);
}
