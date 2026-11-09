import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { Favorites } from '@/api/contracts'
import { favoritesApi } from '@/api/endpoints'
import { qk, type ViewerScope } from '@/lib/query-keys'
import { useCurrentUser, useViewerScope } from '../session/use-viewer'

function apply(old: Favorites | undefined, nftId: string, favorite: boolean): Favorites {
  const ids = old?.nftIds ?? []
  return { nftIds: favorite ? [...new Set([...ids, nftId])] : ids.filter((id) => id !== nftId) }
}

export const favoritesQuery = (scope: ViewerScope) =>
  queryOptions({
    queryKey: qk.private.favorites(scope),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: scope !== 'guest',
  })

export function useFavorites() {
  const scope = useViewerScope()
  return useQuery(favoritesQuery(scope))
}

export function useIsFavorite(nftId: string) {
  return useFavorites().data?.nftIds.includes(nftId) ?? false
}

/**
 * Favoritar/desfavoritar com ATUALIZAÇÃO OTIMISTA:
 *  - onMutate: cancela buscas em voo, guarda o estado anterior e aplica a mudança no cache imediatamente;
 *  - onError: rollback para o estado anterior + aviso;
 *  - onSuccess: substitui pelo estado confirmado pela API.
 * Visitante é levado ao login (com retorno à página atual).
 */
export function useToggleFavorite() {
  const client = useQueryClient()
  const scope = useViewerScope()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const key = qk.private.favorites(scope)

  const mutation = useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await client.cancelQueries({ queryKey: key })
      client.setQueryData<Favorites>(key, (old) => apply(old, nftId, favorite))
    },
    onError: (error, { nftId, favorite, name }) => {
      // Rollback: desfaz só a alteração deste NFT. (Restaurar um "snapshot" falharia se a lista
      // ainda não tivesse carregado — setQueryData(undefined) é ignorado — e descartaria cliques concorrentes.)
      client.setQueryData<Favorites>(key, (old) => apply(old, nftId, !favorite))
      toast.error(`Não foi possível ${favorite ? 'favoritar' : 'remover dos favoritos'} ${name}. ${error.message}`)
    },
    onSuccess: (_data, { favorite, name }) => {
      toast.success(favorite ? `${name} adicionado aos favoritos.` : `${name} removido dos favoritos.`, { id: 'favorite' })
    },
    // Ressincroniza com o servidor (inclusive se a busca inicial foi cancelada pelo onMutate).
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  })

  const toggle = (nftId: string, name: string, isFavorite: boolean) => {
    if (!user) {
      toast.info('Entre na sua conta para salvar favoritos.', { id: 'favorite-login' })
      void navigate({ to: '/entrar', search: { redirect: href } })
      return
    }
    mutation.mutate({ nftId, name, favorite: !isFavorite })
  }

  return { toggle, isPending: mutation.isPending }
}
