/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope

// Basic service worker for PWA
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Network-first strategy for all requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request) as Promise<Response>
    })
  )
})

export {}
