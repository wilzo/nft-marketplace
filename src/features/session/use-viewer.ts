import { useQuery } from '@tanstack/react-query'
import type { ViewerScope } from '@/lib/query-keys'
import { sessionQuery } from './session'

export function useSession() {
  return useQuery(sessionQuery)
}

/** Usuário autenticado (ou null para visitante). */
export function useCurrentUser() {
  return useSession().data?.user ?? null
}

/**
 * Escopo das chaves de cache privadas: id do usuário ou 'guest'.
 * Trocar de usuário muda o escopo, então nenhum dado de um usuário é servido a outro.
 */
export function useViewerScope(): ViewerScope {
  return useCurrentUser()?.id ?? 'guest'
}
