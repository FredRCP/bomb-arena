import type { Direction } from '../core';

// Lembra quais teclas de direção estão apertadas e em que ordem.
// Regra: vale a direção da tecla apertada por ÚLTIMO que ainda está segurada.
// Assim, segurar "direita" e depois apertar "cima" vira para cima; soltar "cima" volta para a direita.
// Esta classe não conhece o Phaser nem o teclado de verdade: só nomes de teclas. Por isso é testável.

interface HeldKey {
  key: string;
  direction: Direction;
}

export class DirectionStack {
  private held: HeldKey[] = [];

  /** Registra que a tecla `key` foi apertada. Repetições da mesma tecla são ignoradas. */
  press(key: string, direction: Direction): void {
    if (this.held.some((entry) => entry.key === key)) return;
    this.held.push({ key, direction });
  }

  /** Registra que a tecla `key` foi solta. */
  release(key: string): void {
    this.held = this.held.filter((entry) => entry.key !== key);
  }

  /** Esquece tudo (por exemplo, quando a janela perde o foco e o navegador não avisa que as teclas foram soltas). */
  clear(): void {
    this.held = [];
  }

  /** Direção que vale agora, ou null se nenhuma tecla de direção está apertada. */
  current(): Direction | null {
    return this.held.at(-1)?.direction ?? null;
  }
}
