import Phaser from 'phaser';

// Aparência de cada fase (só desenho; nenhuma regra do jogo mora aqui). As imagens ficam em public/themes/<fase>/.
// Qualquer imagem que faltar é ignorada: a arena usa o desenho provisório feito em código (ver ArenaRenderer.ts).

export interface ThemeDef {
  id: string;
  /** Piso em imagem (floorA.png e floorB.png, alternados como um tabuleiro)? Senão, o piso colorido provisório. */
  floors: boolean;
  /** Parede fixa em imagem (wall.png)? */
  wall: boolean;
  /** Largura (em pixels lógicos) com que a parede é desenhada; a altura segue a proporção da imagem. */
  wallWidth: number;
  /** Quantas variações de bloco existem (block1.png, block2.png...). 0 = desenho provisório. */
  blockVariants: number;
  blockWidth: number;
  /** Pedras que sobram quando um bloco quebra (rubble.png). */
  rubble: boolean;
  /** Fundo da tela inteira (background.jpg); senão, o degradê colorido. */
  background: boolean;
  /** Cores dos estilhaços quando um bloco quebra. */
  chips: readonly number[];
  /** Pilares do meio da arena em imagem própria (pillar.png), diferente da parede da borda? */
  pillar?: boolean;
  /** Largura com que o pilar é desenhado. */
  pillarWidth?: number;
  /** Quantas imagens de hieróglifo (glyph1.png...) formam a borda da arena? 0 = a borda usa a imagem de parede. */
  borderGlyphs?: number;
  /** Pirâmide central 5 x 5 com túnel (pyramid.png)? */
  pyramid?: boolean;
  /** Iglu central 3 x 3 (igloo.png)? */
  igloo?: boolean;
  /** Esfinge do alto da arena (sphinx.png, 3 células de largura)? */
  sphinx?: boolean;
  /** Areia movediça em imagem (quicksand.png)? */
  quicksand?: boolean;
}

export const THEMES: Record<string, ThemeDef> = {
  classic: { id: 'classic', floors: false, wall: true, wallWidth: 62, blockVariants: 1, blockWidth: 62, rubble: false, background: false, chips: [0xd9822b, 0xa65a1c, 0x6e3a12] },
  egypt: { id: 'egypt', floors: true, wall: true, wallWidth: 62, blockVariants: 3, blockWidth: 62, rubble: false, background: true, chips: [0xf3d896, 0xe0b868, 0xb88f46], borderGlyphs: 22, pyramid: true, sphinx: true, quicksand: true },
  ice: { id: 'ice', floors: true, wall: true, wallWidth: 56, blockVariants: 3, blockWidth: 62, rubble: true, background: true, chips: [0xe3f6ff, 0xb9e3f7, 0x7fc4e8], igloo: true },
};

export function themeById(id: string | undefined): ThemeDef {
  return THEMES[id ?? 'classic'] ?? THEMES.classic!;
}

export const themeKey = (theme: ThemeDef, name: string): string => `theme-${theme.id}-${name}`;

/** Pede as imagens de todas as fases (chame no `preload` da primeira cena). Arquivo que não existe é ignorado. */
export function preloadThemes(scene: Phaser.Scene): void {
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => undefined);
  for (const theme of Object.values(THEMES)) {
    const base = `themes/${theme.id}`;
    const add = (name: string, file: string): void => void scene.load.image(themeKey(theme, name), `${base}/${file}`);
    if (theme.floors) {
      add('floorA', 'floorA.png');
      add('floorB', 'floorB.png');
    }
    if (theme.wall) add('wall', 'wall.png');
    for (let i = 1; i <= theme.blockVariants; i++) add(`block${i}`, `block${i}.png`);
    if (theme.rubble) add('rubble', 'rubble.png');
    if (theme.pillar) add('pillar', 'pillar.png');
    for (let i = 1; i <= (theme.borderGlyphs ?? 0); i++) add(`glyph${i}`, `glyph${i}.png`);
    if (theme.pyramid) add('pyramid', 'pyramid.png');
    if (theme.igloo) add('igloo', 'igloo.png');
    if (theme.sphinx) add('sphinx', 'sphinx.png');
    if (theme.quicksand) add('quicksand', 'quicksand.png');
    if (theme.background) add('background', 'background.jpg');
  }
}

/** A imagem existe (foi carregada)? */
export function has(scene: Phaser.Scene, theme: ThemeDef, name: string): boolean {
  return scene.textures.exists(themeKey(theme, name));
}

/** Quantas variações de bloco estão de fato carregadas. */
export function loadedBlockVariants(scene: Phaser.Scene, theme: ThemeDef): number {
  let n = 0;
  while (n < theme.blockVariants && has(scene, theme, `block${n + 1}`)) n++;
  return n;
}
