import { http, HttpResponse } from 'msw'
import { env } from '@/config/env'

const api = (path: string) => `${env.apiBaseUrl}${path}`

/** Handlers REST. O banco simulado, cenários e Socket.IO entram na etapa 2. */
export const handlers = [
  http.get(api('/health'), () => HttpResponse.json({ status: 'ok' })),
]
