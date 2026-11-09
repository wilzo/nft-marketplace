import { http, HttpResponse } from 'msw'
import {
  Favorites,
  LoginInput,
  OAuthCallbackInput,
  OAuthProvider,
  RegisterInput,
  type OAuthAuthorization,
  type OAuthSession,
  type Session,
} from '@/api/contracts'
import { getDb, nextId, nowIso, transact } from '../db/store'
import type { UserRecord } from '../db/types'
import { toUser } from '../domain/mappers'
import { OAUTH_ACCOUNTS, OAUTH_PROVIDER_NAMES, OAUTH_SCOPES } from '../fixtures/oauth'
import { hashPassword, randomToken, verifyPassword } from '../lib/crypto'
import { api, apiError, bearerToken, parseBody, requireUser } from '../lib/http'
import { getScenario } from '../scenarios'

function openSession(user: UserRecord): Session {
  const token = randomToken()
  const expiresAt = nowIso(getScenario().sessionTtlSeconds * 1000)
  transact((db) => db.sessions.push({ token, userId: user.id, createdAt: nowIso(), expiresAt }))
  return { token, expiresAt, user: toUser(user) }
}

const OAUTH_REQUEST_TTL_MS = 5 * 60_000

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
    // Conta criada só pelo login social não tem senha: não entra por e-mail/senha.
    if (!user || !user.passwordHash || !(await verifyPassword(input.password, user.passwordSalt, user.passwordHash))) {
      return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos')
    }
    return HttpResponse.json(openSession(user))
  }),

  http.get(api('/auth/session'), ({ request }) => {
    const user = requireUser(request)
    const session = getDb().sessions.find((s) => s.token === bearerToken(request))!
    return HttpResponse.json({ token: session.token, expiresAt: session.expiresAt, user: toUser(user) } satisfies Session)
  }),

  // ---------- Login social SIMULADO (nenhuma chamada sai para o Google/Facebook) ----------

  /** 1º passo: o "provedor" autentica o usuário e devolve o pedido de consentimento (contas e dados compartilhados). */
  http.post(api('/auth/oauth/:provider/authorize'), ({ params }) => {
    const parsed = OAuthProvider.safeParse(params.provider)
    if (!parsed.success) return apiError(404, 'NOT_FOUND', 'Provedor de login desconhecido')
    const provider = parsed.data
    const request = transact((db) => {
      // Pedidos expirados não se acumulam.
      db.oauthRequests = db.oauthRequests.filter((r) => r.expiresAt > nowIso())
      const record = { id: nextId('oauth'), provider, expiresAt: nowIso(OAUTH_REQUEST_TTL_MS) }
      db.oauthRequests.push(record)
      return record
    })
    return HttpResponse.json({
      requestId: request.id,
      provider,
      providerName: OAUTH_PROVIDER_NAMES[provider],
      scopes: OAUTH_SCOPES,
      accounts: OAUTH_ACCOUNTS[provider],
      expiresAt: request.expiresAt,
    } satisfies OAuthAuthorization)
  }),

  /** 2º passo: decisão do usuário. Aceite → entra na conta vinculada ou cria uma nova; recusa → 403. */
  http.post(api('/auth/oauth/:provider'), async ({ request, params }) => {
    const parsed = OAuthProvider.safeParse(params.provider)
    if (!parsed.success) return apiError(404, 'NOT_FOUND', 'Provedor de login desconhecido')
    const provider = parsed.data
    const input = await parseBody(request, OAuthCallbackInput)
    const providerName = OAUTH_PROVIDER_NAMES[provider]

    // Pedido de uso único: consumido aqui, aceito ou não.
    const pending = transact((db) => {
      const found = db.oauthRequests.find((r) => r.id === input.requestId && r.provider === provider)
      db.oauthRequests = db.oauthRequests.filter((r) => r.id !== input.requestId)
      return found
    })
    if (!pending || pending.expiresAt <= nowIso()) {
      return apiError(400, 'VALIDATION_ERROR', `A autorização do ${providerName} expirou. Tente novamente.`)
    }
    if (input.decision === 'deny') {
      return apiError(403, 'OAUTH_DENIED', `Você cancelou o acesso pelo ${providerName}. Nenhuma conta foi criada ou alterada.`)
    }

    const account = OAUTH_ACCOUNTS[provider].find((a) => a.subject === input.subject)
    if (!account) return apiError(422, 'VALIDATION_ERROR', 'Conta do provedor inválida')

    const db = getDb()
    const identity = db.oauthIdentities.find((i) => i.provider === provider && i.subject === account.subject)
    const linked = identity && db.users.find((u) => u.id === identity.userId)
    if (linked) return HttpResponse.json({ ...openSession(linked), created: false } satisfies OAuthSession)

    if (db.users.some((u) => u.email === account.email)) {
      return apiError(
        409,
        'ACCOUNT_EXISTS',
        `Já existe uma conta Kurio com o e-mail ${account.email}, criada com senha. Entre com sua senha para continuar.`,
        { details: { email: account.email } },
      )
    }

    const id = nextId('usr')
    const base = account.email.split('@')[0]!.replace(/[^a-z0-9._-]/gi, '').toLowerCase().slice(0, 20) || 'colecionador'
    let username = base
    for (let n = 2; db.users.some((u) => u.username.toLowerCase() === username); n++) username = `${base}${n}`
    const user: UserRecord = {
      id,
      username,
      displayName: account.name,
      email: account.email,
      ensName: null,
      walletNickname: null,
      avatarUrl: null,
      passwordSalt: '',
      passwordHash: '',
      updatedAt: nowIso(),
    }
    transact((d) => {
      d.users.push(user)
      d.favorites[id] = []
      d.oauthIdentities.push({ provider, subject: account.subject, userId: id, linkedAt: nowIso() })
    })
    return HttpResponse.json({ ...openSession(user), created: true } satisfies OAuthSession, { status: 201 })
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
