// Faixas ao lado da tela do jogo: quando a janela do navegador não é 16:9 (barra de endereço, favoritos...), sobram faixas nas
// laterais. Em vez de uma cor lisa, elas mostram o fundo da fase borrado, para a tela parecer cheia. Fora das partidas fica o degradê do menu.

const ID = 'page-backdrop';

/** Mostra (url) ou tira (null) o fundo borrado atrás do jogo. Não faz nada fora do navegador (testes). */
export function setPageBackdrop(url: string | null): void {
  if (typeof document === 'undefined') return;
  let element = document.getElementById(ID);
  if (!element) {
    if (!url) return;
    element = document.createElement('div');
    element.id = ID;
    element.style.cssText = 'position:fixed;inset:-40px;z-index:0;background-size:cover;background-position:center;filter:blur(22px) brightness(0.72) saturate(1.1);pointer-events:none;';
    document.body.insertBefore(element, document.body.firstChild);
  }
  element.style.backgroundImage = url ? `url("${url}")` : 'none';
  element.style.display = url ? 'block' : 'none';
}
