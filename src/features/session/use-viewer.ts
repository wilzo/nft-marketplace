import type { ViewerScope } from '@/lib/query-keys'

/**
 * Escopo do visitante/usuário atual para as chaves de cache privadas.
 * Etapa 3: sempre visitante. A etapa 4 passa a derivar do usuário autenticado.
 */
export function useViewerScope(): ViewerScope {
  return 'guest'
}
