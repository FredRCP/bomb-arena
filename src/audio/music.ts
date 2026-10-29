// Música de fundo das partidas. Fora do core: é só apresentação.
// Usa um elemento de áudio comum (toca em loop, carrega aos poucos e não pesa na abertura do jogo).
import { SUDDEN_DEATH_MUSIC } from '../config/stages';
import { pickTrack } from './musicPick';
import { sfx } from './sfx';

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
  play(file: string | undefined): void {
    window.clearTimeout(this.stopTimer);
    if (!file) {
      this.stopNow();
      return;
    }
    try {
      if (this.current !== file || !this.element) {
        this.stopNow();
        this.element = new Audio(file);
        this.element.loop = true;
        this.current = file;
      }
      this.sync();
      if (this.element.paused && !sfx.muted) void this.element.play().catch(() => undefined);
    } catch {
      // Sem áudio: o jogo segue sem música.
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
      this.element.pause();
      this.element.src = '';
    }
    this.element = null;
    this.current = null;
  }
}

export const music = new Music();
