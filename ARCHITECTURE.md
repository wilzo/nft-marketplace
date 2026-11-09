# Arquitetura

Este documento explica como a aplicação está organizada, os contratos com a API (REST e Socket.IO), as políticas de
sessão, carrinho, cache e retries, a reconciliação entre REST e eventos, as limitações conhecidas e as decisões de UX e
desvios em relação ao Figma. Instruções de uso estão no [README.md](README.md).

## 1. Visão geral

```
 React (rotas, componentes)
        │  useQuery / useMutation
 TanStack Query (cache por recurso, escopo por usuário)
        │                              ▲ eventos → setQueryData / invalidate
 api/endpoints.ts (Axios + zod)   lib/realtime.ts (socket.io-client)
        │ HTTP /api/*                  │ wss://realtime.kurio.test
 ───────┴──────── rede do navegador ───┴────────────────────────────
 MSW (service worker)            @mswjs/socket.io-binding
        └──── handlers REST ── banco simulado (localStorage) ── publicador de eventos
```

- A aplicação **não sabe que está mockada**: chama a API via Axios e conecta via `socket.io-client`. Desligar
  `VITE_ENABLE_MOCKS` faz as mesmas chamadas irem para `VITE_API_BASE_URL`/`VITE_SOCKET_URL`.
- Os **contratos zod** em `src/api/contracts/` são a fonte única de tipos: o cliente valida toda resposta
  (`api/client.ts`) e os handlers do MSW validam todo corpo recebido com os mesmos schemas.
- Valores em ETH trafegam como **string decimal** e são calculados em **BigInt (wei)** (`lib/eth.ts`); nada usa `number`.

### Organização das pastas

| Pasta | Responsabilidade |
| --- | --- |
| `src/routes/` | Uma rota por tela (TanStack Router por arquivo). Busca validada (`validateSearch` + zod com `.catch`), guarda de sessão em `beforeLoad`, prefetch no `loader`. |
| `src/features/<domínio>/` | Queries/mutations, regras e componentes de cada domínio: `catalog`, `nft-detail`, `session`, `auth`, `favorites`, `cart`, `checkout`, `orders`, `account`, `wallets`, `realtime`, `dev` (painel de cenários). |
| `src/api/` | Contratos, funções REST tipadas (`endpoints.ts`) e cliente da API de controle dos mocks. |
| `src/lib/` | Infraestrutura: Axios (`http.ts`), erro normalizado (`api-error.ts`), Socket.IO (`realtime.ts`), QueryClient, chaves de cache, ETH, boot progressivo, armazenamento do cliente. |
| `src/components/` | Layout (header, footer, tab bar, menu do usuário), campos de formulário, `ui/` do shadcn (ajustados aos tokens do Figma). |
| `src/mocks/` | MSW: handlers REST, servidor Socket.IO, banco simulado, fixtures, regras de negócio do servidor, cenários. |

## 2. Contratos REST

Prefixo `/api`. Autenticação por `Authorization: Bearer <token>`; carrinho de visitante por `X-Cart-Id`.

| Recurso | Endpoints |
| --- | --- |
| Catálogo | `GET /nfts?q&category[]&network[]&minPrice&maxPrice&tab&sort&page&pageSize` (paginado), `GET /nfts/:id`, `GET /nfts/:id/related`, `GET /highlights` |
| Autenticação | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/session` |
| Login social (simulado) | `POST /auth/oauth/:provider/authorize` → `OAuthAuthorization` (pedido de consentimento: `requestId`, contas, escopos, `expiresAt`); `POST /auth/oauth/:provider` `{ requestId, decision: 'allow', subject }` ou `{ requestId, decision: 'deny' }` → `OAuthSession` (`Session` + `created`) |
| Favoritos | `GET /favorites`, `PUT /favorites/:nftId`, `DELETE /favorites/:nftId` (idempotentes) |
| Carrinho | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`, `POST /cart/acknowledge`, `PUT /cart/coupon`, `DELETE /cart/coupon`, `POST /cart/merge` |
| Cotação | `POST /quotes` `{ network }` → itens, subtotal, desconto, taxas, total, avisos, `expiresAt` |
| Pedidos | `POST /orders` (header **`Idempotency-Key`** obrigatório), `GET /orders?status=`, `GET /orders/:id` |
| Perfil | `GET /profile`, `PATCH /profile`, `PUT /profile/avatar`, `DELETE /profile/avatar`, `POST /profile/password` |
| Newsletter | `POST /newsletter` `{ email }` → 201 `NewsletterSubscription`; e-mail já inscrito → 409 `CONFLICT` com `fieldErrors.email` |
| Carteiras | `GET /wallets`, `PUT /wallets/:slot` (`primary`/`secondary`), `POST /wallet-connections`, `DELETE /wallet-connections/:id` |
| Controle (mock) | `/__mock/*` — ver README |

