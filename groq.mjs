import { allowedOrigin } from './deployment.mjs'

const providers = {
  groq: { url: 'https://api.groq.com/openai/v1', key: () => process.env.groq || process.env.GROQ_API_KEY },
  pollinations: { url: 'https://gen.pollinations.ai/v1', key: () => process.env.pollinations || process.env.POLLINATIONS_API_KEY },
}
const personalities = {
  general: 'You are Caffeine AI. Be helpful, clear, and concise.',
  coder: 'You are a thoughtful programming partner. Give correct, practical code, explain tradeoffs briefly, and ask for missing requirements when needed.',
  professional: 'You are a professional assistant. Be precise, polished, structured, and evidence-conscious.',
  friend: 'You are a warm, supportive conversational companion. Be casual, kind, and honest; do not pretend to be human.',
  femboy: 'You are a playful, friendly assistant with a soft, cute, upbeat style. Use occasional light emoticons, keep answers useful, and respect boundaries.',
}
const rates = new Map()
const catalogs = new Map()
function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(value))
}
async function catalog(provider) {
  const cached = catalogs.get(provider)
  if (cached && Date.now() - cached.time < 300000) return cached.models
  const config = providers[provider]
  const url = provider === 'pollinations' ? 'https://gen.pollinations.ai/text/models' : `${config.url}/models`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${config.key()}` }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('Models unavailable')
  const data = await response.json()
  const source = Array.isArray(data) ? data : data.data
  if (!Array.isArray(source)) throw new Error('Invalid catalog')
  const models = source.filter(model => model.active !== false && (!model.category || model.category === 'text') && !/whisper|tts|guard|speech|embedding/i.test(model.id || model.name)).map(model => {
    const name = model.id || model.name
    const text = `${name} ${model.title || ''} ${model.description || ''}`
    const category = model.uncensored === true || /uncensored|unfiltered|dolphin/i.test(text) ? 'unfiltered' : /codex|coder|coding|code generation|programming|deepseek|qwen.*coder|devstral/i.test(text) ? 'coding' : 'general'
    return { id: `${provider}:${name}`, name, title: model.title || name, provider, owner: model.publisher || model.owned_by, category, vision: model.input_modalities?.includes('image') || /llama-4|vision|pixtral/i.test(name) }
  })
  catalogs.set(provider, { time: Date.now(), models })
  return models
}
function validContent(content) {
  if (typeof content === 'string') return content.trim().length > 0 && content.length <= 300000
  return Array.isArray(content) && content.length > 0 && content.length <= 6 && content.every(part => part?.type === 'text' ? typeof part.text === 'string' && part.text.length <= 300000 : part?.type === 'image_url' && typeof part.image_url?.url === 'string' && part.image_url.url.length <= 1500000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(part.image_url.url))
}
export async function handleGroq(request, response, authorized = () => true) {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname
  if (!pathname.startsWith('/api/ai/')) return false
  if (!authorized(request)) { json(response, 401, { error: 'Unlock server access in Connection settings.' }); return true }
  if (!allowedOrigin(request)) { json(response, 403, { error: 'Origin is not allowed.' }); return true }
  if (pathname === '/api/ai/models' && request.method === 'GET') {
    const available = Object.keys(providers).filter(provider => providers[provider].key())
    if (!available.length) { json(response, 503, { error: 'AI is temporarily unavailable.' }); return true }
    const results = await Promise.allSettled(available.map(provider => catalog(provider)))
    const models = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
    json(response, models.length ? 200 : 502, models.length ? { models, unavailable: available.filter((_, index) => results[index].status === 'rejected') } : { error: 'Could not load AI models. Try again shortly.' })
    return true
  }
  if (pathname !== '/api/ai/chat' || request.method !== 'POST') { json(response, 405, { error: 'Method not allowed.' }); return true }
  const ip = request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  for (const [address, entry] of rates) if (now - entry.start > 60000) rates.delete(address)
  const rate = rates.get(ip) || { start: now, count: 0 }
  rates.set(ip, rate)
  if (++rate.count > 20 || rates.size > 5000) { json(response, 429, { error: 'Too many messages. Try again in a minute.' }); return true }
  try {
    request.setEncoding('utf8')
    let body = ''
    for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 8000000) { json(response, 413, { error: 'Conversation too large. Start a new chat.' }); return true } }
    let data
    try { data = JSON.parse(body) } catch { json(response, 400, { error: 'Invalid request.' }); return true }
    if (!data || typeof data.model !== 'string' || !Array.isArray(data.messages) || !data.messages.length || data.messages.length > 60 || data.messages.some(message => !message || !['user', 'assistant'].includes(message.role) || !validContent(message.content))) { json(response, 400, { error: 'Invalid or oversized message.' }); return true }
    const provider = data.model.includes(':') ? data.model.split(':')[0] : 'groq'
    const config = providers[provider]
    if (!config?.key()) { json(response, 503, { error: 'This provider is unavailable.' }); return true }
    const model = (await catalog(provider)).find(item => item.id === data.model || item.name === data.model)
    if (!model) { json(response, 400, { error: 'Model unavailable. Select another model.' }); return true }
    if (!model.vision && data.messages.some(message => Array.isArray(message.content) && message.content.some(part => part.type === 'image_url'))) { json(response, 400, { error: 'Select an image-compatible model for this conversation.' }); return true }
    if (response.destroyed) return true
    const controller = new AbortController()
    const cancel = () => { if (!response.writableEnded) controller.abort() }
    response.on('close', cancel)
    const timeout = setTimeout(() => controller.abort(), 90000)
    try {
      const personality = typeof data.personality === 'string' && Object.hasOwn(personalities, data.personality) ? personalities[data.personality] : personalities.general
      const messages = [{ role: 'system', content: personality }, ...data.messages.map(message => ({ role: message.role, content: message.content }))]
      const upstream = await fetch(`${config.url}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${config.key()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model.name, messages, max_completion_tokens: 4096, stream: false }), signal: controller.signal })
      if (!upstream.ok) {
        await upstream.body?.cancel()
        json(response, upstream.status === 429 ? 429 : 502, { error: upstream.status === 429 ? 'Provider rate limit reached. Try again shortly.' : 'This model could not answer. Try another model.' })
      } else {
        const result = await upstream.json()
        const content = result.choices?.[0]?.message?.content
        json(response, typeof content === 'string' && content.trim() ? 200 : 502, typeof content === 'string' && content.trim() ? { content, model: model.title, usage: result.usage } : { error: 'Empty answer. Try another model.' })
      }
    } finally { clearTimeout(timeout); response.off('close', cancel) }
  } catch { if (!response.destroyed) json(response, 502, { error: 'Request failed or timed out. Try again.' }) }
  return true
}
