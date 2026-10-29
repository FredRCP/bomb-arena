import Phaser from 'phaser';
import type { GameState, MatchState, PlayerState, Scoreboard } from '../core';
import { characterById } from '../characters/characters';
import type { CharacterChoices } from '../characters/characters';
import { drawItemPlate } from './ArenaRenderer';
import { hasItemIcon, itemTexture } from './ItemSprites';
import { addCharacter, setFace } from './CharacterView';
import { SCREEN_WIDTH, TOP_HEIGHT, arenaWidthFor, sideWidthFor } from './layout';
import { powerFraction, powerReady } from '../core';
import { formatClock, isTeamGame, playerLabel } from './outcomeText';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const BAR_COLOR = 0x1b1f3b;
const CARD_COLOR = 0x2c3160;
/** Cores dos dois times nas partidas em equipes. */
const TEAM_COLORS: Record<number, number> = { 1: 0x4dabf7, 2: 0xff6b6b };

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export interface Hud {
  /** Atualiza os textos e desenhos com o estado atual (só mexe no que mudou). */
  update(state: GameState, match: MatchState, scores?: Scoreboard): void;
}

function style(size: number, color: string, stroke = 4): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#0b0c1a', strokeThickness: stroke };
}

function drawClockIcon(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0xffffff);
  g.fillCircle(x, y, 18);
  g.fillStyle(0x1b1f3b);
  g.fillCircle(x, y, 14);
  g.lineStyle(3, 0xffffff, 1);
  g.lineBetween(x, y, x, y - 10);
  g.lineBetween(x, y, x + 7, y + 3);
  g.fillStyle(0xffffff);
  g.fillRect(x - 4, y - 23, 8, 4);
}

/** Habilidades que se têm até o fim da rodada: só aparecem as que o jogador tem (ícones pequenos na ficha). */
const PERMANENT = [
  { kind: 'vest', has: (p: PlayerState) => p.vest },
  { kind: 'kick', has: (p: PlayerState) => p.canKick },
  { kind: 'pierce', has: (p: PlayerState) => p.piercing },
  { kind: 'remote', has: (p: PlayerState) => p.remote },
  { kind: 'throw', has: (p: PlayerState) => p.canThrow },
] as const;

/** Efeitos com tempo (também só enquanto valem). */
const TIMED = [
  { kind: 'hero', left: (p: PlayerState) => p.heroTicks },
  { kind: 'ghost', left: (p: PlayerState) => p.ghostTicks },
  { kind: 'invert', left: (p: PlayerState) => p.invertTicks },
] as const;

const CARD_W = 220;
const CARD_H = 52;
const CARD_STEP = 224;
/** Quantos ícones de habilidade cabem na ficha (3 colunas x 2 linhas). */
const MAX_ICONS = 6;

/**
 * Informações da partida, numa barra fina em cima da arena (veja layout.ts): uma ficha por jogador (retrato, nome,
 * pontos e vitórias, mais ícones pequenos das habilidades que ele tem) e o cronômetro no meio. Bombas, alcance e
 * velocidade não aparecem: o jogador vê o efeito no próprio jogo.
 */