**Envelope de erro** (`ApiErrorBody`):

```json
{ "error": { "code": "QUOTE_STALE", "message": "…", "retryable": false, "fieldErrors": { "email": ["…"] }, "details": { "quote": {} } } }
```

Códigos: `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `AVAILABILITY_CONFLICT`, `QUOTE_STALE`, `IDEMPOTENCY_CONFLICT`, `COUPON_INVALID`, `COUPON_EXPIRED`,
`WALLET_REJECTED`, `WALLET_NOT_CONNECTED`, `OAUTH_DENIED`, `OAUTH_PROVIDER_ERROR`, `ACCOUNT_EXISTS`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`.

O interceptor do Axios converte qualquer falha em `ApiError` (`lib/api-error.ts`) com `kind` (`network`, `timeout`,
`http`, `invalid-response`, `canceled`), `status`, `code`, `fieldErrors`, `retryable` e `isSessionLoss`. Uma resposta 2xx fora do
contrato vira erro `invalid-response` em vez de dado corrompido na tela. `fieldErrors` são aplicados aos campos do formulário
(`lib/use-api-form.ts`); sem erro de campo, o formulário mostra um alerta geral.

## 3. Eventos Socket.IO

Conexão: `io(VITE_SOCKET_URL, { transports: ['websocket'], auth: { token } })`. Sem token, só eventos públicos.

| Evento | Recurso | Dados | Quem recebe |
| --- | --- | --- | --- |
| `nft.updated` | `{ type: 'nft', id }` | `price`, `previousPrice`, `available`, `defaultEditionId`, `editions[]` | Todos |
| `order.updated` | `{ type: 'order', id }` | `status` (`pending`/`confirmed`/`declined`), `txHash`, `failureReason`; `userId` no envelope | Dono do pedido |

Envelope comum: `eventId` (estável entre reentregas), `occurredAt` e `version` (versão do recurso após a mudança).
Todo evento é validado com zod (`RealtimeEvent`); eventos inválidos são descartados. Em `nft.updated`, `price` é o preço da
edição padrão e `available` é o total das edições; o detalhe por edição está em `editions[]`.

### Transporte no ambiente de mocks

- O `socket.io-client` real abre um WebSocket para `VITE_SOCKET_URL`; o MSW intercepta esse WebSocket
  (`ws.link('wss://realtime.kurio.test/*')`) e o `@mswjs/socket.io-binding` traduz os pacotes Engine.IO/Socket.IO para
  o servidor simulado (`src/mocks/realtime.ts`). Os eventos nascem no servidor simulado (mudanças no banco via REST
  ou API de controle) — **nenhum evento é criado pela interface**.
- Cliente: `RealtimeClient` (`src/lib/realtime.ts`), importado sob demanda depois que o MSW sobe; reconexão automática
  (0,5 s → 3 s); a cada troca de sessão desconecta e conecta de novo com o token novo.
- Servidor simulado: autentica pelo token do CONNECT, guarda o usuário da conexão, entrega `order.updated` só ao dono,
  mantém histórico para `replay` (duplicado/antigo) e responde ao cenário `tempo-real-fora` recusando conexões.
