// Música de fundo das partidas. Fora do core: é só apresentação.
// Usa um elemento de áudio comum (toca em loop, carrega aos poucos e não pesa na abertura do jogo).
import { SUDDEN_DEATH_MUSIC } from '../config/stages';
import { pickTrack } from './musicPick';
import { loadSettings } from '../menu/settingsStorage';
import { sfx } from './sfx';

/** Músicas dos menus (tudo fora das batalhas): tocam uma depois da outra, sem parar. */
export const MENU_PLAYLIST = ['audio/menu.ogg', 'audio/8bit_bossa.mp3'] as const;

export { SUDDEN_DEATH_MUSIC, pickTrack };

/** A música fica bem abaixo dos efeitos para não cobrir os estrondos. */
const MUSIC_GAIN = 0.8;

class Music {
  private element: HTMLAudioElement | null = null;
  private current: string | null = null;
  private stopTimer: number | undefined;
  /** Volume da música pelo nível do menu (0 a 10), com a mesma curva dos sons. */
  private level = 0.6;
  /** Abafa a música (1 = normal): usado na contagem regressiva do início da rodada. */
  private duck = 1;
  private fadeTimer: number | undefined;

  /** Toca a faixa (ou nada, se não houver). Chamar de novo com a mesma faixa não reinicia. */
  play(file: string | undefined, loop = true): void {
    window.clearTimeout(this.stopTimer);
    if (!file) {
      this.stopNow();
      return;
    }
    try {
      if (this.current !== file || !this.element) {
        this.stopNow();
        this.element = new Audio(file);
        this.element.loop = loop;
        this.current = file;
      }
      this.sync();
      if (this.element.paused && !sfx.muted) void this.element.play().catch(() => undefined);
    } catch {
      // Sem áudio: o jogo segue sem música.
    }
  }

  /** Música de fundo dos menus (volume do menu de Opções, um pouco mais baixa que na partida). */
  playMenu(): void {
    this.setLevel(loadSettings().music);
    this.setDuck(0.7);
    // Já está tocando uma música de menu (mudou só de tela)? Segue sem reiniciar.
    if (this.current && (MENU_PLAYLIST as readonly string[]).includes(this.current) && this.element) {
      window.clearTimeout(this.stopTimer);
      this.sync();
      return;
    }
    this.playMenuTrack(this.menuNext);
  }

  /** Posição, na lista dos menus, da próxima música a tocar. */
  private menuNext = 0;

  private playMenuTrack(index: number): void {
    const i = index % MENU_PLAYLIST.length;
    this.play(MENU_PLAYLIST[i], false);
    this.menuNext = i + 1;
    if (this.element) {
      this.element.onended = () => {
        // Ao terminar, passa para a outra (só se ainda estamos nos menus).
        if (this.current && (MENU_PLAYLIST as readonly string[]).includes(this.current)) this.playMenuTrack(this.menuNext);
      };
    }
  }

  /** Para a música daqui a pouco, a não ser que outra partida comece logo em seguida (reiniciar a rodada). */
  release(): void {
    window.clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => this.stopNow(), 400);
  }

  /** Nível do menu: 0 (mudo) a 10. */
  setLevel(level: number): void {
    const clamped = Math.min(10, Math.max(0, level));
    this.level = (clamped / 10) ** 2;
    this.sync();
  }

  /** Abafa na hora (fator de 0 a 1). */
  setDuck(factor: number): void {
    window.clearInterval(this.fadeTimer);
    this.duck = factor;
    this.sync();
  }

  /** Volta ao volume normal aos poucos (em `ms` milissegundos). */
  fadeDuckTo(target: number, ms: number): void {
    window.clearInterval(this.fadeTimer);
    const steps = 20;
    const from = this.duck;
    let n = 0;
    this.fadeTimer = window.setInterval(() => {
      n += 1;
      this.duck = from + ((target - from) * n) / steps;
      this.sync();
      if (n >= steps) window.clearInterval(this.fadeTimer);
    }, ms / steps);
  }

  /** Acompanha o volume do menu e o mudo (tecla M). */
  sync(): void {
    const el = this.element;
    if (!el) return;
    el.volume = Math.min(1, this.level * this.duck * MUSIC_GAIN);
    if (sfx.muted) el.pause();
    else if (el.paused) void el.play().catch(() => undefined);
  }

  private stopNow(): void {
    if (this.element) {
      this.element.onended = null;
      this.element.pause();
      this.element.src = '';
    }
    this.element = null;
    this.current = null;
  }
}

export const music = new Music();
