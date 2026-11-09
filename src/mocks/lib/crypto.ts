/** Utilitários criptográficos do mock (WebCrypto, disponível no navegador). */

const encoder = new TextEncoder()

function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s)
}

/** PBKDF2-SHA256: a senha nunca é persistida em claro no banco simulado. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 20_000 },
    key,
    256,
  )
  return toBase64(bits)
}

export async function verifyPassword(password: string, salt: string, hash: string) {
  return (await hashPassword(password, salt)) === hash
}

export function randomToken(bytes = 24) {
  return toBase64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/[+/=]/g, '')
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** JSON com chaves ordenadas: mesma carga útil → mesmo hash (idempotência). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