- Limitações do binding: ver seção 12.

## 4. Sessão

- **Token** em `localStorage` (`kurio:session-token`), enviado pelo interceptor. A sessão é a query `['session']`
  (`GET /auth/session`, `staleTime: Infinity`), validada no carregamento da aplicação.
- **Rotas privadas** (`favoritos`, `perfil`, `carteiras`, `pagamento`, `pedidos/:id`) têm `staticData.private` e
  `beforeLoad: requireAuth`: sem sessão → `/entrar?redirect=<URL atual com busca>`. O `redirect` só aceita caminhos
  internos (evita *open redirect*).
- **Expiração** é detectada de três formas: (1) 401 `SESSION_EXPIRED`/`UNAUTHENTICATED` em qualquer chamada
  (`onSessionLoss`); (2) timer local no `expiresAt` da sessão; (3) token salvo recusado ao recarregar. Em todas:
  `clearSession(client, { keepDrafts: true })`; em rota privada, ida ao login com `?expirada=1` (aviso persistente
  na tela, pois um toast emitido durante o redirecionamento se perderia); em página pública, toast.
- **Retomada:** após novo login o usuário volta à URL de origem e o rascunho do pagamento (sessionStorage) é restaurado.
- **Logout:** `POST /auth/logout`, remove todas as queries sob `['private']`, apaga rascunhos de checkout e o id do
  carrinho de visitante, e reconecta o Socket.IO sem token.
- **Isolamento entre usuários no servidor:** pedidos, carrinho, carteiras, favoritos e perfil são sempre resolvidos pelo
  usuário da sessão. `GET /orders/:id` de outro usuário → 403 `FORBIDDEN`; a tela mostra "Acesso negado" sem nenhum
  dado do pedido. `order.updated` só é entregue à conexão do dono (e o cliente descarta `userId` diferente).
- **Troca de usuário:** dados privados ficam sob `['private', <userId>, …]`; o login remove o escopo anterior e
  rascunhos de outra conta. Nenhum dado de um usuário aparece para outro, nem por cache.
- O Socket.IO reconecta com o novo token sempre que a sessão muda (`use-session-sync.ts`).

### Login social (simulado)

Google e Facebook **não são integrados**: o provedor é simulado pelo MSW (`mocks/handlers/auth.ts`, contas fictícias em
`mocks/fixtures/oauth.ts`), seguindo o desenho de um fluxo OAuth:

1. `POST /auth/oauth/:provider/authorize` — o "provedor" devolve o pedido de consentimento (uso único, expira em 5 min).
2. A UI (`features/auth/social-login.tsx`) exibe um diálogo acessível com o que a API devolveu: título "Entrar com
   Google", aviso de simulação, contas (rádios, foco inicial na 1ª), dados compartilhados, **Cancelar**/**Continuar**.
   Fechar (Esc, clique fora) equivale a cancelar; o foco volta ao botão do provedor.
3. `POST /auth/oauth/:provider` com a decisão. `allow`: identidade já vinculada → entra (200, `created: false`);
   e-mail livre → cria a conta sem senha e vincula a identidade (201, `created: true`); e-mail de uma conta com senha →
   409 `ACCOUNT_EXISTS` (`details.email`) e a UI oferece **Entrar com senha** (`/entrar?email=…`, foco na senha).
   `deny` → 403 `OAUTH_DENIED`. Pedido inexistente/expirado/reutilizado → 400.
4. Sessão aberta segue exatamente o caminho do login comum (`startSession`: limpa dados privados, incorpora o carrinho
   do visitante, reconecta o Socket.IO).

Cenário `oauth-falha`: `authorize` responde 502 `OAUTH_PROVIDER_ERROR` (regra de falha do cenário). Contas criadas pelo
provedor não entram por senha; a troca de senha do perfil pede a senha atual, então não se aplica a elas.

## 5. Carrinho e cotação

