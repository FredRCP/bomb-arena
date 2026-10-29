import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { PadNav } from '../input/padNav';
import { CHARACTERS } from '../characters/characters';
import { PICKER_COLUMNS, allConfirmed, cancelPick, confirmPick, createPicker, finalizeChoices, moveCursor } from '../characters/picker';
import type { PickerState } from '../characters/picker';
import type { GameSession } from './GameScene';
import { addCardArt } from '../render/CharacterView';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../render/layout';
import { addMenuBackground } from '../render/menuBackground';
import { needsTeamsScreen } from '../menu/teamsModel';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const CARD_W = 200;
const CARD_H = 250;
const GAP = 16;
const TOP = 190;

/** Cor e teclas de cada pessoa. Jogando sozinho, o jogador 1 aceita as duas formas de teclado. */
const PLAYERS = [
  { label: 'Jogador 1', color: 0xff5c8a, hex: '#ff5c8a', left: ['A'], right: ['D'], up: ['W'], down: ['S'], confirm: ['SPACE'], cancel: ['ESC'] },
  { label: 'Jogador 2', color: 0x2dc7ff, hex: '#2dc7ff', left: ['LEFT', 'NUMPAD_FOUR'], right: ['RIGHT', 'NUMPAD_SIX'], up: ['UP', 'NUMPAD_EIGHT'], down: ['DOWN', 'NUMPAD_TWO'], confirm: ['ENTER'], cancel: ['BACKSPACE'] },
  { label: 'Jogador 3', color: 0x7ed957, hex: '#7ed957', left: [], right: [], up: [], down: [], confirm: [], cancel: [] },
  { label: 'Jogador 4', color: 0xb388ff, hex: '#b388ff', left: [], right: [], up: [], down: [], confirm: [], cancel: [] },
  { label: 'Jogador 5', color: 0xffd43b, hex: '#ffd43b', left: [], right: [], up: [], down: [], confirm: [], cancel: [] },
] as const;

/** Jogadores de 3 em diante usam só o controle de videogame. */
const KEYBOARD_PLAYERS = 2;

/**
 * Escolha de personagem: cada pessoa move o cursor e confirma. Os inimigos do computador recebem
 * personagens sorteados entre os que sobraram. A lógica está em characters/picker.ts (com testes).
 */
export class SelectScene extends Phaser.Scene {
  private session!: GameSession;
  private picker!: PickerState;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private humans = 1;
  private padNav!: PadNav;

  constructor() {
    super({ key: 'Select' });
  }

  init(data: GameSession): void {
    this.session = data;
  }

