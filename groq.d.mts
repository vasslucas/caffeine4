import type { IncomingMessage, ServerResponse } from 'node:http'

export function handleGroq(request: IncomingMessage, response: ServerResponse, authorized?: (request: IncomingMessage) => boolean): Promise<boolean>