- O carrinho é **sempre do servidor**. Visitante: o servidor cria um carrinho e o cliente guarda seu id
  (`X-Cart-Id`). No login, `POST /cart/merge` incorpora o carrinho do visitante ao do usuário.
- Cada item tem `status`: `ok`, `price_changed`, `quantity_exceeds`, `sold_out`, calculado pelo servidor contra o
  catálogo atual. `price_changed` exige **Aceitar novos preços** (`POST /cart/acknowledge`).
- **Mutations em série** (`scope: cart:<usuário>`): cliques rápidos em +/− nunca chegam fora de ordem.
  Quantidade e remoção são **otimistas** com rollback; a resposta do servidor substitui o cache.
- **Cotação:** os valores exibidos (subtotal, desconto, taxas, total) vêm sempre de `POST /quotes`; o cliente não
  recalcula totais. A chave da cotação inclui a versão do carrinho, preços e disponibilidade de cada item e a rede —
  qualquer mudança gera nova cotação. A query fica pausada enquanto há mutation do carrinho em andamento
  (`useIsMutating`), evitando cotar um estado intermediário.
- `blockingReason` (`features/cart/checkout-rules.ts`) explica por que a finalização está bloqueada (esgotado, acima
  do limite, preço não aceito, cupom inválido).

## 6. Checkout e idempotência

1. O formulário (react-hook-form + `CollectorInput`) é salvo como rascunho em `sessionStorage` por usuário.
2. **Revisão obrigatória**: a cotação é congelada no diálogo. Se a cotação ao vivo mudar (evento ou ação em outra
   aba), a revisão exige **Revisar novos valores**.
3. `POST /orders` leva o corpo e uma **`Idempotency-Key`** gerada por tentativa e guardada em `sessionStorage`
   (`kurio:checkout-attempt:<usuário>`). A mesma chave é reaproveitada enquanto o conteúdo não muda; reenviar após
   timeout ou queda de rede devolve **o mesmo pedido**. Mesma chave com corpo diferente → `IDEMPOTENCY_CONFLICT`.
4. O servidor exige uma **conexão ativa da carteira na rede do pedido** (`POST /wallet-connections`; desconectar remove a
   conexão): sem ela, 409 `WALLET_NOT_CONNECTED` e a UI volta a pedir a conexão — a regra não fica só na interface.
   Em seguida revalida preços e estoque: `QUOTE_STALE` (409) traz a nova cotação em `details.quote`;
   `AVAILABILITY_CONFLICT` leva à revisão do carrinho.
5. Criado o pedido (`pending`), a tela `/pedidos/:id` acompanha o status por `order.updated` e, como rede de
   segurança, por *polling* de 5 s enquanto pendente. Confirmado → recibo; recusado → motivo e opção de tentar de novo.
   A liquidação simulada é retomada após refresh (os timers são recriados a partir de `settleAt`).

Mutations de pedido nunca são repetidas automaticamente (`retry: false`): a repetição é sempre uma ação explícita do
usuário, sempre com a mesma chave.

## 7. Cache e retries

| Política | Valor | Motivo |
| --- | --- | --- |
| `staleTime` | 30 s (sessão: ∞) | Navegação entre telas sem piscar; eventos e invalidações cuidam da frescura. |
| `gcTime` | 5 min | Voltar a uma página recente é instantâneo. |
| Retry de queries | até 2×, só se `error.retryable` (rede, timeout, 5xx/503), *backoff* 0,5 s → 1 s | 4xx nunca se repetem. |
| Retry de mutations | nenhum | Evita duplicar operações. |
| Listagem | `placeholderData: keepPreviousData` + `AbortSignal` | Troca de filtros sem esvaziar a grade; requisições obsoletas são canceladas (sem respostas fora de ordem). |
| Chaves | `qk.*` em `lib/query-keys.ts`; privadas sob `['private', userId, …]` | Logout/troca de usuário removem tudo com um prefixo. |
| Foco da janela | `refetchOnWindowFocus` | Dados atualizados ao voltar à aba. |

