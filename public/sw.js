// ─── SERVICE WORKER — Copa 2026 ───────────────────────────────────────────────
// Estratégia: Cache First para assets estáticos, Network First para CSVs da planilha
const CACHE_NAME = 'copa2026-v1';
const DATA_CACHE  = 'copa2026-data-v1';

// Assets que ficam em cache após o primeiro carregamento (Vite gera esses paths)
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// ── Install: pré-cacheia o shell da app ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove caches antigos ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== DATA_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estratégia por tipo de recurso ────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // CSVs do Google Sheets: Network First com fallback para cache
  if (url.hostname.includes('docs.google.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DATA_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Fontes do Google: Cache First (raramente mudam)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Assets estáticos da app (JS, CSS, imagens): Cache First com fallback de rede
  // — o Vite gera hashes nos nomes dos arquivos, então são imutáveis
  if (
    url.pathname.match(/\.(js|css|ico|png|jpg|svg|woff2?)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached); // se offline e não tem cache, retorna o que tiver
      })
    );
    return;
  }

  // Navegação (HTML): Network First com fallback para o shell cacheado
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Tudo mais: tenta rede, se falhar usa cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
