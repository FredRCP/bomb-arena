import Phaser from 'phaser';
import { SUDDEN_DEATH_MUSIC, music, pickTrack } from '../audio/music';
import { stageById, themeIdOf } from '../config/stages';
import { loadSettings } from '../menu/settingsStorage';
import { sfx } from '../audio/sfx';
import { AI_SETTINGS } from '../config/ai';
import { COUNTDOWN_SECONDS } from '../config/round';
import { TICKS_PER_SECOND } from '../config/simulation';
import { characterById, defaultChoices } from '../characters/characters';
import type { CharacterChoices } from '../characters/characters';
import { aiShouldUsePower, applyItem, givePower, createAi, createScoreboard, rankPlayers, recordEvents, recordMatchScore, recordRoundScore, createFixedStepper, createGameState, createMatch, drainEvents, nextRound, recordRound, step, teamOfOutcome } from '../core';
import type { AiController, GameState, MatchState, PlayerId, Scoreboard } from '../core';
import type { HumanId } from '../input/controls';
import { KeyboardInput } from '../input/keyboardInput';
import { TouchControls } from '../input/touchControls';
import { wantsTouchControls } from '../input/touchUi';
import { parseGameConfig } from '../menu/gameConfig';
import { saveSettings } from '../menu/settingsStorage';
import { readPad } from '../input/padReader';
import { startPadMemory, stepPadNav } from '../input/padNavLogic';
import type { NavAction, PadMemory } from '../input/padNavLogic';
import type { GameConfig } from '../menu/gameConfig';
import {
  TILE_SIZE,
  type BlocksView,
  type ClosedView,
  createBlocksView,
  createClosedView,
  createEffectsView,
  createItemsView,
  createPlayerView,
  drawArena,
  drawClosedWall,
  drawEffects,
  drawItems,
  redrawBlocks,
  syncPlayerView,
} from '../render/ArenaRenderer';
import { spriteDebug, triggerBombPose } from '../render/CharacterView';
import { Effects } from '../render/Effects';
import { FlameSprites } from '../render/FlameSprites';
import { ItemSprites, hasItemIcon } from '../render/ItemSprites';
import { FLAME_TICKS } from '../config/bombs';
import { createHud } from '../render/Hud';
import { SCREEN_HEIGHT, SCREEN_WIDTH, TOP_HEIGHT, placeArena, sideWidthFor } from '../render/layout';
import { HazardsView } from '../render/HazardsView';
import { ElephantView } from '../render/ElephantView';
import { PlaneView } from '../render/PlaneView';
import { SnowView } from '../render/SnowView';
import { POWER_LABELS } from '../config/powers';
import { addMenuBackground } from '../render/menuBackground';
import { has, themeById, themeKey } from '../render/theme';
import type { Hud } from '../render/Hud';
import { showOutcomeOverlay } from '../render/OutcomeOverlay';
import { describeRoundEnd, rankingLines, setCpuNames } from '../render/outcomeText';
import { addToRanking, rankingPosition } from '../menu/ranking';
import { loadRanking, saveRanking } from '../menu/rankingStorage';
import type { RankedPlayer } from '../core';


/** Volume da música durante a contagem regressiva (1 = normal). */
const COUNTDOWN_MUSIC_DUCK = 0.3;
/** Ao fim da partida, a música da arena baixa até o zero em 6 s. */
const MATCH_END_FADE_MS = 6000;

/** Tudo que atravessa o reinício da cena: a configuração da partida e o placar. A rodada em si é descartada. */
export interface GameSession {
  config: GameConfig;
  match: MatchState;
  /** Pontos de cada jogador na partida (sobrevive entre as rodadas). Ausente: começa zerado. */
  scores?: Scoreboard;
  /** Personagem de cada jogador (id do jogador -> id do personagem). Ausente: escolha padrão. */
  characters?: CharacterChoices;
  /** Música sorteada para esta partida (vale para todas as rodadas dela). Ausente: sorteia ao começar. */
  track?: string;
}

