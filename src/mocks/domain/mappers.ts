import { NETWORK_LABELS, type NftDetail, type NftSummary, type User, type Wallet } from '@/api/contracts'
import { defaultEdition, displayPrice } from '../fixtures/nfts'
import type { NftRecord, UserRecord, WalletRecord } from '../db/types'

/** Conversões registro interno → contrato público (nunca expõe hash de senha, sessões etc.). */

export function toNftSummary(n: NftRecord): NftSummary {
  return {
    id: n.id,
    name: n.name,
    tokenId: n.tokenId,
    image: n.image,
    collection: n.collection,
    creator: n.creator,
    category: n.category,
    network: n.network,
    price: displayPrice(n),
    previousPrice: n.previousPrice,
    rare: n.rare,
    defaultEditionId: defaultEdition(n).id,
    available: n.editions.reduce((sum, e) => sum + e.available, 0),
    listedAt: n.listedAt,
    version: n.version,
  }
}

export function toNftDetail(n: NftRecord): NftDetail {
  return {
    ...toNftSummary(n),
    // Textos exatamente como no frame "Desktop / Detalhes do NFT" (inclusive "Kurio Editions").
    summary: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na ${NETWORK_LABELS[n.network]}, com arte desbloqueável e acesso para colecionadores.`,
    description:
      `${n.name} é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e ` +
      `verificado na ${NETWORK_LABELS[n.network]}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.

` +
      `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada ` +
      `na rede. ${n.creator} recebe ${n.royaltyPercent}% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
    attributes: n.attributes,
    contractAddress: n.contractAddress,
    standard: n.standard,
    royaltyPercent: n.royaltyPercent,
    rating: n.rating,
    editions: n.editions,
    gallery: n.gallery,
  }
}

export function toUser(u: UserRecord): User {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    ensName: u.ensName,
    walletNickname: u.walletNickname,
    avatarUrl: u.avatarUrl,
    updatedAt: u.updatedAt,
  }
}

export function toWallet(w: WalletRecord): Wallet {
  return {
    id: w.id,
    slot: w.slot,
    displayName: w.displayName,
    nickname: w.nickname,
    network: w.network,
    profileName: w.profileName,
    address: w.address,
    secondaryAddress: w.secondaryAddress,
    walletType: w.walletType,
    referralCode: w.referralCode,
    email: w.email,
    ensName: w.ensName,
    updatedAt: w.updatedAt,
  }
}
