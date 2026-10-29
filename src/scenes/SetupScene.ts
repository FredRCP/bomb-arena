import Phaser from 'phaser';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { ARENA_COLS, ARENA_ROWS } from '../config/arena';
import { STAGES, stageById } from '../config/stages';
import { wantsTouchControls } from '../input/touchUi';
import { createMatch } from '../core';
import { PadNav } from '../input/padNav';
import { DIFFICULTY_TAGLINES, NEXT_LABELS, SCREEN_TITLES, canStart, changeValue, stageIssue, createMenu, describeRow, moveSelection, selectedRow, stepNumber, toGameConfig, totalSteps, visibleRows } from '../menu/menuModel';
import type { MenuScreen, MenuSettings, MenuState } from '../menu/menuModel';
import { needsTeamsScreen } from '../menu/teamsModel';
import { loadSettings, saveSettings } from '../menu/settingsStorage';
import { TILE_SIZE } from '../render/ArenaRenderer';
import { placeArena } from '../render/layout';
import { addMenuBackground, addPanel } from '../render/menuBackground';
import type { GameSession } from './GameScene';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const WIDTH = ARENA_COLS * TILE_SIZE;
const HEIGHT = ARENA_ROWS * TILE_SIZE;
const ROW_TOP = 290;
const ROW_STEP = 66;

interface SetupData {
  screen?: MenuScreen;
  /** Na tela da fase: a partida já montada (com os personagens escolhidos). */
  session?: GameSession;
}

/**
 * Telas de configuração em lista: Quem vai jogar -> Regras -> (personagens) -> Fase, e as Opções. A lógica (linhas,
 * valores, resumo) está em menu/menuModel.ts, que tem testes; esta cena só desenha e repassa as teclas.
 * Esc volta um passo; Enter no botão de baixo (ou em qualquer linha) avança.
 */
export class SetupScene extends Phaser.Scene {
  private menu!: MenuState;
  private session: GameSession | undefined;
  private texts: Phaser.GameObjects.GameObject[] = [];
  private arrow!: Phaser.GameObjects.Text;
  private padNav!: PadNav;
  /** Tela de toque (celular/tablet)? As arenas grandes ficam desligadas nela. */
  private touch = false;

  constructor() {
    super({ key: 'Setup' });
  }

  init(data: SetupData): void {
    this.menu = createMenu(loadSettings(), data?.screen ?? 'participants');
    this.session = data?.session;
    this.touch = wantsTouchControls();
  }

  /** Jogadores da partida (pessoas + computador): a sessão já montada, ou, sem ela, o que está no menu. */
  private totalPlayers(): number {
    const config = this.session?.config;
    return config ? config.players + config.enemies : this.menu.settings.players + this.menu.settings.enemies;
  }