/** Quanto a semente avança quando começa uma partida nova (para a revanche não repetir as mesmas arenas). */
const SEED_STEP_PER_MATCH = 10;

export class GameScene extends Phaser.Scene {
  private gameState!: GameState;
  private session!: GameSession;
  private characters: CharacterChoices = {};
  private keyboardInput!: KeyboardInput;
  private touchControls: TouchControls | null = null;
  private readonly stepper = createFixedStepper();
  private blocksView!: BlocksView;
  private itemsView!: Phaser.GameObjects.Graphics;
  private effectsView!: Phaser.GameObjects.Graphics;
  /** Faíscas, fumaça, estilhaços e tremor (só visual; ?fx=0 desliga). */
  private fx!: Effects;
  /** Fogo em imagem (se as imagens existirem). */
  private flameSprites!: FlameSprites;
  private itemSprites!: ItemSprites;
  private closedView!: ClosedView;
  private hazardsView!: HazardsView;
  private elephantView!: ElephantView;
  private planeView!: PlaneView;
  private snowView: SnowView | null = null;
  /** A música da morte súbita já começou nesta rodada? */
  private suddenMusic = false;
  private hud!: Hud;
  private readonly playerViews = new Map<PlayerId, Phaser.GameObjects.Container>();
  /** Jogadores controlados por pessoas (para os textos de resultado e para ligar as teclas certas). */
  private humans: PlayerId[] = [1];
  /** Inimigos do computador: um controlador por jogador do computador. Recriados a cada rodada. */
  private ais: AiController[] = [];
  private overlayShown = false;
  /** Passos que faltam da contagem regressiva do início (o jogo só começa em zero). */
  private countdownTicks = 0;
  private countdownText: Phaser.GameObjects.Text | null = null;
  private lastCountdownShown = '';
  private pauseObjects: Phaser.GameObjects.GameObject[] = [];
  /** Menu da pausa: linha selecionada e os textos (atualizados quando algo muda). */
  private pauseRow = 0;
  private pauseTexts: Phaser.GameObjects.Text[] = [];
  private readonly padMemory = new Map<number, PadMemory>();
  /** Diagnóstico de velocidade (?debug=1): quantos passos de simulação rodaram no último segundo. */
  private debugText: Phaser.GameObjects.Text | null = null;
  private debugMs = 0;
  private debugLine = '';
  private lastFrameMs = 0;
  private debugTicks = 0;

  constructor() {
    super({ key: 'Game' });
  }

  /**
   * Recebe a sessão do menu (ou da rodada anterior). Sem sessão — jogo aberto direto por um endereço como
   * `?players=1&enemies=2` — monta uma a partir do endereço, com uma partida nova.
   */
  init(data?: Partial<GameSession>): void {
    this.session = {
      config: data?.config ?? parseGameConfig(window.location.search),
      match: data?.match ?? createMatch(data?.config?.wins ?? parseGameConfig(window.location.search).wins),
      ...(data?.characters && { characters: data.characters }),
      ...(data?.track && { track: data.track }),
      ...(data?.scores && { scores: data.scores }),
    };
  }