Filtros, busca, ordenação, página e edição selecionada vivem na **URL**, então voltar/avançar, refresh e links
compartilhados reproduzem a mesma tela. O schema da busca (`features/catalog/search.ts`) nunca quebra a página: listas
aceitam JSON (`["a","b"]`, formato gravado pelo Router), parâmetro repetido (`a&a`, formato da API) ou valor único e
mantêm só os valores válidos; preço aceita texto ou número; faixa invertida é trocada; página/aba/ordenação inválidas
caem no padrão. Toda mudança de filtro zera a página.

## 8. Reconciliação REST × Socket.IO

- **Versão por recurso:** toda resposta REST de NFT registra sua versão (`realtime.noteVersion`). Eventos com versão
  menor ou igual à conhecida são ignorados — um evento antigo nunca sobrescreve dado mais novo vindo do REST.
- **Dedupe:** `eventId`s processados ficam num conjunto limitado (500); reentregas são descartadas.
- **Filtro por usuário:** `order.updated` de outro `userId` é descartado.
- **Aplicação:** `nft.updated` atualiza com `setQueryData` o detalhe, as listas, os destaques e os relacionados
  já em cache e invalida o carrinho (que recalcula status e cotação). `order.updated` invalida o pedido e a lista;
  confirmação invalida também o carrinho.
- **Reconexão:** ao reconectar, tudo que pode ter mudado durante a queda (catálogo, destaques, dados privados) é
  invalidado; o REST é a fonte da verdade e os eventos são aceleradores.
- **Sem Socket.IO:** a aplicação continua correta (polling de pedidos pendentes, revalidação no foco e na cotação).

## 9. Inicialização progressiva

`main.tsx` renderiza a interface imediatamente. Com mocks ativos, `import('./mocks/browser')` sobe o MSW em paralelo e
`lib/boot.ts` expõe `whenNetworkReady()`: o interceptor do Axios e o `RealtimeClient` aguardam essa promessa, então
nenhuma requisição escapa do MSW e o primeiro conteúdo (header, hero) não espera o service worker. Os parâmetros
`?cenario=`/`?painel=` são lidos e removidos da URL antes de o Router ser criado. `<html data-app="ready">` sinaliza
aos testes que a rede está pronta.

Carregamento (ver [lighthouse/ANALISE.md](lighthouse/ANALISE.md)):
- o chunk dos mocks recebe `modulepreload` no `index.html` (plugin em `vite.config.ts`): baixa junto com o bundle
  principal e executa sob demanda;
- partes de um único breakpoint (barra lateral de filtros, ordenação, barra mobile, hero) só são montadas no
  breakpoint em que aparecem — versões escondidas por CSS custavam render e *reflows* forçados do slider;
- as seções editoriais da home (Promos, Diário) são montadas depois da 1ª resposta do catálogo, no próximo momento
  ocioso: suas artes não disputam banda com os dados e o LCP, e o render fica em tarefas menores;
- o seed do banco simulado traz as senhas já em hash (PBKDF2), em vez de derivá-las a cada criação do banco.

## 10. Camada de mocks

- **Banco** em `localStorage` (`kurio:mock-db`). Ao carregar, o banco salvo só é adotado se tiver o `schemaVersion` atual
  **e** a forma esperada; versão antiga, banco parcial ou JSON inválido são descartados e recriados a partir do seed.
  O cenário salvo (`kurio:mock-scenario`) é completado com os valores padrão do preset.
- **Várias abas:** cada aba mantém uma cópia do banco em memória. Um listener do evento `storage` adota o banco
  gravado por outra aba — sem isso, uma aba antiga regravava o banco inteiro e apagava a sessão recém-criada em outra
  (causa do bug "o login não fica", coberto por `e2e/login-regression.spec.ts`).
- **Gravação:** `transact()`
  aplica mudanças e persiste, inclusive quando o handler lança erro depois de alterar o estado (necessário, por
  exemplo, no cenário "preço alterado", que muda o catálogo e responde 409).
