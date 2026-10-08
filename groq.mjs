const endpoint = 'https://api.groq.com/openai/v1'
const rates = new Map()
let cachedModels = []
let cachedAt = 0

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(value))
}

async function models(key) {
  if (Date.now() - cachedAt < 300000 && cachedModels.length) return cachedModels
  const response = await fetch(`${endpoint}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('Models unavailable')
  const data = await response.json()
  cachedModels = data.data.filter(model => model.active !== false && !/whisper|tts|guard|speech/i.test(model.id)).map(model => ({ id: model.id, owner: model.owned_by, context: model.context_window }))
  cachedAt = Date.now()
  return cachedModels
}

export async function handleGroq(request, response, authorized = () => true) {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname
  if (!pathname.startsWith('/api/ai/')) return false
  if (!authorized(request)) { json(response, 401, { error: 'Unlock server access in Settings → Connection first.' }); return true }
  if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) { json(response, 403, { error: 'Origin is not allowed.' }); return true }
  const key = process.env.groq || process.env.GROQ_API_KEY
  if (!key) { json(response, 503, { error: 'AI is not connected yet. Set the groq environment variable on Railway, then redeploy.' }); return true }
  if (pathname === '/api/ai/models' && request.method === 'GET') {
    try { json(response, 200, { models: await models(key) }) } catch { json(response, 502, { error: 'Could not load Groq models. Check the server API key and try again.' }) }
    return true
  }
  if (pathname !== '/api/ai/chat' || request.method !== 'POST') { json(response, 405, { error: 'Method not allowed.' }); return true }
  const ip = request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  for (const [address, entry] of rates) if (now - entry.start > 60000) rates.delete(address)
  const rate = rates.get(ip) || { start: now, count: 0 }
  rates.set(ip, rate)
  if (++rate.count > 20 || rates.size > 5000) { json(response, 429, { error: 'Too many messages. Wait a minute and try again.' }); return true }
  try {
    let body = ''
    for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 100000) { json(response, 413, { error: 'Conversation too long. Start a new chat.' }); return true } }
    let data
    try { data = JSON.parse(body) } catch { json(response, 400, { error: 'Invalid JSON.' }); return true }
    if (!data || !Array.isArray(data.messages) || !data.messages.length || data.messages.length > 60 || data.messages.some(message => !message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 20000)) { json(response, 400, { error: 'Invalid messages. Start a new chat or shorten your message.' }); return true }
    if (!(await models(key)).some(model => model.id === data.model)) { json(response, 400, { error: 'This model is unavailable. Select another model.' }); return true }
    if (response.destroyed) return true
    const controller = new AbortController()
    const cancel = () => { if (!response.writableEnded) controller.abort() }
    response.on('close', cancel)
    const timeout = setTimeout(() => controller.abort(), 60000)
    try {
      const upstream = await fetch(`${endpoint}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: data.model, messages: data.messages.map(message => ({ role: message.role, content: message.content })), max_completion_tokens: 2048, stream: false }), signal: controller.signal })
      if (!upstream.ok) {
        await upstream.body?.cancel()
        const error = upstream.status === 429 ? 'Groq rate limit reached. Try again shortly.' : upstream.status === 401 ? 'Groq rejected the server API key. Check the Railway groq variable.' : 'Groq could not answer with this model. Try another model.'
        json(response, upstream.status === 429 ? 429 : 502, { error })
      } else {
        const result = await upstream.json()
        const content = result.choices?.[0]?.message?.content
        if (typeof content !== 'string' || !content.trim()) json(response, 502, { error: 'The model returned an empty answer. Try another model.' })
        else json(response, 200, { content, model: result.model, usage: result.usage })
      }
    } finally { clearTimeout(timeout); response.off('close', cancel) }
  } catch { if (!response.destroyed) json(response, 502, { error: 'AI request failed or timed out. Please try again.' }) }
  return true
}
