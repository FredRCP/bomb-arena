import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Confere os arquivos da publicação (PWA): manifesto válido, ícones existentes e ligados no index.html.
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
  name: string;
  start_url: string;
  display: string;
  icons: Array<{ src: string; sizes: string; purpose?: string }>;
};

describe('PWA', () => {
  it('manifesto: nome, abre na raiz relativa e é instalável (standalone, ícones 192 e 512)', () => {
    expect(manifest.name).toBe('Bomb Arena');
    expect(manifest.start_url).toBe('./'); // relativo: funciona em qualquer subpasta
    expect(manifest.display).toBe('standalone');
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  it('todos os ícones do manifesto existem em public/', () => {
    for (const icon of manifest.icons) expect(existsSync(`public/${icon.src}`)).toBe(true);
  });

  it('index.html liga o manifesto, o ícone e a cor do tema; o service worker existe', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('apple-touch-icon');
    expect(html).toContain('name="theme-color"');
    expect(existsSync('public/sw.js')).toBe(true);
  });

  it('o service worker só mexe em pedidos GET do próprio site', () => {
    const sw = readFileSync('public/sw.js', 'utf8');
    expect(sw).toContain("request.method !== 'GET'");
    expect(sw).toContain('self.location.origin');
  });
});