- **Seed determinístico:** 239 NFTs com as contagens do Figma, 4 edições cada, ids e preços estáveis, dois usuários
  (senhas com PBKDF2), carteiras, carrinho do frame e cupons.
- **Cenários** (`mocks/scenarios.ts`): latência (fixa, nenhuma ou variável determinística por URL), offline, falhas
  por rota (com número de ocorrências), catálogo vazio, TTL da sessão, comportamento do checkout, da carteira e do
  tempo real. Persistem em `localStorage`.
- **Servidor de regras** (`mocks/domain/`): cotação, cupons, reservas de estoque, idempotência, liquidação do pagamento
  e publicação de eventos com versão.
- **Testes** usam a API de controle para preparar estado e disparar eventos, sem *sleeps* arbitrários.

## 11. O que é simulado e como

Tudo abaixo é servido pelo MSW a partir do banco simulado; a aplicação só conhece os contratos REST/Socket.IO e não tem
nenhum caminho alternativo para "modo demonstração" (`VITE_ENABLE_MOCKS` só decide se o MSW sobe e se o painel de cenários
existe). Com `npm run dev:no-mocks`, as mesmas chamadas vão para `VITE_API_BASE_URL`/`VITE_SOCKET_URL` e falham sem um backend.

| Domínio | Simulação |
| --- | --- |
| Autenticação | Usuários com senha em PBKDF2-SHA256 (salt por usuário; nunca em claro), sessões com token aleatório e expiração (TTL do cenário; `sessao-curta` = 30 s), 401 para token inválido/expirado. |
| Login social | Provedores Google/Facebook fictícios: pedido de consentimento de uso único, contas fictícias, criação/vínculo de conta, recusa (403), conflito com conta de senha (409), falha do provedor (`oauth-falha`, 502). Nenhuma chamada ao Google/Facebook. |
| Carteiras | Cadastro principal/secundária validado no servidor (endereço 0x, ENS, mesmo endereço nas duas → erro de campo). Conexão por carteira + rede em `/wallet-connections` (recusa no cenário `carteira-recusada`), desconexão remove a conexão. Nenhuma extensão de carteira é acessada. |
| Pagamento | Pedido idempotente criado como `pending` só com carteira conectada; liquidação após `settleDelayMs` (3 s no padrão) ou pela API de controle; resultado `confirmed` (remove do carrinho só os itens/quantidades comprados) ou `declined` (devolve o estoque reservado). Estados terminais não mudam. |
| Newsletter | Inscrição registrada no banco simulado (`newsletter`), e-mail validado pelo mesmo contrato e repetido recusado (409). Nenhum e-mail é enviado. |
| Transações | `txHash` determinístico (SHA-256 do id do pedido) e link de explorador gerados pelo servidor simulado na confirmação; a UI só exibe o que veio na resposta, marcado como referência simulada. Nenhuma blockchain é consultada. |
| Catálogo e eventos | 239 NFTs persistidos; preço/estoque mudam pela API de controle ou pelos cenários de checkout e publicam `nft.updated` com versão. |

## 12. Limitações conhecidas

**Binding Socket.IO do MSW (`@mswjs/socket.io-binding` 0.2):**
- Só transporte **WebSocket** (sem long-polling); o cliente usa `transports: ['websocket']`.
- O binding confirma o CONNECT antes de expor o `auth`: o token é lido do pacote bruto `40{…}`.
- Não há *rooms* nem *acks*; o filtro de destinatário é feito no envio (e repetido no cliente).
- Não envia heartbeat: o mock emite ping Engine.IO a cada 20 s para o cliente não derrubar a conexão.
- O MSW remove `/socket.io/` do caminho ao casar o handler (`ws.link('wss://realtime.kurio.test/*')`).
- O `socket.io-client` precisa ser importado **depois** do `worker.start()` (o engine.io captura `WebSocket` ao
  carregar o módulo) — por isso é importado sob demanda.
- Exige a versão 2 do MSW (o binding não é compatível com o MSW 3).

