import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ChangePasswordInput, ProfileInput, Session, User, WalletInput, Wallets, WalletSlot } from '@/api/contracts'
import { profileApi, walletsApi } from '@/api/endpoints'
import { qk, type ViewerScope } from '@/lib/query-keys'
import { sessionQuery } from '../session/session'
import { useViewerScope } from '../session/use-viewer'

export const profileQuery = (scope: ViewerScope) =>
  queryOptions({ queryKey: qk.private.profile(scope), queryFn: ({ signal }) => profileApi.get({ signal }), enabled: scope !== 'guest' })

export const useProfile = () => useQuery(profileQuery(useViewerScope()))

/** Atualiza o perfil no cache e na sessão (header, checkout) sem refetch. */
function useSaveUser() {
  const client = useQueryClient()
  const scope = useViewerScope()
  return (user: User) => {
    client.setQueryData(qk.private.profile(scope), user)
    client.setQueryData<Session | null>(sessionQuery.queryKey, (s) => (s ? { ...s, user } : s))
  }
}

export function useUpdateProfile() {
  const save = useSaveUser()
  return useMutation({ mutationFn: (input: ProfileInput) => profileApi.update(input), onSuccess: save })
}

export function useSetAvatar() {
  const save = useSaveUser()
  return useMutation({ mutationFn: (dataUrl: string) => profileApi.setAvatar(dataUrl), onSuccess: save })
}

export function useRemoveAvatar() {
  const save = useSaveUser()
  return useMutation({ mutationFn: () => profileApi.removeAvatar(), onSuccess: save })
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: ChangePasswordInput) => profileApi.changePassword(input) })
}

export function useSaveWallet() {
  const client = useQueryClient()
  const scope = useViewerScope()
  return useMutation({
    mutationFn: ({ slot, input }: { slot: WalletSlot; input: WalletInput }) => walletsApi.save(slot, input),
    onSuccess: (wallets: Wallets) => client.setQueryData(qk.private.wallets(scope), wallets),
  })
}

export const AVATAR_MAX_BYTES = 512 * 1024
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Valida o arquivo e o reduz no navegador (256px, WebP) antes do envio: o avatar trafega como data URL pequena.
 * Retorna a mensagem de erro (ou a data URL pronta).
 */
export async function prepareAvatar(file: File): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!AVATAR_TYPES.includes(file.type)) return { ok: false, error: 'Envie uma imagem PNG, JPEG ou WebP.' }
  if (file.size > AVATAR_MAX_BYTES * 4) return { ok: false, error: 'A imagem deve ter no máximo 2 MB.' }
  try {
    const bitmap = await createImageBitmap(file)
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    // Recorte central quadrado
    const side = Math.min(bitmap.width, bitmap.height)
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
    const dataUrl = canvas.toDataURL('image/webp', 0.85)
    return { ok: true, dataUrl }
  } catch {
    return { ok: false, error: 'Não foi possível ler esta imagem.' }
  }
}
