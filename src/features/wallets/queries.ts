import { queryOptions, useQuery } from '@tanstack/react-query'
import { walletsApi } from '@/api/endpoints'
import { qk, type ViewerScope } from '@/lib/query-keys'
import { useViewerScope } from '../session/use-viewer'

export const walletsQuery = (scope: ViewerScope) =>
  queryOptions({
    queryKey: qk.private.wallets(scope),
    queryFn: ({ signal }) => walletsApi.list({ signal }),
    enabled: scope !== 'guest',
  })

export function useWallets() {
  return useQuery(walletsQuery(useViewerScope()))
}

/** Endereço abreviado como no Figma: 0xA91F…E82C */
export function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}
