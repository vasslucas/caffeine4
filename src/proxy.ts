import EpoxyTransport from '@mercuryworkshop/epoxy-transport'
import type { Controller, Frame } from '@mercuryworkshop/scramjet-controller'

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`
let initialization: Promise<void> | undefined
let controller: Controller | undefined
let transportEndpoint = ''
const engineVersion = '2.0.67-alpha.2-4'
const scripts = new Map<string, Promise<void>>()
const managedFrames = new WeakMap<HTMLIFrameElement, Frame>()
let blocker = true
const blockedDomains = ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adnxs.com', 'adsrvr.org', 'scorecardresearch.com', 'connect.facebook.net', 'analytics.google.com', 'google-analytics.com', 'taboola.com', 'outbrain.com']

export function setProxyBlocker(enabled: boolean) {
  blocker = enabled
}

class FilteringTransport extends EpoxyTransport {
  async request(...args: Parameters<EpoxyTransport['request']>): ReturnType<EpoxyTransport['request']> {
    const hostname = args[0].hostname
    if (blocker && blockedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
      return { body: new ArrayBuffer(0), headers: [], status: 204, statusText: 'No Content' }
    }
    return super.request(...args)
  }
}

export function decodeProxied(href: string) {
  try {
    const url = new URL(href, location.origin)
    if (url.origin !== location.origin || !url.pathname.startsWith('/p/')) return ''
    const encoded = url.pathname.slice(3).split('/').slice(2).join('/')
    const target = decodeURIComponent(encoded)
    return /^https?:\/\//i.test(target) ? target + url.hash : ''
  } catch {
    return ''
  }
}

async function loadScript(path: string) {
  if (scripts.has(path)) return scripts.get(path)
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${asset(path)}?v=${engineVersion}`
    script.onload = () => resolve()
    script.onerror = () => { script.remove(); reject(new Error('Could not load the proxy engine.')) }
    document.head.append(script)
  })
  scripts.set(path, promise)
  try { await promise } catch (error) { scripts.delete(path); throw error }
}

export function navigateProxyFrame(element: HTMLIFrameElement, url: string) {
  if (!controller) return
  let frame = managedFrames.get(element)
  if (!frame) {
    frame = controller.createFrame(element)
    managedFrames.set(element, frame)
  }
  if (element.dataset.caffeineTarget === url) return
  element.dataset.caffeineTarget = url
  frame.go(url)
}

export function releaseProxyFrame(element: HTMLIFrameElement) {
  const frame = managedFrames.get(element)
  if (!frame || !controller) return
  const index = controller.frames.indexOf(frame)
  if (index !== -1) controller.frames.splice(index, 1)
  managedFrames.delete(element)
  delete element.dataset.caffeineTarget
}

export async function initializeProxy(endpoint: string) {
  if (!window.isSecureContext || !navigator.serviceWorker)
    throw new Error('Browsing requires HTTPS or localhost with service worker support.')
  const websocket = new URL(endpoint || '/wisp/', location.origin)
  if (websocket.protocol === 'https:') websocket.protocol = 'wss:'
  if (websocket.protocol === 'http:') websocket.protocol = 'ws:'
  if (!['ws:', 'wss:'].includes(websocket.protocol)) throw new Error('Invalid connection URL.')
  if (controller && initialization && transportEndpoint !== websocket.href) {
    const transport = new FilteringTransport({ wisp: websocket.href })
    await transport.init(); controller.setTransport(transport); transportEndpoint = websocket.href
    return
  }
  if (!initialization) initialization = (async () => {
    await loadScript('scramjet/scramjet.js')
    await loadScript('controller/controller.api.js')
    const registration = await navigator.serviceWorker.register(`${asset('caffeine-proxy.js')}?v=${engineVersion}`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    })
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', check); registration.removeEventListener('updatefound', watch); registration.installing?.removeEventListener('statechange', check); registration.waiting?.removeEventListener('statechange', check) }
      const timer = setTimeout(() => {
        cleanup(); reject(new Error('Connection did not activate. Refresh and try again.'))
      }, 20000)
      function check() {
        const active = navigator.serviceWorker.controller
        if (!active || new URL(active.scriptURL).pathname !== new URL(asset('caffeine-proxy.js'), location.origin).pathname || active.state !== 'activated') return
        if (registration.installing || registration.waiting) return
        cleanup()
        resolve()
      }
      function watch() { registration.installing?.addEventListener('statechange', check); check() }
      registration.addEventListener('updatefound', watch)
      registration.installing?.addEventListener('statechange', check)
      registration.waiting?.addEventListener('statechange', check)
      navigator.serviceWorker.addEventListener('controllerchange', check)
      check()
    })
    const transport = new FilteringTransport({ wisp: websocket.href })
    await transport.init()
    transportEndpoint = websocket.href
    const { Controller } = await import('@mercuryworkshop/scramjet-controller')
    controller = new Controller({
      serviceworker: navigator.serviceWorker.controller!,
      transport,
      config: {
        prefix: '/p/',
        scramjetPath: `${asset('scramjet/scramjet.js')}?v=${engineVersion}`,
        wasmPath: `${asset('scramjet/scramjet.wasm')}?v=${engineVersion}`,
        injectPath: `${asset('controller/controller.inject.js')}?v=${engineVersion}`,
      },
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        controller.wait(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Scramjet v2 did not initialize. Reload to activate the updated worker.')), 15000)
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  })().catch(error => { initialization = undefined; controller = undefined; throw error })
  await initialization
}
