// Service worker do Bomb Arena: faz o jogo abrir mesmo sem internet depois da primeira visita.
// Estratégia "rede primeiro": com internet, sempre baixa a versão mais nova (e guarda uma cópia); sem internet,
// usa a cópia guardada. Assim uma atualização publicada nunca fica presa num cache velho.
// Só trata pedidos GET do próprio site; o resto passa direto.

const CACHE = 'bomb-arena-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('./'))),
  );
});
