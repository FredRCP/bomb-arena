// Música de fundo das partidas. Fora do core: é só apresentação.
// Usa um elemento de áudio comum (toca em loop, carrega aos poucos e não pesa na abertura do jogo).
import { sfx } from './sfx';

/** Arquivo de música de cada arena (relativo a public/). Arena sem entrada fica sem música. */
export const STAGE_MUSIC: Record<string, string> = { classic: 'audio/classic.ogg' };

/** A música fica bem abaixo dos efeitos para não cobrir os estrondos. */
const MUSIC_GAIN = 0.45;

class Music {
  private element: HTMLAudioElement | null = null;
  private current: string | null = null;
  private stopTimer: number | undefined;

  /** Toca a música da arena (ou nada, se não houver). Chamar de novo com a mesma faixa não reinicia. */
  play(stage: string): void {
    window.clearTimeout(this.stopTimer);
    const file = STAGE_MUSIC[stage];
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

  /** Acompanha o volume do menu e o mudo (tecla M). */
  sync(): void {
    const el = this.element;
    if (!el) return;
    el.volume = Math.min(1, sfx.volumeNow * MUSIC_GAIN);
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
