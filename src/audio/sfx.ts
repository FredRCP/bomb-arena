// Sons provisórios, sintetizados na hora (sem arquivos de áudio, sem direitos autorais).
// Ficam fora do core: som é apresentação, a regra do jogo não depende dele.

export type SfxKind = 'place' | 'explode' | 'hit' | 'win' | 'lose' | 'pickup' | 'tick' | 'confirm';

export class Sfx {
  muted = false;
  /** Volume de 0 a 1 (o menu usa 0 a 10; veja setLevel). */
  private volume = 0.7;
  private context: AudioContext | null = null;
  /** Controle de volume geral: todos os sons passam por ele antes de sair. */
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  /**
   * O navegador só libera áudio depois de o jogador interagir com a página. Criamos o contexto sob demanda,
   * no primeiro som: isso acontece depois de uma tecla apertada, então é permitido.
   * Qualquer falha de áudio é ignorada de propósito: o jogo continua sem som.
   */
  play(kind: SfxKind): void {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      if (kind === 'place') this.blip(ctx, now);
      else if (kind === 'pickup') this.pickup(ctx, now);
      else if (kind === 'tick') this.tick(ctx, now);
      else if (kind === 'confirm') this.jingle(ctx, now, [523, 784], 0.1);
      else if (kind === 'explode') this.boom(ctx, now);
      else if (kind === 'hit') this.hit(ctx, now);
      else this.jingle(ctx, now, kind === 'win' ? [392, 523, 659, 784] : [392, 330, 262, 196]);
    } catch (error) {
      console.warn('[Bomb Arena] Não foi possível tocar o som:', error);
    }
  }

  /**
   * Define o volume pelo nível do menu (0 = mudo, 10 = máximo). A curva ao quadrado faz os níveis baixos
   * soarem mais baixos de verdade (o ouvido percebe volume de forma logarítmica).
   */
  setLevel(level: number): void {
    const clamped = Math.min(10, Math.max(0, level));
    this.volume = (clamped / 10) ** 2;
    if (this.master) this.master.gain.value = this.volume;
  }

  /** Volume atual, de 0 a 1 (já com a curva do menu). */
  get volumeNow(): number {
    return this.volume;
  }

  /** Alterna entre som ligado e desligado. Devolve o novo estado de `muted`. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private getContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof AudioContext === 'undefined') return null;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.context.destination);
    return this.context;
  }

  private output(ctx: AudioContext): AudioNode {
    return this.master ?? ctx.destination;
  }

  /** Dois toques rápidos subindo: "pegou um item". */
  private pickup(ctx: AudioContext, t: number): void {
    this.jingle(ctx, t, [659, 988], 0.07);
  }

  /** Um clique curtinho: navegação no menu. */
  private tick(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain).connect(this.output(ctx));
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** Um "pop" curto e agudo. */
  private blip(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.08);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain).connect(this.output(ctx));
    osc.start(t);
    osc.stop(t + 0.11);
  }

  /** Ruído que vai ficando mais grave e baixo, com um tom grave por baixo. */
  private boom(ctx: AudioContext, t: number): void {
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 0.5);
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.45);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    source.connect(filter).connect(gain).connect(this.output(ctx));
    source.start(t);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    oscGain.gain.setValueAtTime(0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(oscGain).connect(this.output(ctx));
    osc.start(t);
    osc.stop(t + 0.36);
  }

  /** Tom descendente: "perdeu". */
  private hit(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.4);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(gain).connect(this.output(ctx));
    osc.start(t);
    osc.stop(t + 0.46);
  }

  /** Notas seguidas: subindo é vitória, descendo é derrota/empate. `gap` é o intervalo entre as notas, em segundos. */
  private jingle(ctx: AudioContext, t: number, notes: number[], gap = 0.13): void {
    notes.forEach((frequency, index) => {
      const start = t + index * gap;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain).connect(this.output(ctx));
      osc.start(start);
      osc.stop(start + 0.23);
    });
  }
}

/**
 * O som é um só para o jogo inteiro (menu e partida): assim o volume escolhido no menu e o mudo (tecla M)
 * continuam valendo ao trocar de tela e ao reiniciar a rodada.
 */
export const sfx = new Sfx();
