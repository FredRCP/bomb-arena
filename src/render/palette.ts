// Cores provisórias do protótipo (formato 0xRRGGBB, como o Phaser espera).
// A identidade visual definitiva virá numa etapa futura; trocar aqui já muda o jogo todo.

export const COLORS = {
  floorA: 0xa8e6cf,
  floorB: 0x9adcc2,

  wallFace: 0x5a5fc4,
  wallShadow: 0x34377f,
  wallHighlight: 0xb4b8ff,

  blockFace: 0xffa94d,
  blockShadow: 0xd9772b,
  blockLine: 0xb85a14,

  bombBody: 0x2b2d42,
  bombHighlight: 0x8d99ae,
  bombFuse: 0xffd166,
  bombSpark: 0xff6b35,

  flameOuter: 0xff6b35,
  flameInner: 0xffe66d,

  playerBody: { 1: 0xff5c8a, 2: 0x2dc7ff, 3: 0x7ed957, 4: 0xb388ff } as Record<1 | 2 | 3 | 4, number>,
  playerHighlight: 0xffffff,
  playerEye: 0xffffff,
  playerPupil: 0x1b1f3b,
  itemBomb: 0x2b2d42,
  itemRange: 0xff6b35,
  itemSpeed: 0x2dc7ff,
  itemPlate: 0xfff8e1,
  shadow: 0x000000,
} as const;
