// Sons provisórios, sintetizados na hora (sem arquivos de áudio, sem direitos autorais).
// Ficam fora do core: som é apresentação, a regra do jogo não depende dele.

export type PowerSfx = 'power-elephant' | 'power-airplane' | 'power-shield' | 'power-freeze' | 'power-stork' | 'power-confuse' | 'power-ghost' | 'power-jump' | 'power-sprint' | 'power-slime' | 'power-invisible' | 'power-twinbombs' | 'power-fog' | 'power-chocolate';
export type SfxKind = 'place' | 'explode' | 'hit' | 'win' | 'lose' | 'pickup' | 'tick' | 'confirm' | 'fanfare' | 'sad' | 'cannon' | PowerSfx;

/**
 * Arquivos de som próprios (opcional): se existir public/sfx/<nome>.ogg (ou .mp3/.wav), ele toca no lugar do som sintetizado.
 * Os nomes são os do tipo SfxKind: power-airplane, power-elephant, power-shield, power-freeze, win, lose, fanfare, sad, cannon...
 */
const OVERRIDE_EXTENSIONS = ['ogg', 'mp3', 'wav'] as const;

export class Sfx {
  muted = false;
  /** Volume de 0 a 1 (o menu usa 0 a 10; veja setLevel). */
  private volume = 0.7;
  /** Ganho fixo dos efeitos: deixa o som geral um pouco mais baixo do que o nível do menu indica. */
  private static readonly GAIN = 0.7;
  private context: AudioContext | null = null;
  /** Controle de volume geral: todos os sons passam por ele antes de sair. */
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  /** Sons de arquivo já carregados (null = não existe arquivo: usa o sintetizado). */
  private readonly overrides = new Map<string, AudioBuffer | null>();

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
      if (this.overrides.has(kind)) {
        const buffer = this.overrides.get(kind);
        if (buffer) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.output(ctx));
          source.start(now);
          return;
        }
      } else {
        this.overrides.set(kind, null);
        void this.loadOverride(ctx, kind);
      }
      this.synth(ctx, now, kind);
    } catch (error) {
      console.warn('[Bomb Arena] Não foi possível tocar o som:', error);
    }
  }

  /** Procura public/sfx/<kind>.(ogg|mp3|wav); se achar, passa a usar esse arquivo a partir do próximo disparo. */
  private async loadOverride(ctx: AudioContext, kind: string): Promise<void> {
    const base = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.BASE_URL : '/';
    for (const ext of OVERRIDE_EXTENSIONS) {
      try {
        const response = await fetch(`${base}sfx/${kind}.${ext}`);
        const type = response.headers.get('content-type') ?? '';
        if (!response.ok || type.includes('text/html')) continue;
        this.overrides.set(kind, await ctx.decodeAudioData(await response.arrayBuffer()));
        return;
      } catch {
        /* sem arquivo (ou formato que o navegador não lê): segue com o som sintetizado */
      }
    }
  }

  private synth(ctx: AudioContext, now: number, kind: SfxKind): void {
    if (kind === 'place') this.blip(ctx, now);
    else if (kind === 'pickup') this.pickup(ctx, now);
    else if (kind === 'tick') this.tick(ctx, now);
    else if (kind === 'confirm') this.jingle(ctx, now, [523, 784], 0.1);
    else if (kind === 'explode') this.boom(ctx, now);
    else if (kind === 'hit') this.hit(ctx, now);
    else if (kind === 'win') this.jingle(ctx, now, [392, 523, 659, 784]);
    else if (kind === 'lose') this.jingle(ctx, now, [392, 330, 262, 196]);
    else if (kind === 'fanfare') this.fanfare(ctx, now);
    else if (kind === 'sad') this.sad(ctx, now);
    else if (kind === 'cannon') this.cannon(ctx, now);
    else this.power(ctx, now, kind);
  }

  /**
   * Define o volume pelo nível do menu (0 = mudo, 10 = máximo). A curva ao quadrado faz os níveis baixos
   * soarem mais baixos de verdade (o ouvido percebe volume de forma logarítmica).
   */
  setLevel(level: number): void {
    const clamped = Math.min(10, Math.max(0, level));
    this.volume = (clamped / 10) ** 2;
    if (this.master) this.master.gain.value = this.volume * Sfx.GAIN;
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
    this.master.gain.value = this.volume * Sfx.GAIN;
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

  // ---- Blocos de construção dos sons de poder ----

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 0.5);
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  /** Tom que desliza de `f0` a `f1` em `dur` s, com volume `vol` e vibrato opcional (Hz, profundidade em Hz). */
  private sweep(ctx: AudioContext, t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, vibrato?: [number, number]): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.04, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = vibrato[0];
      depth.gain.value = vibrato[1];
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.02);
    }
    osc.connect(gain).connect(this.output(ctx));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Ruído filtrado: vento, chiado, whoosh. A frequência do filtro vai de `f0` a `f1`. */
  private hiss(ctx: AudioContext, t: number, filter: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, q = 1): void {
    const source = ctx.createBufferSource();
    source.buffer = this.getNoise(ctx);
    source.loop = true;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(f0, t);
    biquad.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    source.connect(biquad).connect(gain).connect(this.output(ctx));
    source.start(t);
    source.stop(t + dur + 0.02);
  }

  /** Fanfarra de vitória: arpejo brilhante subindo e um acorde final cheio (~2 s). */
  private fanfare(ctx: AudioContext, t: number): void {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => {
      this.sweep(ctx, t + i * 0.13, 'square', f, f, 0.2, 0.09);
      this.sweep(ctx, t + i * 0.13, 'triangle', f / 2, f / 2, 0.22, 0.12);
    });
    const end = t + notes.length * 0.13;
    for (const f of [523, 659, 784, 1047]) this.sweep(ctx, end, 'triangle', f, f, 0.9, 0.12);
    for (const f of [1047, 1319, 1568]) this.sweep(ctx, end, 'square', f, f, 0.8, 0.05);
    this.hiss(ctx, end, 'highpass', 5000, 9000, 0.5, 0.05); // brilho de confete
  }

  /** Derrota: "uóóó-uóóó" descendente, desanimado (trombone triste, ~2 s). */
  private sad(ctx: AudioContext, t: number): void {
    const notes: Array<[number, number, number]> = [[392, 370, 0.4], [370, 349, 0.4], [349, 330, 0.4], [330, 220, 1.0]];
    let at = t;
    for (const [a, b, d] of notes) {
      this.sweep(ctx, at, 'sawtooth', a, b, d, 0.1, [6, a * 0.015]);
      this.sweep(ctx, at, 'triangle', a / 2, b / 2, d, 0.1);
      at += d + 0.05;
    }
  }

  /** Canhão: estrondo grave com um estalo e fumaça. */
  private cannon(ctx: AudioContext, t: number): void {
    this.boom(ctx, t);
    this.sweep(ctx, t, 'sine', 90, 30, 0.5, 0.35);
    this.hiss(ctx, t, 'bandpass', 900, 200, 0.5, 0.18);
  }

  /** Um som para cada superpoder (sintetizado; troque por arquivo em public/sfx/ quando quiser). */
  private power(ctx: AudioContext, t: number, kind: SfxKind): void {
    switch (kind) {
      case 'power-airplane': {
        // Motor de hélice passando: zumbido grave pulsando, que sobe e some.
        this.sweep(ctx, t, 'sawtooth', 85, 150, 1.4, 0.13, [24, 18]);
        this.sweep(ctx, t + 0.1, 'sawtooth', 170, 110, 1.3, 0.06, [30, 25]);
        this.hiss(ctx, t, 'bandpass', 600, 1800, 1.3, 0.1, 2);
        break;
      }
      case 'power-elephant': {
        // Barrido de tromba de elefante.
        this.sweep(ctx, t, 'sawtooth', 260, 560, 0.35, 0.16, [9, 12]);
        this.sweep(ctx, t + 0.3, 'sawtooth', 560, 330, 0.55, 0.14, [11, 16]);
        this.sweep(ctx, t, 'square', 130, 280, 0.9, 0.05);
        this.hiss(ctx, t, 'bandpass', 700, 500, 0.7, 0.06, 3);
        break;
      }
      case 'power-shield': {
        // Teletransporte: zap subindo e "pop" de chegada com brilho.
        this.sweep(ctx, t, 'sine', 220, 2400, 0.16, 0.16);
        this.sweep(ctx, t + 0.17, 'sine', 2600, 300, 0.18, 0.14);
        [1319, 1760, 2349].forEach((f, i) => this.sweep(ctx, t + 0.32 + i * 0.06, 'triangle', f, f, 0.2, 0.08));
        break;
      }
      case 'power-freeze': {
        // Cristais de gelo: sininhos agudos e um estalo gelado.
        [3136, 2637, 3520, 2093, 2794].forEach((f, i) => this.sweep(ctx, t + i * 0.05, 'sine', f, f * 0.98, 0.5, 0.09));
        this.hiss(ctx, t, 'highpass', 4000, 7500, 0.45, 0.12);
        this.sweep(ctx, t, 'triangle', 900, 300, 0.25, 0.08);
        break;
      }
      case 'power-stork': {
        // Assobio de passarinho em duas notas e um "plim" de entrega.
        this.sweep(ctx, t, 'sine', 900, 1500, 0.14, 0.12, [18, 40]);
        this.sweep(ctx, t + 0.18, 'sine', 1200, 1900, 0.16, 0.12, [18, 40]);
        this.sweep(ctx, t + 0.45, 'triangle', 1568, 1568, 0.35, 0.1);
        break;
      }
      case 'power-confuse': {
        // Bagunça: notas bêbadas, balançando.
        [440, 330, 520, 280, 600].forEach((f, i) => this.sweep(ctx, t + i * 0.08, 'square', f, f * 0.8, 0.12, 0.07, [14, 30]));
        break;
      }
      case 'power-ghost': {
        // "Uuuuu" de fantasma: tom que oscila e sopro.
        this.sweep(ctx, t, 'sine', 520, 260, 0.9, 0.14, [7, 30]);
        this.hiss(ctx, t, 'bandpass', 1200, 400, 0.9, 0.08, 4);
        break;
      }
      case 'power-jump': {
        // Boing de mola.
        this.sweep(ctx, t, 'sine', 180, 720, 0.12, 0.17);
        this.sweep(ctx, t + 0.12, 'sine', 720, 240, 0.22, 0.15, [28, 40]);
        break;
      }
      case 'power-sprint': {
        // Arrancada: whoosh e zap subindo, estilo raio.
        this.hiss(ctx, t, 'bandpass', 300, 4000, 0.45, 0.2, 2);
        this.sweep(ctx, t, 'square', 300, 1800, 0.25, 0.08);
        this.sweep(ctx, t + 0.1, 'sawtooth', 150, 900, 0.3, 0.07);
        break;
      }
      case 'power-slime': {
        // Gosma: bolhas borbulhando.
        for (let i = 0; i < 6; i++) this.sweep(ctx, t + i * 0.07, 'sine', 180 + (i % 3) * 90, 480 + (i % 2) * 200, 0.1, 0.13);
        this.hiss(ctx, t, 'lowpass', 600, 300, 0.5, 0.07);
        break;
      }
      case 'power-invisible': {
        // Brilho que some: glissando suave descendente.
        [1760, 1319, 988, 659].forEach((f, i) => this.sweep(ctx, t + i * 0.09, 'triangle', f, f * 0.9, 0.3, 0.08));
        this.hiss(ctx, t, 'highpass', 6000, 3000, 0.5, 0.05);
        break;
      }
      case 'power-twinbombs': {
        // Duas bombinhas colocadas e o pavio chiando.
        this.blip(ctx, t);
        this.blip(ctx, t + 0.12);
        this.hiss(ctx, t + 0.05, 'highpass', 3000, 6000, 0.5, 0.07);
        break;
      }
      case 'power-fog': {
        // Vento: sopro que enche e vai embora.
        this.hiss(ctx, t, 'lowpass', 300, 1200, 1.1, 0.2, 0.7);
        this.sweep(ctx, t, 'sine', 120, 90, 1, 0.05, [2, 6]);
        break;
      }
      case 'power-chocolate': {
        // Três "toc toc toc" de bloco aparecendo, com um brilhinho doce.
        [0, 0.1, 0.2].forEach((d, i) => {
          this.sweep(ctx, t + d, 'square', 280 + i * 60, 140, 0.08, 0.14);
          this.hiss(ctx, t + d, 'bandpass', 900, 500, 0.08, 0.1, 3);
        });
        this.sweep(ctx, t + 0.35, 'triangle', 1175, 1568, 0.25, 0.07);
        break;
      }
      default:
        break;
    }
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