  create(): void {
    this.humans = this.session.config.players;
    this.picker = createPicker(this.humans);
    this.overlay = [];
    addMenuBackground(this);
    this.add
      .text(SCREEN_WIDTH / 2, 70, 'ESCOLHA SEU PERSONAGEM', { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 8 })
      .setOrigin(0.5);

    const steps = needsTeamsScreen(this.session.config.players, this.session.config.enemies) ? 5 : 4;
    this.add.text(SCREEN_WIDTH / 2, 124, `Passo 3 de ${steps}`, { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 }).setOrigin(0.5);

    // Grade de cartões (fixa)
    CHARACTERS.forEach((character, index) => {
      const { x, y } = this.cardCenter(index);
      const hex = `#${character.color.toString(16).padStart(6, '0')}`;
      this.add.rectangle(x, y, CARD_W, CARD_H, 0x1b1f3b, 0.8).setStrokeStyle(3, 0x8d99ff);
      addCardArt(this, character, x, y - 22, 54, 185);
      this.add.text(x, y + 82, character.name, { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: hex, stroke: '#0b0c1a', strokeThickness: 4 }).setOrigin(0.5);
    });

    this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 60, this.humans === 1 ? 'Setas ou W A S D mover     Espaço ou Enter confirmar     Esc voltar' : this.humans === 2 ? 'Jogador 1: W A S D + Espaço     Jogador 2: setas ou 2 4 8 6 + Enter     Esc/Backspace ou B: desfazer ou voltar' : 'Jogadores 1 e 2: teclado ou controles 1 e 2     Jogadores 3 em diante: controle de mesmo número     A confirma, B volta', { fontFamily: FONT, fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    this.bindKeys();
    this.padNav = new PadNav(this);
    this.render();
  }

  private cardCenter(index: number): { x: number; y: number } {
    const col = index % PICKER_COLUMNS;
    const row = Math.floor(index / PICKER_COLUMNS);
    const rowCount = Math.min(PICKER_COLUMNS, CHARACTERS.length - row * PICKER_COLUMNS);
    const rowWidth = rowCount * CARD_W + (rowCount - 1) * GAP;
    return { x: SCREEN_WIDTH / 2 - rowWidth / 2 + CARD_W / 2 + col * (CARD_W + GAP), y: TOP + CARD_H / 2 + row * (CARD_H + GAP) };
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const bind = (names: readonly string[], action: () => void): void => {
      for (const name of names) keyboard.addKey(name).on('down', action);
    };
    for (let who = 0; who < Math.min(this.humans, KEYBOARD_PLAYERS); who++) {
      const keys = PLAYERS[who]!;
      // Sozinho, o jogador 1 também aceita as setas e o Enter (como no menu).
      const solo = this.humans === 1;
      bind(solo ? [...keys.left, 'LEFT'] : keys.left, () => this.move(who, -1, 0));
      bind(solo ? [...keys.right, 'RIGHT'] : keys.right, () => this.move(who, 1, 0));
      bind(solo ? [...keys.up, 'UP'] : keys.up, () => this.move(who, 0, -1));
      bind(solo ? [...keys.down, 'DOWN'] : keys.down, () => this.move(who, 0, 1));
      bind(solo ? [...keys.confirm, 'ENTER'] : keys.confirm, () => this.confirm(who));
      bind(keys.cancel, () => this.cancel(who));
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.removeAllKeys(true));
  }

  /** Controle de videogame: o controle N escolhe pelo jogador N (sozinho, qualquer controle vale para o jogador 1). */
  update(time: number): void {
    if (!this.padNav) return;
    for (const { pad, action } of this.padNav.poll(time)) {
      const who = Math.min(pad, this.humans - 1);
      if (action === 'left') this.move(who, -1, 0);
      else if (action === 'right') this.move(who, 1, 0);
      else if (action === 'up') this.move(who, 0, -1);
      else if (action === 'down') this.move(who, 0, 1);
      else if (action === 'confirm') this.confirm(who);
      else if (action === 'back') this.cancel(who);
    }
  }

  private move(who: number, dx: -1 | 0 | 1, dy: -1 | 0 | 1): void {
    const before = this.picker.cursor[who];
    moveCursor(this.picker, who, dx, dy);
    if (before !== this.picker.cursor[who]) sfx.play('tick');
    this.render();
  }

  private confirm(who: number): void {
    if (!confirmPick(this.picker, who)) {
      sfx.play('hit'); // outra pessoa já escolheu este
      return;
    }
    sfx.play('confirm');
    this.render();
    if (allConfirmed(this.picker)) {
      // Sortear aqui é permitido: só o core não pode usar Math.random.
      const characters = finalizeChoices(this.picker, this.session.config.enemies, Math.random);
      const session = { ...this.session, characters };
      // Com 3 ou mais jogadores vem a tela de times; senão, direto para a fase.
      if (needsTeamsScreen(this.session.config.players, this.session.config.enemies)) this.scene.start('Teams', session);
      else this.scene.start('Setup', { screen: 'stage', session });
    }
  }

  /** Esc: desfaz a confirmação de quem já confirmou; sem nada a desfazer, volta às regras. */
  private cancel(who: number): void {
    if (cancelPick(this.picker, who)) {
      this.render();
      return;
    }
    if (this.picker.confirmed.every((done) => !done)) this.scene.start('Setup', { screen: 'rules' });
  }

  /** Cursores (molduras coloridas) e marcas de "pronto". */
  private render(): void {
    for (const object of this.overlay) object.destroy();
    this.overlay = [];
    this.picker.cursor.forEach((index, who) => {
      const { x, y } = this.cardCenter(index);
      const keys = PLAYERS[who]!;
      const offset = [-8, 8, -8, 8, 0][who] ?? 0;
      const offsetY = [-8, -8, 8, 8, 0][who] ?? 0;
      const done = this.picker.confirmed[who]!;
      const frame = this.add.rectangle(x + offset, y + offsetY, CARD_W + 8, CARD_H + 8).setStrokeStyle(done ? 8 : 5, keys.color).setDepth(5);
      const tag = this.add
        .text(x + offset * 5, y - CARD_H / 2 + 6 + Math.floor(who / 2) * 26, done ? `${keys.label} ✔` : keys.label, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#0b0c1a', backgroundColor: keys.hex, padding: { x: 8, y: 2 } })
        .setOrigin(0.5, 0)
        .setDepth(6);
      this.overlay.push(frame, tag);
    });
  }
}