export function createHud(scene: Phaser.Scene, state: GameState, choices: CharacterChoices): Hud {
  const players = state.players;
  const teamGame = isTeamGame(players);
  const characterOf = (player: PlayerState) => characterById(choices[player.id]);
  const hasAlly = (player: PlayerState): boolean => players.some((other) => other.id !== player.id && other.team === player.team);
  const accentOf = (player: PlayerState): number => (teamGame && hasAlly(player) ? TEAM_COLORS[player.team] ?? characterOf(player).color : characterOf(player).color);
  const side = sideWidthFor(state.arena.cols);
  const left = -side;
  const barY = -TOP_HEIGHT;

  // Fundo da barra (o fundo colorido da tela é desenhado pela cena)
  const back = scene.add.graphics().setDepth(1);
  back.fillStyle(BAR_COLOR, 0.94);
  back.fillRect(left, barY, SCREEN_WIDTH, TOP_HEIGHT);
  back.fillStyle(0xffe66d, 1);
  back.fillRect(left, -4, SCREEN_WIDTH, 4);

  // ---- Relógio e, embaixo dele, o aviso da morte súbita
  const clockCenter = arenaWidthFor(state.arena.cols) / 2;
  const clockY = barY + TOP_HEIGHT / 2 - 2;
  drawClockIcon(back, clockCenter - 62, clockY);
  const clock = scene.add.text(clockCenter + 14, clockY, '', style(44, '#ffffff', 5)).setOrigin(0.5).setDepth(5);
  const alert = scene.add.text(clockCenter, -14, '', style(15, '#ff6b6b', 3)).setOrigin(0.5).setDepth(5);

  // ---- Fichas dos jogadores: metade à esquerda do relógio, metade à direita
  const half = Math.ceil(players.length / 2);
  const cardY = barY + (TOP_HEIGHT - 4 - CARD_H) / 2;
  const cards = players.map((player, index) => {
    const onLeft = index < half;
    const order = onLeft ? index : index - half;
    const x = onLeft ? clockCenter - 130 - (half - order) * CARD_STEP + (CARD_STEP - CARD_W) : clockCenter + 130 + order * CARD_STEP;
    const accent = accentOf(player);
    back.fillStyle(CARD_COLOR);
    back.fillRoundedRect(x, cardY, CARD_W, CARD_H, 12);
    back.fillStyle(accent);
    back.fillRoundedRect(x, cardY, 7, CARD_H, 4);
    const face = addCharacter(scene, characterOf(player), x + 34, cardY + CARD_H / 2, 17).setDepth(4);
    const name = scene.add.text(x + 58, cardY + 15, playerLabel(player, players), style(18, hex(accent), 3)).setOrigin(0, 0.5).setDepth(5);
    const info = scene.add.text(x + 58, cardY + 37, '', style(15, '#e3e7ff', 2)).setOrigin(0, 0.5).setDepth(5);
    const icons = scene.add.graphics().setDepth(5);
    const powerBar = scene.add.graphics().setDepth(5);
    return { player, x, name, info, icons, powerBar, face, iconImages: [] as Phaser.GameObjects.Image[] };
  });

  // Teclas gerais, no canto esquerdo da tela (o fundo colorido, ao lado da arena)
  scene.add
    .text(left + 24, 24, 'Esc  pausa\nR  reinicia a rodada\nQ  menu\nM  som', { ...style(side >= 256 ? 20 : 15, '#ffffff', 4), lineSpacing: 6 })
    .setOrigin(0, 0)
    .setDepth(5)
    .setAlpha(0.85);

  let lastClock = '';
  let lastKey = '';

  return {
    update(current, match, scores) {
      // Barra de carga do superpoder (muda a cada passo, por isso fica antes da checagem de "nada mudou").
      for (const card of cards) {
        const live = current.players.find((p) => p.id === card.player.id);
        card.powerBar.clear();
        if (!live?.power) continue;
        const fraction = powerFraction(live);
        const ready = powerReady(live);
        const bx = card.x + 58;
        const by = cardY + CARD_H - 6;
        card.powerBar.fillStyle(0x0b0c1a, 0.9).fillRoundedRect(bx, by, 96, 4, 2);
        const pulse = ready ? 0.65 + 0.35 * Math.sin(current.tick / 5) : 1;
        card.powerBar.fillStyle(ready ? 0xffe66d : 0x74c0fc, pulse).fillRoundedRect(bx, by, Math.max(2, 96 * fraction), 4, 2);
      }

      const clockText = formatClock(current.round.ticksLeft);
      if (clockText !== lastClock) {
        lastClock = clockText;
        clock.setText(clockText);
        // Nos últimos 30 segundos o relógio fica vermelho.
        clock.setColor(current.round.ticksLeft <= 30 * 60 ? '#ff6b6b' : '#ffffff');
      }
      alert.setText(current.round.suddenDeath && current.round.phase === 'playing' ? 'MORTE SÚBITA' : '');

      // Tudo que depende dos jogadores só é refeito se algo mudou (os efeitos com tempo, de 6 em 6 passos).
      const key = current.players
        .map((p) => `${p.alive ? 1 : 0}${current.round.phase === 'playing' ? 'p' : 'e'}${+p.canKick}${+p.piercing}${+p.remote}${+p.canThrow}${+p.vest}.${Math.ceil(p.ghostTicks / 6)}.${Math.ceil(p.invertTicks / 6)}.${Math.ceil(p.heroTicks / 6)}${p.sideline ?? 'x'}:${scores?.[p.id]?.points ?? 0}:${match.wins[p.team] ?? 0}`)
        .join('|');
      if (key === lastKey) return;
      lastKey = key;

      for (const card of cards) {
        const live = current.players.find((p) => p.id === card.player.id);
        if (!live) continue;
        const points = scores?.[live.id]?.points ?? 0;
        const wins = match.wins[live.team] ?? 0;
        const onSideline = live.sideline !== null;
        card.name.setAlpha(live.alive ? 1 : 0.55);
        // Rosto: triste se foi eliminado, feliz para quem está de pé quando a rodada termina.
        setFace(scene, card.face, !live.alive ? 'sad' : current.round.phase !== 'playing' ? 'happy' : 'normal');
        card.info
          .setText(live.alive ? `${points} pts · ${wins} vit.` : `${points} pts · ${onSideline ? 'repescagem' : 'eliminado'}`)
          .setColor(live.alive ? '#e3e7ff' : onSideline ? '#ffd43b' : '#ff8fa3');

        // Ícones pequenos: só o que o jogador tem agora.
        card.icons.clear();
        card.iconImages.forEach((image) => image.setVisible(false));
        const owned: string[] = [];
        for (const item of PERMANENT) if (item.has(live)) owned.push(item.kind);
        for (const item of TIMED) if (item.left(live) > 0) owned.push(item.kind);
        owned.slice(0, MAX_ICONS).forEach((kind, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const scale = 0.38;
          // Cada ícone é desenhado em tamanho normal numa origem própria e reduzido; por isso o setScale na camada
          // não serve (reduziria tudo junto): desenhamos direto nas coordenadas já reduzidas.
          const px = card.x + CARD_W - 50 + col * 17;
          const py = cardY + 14 + row * 20;
          if (hasItemIcon(scene, kind)) {
            // Ícone em imagem (as imagens são criadas na primeira vez que aparecem e reaproveitadas depois).
            const image = (card.iconImages[i] ??= scene.add.image(0, 0, itemTexture(kind)).setDepth(5));
            image.setTexture(itemTexture(kind)).setDisplaySize(19, 19).setPosition(px, py).setVisible(true);
          } else {
            drawSmallPlate(card.icons, kind as Parameters<typeof drawItemPlate>[1], px, py, scale);
          }
        });
      }
    },
  };
}

/** Plaquinha de item em tamanho reduzido (para as fichas da barra superior). */
function drawSmallPlate(g: Phaser.GameObjects.Graphics, kind: Parameters<typeof drawItemPlate>[1], cx: number, cy: number, scale: number): void {
  // O desenho do item é em coordenadas absolutas; para reduzir, usa-se a transformação da própria camada.
  g.save();
  g.translateCanvas(cx, cy);
  g.scaleCanvas(scale, scale);
  drawItemPlate(g, kind, 0, 0);
  g.restore();
}
