import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Guardião da regra obrigatória: o core (e a config que ele importa) não pode depender
// do Phaser, do navegador, de sorteio nativo nem do relógio. Se um desses aparecer,
// as partidas deixam de ser reproduzíveis e a lógica deixa de ser testável sozinha.

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: 'importar o Phaser', pattern: /from\s+['"]phaser['"]|require\(\s*['"]phaser['"]\s*\)/ },
  { name: 'usar window', pattern: /\bwindow\b/ },
  { name: 'usar document', pattern: /\bdocument\b/ },
  { name: 'usar localStorage', pattern: /\blocalStorage\b/ },
  { name: 'usar Math.random (use createRng com semente)', pattern: /Math\.random/ },
  { name: 'usar Date.now ou new Date (use contagem de ticks)', pattern: /Date\.now|new\s+Date\b/ },
  { name: 'usar performance.now', pattern: /performance\.now/ },
  { name: 'usar setTimeout ou setInterval (use contagem de ticks)', pattern: /\bsetTimeout\b|\bsetInterval\b/ },
];

function listTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const root = fileURLToPath(new URL('../../src', import.meta.url));
const files = [...listTsFiles(join(root, 'core')), ...listTsFiles(join(root, 'config'))];

describe('pureza do core', () => {
  it('encontra os arquivos do core e da config (o teste não pode passar no vazio)', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  for (const { name, pattern } of FORBIDDEN) {
    it(`nenhum arquivo do core ou da config pode ${name}`, () => {
      const offenders = files.filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))));
      expect(offenders).toEqual([]);
    });
  }
});
