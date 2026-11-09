/**
 * Configuração de runtime lida das variáveis VITE_* (ver .env.example).
 * Centralizada aqui para que o restante da aplicação não leia import.meta.env diretamente.
 */
export const env = {
  /** Base das rotas REST. Com mocks ativos, o MSW intercepta este prefixo. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  /** URL do servidor Socket.IO. Com mocks ativos, o @mswjs/socket.io-binding intercepta a conexão. */
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.test',
  /** Ativa a camada MSW (REST + Socket.IO). Padrão: ativa, inclusive no build de demonstração. */
  mocksEnabled: (import.meta.env.VITE_ENABLE_MOCKS ?? 'true') === 'true',
} as const
