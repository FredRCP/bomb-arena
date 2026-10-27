import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { AI_SETTINGS } from '../config/ai';
import { COUNTDOWN_SECONDS } from '../config/round';
import { TICKS_PER_SECOND } from '../config/simulation';
import { characterById, defaultChoices } from '../characters/characters';
import type { CharacterChoices } from '../characters/characters';
import { applyItem, createAi, createScoreboard, rankPlayers, recordEvents, recordMatchScore, recordRoundScore, createFixedStepper, createGameState, createMatch, drainEvents, nextRound, recordRound, step, teamOfOutcome } from '../core';
import type { AiController, GameState, MatchState, PlayerId, Scoreboard } from '../core';
import type { HumanId } from '../input/controls';
import { KeyboardInput } from '../input/keyboardInput';
import { TouchControls } from '../input/touchControls';
import { wantsTouchControls } from '../input/touchUi';
import { parseGameConfig } from '../menu/gameConfig';
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
import { SCREEN_HEIGHT, SCREEN_WIDTH, SIDE_WIDTH, TOP_HEIGHT, placeArena } from '../render/layout';
import { addMenuBackground } from '../render/menuBackground';
import { has, themeById, themeKey } from '../render/theme';
import type { Hud } from '../render/Hud';
import { showOutcomeOverlay } from '../render/OutcomeOverlay';
import { describeRoundEnd, rankingLines, setCpuNames } from '../render/outcomeText';
import { addToRanking, rankingPosition } from '../menu/ranking';
import { loadRanking, saveRanking } from '../menu/rankingStorage';
import type { RankedPlayer } from '../core';

/** Tudo que atravessa o reinício da cena: a configuração da partida e o placar. A rodada em si é descartada. */
export interface GameSession {
  config: GameConfig;
  match: MatchState;
  /** Pontos de cada jogador na partida (sobrevive entre as rodadas). Ausente: começa zerado. */
  scores?: Scoreboard;
  /** Personagem de cada jogador (id do jogador -> id do personagem). Ausente: escolha padrão. */
  characters?: CharacterChoices;
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
    this.gameState = createGameState({ seed, players: config.players, enemies: config.enemies, items: config.items, sideline: config.sideline ?? true, teams: config.teams, ...(config.teamAssignment && { teamAssignment: config.teamAssignment }), enemySpeedScale: AI_SETTINGS[config.difficulty].speedScale, ...(config.time !== undefined && { roundTicks: config.time * TICKS_PER_SECOND }) });
    this.characters = this.session.characters ?? defaultChoices(this.gameState.players.length);
    // O computador aparece com o nome do personagem que está jogando (e não "CPU 1", "CPU 2"...).
    const cpuNames: Record<number, string> = {};
    for (const player of this.gameState.players) if (player.cpu) cpuNames[player.id] = characterById(this.characters[player.id]).name;
    setCpuNames(cpuNames);
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

    placeArena(this);
    const theme = themeById(config.stage);
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

    drawArena(this, this.gameState.arena, theme.id);
    this.blocksView = createBlocksView(this, this.gameState.arena, theme.id);
    this.itemsView = createItemsView(this);
    this.effectsView = createEffectsView(this);
    this.fx = new Effects(this, theme.id);
    this.flameSprites = new FlameSprites(this);
    this.itemSprites = new ItemSprites(this);
    this.closedView = createClosedView(this, theme.id);
    for (const player of this.gameState.players) {
      this.playerViews.set(player.id, createPlayerView(this, player, characterById(this.characters[player.id])));
    }
    this.hud = createHud(this, this.gameState, this.characters);

    this.debugText = null;
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      this.debugText = this.add.text(-SIDE_WIDTH + 12, -TOP_HEIGHT + 4, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe66d' }).setDepth(50);
      this.debugMs = 0;
      this.debugTicks = 0;
    }

    this.keyboardInput = new KeyboardInput(this, this.humans as HumanId[]);
    this.touchControls = this.humans.includes(1) && wantsTouchControls() ? new TouchControls(this, this.keyboardInput) : null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyboardInput.destroy());

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
  update(): void {
    // Tempo real do quadro, medido aqui. NÃO usamos o `delta` do Phaser: ele suaviza e limita os quadros lentos
    // (um quadro de 100 ms chega como ~16 ms), e aí o jogo anda em câmera lenta sempre que a máquina engasga,
    // por exemplo nos primeiros segundos depois de abrir a cena. Com o tempo real, o passo fixo recupera o atraso.
    const now = performance.now();
    const delta = now - this.lastFrameMs;
    this.lastFrameMs = now;

    if (this.keyboardInput.consumeMuteToggle()) {
      console.info(`[Bomb Arena] Som ${sfx.toggleMute() ? 'desligado' : 'ligado'}.`);
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
      for (const ai of this.ais) intents[ai.playerId] = ai.decide(this.gameState);
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
      this.scene.restart({ config, match, characters: this.characters, scores: this.session.scores });
    } else if (match.finished) {
      this.scene.restart({ config: { ...config, seed: config.seed + SEED_STEP_PER_MATCH }, match: createMatch(config.wins), characters: this.characters });
    } else {
      nextRound(match);
      this.scene.restart({ config, match, characters: this.characters, scores: this.session.scores });
    }
  }

  private setPaused(paused: boolean): void {
    if (!paused) {
      for (const object of this.pauseObjects) object.destroy();
      this.pauseObjects = [];
      return;
    }
    this.pauseObjects = showOutcomeOverlay(this, this.gameState.arena.cols * TILE_SIZE, this.gameState.arena.rows * TILE_SIZE, {
      title: 'Pausado',
      tone: 'neutral',
      hint: 'Esc/Start: continuar   R: reiniciar a rodada   Q/Select: menu',
    });
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
      if (event.type === 'blockDestroyed') blocksChanged = true;
      if (event.type === 'cellClosed') {
        blocksChanged = true;
        drawClosedWall(this.closedView, event.col, event.row);
        heard.add('tick');
      }
      if (event.type === 'bombPlaced' || event.type === 'bombKicked' || event.type === 'bombThrown') heard.add('place');
      if (event.type === 'bombPlaced') triggerBombPose(this.playerViews.get(event.owner), this.gameState.tick);
      if (event.type === 'bombExploded') heard.add('explode');
      if (event.type === 'playerHit') heard.add('hit');
      if (event.type === 'itemPicked' || event.type === 'vestBroken') heard.add('pickup');
      if (event.type === 'playerRevived') heard.add('pickup');
      if (event.type === 'roundEnded') this.showResult(event.outcome);
    }

    this.fx.onEvents(events, this.gameState);
    this.flameSprites.onEvents(events, this.gameState, FLAME_TICKS);
    if (blocksChanged) redrawBlocks(this.blocksView, this.gameState.arena);
    if (heard.has('tick')) sfx.play('tick');
    if (heard.has('place')) sfx.play('place');
    if (heard.has('explode')) sfx.play('explode');
    if (heard.has('hit')) sfx.play('hit');
    if (heard.has('pickup')) sfx.play('pickup');
  }

  private showResult(outcome: NonNullable<GameState['round']['outcome']>): void {
    if (this.overlayShown) return;
    this.overlayShown = true;
    const { match } = this.session;
    const { players } = this.gameState;
    const scores = this.session.scores!;
    recordRound(match, outcome, players);
    recordRoundScore(scores, outcome, players);
    if (match.finished) recordMatchScore(scores, match, players);
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
