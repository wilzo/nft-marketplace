/**
 * Inicialização progressiva: a interface renderiza imediatamente, e toda chamada REST / conexão Socket.IO
 * aguarda a camada de mocks (MSW) ficar pronta. Assim nenhuma requisição escapa do MSW e o primeiro
 * conteúdo (header, hero) não espera o service worker subir.
 */
let ready: Promise<void> = Promise.resolve()

export function setNetworkReady(promise: Promise<unknown>) {
  ready = promise.then(() => undefined)
}

/** Resolve quando as requisições podem ser feitas (mocks ativos ou desativados). */
export function whenNetworkReady() {
  return ready
}
