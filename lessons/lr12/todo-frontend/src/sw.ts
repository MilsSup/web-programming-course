/// <reference lib="WebWorker" />

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE_NAME = 'todo-pwa-v1';

// 1. Список ресурсов для предкэширования (App Shell)
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png'
];

// 2. Установка: сохраняем файлы в кэш
sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  void sw.skipWaiting();
});

// 3. Активация: чистим старые версии кэша
sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  void sw.clients.claim();
});

// 4. Перехват запросов (Стратегия: Network-first)
sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ИГНОРИРУЕМ запросы к бэкенду (чтобы они не попадали в кэш и не ломали логику очереди)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      
      // Если нашли в кэше (статику) — отдаем. Если нет — возвращаем статус 503.
      return cachedResponse || new Response('Offline content not available', { 
        status: 503,
        statusText: 'Service Unavailable' 
      });
    })
  );
});