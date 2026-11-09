/**
 * Persistência local do cliente (não do mock): token de sessão e id do carrinho de visitante.
 * A senha nunca é armazenada; o token é opaco e validado pela API a cada requisição.
 */

const TOKEN_KEY = 'kurio:session-token'
const GUEST_CART_KEY = 'kurio:guest-cart-id'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // armazenamento indisponível: segue só em memória
  }
}

export const sessionToken = {
  get: () => read(TOKEN_KEY),
  set: (token: string | null) => write(TOKEN_KEY, token),
}

export const guestCartId = {
  get: () => read(GUEST_CART_KEY),
  set: (id: string | null) => write(GUEST_CART_KEY, id),
}
