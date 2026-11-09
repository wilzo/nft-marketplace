/**
 * Aritmética de ETH sem ponto flutuante.
 *
 * Valores trafegam como strings decimais (ex.: "1.19") e são convertidos para wei (BigInt, 18 casas)
 * em qualquer cálculo. Usado tanto pelos mocks (cotação, pedidos) quanto pela interface (exibição).
 */

export const ETH_DECIMALS = 18
const WEI_PER_ETH = 10n ** BigInt(ETH_DECIMALS)
const DECIMAL_RE = /^\d+(\.\d{1,18})?$/

export type Wei = bigint

export function isEthString(value: string): boolean {
  return DECIMAL_RE.test(value)
}

/** "1.19" → 1190000000000000000n */
export function toWei(value: string): Wei {
  if (!isEthString(value)) throw new RangeError(`Valor ETH inválido: "${value}"`)
  const [int, frac = ''] = value.split('.')
  return BigInt(int) * WEI_PER_ETH + BigInt(frac.padEnd(ETH_DECIMALS, '0'))
}

/** 1190000000000000000n → "1.19" (forma canônica, sem zeros à direita) */
export function fromWei(wei: Wei): string {
  if (wei < 0n) return `-${fromWei(-wei)}`
  const int = wei / WEI_PER_ETH
  const frac = (wei % WEI_PER_ETH).toString().padStart(ETH_DECIMALS, '0').replace(/0+$/, '')
  return frac ? `${int}.${frac}` : int.toString()
}

export function addEth(...values: string[]): string {
  return fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
}

export function subEth(a: string, b: string): string {
  return fromWei(toWei(a) - toWei(b))
}

export function mulEth(value: string, quantity: number): string {
  if (!Number.isInteger(quantity)) throw new RangeError('Quantidade deve ser inteira')
  return fromWei(toWei(value) * BigInt(quantity))
}

/** Percentual inteiro em pontos-base (1000 = 10%), arredondado para baixo em wei. */
export function percentOfEth(value: string, basisPoints: number): string {
  return fromWei((toWei(value) * BigInt(basisPoints)) / 10_000n)
}

export function compareEth(a: string, b: string): -1 | 0 | 1 {
  const d = toWei(a) - toWei(b)
  return d === 0n ? 0 : d > 0n ? 1 : -1
}

export function minEth(a: string, b: string): string {
  return compareEth(a, b) <= 0 ? a : b
}

/**
 * Formatação para exibição, sem perder precisão: arredonda (half-up) para `maxDecimals`
 * e garante `minDecimals` casas. Ex.: formatEth("26.846") → "26.846"; formatEth("1.2") → "1.20".
 */
export function formatEth(value: string, { minDecimals = 2, maxDecimals = 4 } = {}): string {
  const negative = value.startsWith('-')
  let wei = toWei(negative ? value.slice(1) : value)
  const unit = 10n ** BigInt(ETH_DECIMALS - maxDecimals)
  wei = ((wei + unit / 2n) / unit) * unit
  const [int, frac = ''] = fromWei(wei).split('.')
  const out = `${int}.${frac.padEnd(minDecimals, '0')}`.replace(/\.$/, '')
  return negative && wei !== 0n ? `-${out}` : out
}