  /**
   * Chamado no começo de toda rodada, inclusive nos reinícios (`scene.restart()` roda `init` e `create` de novo).
   * Tudo que pertence à rodada nasce aqui; nada da rodada anterior deve sobreviver, por isso os campos
   * que guardam coisas (mapa de desenhos, aviso do resultado, pausa) são zerados.
   */
  create(): void {
    const { config, match } = this.session;
    // Cada rodada tem a própria arena: semente da partida + número da rodada. Reiniciar a MESMA rodada repete a arena.
    const seed = config.seed + (match.round - 1);
    console.info(`[Bomb Arena] semente da arena: ${seed} (rodada ${match.round})`);

    // O core decide o que existe; a cena só pede o estado e manda desenhar.
    const stage = stageById(config.stage ?? 'classic');
    // A fase manda no tamanho da arena e no máximo de jogadores (endereços como ?stage=egypt&players=5 também respeitam).
    const players = Math.min(config.players, stage.maxPlayers) as typeof config.players;
    const enemies = Math.min(config.enemies, stage.maxPlayers - players) as typeof config.enemies;
    this.gameState = createGameState({ seed, cols: stage.cols, rows: stage.rows, ...(stage.hazards && { hazards: stage.hazards }), players, enemies, items: config.items, sideline: config.sideline ?? true, teams: config.teams, ...(config.teamAssignment && { teamAssignment: config.teamAssignment }), enemySpeedScale: AI_SETTINGS[config.difficulty].speedScale, ...(config.time !== undefined && { roundTicks: config.time === 0 ? Number.POSITIVE_INFINITY : config.time * TICKS_PER_SECOND }) });
    this.characters = this.session.characters ?? defaultChoices(this.gameState.players.length);
    // O computador aparece com o nome do personagem que está jogando (e não "CPU 1", "CPU 2"...).
    const cpuNames: Record<number, string> = {};
    for (const player of this.gameState.players) if (player.cpu) cpuNames[player.id] = characterById(this.characters[player.id]).name;
    setCpuNames(cpuNames);
    // Superpoder de cada personagem (a carga começa vazia a cada rodada).
    for (const player of this.gameState.players) {
      const power = characterById(this.characters[player.id]).power;
      if (power) givePower(player, power);
    }
    this.session.scores ??= createScoreboard(this.gameState.players);
    this.humans = this.gameState.players.filter((player) => !player.cpu).map((player) => player.id);
    this.ais = this.gameState.players
      .filter((player) => player.cpu)
      .map((player) => createAi(player.id, config.difficulty, seed));

    // Ajudas de teste pelo endereço: ?power=kick,remote  (habilidades iniciais das pessoas)
    for (const name of config.power ?? []) {
      for (const human of this.gameState.players.filter((p) => !p.cpu)) applyItem(human, name);
    }

    // Ajudas de teste pelo endereço: ?bombs=3&range=4
    for (const player of this.gameState.players) {
      if (config.bombs !== undefined) player.maxBombs = config.bombs;
      if (config.range !== undefined) player.bombRange = config.range;
    }

    placeArena(this, stage.cols);
    const theme = themeById(themeIdOf(stage));
    if (theme.background && has(this, theme, 'background')) {
      // Fundo da fase: uma imagem do tamanho da tela (a câmera desliza, por isso começa no canto da tela, e não em 0,0).
      this.add.image(this.cameras.main.scrollX, this.cameras.main.scrollY, themeKey(theme, 'background')).setOrigin(0, 0).setDisplaySize(SCREEN_WIDTH, SCREEN_HEIGHT).setDepth(-100);
    } else {
      addMenuBackground(this, undefined, false); // fundo colorido da tela (sem bolhas, para não distrair)
    }
    this.stepper.reset();
    this.lastFrameMs = performance.now();
    this.overlayShown = false;
    this.countdownTicks = (config.countdown ?? COUNTDOWN_SECONDS) * TICKS_PER_SECOND;
    this.countdownText = null;
    this.lastCountdownShown = '';
    this.pauseObjects = [];
    this.playerViews.clear();

    drawArena(this, this.gameState.arena, theme.id, this.gameState.hazards);
    this.blocksView = createBlocksView(this, this.gameState.arena, theme.id);
    this.itemsView = createItemsView(this);
    this.effectsView = createEffectsView(this);
    this.fx = new Effects(this, theme.id);
    this.flameSprites = new FlameSprites(this);
    this.itemSprites = new ItemSprites(this);
    this.closedView = createClosedView(this, theme.id);
    this.hazardsView = new HazardsView(this, this.gameState);
    this.elephantView = new ElephantView(this);
    this.planeView = new PlaneView(this);
    this.snowView = theme.snow ? new SnowView(this) : null;
    this.suddenMusic = false;
    for (const player of this.gameState.players) {
      this.playerViews.set(player.id, createPlayerView(this, player, characterById(this.characters[player.id])));
    }
    this.hud = createHud(this, this.gameState, this.characters);

    this.debugText = null;
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      this.debugText = this.add.text(-sideWidthFor(stage.cols) + 12, -TOP_HEIGHT + 4, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe66d' }).setDepth(50);
      this.debugMs = 0;
      this.debugTicks = 0;
    }

    this.keyboardInput = new KeyboardInput(this, this.humans as HumanId[]);
    this.pauseRow = 0;
    this.pauseTexts = [];
    const onPauseKey = (event: KeyboardEvent): void => {
      if (this.pauseObjects.length === 0 || event.repeat) return;
      const actions: Record<string, NavAction> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'confirm', Space: 'confirm' };
      const action = actions[event.code];
      if (action) this.pauseAction(action);
    };
    this.input.keyboard?.on('keydown', onPauseKey);
    this.touchControls = this.humans.includes(1) && wantsTouchControls() ? new TouchControls(this, this.keyboardInput, !!this.gameState.players[0]?.power) : null;
    music.setLevel(loadSettings().music);
    music.setDuck(this.countdownTicks > 0 ? COUNTDOWN_MUSIC_DUCK : 1); // música baixinha durante a contagem
    this.session.track ??= pickTrack(stage.id);
    music.play(this.session.track);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', onPauseKey);
      this.keyboardInput.destroy();
      music.release();
    });

    this.syncViews();

    // Mensagem de conferência: se ela aparecer no Console (F12), o código da Etapa 7 está rodando.
    console.info(
      '[Bomb Arena] Etapa 8 ativa: jogador 1 = WASD + Espaço; jogador 2 = setas + Enter; Esc pausa; R reinicia a rodada; Q volta ao menu; M liga/desliga o som (clique na página se não responder).',
    );
  }

  /**
   * Chamado a cada quadro da tela. O tempo real (delta, em ms) vira um número inteiro de passos de
   * simulação: em monitores de 60 ou de 144 Hz o jogador anda exatamente a mesma distância por segundo.
   */
  update(time: number): void {
    // Tempo real do quadro, medido aqui. NÃO usamos o `delta` do Phaser: ele suaviza e limita os quadros lentos
    // (um quadro de 100 ms chega como ~16 ms), e aí o jogo anda em câmera lenta sempre que a máquina engasga,
    // por exemplo nos primeiros segundos depois de abrir a cena. Com o tempo real, o passo fixo recupera o atraso.
    const now = performance.now();
    const delta = now - this.lastFrameMs;
    this.lastFrameMs = now;

    if (this.keyboardInput.consumeMuteToggle()) {
      console.info(`[Bomb Arena] Som ${sfx.toggleMute() ? 'desligado' : 'ligado'}.`);
      music.sync();
    }

    this.keyboardInput.pollGamepads();
    const roundOver = this.gameState.round.phase === 'over';
    const paused = this.pauseObjects.length > 0;
    this.touchControls?.setState(paused, roundOver);

    // Start do controle: pausa/continua; com a rodada acabada, vai para a próxima (como a tecla R).
    if (this.keyboardInput.consumeStart()) {
      if (roundOver) {
        this.restart(true);
        return;
      }
      this.setPaused(!paused);
      return;
    }
    if (this.keyboardInput.consumePause() && !roundOver) {
      this.setPaused(!paused);
      return;
    }
    if (this.keyboardInput.consumeQuit() && (paused || roundOver)) {
      this.scene.start('Menu');
      return;
    }
    if (this.keyboardInput.consumeRestart()) {
      this.restart(roundOver);
      return;
    }

    const ticks = this.stepper.advance(delta);
    if (paused) this.pollPausePads(time);
    if (paused) {
      this.keyboardInput.getIntents(); // descarta apertos de bomba feitos durante a pausa
      return;
    }

    this.fx.update(delta, this.gameState);

    if (this.debugText && !this.keyboardPausedOrOver(paused)) {
      this.debugMs += delta;
      this.debugTicks += ticks;
      this.debugText.setText(`${this.debugLine}\n${spriteDebug.text}`);
      if (this.debugMs >= 1000) {
        const perSecond = Math.round((this.debugTicks * 1000) / this.debugMs);
        this.debugLine = `passos/s: ${perSecond} (certo: 60)  quadros: ${Math.round(this.game.loop.actualFps)} fps`;
        this.debugMs = 0;
        this.debugTicks = 0;
      }
    }

    // Contagem regressiva: os passos do relógio são gastos nela e o jogo fica parado (para a IA não sair na frente).
    let playTicks = ticks;
    if (this.countdownTicks > 0) {
      this.keyboardInput.getIntents(); // descarta apertos feitos durante a contagem
      const used = Math.min(ticks, this.countdownTicks);
      this.countdownTicks -= used;
      playTicks = ticks - used;
      this.showCountdown();
    }

    for (let i = 0; i < playTicks; i++) {
      const intents = this.keyboardInput.getIntents();
      for (const ai of this.ais) {
        const intent = ai.decide(this.gameState);
        const self = this.gameState.players.find((p) => p.id === ai.playerId);
        if (self && aiShouldUsePower(this.gameState, self)) intent.power = true;
        intents[ai.playerId] = intent;
      }
      step(this.gameState, intents);
    }

    if (playTicks > 0) {
      this.handleEvents();
      this.syncViews();
    }
  }

  /** Mostra o número grande no centro da arena (3, 2, 1) e "VAI!" por um instante; some quando o jogo começa. */
  private showCountdown(): void {
    const label = this.countdownTicks > 0 ? String(Math.ceil(this.countdownTicks / TICKS_PER_SECOND)) : 'VAI!';
    if (label === this.lastCountdownShown) return;
    this.lastCountdownShown = label;
    if (this.countdownTicks === 0) music.fadeDuckTo(1, 1200); // "VAI!": a música sobe ao volume normal
    sfx.play(this.countdownTicks > 0 ? 'tick' : 'place');
    const x = (this.gameState.arena.cols * TILE_SIZE) / 2;
    const y = (this.gameState.arena.rows * TILE_SIZE) / 2;
    this.countdownText?.destroy();
    const text = this.add
      .text(x, y, label, { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '200px', color: '#ffe66d', stroke: '#1b1b3a', strokeThickness: 16 })
      .setOrigin(0.5)
      .setDepth(60);
    this.countdownText = text;
    this.tweens.add({ targets: text, scale: { from: 1.4, to: 0.9 }, duration: 600, ease: 'Quad.easeOut' });
    if (this.countdownTicks === 0) this.tweens.add({ targets: text, alpha: 0, delay: 350, duration: 300, onComplete: () => text.destroy() });
  }

  private keyboardPausedOrOver(paused: boolean): boolean {
    return paused || this.gameState.round.phase === 'over';
  }

  /**
   * R: com a rodada em andamento, recomeça a MESMA rodada (mesma arena, placar intacto);
   * com a rodada acabada, vai para a próxima — ou, se a partida acabou, começa uma partida nova.
   */
  private restart(roundOver: boolean): void {
    const { config, match } = this.session;
    if (!roundOver) {
      this.scene.restart({ config, match, characters: this.characters, scores: this.session.scores, ...(this.session.track && { track: this.session.track }) });
    } else if (match.finished) {
      this.scene.restart({ config: { ...config, seed: config.seed + SEED_STEP_PER_MATCH }, match: createMatch(config.wins), characters: this.characters });
    } else {
      nextRound(match);
      this.scene.restart({ config, match, characters: this.characters, scores: this.session.scores, ...(this.session.track && { track: this.session.track }) });
    }
  }

  /** Itens do menu da pausa (a ordem é a da tela). */
  private static readonly PAUSE_ITEMS = ['resume', 'sfx', 'music', 'controls', 'restart', 'quit'] as const;

  private setPaused(paused: boolean): void {
    if (!paused) {
      for (const object of this.pauseObjects) object.destroy();
      this.pauseObjects = [];
      this.pauseTexts = [];
      return;
    }
    const width = this.gameState.arena.cols * TILE_SIZE;
    const height = this.gameState.arena.rows * TILE_SIZE;
    const font = 'system-ui, "Segoe UI", Roboto, sans-serif';
    this.pauseObjects = [
      this.add.rectangle(width / 2, height / 2, width, height, 0x0b0c1a, 0.72).setDepth(100),
      this.add.text(width / 2, height / 2 - 230, 'Pausado', { fontFamily: font, fontSize: '72px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 8 }).setOrigin(0.5).setDepth(101),
      this.add.text(width / 2, height / 2 + 250, '↑ ↓ escolher     ← → ajustar     Enter confirmar     Esc continuar', { fontFamily: font, fontSize: '22px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 }).setOrigin(0.5).setDepth(101),
    ];
    this.pauseRow = 0;
    this.pauseTexts = GameScene.PAUSE_ITEMS.map((id, index) => {
      const text = this.add
        .text(width / 2, height / 2 - 120 + index * 62, '', { fontFamily: font, fontSize: '38px', fontStyle: 'bold', color: '#e3e7ff', stroke: '#1b1f3b', strokeThickness: 6 })
        .setOrigin(0.5)
        .setDepth(101)
        .setInteractive({ useHandCursor: true });
      // Toque/mouse: tocar numa linha a seleciona e confirma; nas linhas de volume, tocar na metade esquerda diminui e na direita aumenta.
      text.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.pauseRow = index;
        if (id === 'sfx' || id === 'music') this.pauseAction(pointer.worldX < text.x ? 'left' : 'right');
        else this.pauseAction('confirm');
      });
      this.pauseObjects.push(text);
      return text;
    });
    this.renderPause();
  }

  private renderPause(): void {
    const settings = loadSettings();
    const pct = (v: number): string => (v === 0 ? 'mudo' : `${v * 10}%`);
    const labels: Record<(typeof GameScene.PAUSE_ITEMS)[number], string> = {
      resume: 'Continuar',
      sfx: `◀  Volume dos sons: ${pct(settings.volume)}  ▶`,
      music: `◀  Volume da música: ${pct(settings.music)}  ▶`,
      controls: 'Controles',
      restart: 'Reiniciar a rodada',
      quit: 'Sair para o menu',
    };
    this.pauseTexts.forEach((text, index) => {
      text.setText(labels[GameScene.PAUSE_ITEMS[index]!]);
      text.setColor(index === this.pauseRow ? '#ffe66d' : '#e3e7ff');
    });
  }

  /** Uma ação no menu da pausa (teclado, controle ou toque). */
  private pauseAction(action: NavAction): void {
    const count = GameScene.PAUSE_ITEMS.length;
    const item = GameScene.PAUSE_ITEMS[this.pauseRow]!;
    if (action === 'up' || action === 'down') {
      this.pauseRow = (this.pauseRow + (action === 'up' ? -1 : 1) + count) % count;
      sfx.play('tick');
    } else if (action === 'back') {
      this.setPaused(false);
      return;
    } else if ((action === 'left' || action === 'right') && (item === 'sfx' || item === 'music')) {
      const settings = loadSettings();
      const delta = action === 'left' ? -1 : 1;
      if (item === 'sfx') {
        settings.volume = Math.min(10, Math.max(0, settings.volume + delta));
        sfx.setLevel(settings.volume);
      } else {
        settings.music = Math.min(10, Math.max(0, settings.music + delta));
        music.setLevel(settings.music);
      }
      saveSettings(settings);
      sfx.play('tick');
    } else if (action === 'confirm') {
      if (item === 'resume') {
        this.setPaused(false);
        return;
      }
      if (item === 'restart') {
        this.restart(false);
        return;
      }
      if (item === 'quit') {
        this.scene.start('Menu');
        return;
      }
      if (item === 'controls') {
        sfx.play('confirm');
        this.scene.launch('Controls', { overlay: true });
        this.scene.pause();
        return;
      }
    }
    this.renderPause();
  }

  /** Controle de videogame no menu da pausa (direcional/alavanca, A confirma, B continua). */
  private pollPausePads(time: number): void {
    const plugin = this.input.gamepad;
    if (!plugin) return;
    for (let index = 0; index < plugin.total; index++) {
      const snapshot = readPad(plugin.getPad(index));
      if (!snapshot) continue;
      const memory = this.padMemory.get(index);
      if (!memory) {
        this.padMemory.set(index, startPadMemory(snapshot, time));
        continue;
      }
      for (const action of stepPadNav(memory, snapshot, time)) this.pauseAction(action);
    }
  }

  /** Reage ao que o core informou que aconteceu: som, redesenho dos blocos e tela de resultado. */
  private handleEvents(): void {
    const events = drainEvents(this.gameState);
    if (events.length === 0) return;

    // Várias bombas na mesma explosão em cadeia tocam um único estrondo (senão o volume se soma).
    const heard = new Set<string>();
    let blocksChanged = false;
    recordEvents(this.session.scores!, events, this.gameState.players);
    for (const event of events) {
      if (event.type === 'blockDestroyed' || event.type === 'blockGrown') blocksChanged = true;
      if (event.type === 'cellClosed') {
        blocksChanged = true;
        drawClosedWall(this.closedView, event.col, event.row);
        heard.add('tick');
      }
      if (event.type === 'dartWarn') heard.add('tick');
      if (event.type === 'boulderWarn') {
        heard.add('tick');
        this.cameras.main.shake(2400, 0.0012); // o chão treme até a pedra cair
      }
      if (event.type === 'boulderRoll') {
        heard.add('explode');
        this.cameras.main.shake(1400, 0.0025);
      }
      if (event.type === 'dartFired') heard.add('place');
      if (event.type === 'powerUsed') {
        heard.add('pickup');
        this.showPowerLabel(event.playerId, POWER_LABELS[event.kind]);
      }
      if (event.type === 'teleported') heard.add('confirm');
      if (event.type === 'iceCracked') heard.add('tick');
      if (event.type === 'iceBroken') heard.add('place');
      if (event.type === 'bombPlaced' || event.type === 'bombKicked' || event.type === 'bombThrown') heard.add('place');
      if (event.type === 'bombPlaced') triggerBombPose(this.playerViews.get(event.owner), this.gameState.tick);
      if (event.type === 'bombExploded') heard.add('explode');
      if (event.type === 'playerHit' || event.type === 'thrownHit') heard.add('hit');
      if (event.type === 'itemPicked' || event.type === 'vestBroken') heard.add('pickup');
      if (event.type === 'playerRevived') heard.add('pickup');
      if (event.type === 'roundEnded') this.showResult(event.outcome);
    }

    this.elephantView.onEvents(events);
    this.fx.onEvents(events, this.gameState);
    this.flameSprites.onEvents(events, this.gameState, FLAME_TICKS);
    if (blocksChanged) redrawBlocks(this.blocksView, this.gameState.arena);
    if (heard.has('tick')) sfx.play('tick');
    if (heard.has('place')) sfx.play('place');
    if (heard.has('explode')) sfx.play('explode');
    if (heard.has('hit')) sfx.play('hit');
    if (heard.has('pickup')) sfx.play('pickup');
    if (heard.has('confirm')) sfx.play('confirm');
  }

  /** Nome do poder subindo e sumindo em cima de quem o usou. */
  private showPowerLabel(playerId: number, label: string): void {
    const player = this.gameState.players.find((p) => p.id === playerId);
    if (!player) return;
    const text = this.add
      .text(player.x * TILE_SIZE, player.y * TILE_SIZE - 58, label, { fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({ targets: text, y: text.y - 46, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => text.destroy() });
  }

  private showResult(outcome: NonNullable<GameState['round']['outcome']>): void {
    if (this.overlayShown) return;
    this.overlayShown = true;
    const { match } = this.session;
    const { players } = this.gameState;
    const scores = this.session.scores!;
    recordRound(match, outcome, players);
    recordRoundScore(scores, outcome, players);
    if (match.finished) {
      recordMatchScore(scores, match, players);
      music.fadeOut(MATCH_END_FADE_MS); // a música da arena vai sumindo aos poucos até o zero
    }
    const ranked = rankPlayers(scores, players);
    const text = describeRoundEnd(outcome, match, players);
    text.lines = rankingLines(ranked, players);
    if (match.finished) {
      const note = this.saveRecords(ranked);
      if (note) text.lines.push(note);
    }
    sfx.play(text.tone === 'good' ? 'win' : 'lose');
    this.hud.update(this.gameState, match, this.session.scores);
    showOutcomeOverlay(this, this.gameState.arena.cols * TILE_SIZE, this.gameState.arena.rows * TILE_SIZE, text);
  }

  /** Fim da partida: guarda a pontuação de cada pessoa no Top 10. Devolve um aviso se alguém entrou no ranking. */
  private saveRecords(ranked: readonly RankedPlayer[]): string | null {
    let entries = loadRanking();
    const today = new Date().toISOString().slice(0, 10);
    const { config } = this.session;
    const hasCpu = this.gameState.players.some((p) => p.cpu);
    let note: string | null = null;
    for (const row of ranked) {
      if (this.gameState.players.find((p) => p.id === row.id)?.cpu) continue;
      const entry = { name: characterById(this.characters[row.id]).name, points: row.points, kills: row.kills, difficulty: hasCpu ? config.difficulty : null, date: today };
      const position = rankingPosition(entries, entry);
      entries = addToRanking(entries, entry);
      if (position !== null && (note === null || position === 1)) note = position === 1 ? `Novo recorde! ${entry.name}: ${entry.points} pts` : `${entry.name} entrou no Top 10 (${position}º lugar)`;
    }
    saveRanking(entries);
    return note;
  }

  /** Copia o estado do core (jogadores, itens, bombas, chamas, placar) para os desenhos. */
  private syncViews(): void {
    // Acabou o tempo: começa a música da morte súbita (a mesma em todas as fases).
    if (this.gameState.round.suddenDeath && !this.suddenMusic && this.gameState.round.phase === 'playing') {
      this.suddenMusic = true;
      music.play(SUDDEN_DEATH_MUSIC);
    }
    this.hazardsView.update(this.gameState);
    this.elephantView.update(this.gameState);
    this.planeView.update(this.gameState);
    this.snowView?.update();
    drawItems(this.itemsView, this.gameState, (kind) => hasItemIcon(this, kind));
    this.itemSprites.update(this.gameState);
    const spriteFlames = this.flameSprites.ready;
    if (spriteFlames) this.flameSprites.update(this.gameState);
    drawEffects(this.effectsView, this.gameState, spriteFlames);
    for (const player of this.gameState.players) {
      const view = this.playerViews.get(player.id);
      if (!view) continue;
      // Na vitória, quem está de pé no time vencedor comemora (a pose só existe para personagens com sprites).
      const round = this.gameState.round;
      const winnerTeam = round.outcome ? teamOfOutcome(round.outcome, this.gameState.players) : null;
      const celebrate = round.phase !== 'playing' && player.alive && (round.outcome === null || winnerTeam === player.team);
      syncPlayerView(view, player, this.gameState.arena, this.gameState.tick, celebrate);
    }
    this.hud.update(this.gameState, this.session.match, this.session.scores);
  }
}
