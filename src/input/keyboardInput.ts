import Phaser from 'phaser';
import type { Direction, Intents, PlayerIntent } from '../core';
import { DIRECTIONS, MUTE_KEY, PAUSE_KEY, PLAYER_CONTROLS, QUIT_KEY, RESTART_KEY } from './controls';
import type { HumanId } from './controls';
import { DirectionStack } from './directionStack';
import { padBack, padBomb, padDirection, padSpecial, padStart } from './gamepad';
import { readPad } from './padReader';

// Lê o teclado de verdade (via Phaser) e o transforma em "intenções" para o core.
// O core nunca vê teclas: só recebe { move: 'up' | 'down' | 'left' | 'right' | null, placeBomb }.

interface PlayerInput {
  stack: DirectionStack;
  /** Aperto único: guardado até o próximo passo da simulação consumir. Segurar a tecla não repete. */
  bombPressed: boolean;
  specialPressed: boolean;
  /** Estado do controle no quadro anterior (para detectar o aperto, e não o botão segurado). */
  padBomb: boolean;
  padSpecial: boolean;
  /** Direção pedida pelo controle neste quadro. */
  padMove: Direction | null;
  /** Direção pedida pela alavanca de toque. */
  touchMove: Direction | null;
}

export class KeyboardInput {
  private readonly scene: Phaser.Scene;
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;
  private readonly keys: Phaser.Input.Keyboard.Key[] = [];
  private readonly players = new Map<HumanId, PlayerInput>();
  private mutePressed = false;
  private restartPressed = false;
  private pausePressed = false;
  private quitPressed = false;
  private startPressed = false;
  private readonly padStartHeld: boolean[] = [];
  private readonly padBackHeld: boolean[] = [];

  // Quando a janela perde o foco, o navegador pode não avisar que as teclas foram soltas.
  // Sem isto, os jogadores continuariam andando sozinhos ao voltar.
  private readonly onBlur = (): void => {
    for (const input of this.players.values()) {
      input.stack.clear();
      input.bombPressed = false;
      input.specialPressed = false;
      input.padMove = null;
      input.touchMove = null;
    }
  };

  /** `playerIds`: quem está na partida. Só as teclas desses jogadores são ligadas. */
  constructor(scene: Phaser.Scene, playerIds: readonly HumanId[]) {
    this.scene = scene;
    this.keyboard = scene.input.keyboard;

    // addKey também impede que as setas e o espaço rolem a página do navegador.
    if (this.keyboard) {
      for (const id of playerIds) {
        const input: PlayerInput = { stack: new DirectionStack(), bombPressed: false, specialPressed: false, padBomb: false, padSpecial: false, padMove: null, touchMove: null };
        this.players.set(id, input);
        const controls = PLAYER_CONTROLS[id];

        for (const direction of DIRECTIONS) {
          for (const name of controls[direction]) {
            const key = this.keyboard.addKey(name);
            key.on('down', () => input.stack.press(name, direction));
            key.on('up', () => input.stack.release(name));
            this.keys.push(key);
          }
        }

        // O navegador manda 'repeat' enquanto a tecla fica apertada; isso não deve colocar várias bombas.
        for (const name of controls.bomb) {
          const bombKey = this.keyboard.addKey(name);
          bombKey.on('down', (_key: unknown, event: KeyboardEvent) => {
            if (!event?.repeat) input.bombPressed = true;
          });
          this.keys.push(bombKey);
        }
        for (const name of controls.special) {
          const specialKey = this.keyboard.addKey(name);
          specialKey.on('down', (_key: unknown, event: KeyboardEvent) => {
            if (!event?.repeat) input.specialPressed = true;
          });
          this.keys.push(specialKey);
        }
      }

      const muteKey = this.keyboard.addKey(MUTE_KEY);
      muteKey.on('down', (_key: unknown, event: KeyboardEvent) => {
        if (!event?.repeat) this.mutePressed = true;
      });
      const restartKey = this.keyboard.addKey(RESTART_KEY);
      restartKey.on('down', (_key: unknown, event: KeyboardEvent) => {
        if (!event?.repeat) this.restartPressed = true;
      });
      const pauseKey = this.keyboard.addKey(PAUSE_KEY);
      pauseKey.on('down', (_key: unknown, event: KeyboardEvent) => {
        if (!event?.repeat) this.pausePressed = true;
      });
      const quitKey = this.keyboard.addKey(QUIT_KEY);
      quitKey.on('down', (_key: unknown, event: KeyboardEvent) => {
        if (!event?.repeat) this.quitPressed = true;
      });
      this.keys.push(muteKey, restartKey, pauseKey, quitKey);
    } else {
      console.warn('[Bomb Arena] Teclado indisponível: o Phaser não ativou o plugin de teclado.');
    }

    scene.game.events.on(Phaser.Core.Events.BLUR, this.onBlur);
  }

