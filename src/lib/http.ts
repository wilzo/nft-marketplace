import axios from 'axios'
import { env } from '@/config/env'
import { toApiError, type ApiError } from './api-error'
import { whenNetworkReady } from './boot'
import { guestCartId, sessionToken } from './client-storage'

export const CART_HEADER = 'X-Cart-Id'

/**
 * Cliente HTTP único da aplicação. Todas as chamadas REST passam por aqui.
 * Não contém respostas fictícias: em modo mock, quem responde é o MSW na camada de rede.
 */
export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  // Arrays como parâmetros repetidos: ?category=a&category=b (contrato da listagem)
  paramsSerializer: { indexes: null },
})

http.interceptors.request.use(async (config) => {
  // Aguarda a camada de mocks (MSW) estar pronta: nenhuma requisição sai antes dela.
  await whenNetworkReady()
  const token = sessionToken.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  const cartId = guestCartId.get()
  if (cartId) config.headers.set(CART_HEADER, cartId)
  return config
})

type SessionLossListener = (error: ApiError) => void
const sessionLossListeners = new Set<SessionLossListener>()

/** Notificado quando uma chamada autenticada recebe 401 (sessão expirada/inválida). */
export function onSessionLoss(listener: SessionLossListener) {
  sessionLossListeners.add(listener)
  return () => sessionLossListeners.delete(listener)
}

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error)
    if (apiError.isSessionLoss && sessionToken.get()) sessionLossListeners.forEach((l) => l(apiError))
    return Promise.reject(apiError)
  },
)
