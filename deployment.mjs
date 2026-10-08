const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || 'caffeine4-production.up.railway.app'
export const publicWispUrl = process.env.WISP_PUBLIC_URL || (process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PUBLIC_DOMAIN ? `wss://${railwayDomain}/wisp/` : '')
const allowedOrigins = new Set((process.env.PROXY_ALLOWED_ORIGINS || 'https://caffeine223.b-cdn.net,https://caffeine4-production.up.railway.app').split(',').map(value => value.trim()).filter(Boolean))

export function allowedOrigin(request) {
  if (!request.headers.origin) return true
  try {
    const origin = new URL(request.headers.origin)
    return ['https:', 'http:'].includes(origin.protocol) && (origin.host === request.headers.host || allowedOrigins.has(origin.origin))
  } catch { return false }
}