  /**
   * Intenção de cada jogador neste instante. `placeBomb` vale uma vez por aperto: depois de entregue, volta a falso.
   * (Vários passos podem rodar no mesmo quadro; só o primeiro recebe o aperto.)
   */
  getIntents(): Intents {
    const intents: Intents = {};
    for (const [id, input] of this.players) {
      // O teclado tem prioridade; sem tecla apertada, vale o controle de videogame.
      const intent: PlayerIntent = {
        move: input.stack.current() ?? input.padMove ?? input.touchMove,
        placeBomb: input.bombPressed,
        special: input.specialPressed,
      };
      input.bombPressed = false;
      input.specialPressed = false;
      intents[id] = intent;
    }
    return intents;
  }

  /**
   * Lê os controles de videogame. Chame UMA vez por quadro, antes dos passos da simulação.
   * O controle de número N (o primeiro que ligou é o 1) comanda o jogador N; quem joga sozinho usa o controle 1.
   * Start (pausa/continua, ou próxima rodada) e Select (menu) valem para qualquer controle.
   */
  pollGamepads(): void {
    const plugin = this.scene.input.gamepad;
    if (!plugin) return;
    for (const [id, input] of this.players) {
      const snapshot = readPad(plugin.getPad(id - 1));
      if (!snapshot) {
        input.padMove = null;
        input.padBomb = false;
        input.padSpecial = false;
        continue;
      }
      input.padMove = padDirection(snapshot);
      const bomb = padBomb(snapshot);
      const special = padSpecial(snapshot);
      if (bomb && !input.padBomb) input.bombPressed = true;
      if (special && !input.padSpecial) input.specialPressed = true;
      input.padBomb = bomb;
      input.padSpecial = special;
    }
    for (let index = 0; index < plugin.total; index++) {
      const snapshot = readPad(plugin.getPad(index));
      if (!snapshot) continue;
      const start = padStart(snapshot);
      const back = padBack(snapshot);
      if (start && !this.padStartHeld[index]) this.startPressed = true;
      if (back && !this.padBackHeld[index]) this.quitPressed = true;
      this.padStartHeld[index] = start;
      this.padBackHeld[index] = back;
    }
  }

  // ---- Controle por toque (celular): a TouchControls chama estes métodos ----
  setTouchMove(id: HumanId, direction: Direction | null): void {
    const input = this.players.get(id);
    if (input) input.touchMove = direction;
  }
  touchBomb(id: HumanId): void {
    const input = this.players.get(id);
    if (input) input.bombPressed = true;
  }
  touchSpecial(id: HumanId): void {
    const input = this.players.get(id);
    if (input) input.specialPressed = true;
  }
  /** Como o Start do controle: pausa/continua, ou próxima rodada. */
  touchStart(): void {
    this.startPressed = true;
  }
  /** Como a tecla Q: volta ao menu (vale com o jogo pausado ou a rodada acabada). */
  touchQuit(): void {
    this.quitPressed = true;
  }

  /** Verdadeiro uma vez a cada aperto de Start no controle (a cena decide: pausar/continuar ou próxima rodada). */
  consumeStart(): boolean {
    const pressed = this.startPressed;
    this.startPressed = false;
    return pressed;
  }

  /** Verdadeiro uma vez a cada aperto de R (reiniciar a rodada). */
  consumeRestart(): boolean {
    const pressed = this.restartPressed;
    this.restartPressed = false;
    return pressed;
  }

  /** Verdadeiro uma vez a cada aperto de Esc (pausar/continuar). */
  consumePause(): boolean {
    const pressed = this.pausePressed;
    this.pausePressed = false;
    return pressed;
  }

  /** Verdadeiro uma vez a cada aperto de Q (voltar ao menu). */
  consumeQuit(): boolean {
    const pressed = this.quitPressed;
    this.quitPressed = false;
    return pressed;
  }

  /** Verdadeiro uma vez a cada aperto da tecla M (liga/desliga o som). */
  consumeMuteToggle(): boolean {
    const pressed = this.mutePressed;
    this.mutePressed = false;
    return pressed;
  }

  /** Solta as teclas e os ouvintes. Chamado quando a cena termina (necessário quando a partida reiniciar). */
  destroy(): void {
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.onBlur);
    for (const key of this.keys) {
      this.keyboard?.removeKey(key, true);
    }
    this.keys.length = 0;
    this.players.clear();
    this.mutePressed = false;
    this.restartPressed = false;
    this.pausePressed = false;
    this.quitPressed = false;
    this.startPressed = false;
  }
}
