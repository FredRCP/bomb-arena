import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Caminhos relativos no build: o jogo funciona em qualquer subpasta (itch.io, GitHub Pages...).
  base: './',
  build: {
    // O Phaser sozinho passa de 1 MB; o aviso padrão (500 kB) seria só ruído.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