**Outras:**
- O "servidor" roda na aba: dados vivem no navegador de cada visitante; abas diferentes compartilham o banco, mas
  eventos só são entregues às conexões da própria aba.
- Pagamento, conexão de carteira e liquidação são simulados (nenhuma chamada a blockchain).
- **Performance mobile do Lighthouse (68–70)** abaixo da meta: o MSW e o banco simulado rodam na *thread* principal
  sob CPU 4× mais lenta e o LCP depende da resposta da API. Desktop 99 e as demais categorias 100.
  Análise em [lighthouse/ANALISE.md](lighthouse/ANALISE.md).
- O `tldts` (lista de sufixos públicos do `tough-cookie`, usado pelo pote de cookies do MSW) é substituído por uma
  regra simples (`src/mocks/lib/tldts-lite.ts`): os handlers não usam cookies; se um dia usarem, o escopo de domínio
  de cookies simulados seria aproximado (dois últimos rótulos).
- Páginas editoriais (Criadores, Aprenda, Diário da Cunhagem), atividade, ofertas, downloads, suporte, central de
  ajuda e recuperação de senha não fazem parte da entrega: levam à página informativa `/secao-indisponivel` (ver
  Decisões de UX). Compartilhar usa links externos reais (LinkedIn,
  Twitter, e-mail).

## 13. Decisões de UX

- **Estados não desenhados** (carregando, vazio, erro, offline, sessão expirada, preço alterado, esgotado, pedido
  pendente/recusado) seguem os tokens e componentes do Figma: skeletons com as mesmas dimensões dos cards (sem CLS),
  mensagens com ação de recuperação (Tentar novamente, Limpar filtros, Revisar carrinho).
- **Validação no envio** (`mode: 'onSubmit'`) e revalidação ao digitar depois do primeiro envio: validar no *blur*
  deslocava o layout e fazia o clique no botão se perder.
- **Acessibilidade:** skip link, foco visível, diálogos com *focus trap* e retorno do foco, grupos de rádio com setas,
  `aria-live` para mudanças de preço/status, alvos ≥ 24 px, contraste AA. Dicas de formato dos campos ficam em texto
  só para leitores de tela (o Figma não as mostra).
- **Breakpoint** em 1024 px: abaixo dele, layout mobile do Figma (tab bar, filtros em gaveta, carrinho e pagamento
  em tela cheia); acima, layout desktop.
- **Menu do usuário logado** (avatar → Meu perfil, Carteiras, Favoritos, Sair): o Figma não desenha o header logado.
- **Hero** com arte estática (não espera a API, protegendo o LCP); os links apontam aos destaques retornados pela API.
- **Seções fora do escopo** (opção "página informativa"): Criadores e Aprenda (header), Minha coleção, Atividade,
  Estúdio do criador, Central de ajuda, Como comprar NFTs, Política do mercado, Denunciar item (rodapé), Atividade,
  Ofertas, Arquivos baixados, Suporte (menu da conta, inclusive a faixa mobile), "Esqueceu a senha?" (login) e "Ler
  mais" (Diário da Cunhagem) continuam **visíveis como no Figma** e são **links reais** para
  `/secao-indisponivel?secao=<chave>`: título "<Seção> não faz parte desta versão", explicação de que nenhuma ação foi
  realizada e botão **Voltar ao catálogo**. Escolhida em vez de "Em breve" com `aria-disabled` porque não altera o
  visual dos frames, funciona igual com mouse, toque, teclado e leitor de tela (é um link comum, com destino
  anunciado), nunca leva a 404/página em branco e não aparenta sucesso. Mapa único em `src/lib/out-of-scope.ts`;
  teste em `e2e/out-of-scope.spec.ts`. "Lista de interesse" leva aos favoritos (equivalente existente).
- **Painel de cenários** fica oculto por padrão (`?painel=1`), para não interferir no layout do Figma.

## 14. Acessibilidade (ajustes)

- Skip link "Pular para o conteúdo", landmarks (`header`, `nav` nomeados, `main#conteudo`, `footer`) e hierarquia de
  títulos sem saltos.
