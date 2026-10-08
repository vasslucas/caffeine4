importScripts('./controller/controller.sw.js?v=2.0.67-alpha.2-4')
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  if (self.$scramjetController.shouldRoute(event)) {
    event.respondWith(self.$scramjetController.route(event).catch(() => new Response(
      'This site is unavailable. Try refreshing the tab.',
      { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )))
  }
})
