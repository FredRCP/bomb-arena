// Personagens jogáveis. Só dados (sem Phaser): quem desenha é render/CharacterView.ts.
//
// Cada personagem tem uma cor e um acessório para o desenho provisório. Os da família (`custom: true`) usam,
// quando existir, a imagem `public/characters/<id>.png` (PNG com fundo transparente, quadrada, de preferência
// 256x256); sem a imagem, aparece o desenho provisório com a inicial do nome. Trocar a imagem não exige mexer em código.

export type Hat = 'none' | 'bow' | 'cap' | 'crown' | 'antenna' | 'horns' | 'headband' | 'leaf' | 'flower' | 'star' | 'ears' | 'tuft';

export interface CharacterDef {
  id: string;
  name: string;
  color: number;
  hat: Hat;
  /** Personagem caricatura (usa public/characters/<id>.png se existir). */
  custom: boolean;
  /**
   * Tem arte de corpo inteiro em public/characters/<id>/ (poses de parado e correndo nas 4 direções, colocar bomba,
   * vitória e derrota, rosto normal/feliz/triste e a arte grande da escolha). Veja characters/poses.ts. Sem os
   * arquivos, o jogo cai no desenho provisório.
   */
  sprites?: boolean;
}

export const CHARACTERS: readonly CharacterDef[] = [
  { id: 'pipoca', name: 'Pipoca', color: 0xff5c8a, hat: 'antenna', custom: false },
  { id: 'bolt', name: 'Bolt', color: 0x2dc7ff, hat: 'horns', custom: false },
  { id: 'musgo', name: 'Musgo', color: 0x7ed957, hat: 'leaf', custom: false },
  { id: 'violeta', name: 'Violeta', color: 0xb388ff, hat: 'crown', custom: false },
  { id: 'fagulha', name: 'Fagulha', color: 0xff6b35, hat: 'star', custom: false },
  { id: 'nimbo', name: 'Nimbo', color: 0x5c7cfa, hat: 'ears', custom: false },
  { id: 'cacau', name: 'Cacau', color: 0xa9744f, hat: 'tuft', custom: false },
  { id: 'fred', name: 'Fred', color: 0xffa94d, hat: 'cap', custom: true, sprites: true },
  { id: 'vanessa', name: 'Van', color: 0xf06595, hat: 'flower', custom: true },
  { id: 'ana-julia', name: 'Ana', color: 0xffd43b, hat: 'bow', custom: true, sprites: true },
  { id: 'lucas', name: 'Lucas', color: 0x74c0fc, hat: 'none', custom: true },
  { id: 'filippe', name: 'Filippe', color: 0x38d9a9, hat: 'headband', custom: true },
  { id: 'waleska', name: 'Wal', color: 0xe599f7, hat: 'crown', custom: true, sprites: true },
  { id: 'glaucio', name: 'Glauceste', color: 0xadb5bd, hat: 'cap', custom: true, sprites: true },
];

export function characterById(id: string | undefined): CharacterDef {
  return CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0]!;
}

/** Caminho da imagem de um personagem caricatura, relativo à pasta `public/`. */
export function characterImagePath(character: CharacterDef): string {
  return character.sprites ? `characters/${character.id}/face.png` : `characters/${character.id}.png`;
}

/** Caminho de uma imagem de um personagem com sprites (pose, rosto ou arte grande). */
export function spriteImagePath(character: CharacterDef, name: string): string {
  return `characters/${character.id}/${name}.png`;
}

/** Personagem de cada jogador (id do jogador -> id do personagem). */
export type CharacterChoices = Record<number, string>;

/** Escolha padrão (partida aberta por endereço, sem tela de seleção): o jogador N usa o N-ésimo personagem. */
export function defaultChoices(playerCount: number): CharacterChoices {
  const choices: CharacterChoices = {};
  for (let id = 1; id <= playerCount; id++) choices[id] = CHARACTERS[(id - 1) % CHARACTERS.length]!.id;
  return choices;
}