- Diálogos (login/cadastro, busca, revisão do pedido, consentimento do login social, recibo) com *focus trap*, foco
  inicial no primeiro campo útil e devolução do foco ao gatilho; gavetas (filtros) idem.
- Formulários: rótulos associados (visíveis ou `sr-only` quando o Figma usa só *placeholder*), `aria-invalid` +
  `aria-describedby` com a mensagem do erro, foco no primeiro campo inválido, erros da API no campo correspondente.
- Estados dinâmicos anunciados: `role="alert"` para erros, `role="status"`/`aria-live` para preço alterado, status do
  pedido, sessão expirada e resultado da busca; `aria-busy` nos carregamentos.
- Controles: grupo de edições como rádios com setas, filtros como checkboxes nativos, quantidade com rótulos
  "Aumentar/Diminuir quantidade", botões de ícone com nome acessível, `aria-pressed` em favoritos e paginação.
- Alvos de toque ≥ 24 px (pontos dos carrosséis, ícones de compartilhar), contraste AA (texto de erro em coral),
  `prefers-reduced-motion` desliga animações e *shimmer*. Lighthouse Accessibility = 100 nas 4 medições.

## 15. Substituições de assets

| Asset | Origem |
| --- | --- |
| Artes dos NFTs | 4 imagens do Figma (1254 px) convertidas em WebP 320/640/960 com `srcset` (`npm run assets:images`); originais em `docs/figma/source-images/`. Os 239 NFTs reutilizam essas 4 artes (o Figma só tem 4). |
| Ícones | 31 SVG exportados do Figma (`src/assets/icons/`, cor via `currentColor`). Sem equivalente exportável, vêm do lucide-react no mesmo traço: coração (favoritos), *scan* da tab bar, estrela da avaliação, setas/chevrons, +/−, fechar, alertas e *spinner*. |
| Logo e fonte | Logo "KURIO" exportado com contorno; Roboto Mono servida localmente (`@fontsource-variable/roboto-mono`). |
| Favicon | Derivado da marca (não existe no Figma). |
| Avatares | Inicial do nome do usuário até o envio de uma foto (o Figma usa fotos de banco de imagens). |

## 16. Desvios e inconsistências do Figma

| Item | Figma | Implementação | Motivo |
| --- | --- | --- | --- |
| Contagens por rede | 119 / 78 / 86 (= 283) | 100 / 66 / 73 (= 239) | O total não fecha com as coleções (239); mantidas as proporções. |
| Pagamento mobile | Sem campos do colecionador | Campos em "Dados do colecionador" recolhível, aberto automaticamente se houver erro | O pedido exige esses dados. |
| Pontos dos carrosséis | 8 px de espaço | 16 px (ponto visível de 8 px) | Alvo de toque de 24 px (WCAG 2.5.8). |
| Texto de erro | Laranja escuro | Coral do próprio tema | Contraste AA sobre o fundo escuro. |
| Header logado, estados de erro/vazio/carregando | Não desenhados | Criados com os tokens do Figma | Exigidos pelo desafio. |
| Ícones de coração e da tab bar | Não exportáveis | lucide-react, mesmo traço e tamanho | Ausentes dos assets do arquivo. |
| Seções sem tela (Criadores, Aprenda, suporte, atividade, ofertas, downloads, ajuda, Diário…) | Apenas visuais | Links mantidos, levando à página informativa `/secao-indisponivel` (sem criar as seções) | Fora do escopo do desafio; comportamento coerente sem sucesso falso. |
| Página "seção indisponível" | Não existe | Criada com os tokens do projeto (título, texto, CTA) | Destino coerente para os links acima. |

Os demais elementos (textos, tokens de cor, tipografia Roboto Mono, raios, sombras, espaçamentos, ordem dos blocos
em cada breakpoint) seguem os frames — conferidos por regressão visual (`e2e/visual.spec.ts`). Material extraído do
Figma em [docs/figma/](docs/figma/).
