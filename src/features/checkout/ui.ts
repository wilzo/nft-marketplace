import type { WalletType } from '@/api/contracts'

/** Rádio redondo do Figma (anel laranja; preenchido quando selecionado). */
export const radioClass =
  "grid size-4 shrink-0 appearance-none place-content-center rounded-full border-[1.2px] border-brand before:size-2 before:scale-0 before:rounded-full before:bg-brand before:content-[''] checked:before:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

/** Opções de conexão (provedores) — ordem e rótulos do Figma. */
export const PROVIDERS: WalletType[] = ['walletconnect', 'metamask', 'coinbase']
