import axios from 'axios'
import { env } from '@/config/env'

/**
 * Cliente HTTP único da aplicação. Todas as chamadas REST passam por aqui.
 * Não contém respostas fictícias: em modo mock, quem responde é o MSW na camada de rede.
 */
export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})
