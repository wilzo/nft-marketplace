import { hashPassword } from '../lib/crypto'
import type { DbState, UserRecord } from '../db/types'
import { createNftFixtures } from './nfts'

export const DB_SCHEMA_VERSION = 5

/** Credenciais fictícias documentadas no README. */
export const FIXTURE_PASSWORD = 'Kurio2026!'

export const FIXTURE_USERS = {
  ana: { id: 'usr_ana', email: 'ana@kurio.dev', username: 'ana.kurio', displayName: 'Ana Colecionadora' },
  bruno: { id: 'usr_bruno', email: 'bruno@kurio.dev', username: 'bruno.mendes', displayName: 'Bruno Mendes' },
} as const

const SEED_TIME = '2026-07-29T12:00:00.000Z'

/** Estado inicial conhecido. `resetDb()` sempre restaura exatamente este cenário. */
export async function createSeed(): Promise<DbState> {
  const users: UserRecord[] = await Promise.all(
    Object.values(FIXTURE_USERS).map(async (u) => ({
      ...u,
      ensName: u.id === 'usr_ana' ? 'anakurio' : null,
      walletNickname: u.id === 'usr_ana' ? 'Cofre principal' : null,
      avatarUrl: null,
      passwordSalt: `salt-${u.id}`,
      passwordHash: await hashPassword(FIXTURE_PASSWORD, `salt-${u.id}`),
      updatedAt: SEED_TIME,
    })),
  )

  const nfts = createNftFixtures()
  const price = (nftId: string, kind: string) => nfts.find((n) => n.id === nftId)!.editions.find((e) => e.kind === kind)!.price

  return {
    schemaVersion: DB_SCHEMA_VERSION,
    nfts,
    users,
    sessions: [],
    wallets: [
      {
        // Endereços do Figma (Pagamento mobile / Confirmação): 0xA91F…E82C
        id: 'wal_ana_primary',
        userId: 'usr_ana',
        slot: 'primary',
        displayName: 'Ana Colecionadora',
        nickname: 'Principal',
        network: 'ethereum',
        profileName: 'Cofre principal',
        address: '0xA91F7c3e5d1b2e8f3a9c4d6e7f8091a2b3c4E82C',
        secondaryAddress: null,
        walletType: 'metamask',
        referralCode: 'KURIO-ANA',
        email: 'ana@kurio.dev',
        ensName: 'anakurio',
        updatedAt: SEED_TIME,
      },
      {
        id: 'wal_ana_secondary',
        userId: 'usr_ana',
        slot: 'secondary',
        displayName: 'Ana Colecionadora',
        nickname: 'Reserva',
        network: 'polygon',
        profileName: 'Reserva',
        address: '0x5B2D9e4f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0C71',
        secondaryAddress: null,
        walletType: 'coinbase',
        referralCode: 'KURIO-ANA',
        email: 'ana@kurio.dev',
        ensName: 'nova.kurio',
        updatedAt: SEED_TIME,
      },
    ],
    favorites: { usr_ana: ['emerald-ape-042', 'neon-vessel-552'], usr_bruno: [] },
    carts: [
      {
        // Carrinho da Ana reproduz o frame "Carrinho de NFTs" do Figma.
        id: 'cart_usr_ana',
        userId: 'usr_ana',
        couponCode: null,
        version: 1,
        updatedAt: SEED_TIME,
        items: [
          { id: 'item_ana_1', nftId: 'emerald-ape-042', editionId: 'emerald-ape-042--1-50', quantity: 2, seenUnitPrice: price('emerald-ape-042', '1-50') },
          { id: 'item_ana_2', nftId: 'violet-nomad-314', editionId: 'violet-nomad-314--1-50', quantity: 6, seenUnitPrice: price('violet-nomad-314', '1-50') },
          { id: 'item_ana_3', nftId: 'ivory-baron-088', editionId: 'ivory-baron-088--1-50', quantity: 9, seenUnitPrice: price('ivory-baron-088', '1-50') },
        ],
      },
    ],
    coupons: [
      { code: 'KURIO10', label: 'Cupom KURIO10 (10%)', basisPoints: 1_000, expiresAt: '2099-12-31T23:59:59.000Z' },
      { code: 'LANCAMENTO', label: 'Desconto do lançamento (15%)', basisPoints: 1_500, expiresAt: '2099-12-31T23:59:59.000Z' },
      { code: 'EXPIRADO', label: 'Cupom expirado (20%)', basisPoints: 2_000, expiresAt: '2025-01-01T00:00:00.000Z' },
    ],
    quotes: [],
    orders: [],
    idempotency: [],
    walletConnections: [],
    oauthIdentities: [],
    oauthRequests: [],
    counters: {},
  }
}
