"use strict";
(() => {
  // src/sw.ts
  var sw = self;
  var CACHE_NAME = "todo-pwa-v1";
  var ASSETS_TO_CACHE = [
    "/",
    "/index.html",
    "/manifest.webmanifest",
    "/icon-192.png",
    "/icon-512.png"
  ];
  sw.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    void sw.skipWaiting();
  });
  sw.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then(
        (keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
    );
    void sw.clients.claim();
  });
  sw.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith("/api/")) {
      return;
    }
    if (event.request.method !== "GET") return;
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        return cachedResponse || new Response("Offline content not available", {
          status: 503,
          statusText: "Service Unavailable"
        });
      })
    );
  });
})();