  /** Imagens de prévia das fases (public/stages/<id>.jpg). Fase sem imagem aparece como cartão "?". */
  preload(): void {
    if (this.menu.screen !== 'stage') return;
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => undefined);
    for (const stage of STAGES) if (!this.textures.exists(`stage-${stage.id}`)) this.load.image(`stage-${stage.id}`, `stages/${stage.id}.jpg`);
  }

  create(): void {
    placeArena(this);
    sfx.setLevel(this.menu.settings.volume);
    music.setLevel(this.menu.settings.music);
    this.texts = [];
    addMenuBackground(this);
    if (this.menu.screen === 'stage') addPanel(this, WIDTH / 2, 470, WIDTH - 120, 560);
    else addPanel(this, WIDTH / 2, 470, WIDTH - 200, 440);
    this.add
      .text(WIDTH / 2, 100, SCREEN_TITLES[this.menu.screen], { fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 8 })
      .setOrigin(0.5);
    const step = stepNumber(this.menu.screen, this.menu.settings);
    const total = this.session ? totalSteps({ ...this.menu.settings, players: this.session.config.players, enemies: this.session.config.enemies }) : totalSteps(this.menu.settings);
    if (step) this.add.text(WIDTH / 2, 160, `Passo ${step} de ${total}`, { fontFamily: FONT, fontSize: '24px', color: '#e3e7ff' }).setOrigin(0.5);
    this.arrow = this.add.text(0, 0, '▶', { fontFamily: FONT, fontSize: '34px', color: '#ffe66d' }).setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT - 50, this.menu.screen === 'stage' ? '← → trocar de fase     Enter jogar     Esc voltar     (ou use o controle)' : '↑ ↓ escolher     ← → mudar     Enter continuar     Esc voltar     (ou use o controle)', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 })
      .setOrigin(0.5);

    this.bindKeys();
    this.padNav = new PadNav(this);
    this.render();
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const bind = (names: readonly string[], action: () => void, repeat = false): void => {
      for (const name of names) {
        keyboard.addKey(name).on('down', (_key: unknown, event: KeyboardEvent) => {
          if (!event?.repeat || repeat) action();
        });
      }
    };
    bind(['UP', 'W'], () => this.navigate(-1));
    bind(['DOWN', 'S'], () => this.navigate(1));
    bind(['LEFT', 'A'], () => this.change(-1), true);
    bind(['RIGHT', 'D'], () => this.change(1), true);
    bind(['ENTER', 'SPACE'], () => this.confirm());
    bind(['ESC', 'BACKSPACE'], () => this.back());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.removeAllKeys(true));
  }

  /** Quantos controles de videogame estão conectados agora. */
  private connectedPads(): number {
    const plugin = this.input.gamepad;
    return plugin ? plugin.gamepads.filter((pad) => pad && pad.connected).length : 0;
  }

  update(time: number): void {
    if (!this.padNav) return;
    if (this.menu.screen === 'participants') {
      // Com 3 ou mais controles conectados, a lista de jogadores passa a oferecer mais pessoas.
      const max = Math.min(5, Math.max(2, this.connectedPads()));
      if (max !== this.menu.maxHumans) {
        this.menu.maxHumans = max;
        if (this.menu.settings.players > max) {
          this.menu.settings.players = max as MenuSettings['players'];
          saveSettings(this.menu.settings);
        }
        this.render();
      }
    }
    for (const { action } of this.padNav.poll(time)) {
      if (action === 'up') this.navigate(-1);
      else if (action === 'down') this.navigate(1);
      else if (action === 'left') this.change(-1);
      else if (action === 'right') this.change(1);
      else if (action === 'confirm') this.confirm();
      else if (action === 'back') this.back();
    }
  }

  private navigate(delta: -1 | 1): void {
    if (this.menu.screen === 'stage') return; // na escolha da fase só existe o carrossel
    moveSelection(this.menu, delta);
    sfx.play('tick');
    this.render();
  }

  private change(delta: -1 | 1): void {
    if (this.menu.screen === 'stage') this.menu.selected = 0; // setas sempre giram o carrossel (a linha 0 é a fase)
    if (!changeValue(this.menu, delta)) return;
    sfx.setLevel(this.menu.settings.volume);
    music.setLevel(this.menu.settings.music);
    sfx.play('tick');
    saveSettings(this.menu.settings);
    this.render();
  }

  /** Enter: avança para a próxima tela (a fase "em breve" não deixa começar). */
  private confirm(): void {
    const { screen, settings } = this.menu;
    saveSettings(settings);
    if (screen === 'stage' && !canStart(settings, this.touch, this.totalPlayers())) {
      sfx.play('hit');
      return;
    }
    if (screen === 'options' && selectedRow(this.menu) === 'controls') {
      sfx.play('confirm');
      this.scene.start('Controls');
      return;
    }
    sfx.play('confirm');
    if (screen === 'participants') this.scene.start('Setup', { screen: 'rules' });
    else if (screen === 'rules') {
      // Semente nova a cada partida, para a arena não ser sempre a mesma. (A cena pode usar o relógio; o core, não.)
      const seed = Math.floor(Math.random() * 1_000_000);
      this.scene.start('Select', { config: toGameConfig(settings, seed), match: createMatch(settings.wins) });
    } else if (screen === 'stage') {
      if (!this.session) return;
      this.scene.start('Game', { ...this.session, config: { ...this.session.config, stage: toGameConfig(settings).stage } });
    } else this.scene.start('Menu');
  }

  /** Esc: volta um passo (da fase, para a escolha de personagem; da primeira tela, para o menu). */
  private back(): void {
    sfx.play('tick');
    const { screen } = this.menu;
    if (screen === 'rules') this.scene.start('Setup', { screen: 'participants' });
    else if (screen === 'stage') {
      if (!this.session) this.scene.start('Menu');
      else if (needsTeamsScreen(this.session.config.players, this.session.config.enemies)) this.scene.start('Teams', this.session);
      else this.scene.start('Select', { config: this.session.config, match: this.session.match });
    } else this.scene.start('Menu');
  }

  /** Carrossel de fases: a escolhida grande no meio, as vizinhas menores e apagadas dos lados. */
  private renderStage(): void {
    this.arrow.setVisible(false);
    const ids = STAGES.map((stage) => stage.id);
    const at = ids.indexOf(stageById(this.menu.settings.stage).id);
    const stage = STAGES[at]!;
    const prev = STAGES[(at - 1 + STAGES.length) % STAGES.length]!;
    const next = STAGES[(at + 1) % STAGES.length]!;
    const cardY = 362;
    const total = this.totalPlayers();
    /** Rótulo da faixa em cima do cartão de uma fase que não pode ser jogada agora (ou null). */
    const cardIssue = (def: (typeof STAGES)[number]): string | null => {
      if (!def.available) return 'EM BREVE';
      if (this.touch && !def.mobileOk) return 'GRANDE DEMAIS\nPARA CELULAR';
      if (total > def.maxPlayers) return `ATÉ ${def.maxPlayers}\nJOGADORES`;
      return null;
    };

    const card = (def: (typeof STAGES)[number], x: number, height: number, alpha: number, onTap: () => void): void => {
      const key = `stage-${def.id}`;
      const has = this.textures.exists(key);
      let width = height * (640 / 555);
      if (has) {
        const image = this.add.image(x, cardY, key).setAlpha(alpha);
        image.setScale(height / image.height);
        width = image.displayWidth;
        if (cardIssue(def)) image.setTint(0x666b88);
        image.setInteractive({ useHandCursor: true }).on('pointerdown', onTap);
        this.texts.push(image);
      } else {
        const g = this.add.graphics().setAlpha(alpha);
        g.fillStyle(0x2b3350, 1).fillRoundedRect(x - width / 2, cardY - height / 2, width, height, 14);
        const q = this.add.text(x, cardY, '?', { fontFamily: FONT, fontSize: `${Math.round(height * 0.45)}px`, fontStyle: 'bold', color: '#8a93c4' }).setOrigin(0.5).setAlpha(alpha);
        const hit = this.add.rectangle(x, cardY, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true }).on('pointerdown', onTap);
        this.texts.push(g, q, hit);
      }
      const frame = this.add.graphics();
      frame.lineStyle(height > 250 ? 6 : 3, height > 250 ? 0xffe66d : 0xffffff, height > 250 ? 1 : 0.35);
      frame.strokeRoundedRect(x - width / 2, cardY - height / 2, width, height, 10);
      this.texts.push(frame);
      const issue = cardIssue(def);
      if (issue) {
        const badge = this.add
          .text(x, cardY, issue, { fontFamily: FONT, fontSize: height > 250 ? '40px' : '18px', fontStyle: 'bold', align: 'center', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 7 })
          .setOrigin(0.5)
          .setAngle(-12);
        this.texts.push(badge);
      }
    };

    card(prev, 200, 170, 0.45, () => this.change(-1));
    card(next, WIDTH - 200, 170, 0.45, () => this.change(1));
    card(stage, WIDTH / 2, 300, 1, () => this.confirm());

    const arrowStyle = { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 6 };
    this.texts.push(
      this.add.text(68, cardY, '◀', arrowStyle).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.change(-1)),
      this.add.text(WIDTH - 68, cardY, '▶', arrowStyle).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.change(1)),
    );

    // Bolinhas: qual das fases está na tela.
    STAGES.forEach((def, index) => {
      const x = WIDTH / 2 + (index - (STAGES.length - 1) / 2) * 28;
      this.texts.push(this.add.circle(x, 532, index === at ? 8 : 5, index === at ? 0xffe66d : 0xffffff, index === at ? 1 : 0.5));
      void def;
    });

    const issueText = stageIssue(stage, total, this.touch);
    this.texts.push(
      this.add.text(WIDTH / 2, 562, stage.name, { fontFamily: FONT, fontSize: '42px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 6 }).setOrigin(0.5),
      this.add.text(WIDTH / 2, 604, stage.available ? stage.tagline : `${stage.tagline} (em breve)`, { fontFamily: FONT, fontSize: '23px', color: '#e3e7ff' }).setOrigin(0.5),
      this.add.text(WIDTH / 2, 636, `Arena ${stage.cols} x ${stage.rows}  ·  até ${stage.maxPlayers} jogadores${stage.hazards ? '  ·  com perigos no terreno' : ''}`, { fontFamily: FONT, fontSize: '21px', color: '#ffe66d' }).setOrigin(0.5),
    );
    if (issueText && stage.available) {
      this.texts.push(this.add.text(WIDTH / 2, 666, issueText, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#ff8fa3', stroke: '#1b1f3b', strokeThickness: 4 }).setOrigin(0.5));
    }
    const blocked = issueText !== null;
    this.texts.push(
      this.add
        .text(WIDTH / 2, 712, NEXT_LABELS.stage, { fontFamily: FONT, fontSize: '50px', fontStyle: 'bold', color: blocked ? '#6c7293' : '#ffe66d', stroke: '#1b1f3b', strokeThickness: 6 })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.confirm()),
    );
  }

  private render(): void {
    for (const text of this.texts) text.destroy();
    this.texts = [];
    if (this.menu.screen === 'stage') {
      this.renderStage();
      return;
    }
    const rows = visibleRows(this.menu.settings, this.menu.screen);
    const current = selectedRow(this.menu);
    rows.forEach((row, index) => {
      const y = ROW_TOP + index * ROW_STEP;
      const selected = row === current;
      if (row === 'next') {
        const blocked = this.menu.screen === 'stage' && !canStart(this.menu.settings, this.touch, this.totalPlayers());
        const label = NEXT_LABELS[this.menu.screen];
        const color = blocked ? '#6c7293' : selected ? '#ffe66d' : '#c9a93a';
        this.texts.push(this.add.text(WIDTH / 2, y + 24, label, { fontFamily: FONT, fontSize: '50px', fontStyle: 'bold', color, stroke: '#1b1f3b', strokeThickness: 6 }).setOrigin(0.5));
        if (selected) this.arrow.setPosition(WIDTH / 2 - 130, y + 24);
        return;
      }
      const { label, value } = describeRow(this.menu.settings, row);
      const color = selected ? '#ffffff' : '#e3e7ff';
      const style = { fontFamily: FONT, fontSize: '32px', fontStyle: selected ? 'bold' : 'normal', color };
      this.texts.push(
        this.add.text(150, y, label, style).setOrigin(0, 0.5),
        this.add.text(WIDTH - 150, y, selected ? `◀  ${value}  ▶` : value, style).setOrigin(1, 0.5),
      );
      if (selected) this.arrow.setPosition(110, y);
    });

    if (this.menu.screen === 'participants' && this.menu.maxHumans < 3) {
      this.texts.push(this.add.text(WIDTH / 2, HEIGHT - 100, 'Dica: conecte 3 ou mais controles de videogame para jogar com mais gente.', { fontFamily: FONT, fontSize: '22px', color: '#c9d1ff', stroke: '#1b1f3b', strokeThickness: 3 }).setOrigin(0.5));
    }

    // Na tela de participantes, uma frase de humor sobre o nível escolhido.
    if (this.menu.screen === 'participants' && rows.includes('difficulty')) {
      const top = ROW_TOP + rows.length * ROW_STEP + 30;
      this.texts.push(this.add.text(WIDTH / 2, top, `“${DIFFICULTY_TAGLINES[this.menu.settings.difficulty]}”`, { fontFamily: FONT, fontSize: '28px', fontStyle: 'italic', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 4 }).setOrigin(0.5));
    }
  }
}
