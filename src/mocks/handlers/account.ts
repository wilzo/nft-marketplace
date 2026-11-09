import { http, HttpResponse } from 'msw'
import {
  AvatarInput,
  ChangePasswordInput,
  NewsletterInput,
  ProfileInput,
  WalletConnectionInput,
  WalletInput,
  WalletSlot,
  type WalletConnection,
  type Wallets,
} from '@/api/contracts'
import { getDb, nextId, nowIso, transact } from '../db/store'
import { toUser, toWallet } from '../domain/mappers'
import { hashPassword, randomToken, verifyPassword } from '../lib/crypto'
import { api, apiError, parseBody, requireUser } from '../lib/http'
import { getScenario } from '../scenarios'

function walletsOf(userId: string): Wallets {
  const list = getDb().wallets.filter((w) => w.userId === userId)
  const bySlot = (slot: WalletSlot) => list.find((w) => w.slot === slot)
  const primary = bySlot('primary')
  const secondary = bySlot('secondary')
  return { primary: primary ? toWallet(primary) : null, secondary: secondary ? toWallet(secondary) : null }
}

/** Newsletter do rodapé: inscrição simulada (nenhum e-mail é enviado); e-mail repetido → 409 no campo. */
export const newsletterHandlers = [
  http.post(api('/newsletter'), async ({ request }) => {
    const input = await parseBody(request, NewsletterInput)
    if (getDb().newsletter.some((s) => s.email === input.email)) {
      return apiError(409, 'CONFLICT', 'Este e-mail já está inscrito na newsletter.', {
        fieldErrors: { email: ['Este e-mail já está inscrito na newsletter.'] },
      })
    }
    const subscription = { email: input.email, subscribedAt: nowIso() }
    transact((db) => db.newsletter.push(subscription))
    return HttpResponse.json(subscription, { status: 201 })
  }),
]

export const profileHandlers = [
  http.get(api('/profile'), ({ request }) => HttpResponse.json(toUser(requireUser(request)))),

  http.patch(api('/profile'), async ({ request }) => {
    const user = requireUser(request)
    const input = await parseBody(request, ProfileInput)
    const others = getDb().users.filter((u) => u.id !== user.id)
    const fieldErrors: Record<string, string[]> = {}
    if (others.some((u) => u.email === input.email)) fieldErrors.email = ['Este e-mail já está cadastrado']
    if (others.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) fieldErrors.username = ['Este nome de usuário já está em uso']
    if (Object.keys(fieldErrors).length) return apiError(409, 'CONFLICT', 'Alguns dados já estão em uso', { fieldErrors })

    const updated = transact((db) => {
      const u = db.users.find((x) => x.id === user.id)!
      Object.assign(u, {
        displayName: input.displayName,
        username: input.username,
        email: input.email,
        ensName: input.ensName ?? null,
        walletNickname: input.walletNickname ?? null,
        updatedAt: nowIso(),
      })
      return u
    })
    return HttpResponse.json(toUser(updated))
  }),

  http.put(api('/profile/avatar'), async ({ request }) => {
    const user = requireUser(request)
    const input = await parseBody(request, AvatarInput)
    const updated = transact((db) => {
      const u = db.users.find((x) => x.id === user.id)!
      u.avatarUrl = input.dataUrl
      u.updatedAt = nowIso()
      return u
    })
    return HttpResponse.json(toUser(updated))
  }),

  http.delete(api('/profile/avatar'), ({ request }) => {
    const user = requireUser(request)
    const updated = transact((db) => {
      const u = db.users.find((x) => x.id === user.id)!
      u.avatarUrl = null
      u.updatedAt = nowIso()
      return u
    })
    return HttpResponse.json(toUser(updated))
  }),

  http.post(api('/profile/password'), async ({ request }) => {
    const user = requireUser(request)
    const input = await parseBody(request, ChangePasswordInput)
    if (!(await verifyPassword(input.currentPassword, user.passwordSalt, user.passwordHash))) {
      return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados', {
        fieldErrors: { currentPassword: ['Senha atual incorreta'] },
      })
    }
    const salt = randomToken(12)
    const hash = await hashPassword(input.newPassword, salt)
    transact((db) => {
      const u = db.users.find((x) => x.id === user.id)!
      u.passwordSalt = salt
      u.passwordHash = hash
      u.updatedAt = nowIso()
    })
    return new HttpResponse(null, { status: 204 })
  }),
]

export const walletHandlers = [
  http.get(api('/wallets'), ({ request }) => HttpResponse.json(walletsOf(requireUser(request).id))),

  http.put(api('/wallets/:slot'), async ({ request, params }) => {
    const user = requireUser(request)
    const slot = WalletSlot.safeParse(params.slot)
    if (!slot.success) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada')
    const input = await parseBody(request, WalletInput)
    const current = walletsOf(user.id)
    if (slot.data === 'secondary' && !current.primary) {
      return apiError(409, 'CONFLICT', 'Cadastre a carteira principal antes da secundária')
    }
    const other = slot.data === 'primary' ? current.secondary : current.primary
    if (other && other.address.toLowerCase() === input.address.toLowerCase()) {
      return apiError(409, 'CONFLICT', 'Este endereço já está cadastrado na outra carteira', {
        fieldErrors: { address: ['Este endereço já está cadastrado na outra carteira'] },
      })
    }
    transact((db) => {
      const existing = db.wallets.find((w) => w.userId === user.id && w.slot === slot.data)
      const data = {
        displayName: input.displayName,
        nickname: input.nickname,
        network: input.network,
        profileName: input.profileName,
        address: input.address,
        secondaryAddress: input.secondaryAddress ?? null,
        walletType: input.walletType,
        referralCode: input.referralCode,
        email: input.email,
        ensName: input.ensName,
        updatedAt: nowIso(),
      }
      if (existing) Object.assign(existing, data)
      else db.wallets.push({ id: nextId('wal'), userId: user.id, slot: slot.data, ...data })
    })
    return HttpResponse.json(walletsOf(user.id))
  }),

  /** Simula a conexão com a carteira (aprovação/recusa no app da carteira). */
  http.post(api('/wallet-connections'), async ({ request }) => {
    const user = requireUser(request)
    const input = await parseBody(request, WalletConnectionInput)
    const wallet = getDb().wallets.find((w) => w.id === input.walletId && w.userId === user.id)
    if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada')
    if (getScenario().wallet.connectOutcome === 'rejected') {
      return apiError(409, 'WALLET_REJECTED', 'A conexão foi recusada na carteira. Tente novamente ou escolha outra carteira.')
    }
    const connection: WalletConnection = {
      id: nextId('conn'),
      walletId: wallet.id,
      network: input.network,
      status: 'connected',
      connectedAt: nowIso(),
    }
    transact((db) => {
      db.walletConnections = db.walletConnections.filter((c) => c.userId !== user.id)
      db.walletConnections.push({ id: connection.id, userId: user.id, walletId: wallet.id, network: input.network, connectedAt: connection.connectedAt })
    })
    return HttpResponse.json(connection, { status: 201 })
  }),

  http.delete(api('/wallet-connections/:id'), ({ request, params }) => {
    const user = requireUser(request)
    transact((db) => (db.walletConnections = db.walletConnections.filter((c) => !(c.id === params.id && c.userId === user.id))))
    return new HttpResponse(null, { status: 204 })
  }),
]
