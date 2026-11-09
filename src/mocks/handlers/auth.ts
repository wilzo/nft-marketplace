import { http, HttpResponse } from 'msw'
import { Favorites, LoginInput, RegisterInput, type Session } from '@/api/contracts'
import { getDb, nextId, nowIso, transact } from '../db/store'
import type { UserRecord } from '../db/types'
import { toUser } from '../domain/mappers'
import { hashPassword, randomToken, verifyPassword } from '../lib/crypto'
import { api, apiError, bearerToken, parseBody, requireUser } from '../lib/http'
import { getScenario } from '../scenarios'

function openSession(user: UserRecord): Session {
  const token = randomToken()
  const expiresAt = nowIso(getScenario().sessionTtlSeconds * 1000)
  transact((db) => db.sessions.push({ token, userId: user.id, createdAt: nowIso(), expiresAt }))
  return { token, expiresAt, user: toUser(user) }
}

export const authHandlers = [
  http.post(api('/auth/register'), async ({ request }) => {
    const input = await parseBody(request, RegisterInput)
    const db = getDb()
    const fieldErrors: Record<string, string[]> = {}
    if (db.users.some((u) => u.email === input.email)) fieldErrors.email = ['Este e-mail já está cadastrado']
    if (db.users.some((u) => u.username.toLowerCase() === input.username.toLowerCase()))
      fieldErrors.username = ['Este nome de usuário já está em uso']
    if (Object.keys(fieldErrors).length) return apiError(409, 'CONFLICT', 'Já existe uma conta com estes dados', { fieldErrors })

    const id = nextId('usr')
    const salt = randomToken(12)
    const user: UserRecord = {
      id,
      username: input.username,
      displayName: input.username,
      email: input.email,
      ensName: null,
      walletNickname: null,
      avatarUrl: null,
      passwordSalt: salt,
      passwordHash: await hashPassword(input.password, salt),
      updatedAt: nowIso(),
    }
    transact((d) => {
      d.users.push(user)
      d.favorites[id] = []
    })
    return HttpResponse.json(openSession(user), { status: 201 })
  }),

  http.post(api('/auth/login'), async ({ request }) => {
    const input = await parseBody(request, LoginInput)
    const user = getDb().users.find((u) => u.email === input.email)
    if (!user || !(await verifyPassword(input.password, user.passwordSalt, user.passwordHash))) {
      return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos')
    }
    return HttpResponse.json(openSession(user))
  }),

  http.get(api('/auth/session'), ({ request }) => {
    const user = requireUser(request)
    const session = getDb().sessions.find((s) => s.token === bearerToken(request))!
    return HttpResponse.json({ token: session.token, expiresAt: session.expiresAt, user: toUser(user) } satisfies Session)
  }),

  http.post(api('/auth/logout'), ({ request }) => {
    const token = bearerToken(request)
    if (token) transact((db) => (db.sessions = db.sessions.filter((s) => s.token !== token)))
    return new HttpResponse(null, { status: 204 })
  }),
]

export const favoriteHandlers = [
  http.get(api('/favorites'), ({ request }) => {
    const user = requireUser(request)
    return HttpResponse.json({ nftIds: getDb().favorites[user.id] ?? [] } satisfies Favorites)
  }),

  http.put(api('/favorites/:nftId'), ({ request, params }) => {
    const user = requireUser(request)
    const nftId = String(params.nftId)
    if (!getDb().nfts.some((n) => n.id === nftId)) return apiError(404, 'NOT_FOUND', 'NFT não encontrado')
    const nftIds = transact((db) => {
      const list = db.favorites[user.id] ?? []
      db.favorites[user.id] = list.includes(nftId) ? list : [...list, nftId]
      return db.favorites[user.id]
    })
    return HttpResponse.json({ nftIds } satisfies Favorites)
  }),

  http.delete(api('/favorites/:nftId'), ({ request, params }) => {
    const user = requireUser(request)
    const nftIds = transact((db) => (db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== params.nftId)))
    return HttpResponse.json({ nftIds } satisfies Favorites)
  }),
]
