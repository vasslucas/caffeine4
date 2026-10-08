importScripts('./controller/controller.sw.js')
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  if (self.$scramjetController.shouldRoute(event)) {
    event.respondWith(self.$scramjetController.route(event).catch(() => new Response(
      'Caffeine could not reach this site. Check that the Wisp server is running.',
      { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )))
  }
})
