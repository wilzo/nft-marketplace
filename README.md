# Kurio — Marketplace de NFTs

SPA em React + TypeScript que implementa o desafio [docs/DESAFIO.md](docs/DESAFIO.md) a partir dos frames do Figma:
catálogo com filtros na URL, detalhe com edições, autenticação, favoritos, carrinho com cotação da API, pagamento com
pedidos idempotentes, confirmação em tempo real (Socket.IO), perfil e carteiras.

Não existe backend: **toda a API (REST e Socket.IO) é simulada na camada de rede pelo MSW**, com banco persistido no
navegador e cenários de falha controláveis. O código da aplicação não contém respostas fictícias — ele faz requisições
reais via Axios e `socket.io-client`, que o MSW intercepta.

- **Demonstração:** https://nft-marketplace-xi-self.vercel.app
- **Repositório:** https://github.com/wilzo/nft-marketplace
- **Arquitetura e decisões:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Matriz de testes:** [docs/TESTES.md](docs/TESTES.md) · **Lighthouse:** [lighthouse/ANALISE.md](lighthouse/ANALISE.md)

## Autor

**Wilson Hernandes** — GitHub: [github.com/wilzo](https://github.com/wilzo)

## Stack

Versões instaladas (`package-lock.json`):

| Área | Tecnologia |
| --- | --- |
| UI | React 19.3.1, TypeScript 7.0.2, Tailwind CSS 4.3.5, shadcn/ui (Radix UI 1.8.1) |
| Roteamento | TanStack Router 1.170.46 (rotas por arquivo, *code splitting*, busca validada com zod) |
| Dados | TanStack Query 5.107.1, Axios 1.21.0 (REST), socket.io-client 4.8.4 |
| Contratos | zod 4.6.7 (compartilhados entre cliente e mocks) |
| Formulários | react-hook-form 7.91.0 + zod |
| Mocks | MSW 2.15.0 + `@mswjs/socket.io-binding` 0.2.0 |
| Testes | Playwright 1.65.0 (desktop 1440×900, mobile 390×844, tablet 768 por teste de layout, regressão visual) |
| Auditoria | Lighthouse 13.6.0 (script versionado) |
| Build | Vite 8.3.7, oxlint 1.92.0 |

## Requisitos

- **Node.js 24** e **npm** (o projeto usa `package-lock.json`).
- Testado em Windows 11; os scripts não dependem de shell específico.

## Instalação (checkout limpo)

```bash
git clone https://github.com/wilzo/nft-marketplace.git
cd nft-marketplace
npm ci
npx playwright install chromium   # necessário para os testes E2E e para o Lighthouse
npm run dev                        # http://localhost:5173
```

Nenhum arquivo `.env` é obrigatório: os valores padrão já ativam os mocks.

O npm 11 pode avisar que o `postinstall` do `msw` não foi aprovado (`allow-scripts`). Não é preciso aprová-lo: o
script só copia o `mockServiceWorker.js`, que já está versionado em `public/`.

## Variáveis de ambiente

Copie [.env.example](.env.example) para `.env.local` se quiser alterar algo.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga a camada MSW (REST + Socket.IO). Fica ativa também no build de demonstração. |
| `VITE_API_BASE_URL` | `/api` | Prefixo das rotas REST (interceptado pelo MSW). |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.test` | Endereço do Socket.IO (interceptado pelo binding do MSW). |

`npm run dev:no-mocks` usa [.env.no-mocks](.env.no-mocks) (`VITE_ENABLE_MOCKS=false`): a aplicação passa a chamar
`VITE_API_BASE_URL`/`VITE_SOCKET_URL` de verdade. Útil para conferir que nada depende dos mocks além da rede.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks (Vite, HMR). |
| `npm run dev:no-mocks` | Desenvolvimento sem MSW (requer uma API real). |
| `npm run build` | `tsc -b` + `vite build` → `dist/`. |
| `npm run preview` | Serve o build (`dist/`) em http://localhost:4173. |
| `npm run typecheck` | Checagem de tipos (`tsc -b`, inclui os testes E2E). |
| `npm run lint` | oxlint. |
| `npm run test:e2e` | Playwright: gera o build, sobe o preview e roda todas as specs nos projetos desktop e mobile. |
| `npm run test:e2e:visual` | Só a regressão visual. |
| `npm run test:e2e:update` | Regera as baselines de screenshot. |
| `npm run test:e2e:report` | Abre o relatório HTML da última execução. |
| `npm run lighthouse` | Build + 3 medições por página/perfil (mobile e desktop) e medianas em `lighthouse/RESULTADOS.md`. `LH_RUNS=1` para uma medição rápida. |
| `npm run assets:images` / `assets:icons` | Regeram as artes WebP responsivas e os ícones SVG a partir dos originais do Figma. |

Para rodar um teste específico: `npx playwright test e2e/checkout.spec.ts --project=desktop-chromium`.

### Larguras avaliadas

- **390 px** e **1440 px**: projetos `mobile-chromium` (390×844) e `desktop-chromium` (1440×900) — toda a suíte roda nos dois.
- **768 px** (tablet): usa o layout mobile do Figma (o desktop começa em 1024 px). `e2e/responsive.spec.ts` abre todas as
  telas (públicas e privadas) em 768, 390 e 1440 px e falha se houver rolagem horizontal.

### Relatório e traces do Playwright

`playwright.config.ts` usa `reporter: html` + `list` e `trace: 'retain-on-failure'` (mais screenshot da falha):

- relatório HTML: `playwright-report/` → `npm run test:e2e:report`;
- trace de cada teste que falhou: `test-results/<teste>/trace.zip` → `npx playwright show-trace test-results/<teste>/trace.zip`
  (também abre clicando no teste dentro do relatório HTML). Ambos os diretórios ficam fora do Git.

## Credenciais fictícias

| Usuário | E-mail | Senha | Estado inicial |
| --- | --- | --- | --- |
| Ana Colecionadora | `ana@kurio.dev` | `Kurio2026!` | Carrinho do Figma (Emerald ×2, Violet ×6, Ivory ×9), carteiras principal e secundária |
| Bruno Mendes | `bruno@kurio.dev` | `Kurio2026!` | Carrinho vazio, sem carteiras (estados vazios) |

Também é possível criar conta em **/cadastro**. Cupons: `KURIO10` (10%), `LANCAMENTO` (15%), `EXPIRADO` (expirado).

### Login social (simulado)

**Continuar com Google** e **Continuar com Facebook** funcionam, mas **não acessam o Google nem o Facebook**: o provedor
é simulado pela API de demonstração (MSW). Ao clicar, a API devolve um pedido de consentimento com contas fictícias,
exibido num diálogo (escolha da conta, dados compartilhados, **Cancelar**/**Continuar**):

| Provedor | Conta fictícia | Resultado |
| --- | --- | --- |
| Google | Carla Nunes — `carla.nunes@gmail.example` | 1º acesso cria a conta; depois entra na mesma conta (vinculada). |
| Google | Ana Colecionadora — `ana@kurio.dev` | Conflito: o e-mail já tem conta com senha → mensagem e botão **Entrar com senha**. |
| Facebook | Diego Rocha — `diego.rocha@facebook.example` | Igual à Carla. |
| Facebook | Bruno Mendes — `bruno@kurio.dev` | Conflito, como a Ana. |

Contas criadas pelo provedor não têm senha (só entram pelo login social).

## Cenários da simulação e reset

O estado do mock (catálogo, usuários, sessões, carrinhos, pedidos) fica em `localStorage` (`kurio:mock-db`) e sobrevive
a refresh. O cenário ativo também (`kurio:mock-scenario`).

**Escolher cenário pela URL** — em qualquer página:

```
http://localhost:5173/?cenario=preco-alterado
https://nft-marketplace-xi-self.vercel.app/carrinho?cenario=lento
```

O parâmetro é aplicado quando o MSW sobe e removido da URL. O cenário permanece até ser trocado.

**Painel de cenários** — oculto por padrão (não faz parte do Figma). Abra qualquer URL com `?painel=1` para exibi-lo
(botão **Cenários** no canto superior esquerdo no mobile e inferior esquerdo no desktop) e `?painel=0` para escondê-lo. Nele: escolher o cenário → **Aplicar**, ou **Restaurar tudo**
(seed + cenário padrão + desconexão do Socket.IO).

**Reset completo** — painel → *Restaurar tudo*, ou `POST /api/__mock/reset` (corpo opcional `{ "scenario": "<nome>" }`),
ou apagar o *site data* do navegador.

| Cenário | Efeito |
| --- | --- |
| `padrao` | Sucesso; 150 ms por requisição; pagamento confirma em 3 s. |
| `sem-latencia` | Igual ao padrão, sem latência. |
| `vazio` | Catálogo sem resultados. |
| `lento` | 2,5 s por requisição (skeletons visíveis). |
| `latencia-variavel` | 100–1800 ms determinísticos por URL: respostas chegam fora de ordem. |
| `offline` | Toda requisição REST falha em nível de rede. |
| `erro-servidor` | HTTP 500 na listagem e no detalhe. |
| `falha-transitoria` | HTTP 503 nas 2 primeiras chamadas da listagem; depois recupera (retry automático). |
| `favoritos-falha` | Favoritar/desfavoritar falha com 503 (rollback otimista). |
| `sessao-curta` | Sessões expiram 30 s após o login. |
| `preco-alterado` | O preço do 1º item muda durante a confirmação do pedido. |
| `esgotado` | A edição do 1º item esgota durante a confirmação do pedido. |
| `timeout-pedido` | O pedido é criado, mas a 1ª resposta demora 15 s (timeout do cliente em 10 s). |
| `pagamento-recusado` | O pagamento simulado é recusado. |
| `carteira-recusada` | O usuário recusa a conexão da carteira. |
| `oauth-falha` | O provedor do login social (Google/Facebook simulados) não responde. |
| `tempo-real-fora` | O servidor Socket.IO recusa conexões. |

### API de controle (testes e demonstração)

Rotas sem latência nem falhas, chamáveis pelo DevTools (`fetch`) ou pelos testes:

| Rota | Uso |
| --- | --- |
| `GET /api/__mock/scenario` · `PUT /api/__mock/scenario` `{ name, overrides? }` | Consulta/troca o cenário. |
| `POST /api/__mock/reset` `{ scenario? }` | Restaura o seed. |
| `PATCH /api/__mock/nfts/:id` `{ editionId?, price?, available? }` | Muda preço/estoque e publica `nft.updated`. |
| `POST /api/__mock/realtime/replay` `{ mode: 'duplicate' \| 'stale', resourceId? }` | Reenvia evento duplicado ou antigo. |
| `POST /api/__mock/realtime/disconnect` · `GET /api/__mock/realtime` | Derruba as conexões Socket.IO / estatísticas. |
| `POST /api/__mock/sessions/expire` `{ userId? }` | Expira sessões agora. |
| `POST /api/__mock/orders/:id/settle` | Liquida um pedido pendente sem esperar. |

Exemplo no console da página:

```js
await fetch('/api/__mock/nfts/emerald-ape-042', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ price: '2.5' }),
})
```

## Como reproduzir os fluxos de falha

Sempre partindo de `?cenario=<nome>` (ou do painel). Faça login como `ana@kurio.dev` quando o fluxo envolver carrinho.

| Fluxo | Passos | Resultado esperado |
| --- | --- | --- |
| Carregamento lento | `/?cenario=lento` | Skeletons no catálogo, destaques e detalhe; layout sem saltos. |
| Respostas fora de ordem | `/?cenario=latencia-variavel`, troque filtros rapidamente | A lista final corresponde aos filtros atuais (requisições antigas são canceladas). |
| Filtros do catálogo | Na home (ou **Mercado**), marque coleções, redes, faixa de preço (**Aplicar**), aba e ordenação; troque de página e filtre de novo | Filtros combinam; cada mudança volta à página 1 e grava na URL; voltar/avançar e refresh restauram o estado; total anunciado = total da API. |
| Filtros pela URL | Abra `/?category=arte-digital`, `/?category=arte-digital&category=fotografia`, `/?network=polygon` ou `/?minPrice=5&maxPrice=1` | Filtros aplicados e marcados no painel (faixa invertida é corrigida). Valores inválidos (`/?category=xx&page=abc&sort=zzz`) caem no padrão, sem erro. |
| Catálogo vazio | `/?cenario=vazio` | Estado vazio com ação de limpar filtros/busca. |
| Erro de servidor | `/?cenario=erro-servidor` | Mensagem de erro com **Tentar novamente**. |
| Falha transitória | `/?cenario=falha-transitoria` | O catálogo aparece após retentativas automáticas. |
| Sem conexão | `/?cenario=offline` | Erro de rede com nova tentativa; nada quebra. |
| Rollback otimista | `/?cenario=favoritos-falha`, favorite um NFT | O coração volta ao estado anterior e um aviso é exibido. |
| Sessão expirada | `/?cenario=sessao-curta`, entre e aguarde 30 s (ou `POST /api/__mock/sessions/expire`) | Ida ao login com aviso "sessão expirou" e retorno à mesma URL após entrar; o rascunho do pagamento é preservado. |
| Rota privada sem sessão | Abra `/perfil` deslogado | Redireciona a `/entrar?redirect=/perfil`. |
| Conflito de cadastro | `/cadastro` com o e-mail `ana@kurio.dev` | "Este e-mail já está cadastrado" no campo E-mail (409 da API), com foco nele. |
| Cupom inválido × expirado | Carrinho → código `NAOEXISTE`, depois `EXPIRADO` | Mensagens distintas ("Código promocional inválido" / "Este código promocional expirou") no campo; o resumo não muda. |
| Acesso a pedido de outro usuário (403) | Como Ana, confirme um pedido e anote `/pedidos/<id>`; saia, entre como `bruno@kurio.dev` e abra a mesma URL | "Acesso negado" sem nenhum dado do pedido; a API responde 403 `FORBIDDEN`. |
| Carrinho do visitante ao entrar | Deslogado, adicione um NFT ao carrinho; entre como `bruno@kurio.dev` | O item continua no carrinho (merge do carrinho do visitante). |
| Logout / troca de usuário | Entre como Ana, saia e entre como Bruno (sem recarregar) | Favoritos, carrinho e pedidos são os do Bruno; o Socket.IO reconecta com o token do Bruno. |
| Preço alterado | `/?cenario=preco-alterado`, carrinho → pagamento → revisar → confirmar | 409 com nova cotação; o usuário aceita os novos preços e confirma de novo. |
| Item esgotado | `/?cenario=esgotado`, mesmo caminho | Conflito de disponibilidade; a revisão oferece **Revisar carrinho**, onde o item aparece como esgotado e a finalização fica bloqueada até removê-lo. |
| Timeout com idempotência | `/?cenario=timeout-pedido`, confirme o pedido | Após 10 s o botão vira **Tentar novamente**; o reenvio usa a mesma `Idempotency-Key` e abre **o mesmo pedido** (sem duplicar). |
| Pagamento recusado | `/?cenario=pagamento-recusado`, confirme | O pedido passa de pendente a recusado em tempo real, com o motivo. |
| Carteira não conectada (409) | Pagamento sem escolher a carteira → **Confirmar compra** (a UI bloqueia); ou, pelo console, `POST /api/orders` sem `POST /api/wallet-connections` antes | A API recusa com 409 `WALLET_NOT_CONNECTED` ("Conecte a carteira na rede escolhida…"); se a conexão some durante a revisão, a tela volta a pedir a conexão. |
| Desconexão da carteira | Pagamento → escolha **MetaMask** → **Desconectar** | A conexão é removida na API (`DELETE /wallet-connections/:id`); confirmar exige reconectar e um pedido sem conexão é recusado (409 `WALLET_NOT_CONNECTED`). |
| Carteira recusada | `/?cenario=carteira-recusada`, escolha um provedor no pagamento | A recusa aparece abaixo das opções de carteira e a confirmação fica bloqueada; é possível tentar de novo. |
| Login social — sucesso | `/cadastro` → **Continuar com Google** → Carla Nunes → **Continuar** | Conta criada e sessão aberta; repetir em `/entrar` entra na mesma conta. |
| Login social — cancelamento | **Continuar com Facebook** → **Cancelar** (ou Esc) | "Você cancelou o acesso pelo Facebook"; nenhuma conta ou sessão criada; foco volta ao botão. |
| Login social — conflito | **Continuar com Google** → Ana Colecionadora → **Continuar** | Mensagem de conta existente com **Entrar com senha** (e-mail preenchido, foco na senha). |
| Login social — provedor fora | `/entrar?cenario=oauth-falha` → **Continuar com Google** | "O provedor de login não respondeu…"; nenhum diálogo nem sessão. |
| Tempo real fora | `/?cenario=tempo-real-fora`, faça um pedido | Sem Socket.IO, o pedido é acompanhado por *polling* (5 s) até confirmar. |
| Preço em tempo real | Abra `/nft/emerald-ape-042` e rode o `PATCH` do exemplo acima | Preço atualizado na tela com aviso; carrinho e cotação revalidados. |
| Queda do Socket.IO com pedido pendente | Com um pedido pendente: `PUT /api/__mock/scenario` `{ "name": "tempo-real-fora" }`, `POST /api/__mock/realtime/disconnect`, `POST /api/__mock/orders/<id>/settle`; depois volte ao cenário `padrao` | O evento de confirmação se perde, mas a tela confirma ao reconectar (dados invalidados e relidos via REST) ou pelo *polling* — sem criar outra compra. |
| Chave de idempotência com outro conteúdo | No console: `POST /api/orders` duas vezes com o mesmo header `Idempotency-Key` e corpos diferentes (ver `e2e/mock-layer.spec.ts`) | A 2ª resposta é 409 `IDEMPOTENCY_CONFLICT`; a mesma chave com o mesmo corpo devolve o mesmo pedido. |
| Evento duplicado/antigo | `POST /api/__mock/realtime/replay` com `duplicate` ou `stale` | Ignorado (dedupe por `eventId` e por versão). |
| Refresh durante pedido | Confirme um pedido e recarregue `/pedidos/<id>` | O pedido continua pendente e confirma sozinho (liquidação retomada). |
| Newsletter | Rodapé → **Antecipe-se ao próximo lançamento**: envie um e-mail inválido, depois um válido e depois o mesmo de novo | "Informe um e-mail válido" no campo; "Inscrição confirmada: …" (registrada na API simulada, nenhum e-mail é enviado); "Este e-mail já está inscrito na newsletter." (409). |
| Seções fora do escopo | Clique em **Criadores** ou **Aprenda** (header), **Central de ajuda** (rodapé), **Suporte** (menu da conta), **Esqueceu a senha?** ou **Ler mais** (Diário) | Página "<Seção> não faz parte desta versão" com **Voltar ao catálogo** — sem 404, sem página em branco e sem simular a seção. |
| Várias abas abertas | Abra o site em duas abas, entre numa delas e use a outra | A sessão continua válida nas duas (o banco simulado é sincronizado entre abas). |

Todos esses fluxos têm teste automatizado — ver [docs/TESTES.md](docs/TESTES.md).

## Lighthouse

Mediana de 3 medições por página e perfil (`npm run lighthouse`), build de produção com o cenário padrão dos mocks.
Análise completa em [lighthouse/ANALISE.md](lighthouse/ANALISE.md); medições individuais em [lighthouse/RESULTADOS.md](lighthouse/RESULTADOS.md).

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | 70 | 100 | 100 | 100 | 4,14 s | 0 | 673 ms |
| Início | desktop | 99 | 100 | 100 | 100 | 0,97 s | 0,003 | 56 ms |
| Detalhe | mobile | 68 | 100 | 100 | 100 | 4,16 s | 0 | 766 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 0,95 s | 0 | 0 ms |

Medido no build final desta versão. Antes das otimizações desta rodada: início mobile 59 (LCP 5,79 s), detalhe mobile 69
(LCP 4,70 s). A meta de Performance mobile (≥ 90) não é atingida: o MSW e o banco simulado rodam na *thread* principal
da página sob CPU 4× mais lenta e o LCP depende da resposta da API. Profiling, antes/depois de cada otimização e
justificativa em [lighthouse/ANALISE.md](lighthouse/ANALISE.md).

## Deploy

Hospedado na Vercel como SPA estática (`dist/`), com os mocks ativos. [vercel.json](vercel.json) reescreve qualquer
rota sem extensão para `/index.html` (acesso direto e refresh em `/nft/...`, `/carrinho` etc.) e serve
`mockServiceWorker.js` sem cache.

```bash
npm run build
vercel deploy --prod
```

## Estrutura

```
src/
  api/          contratos zod (contracts/), cliente REST tipado (endpoints.ts), API de controle dos mocks
  components/   layout (header, footer, tab bar), formulários, ui/ (shadcn)
  features/     domínio por funcionalidade: catalog, nft-detail, session, auth, favorites, cart, checkout, orders, account, wallets, realtime
  lib/          http (Axios), realtime (Socket.IO), erros, ETH em BigInt, query client, boot
  mocks/        MSW: handlers REST, Socket.IO, banco simulado, fixtures, cenários
  routes/       rotas do TanStack Router (uma por tela)
e2e/            specs Playwright + helpers e baselines visuais
lighthouse/     configuração, resultados, relatórios e análise
docs/           enunciado, progresso, matriz de testes, material extraído do Figma
```

Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md).
