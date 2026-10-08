import EpoxyTransport from '@mercuryworkshop/epoxy-transport'
import type { Controller, Frame } from '@mercuryworkshop/scramjet-controller'

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`
let initialization: Promise<void> | undefined
let controller: Controller | undefined
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
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = asset(path)
    script.onload = () => resolve()
    script.onerror = () => { script.remove(); reject(new Error('Could not load the proxy engine.')) }
    document.head.append(script)
  })
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
  if (!initialization) initialization = (async () => {
    await loadScript('scramjet/scramjet.js')
    await loadScript('controller/controller.api.js')
    const registration = await navigator.serviceWorker.register(asset('caffeine-proxy.js'), {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    })
    const updatingWorker = registration.installing || registration.waiting
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', check)
        reject(new Error('Proxy worker did not activate. Reload this page on an HTTPS host.'))
      }, 12000)
      function check() {
        if (updatingWorker && updatingWorker.state !== 'activated') return
        if (!navigator.serviceWorker.controller?.scriptURL.endsWith('/caffeine-proxy.js')) return
        clearTimeout(timer)
        navigator.serviceWorker.removeEventListener('controllerchange', check)
        resolve()
      }
      navigator.serviceWorker.addEventListener('controllerchange', check)
      check()
    })
    const websocket = new URL(endpoint || '/wisp/', location.href)
    if (websocket.protocol === 'https:') websocket.protocol = 'wss:'
    if (websocket.protocol === 'http:') websocket.protocol = 'ws:'
    if (!['ws:', 'wss:'].includes(websocket.protocol)) throw new Error('Invalid Wisp WebSocket URL.')
    const { Controller } = await import('@mercuryworkshop/scramjet-controller')
    controller = new Controller({
      serviceworker: navigator.serviceWorker.controller!,
      transport: new FilteringTransport({ wisp: websocket.href }),
      config: {
        prefix: '/p/',
        scramjetPath: asset('scramjet/scramjet.js'),
        wasmPath: asset('scramjet/scramjet.wasm'),
        injectPath: asset('controller/controller.inject.js'),
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
