# Análise da auditoria Lighthouse

Resultados completos (medianas, medições individuais, ambiente e throttling): [RESULTADOS.md](RESULTADOS.md).
Relatórios HTML/JSON: `lighthouse/reports/`. Configuração versionada: [config.mjs](config.mjs). Execução: `npm run lighthouse`.
A auditoria usa o build de produção servido por `vite preview`, com **as imagens, a fonte, os mocks (MSW + banco
simulado + Socket.IO) e as funcionalidades reais** no cenário padrão — nenhuma otimização é exclusiva da auditoria.

## Resultado final (mediana de 3 medições, build final)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | **70** | 100 | 100 | 100 | 4,14 s | 0 | 673 ms |
| Início | desktop | 99 | 100 | 100 | 100 | 0,97 s | 0,003 | 56 ms |
| Detalhe | mobile | **68** | 100 | 100 | 100 | 4,16 s | 0 | 766 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 0,95 s | 0 | 0 ms |

Metas atingidas no desktop e, no mobile, em Accessibility, Best Practices e SEO. **Performance mobile (≥ 90) não é
atingida**; a justificativa está no fim deste documento.

## Antes × depois

Linha de base = código antes desta rodada de otimizações (mesma máquina, mesma configuração, mediana de 3).

| Página | Perfil | Performance | LCP | TBT |
| --- | --- | --- | --- | --- |
| Início | mobile | 59 → **70** | 5,79 s → **4,14 s** (−1,65 s) | 643 → 673 ms |
| Detalhe | mobile | 69 → 68 | 4,70 s → **4,16 s** (−0,54 s) | 547 → 766 ms |
| Início | desktop | 96 → 99 | 1,14 s → 0,97 s | 117 → 56 ms |
| Detalhe | desktop | 98 → 99 | 1,08 s → 0,95 s | 1 → 0 ms |

O LCP caiu nas quatro combinações. A nota do detalhe mobile ficou igual porque o TBT variou para cima; como o código
do detalhe não ganhou trabalho novo, a diferença é ruído da máquina (veja "Variação").

## Profiling (o que pesava)

Ferramentas: relatórios JSON do Lighthouse (`lcp-breakdown-insight`, `network-requests`, `bootup-time`,
`long-tasks`) e um perfil de CPU do Chrome (CDP, CPU 4× mais lenta) com as amostras mapeadas ao código-fonte pelos
sourcemaps do build.

- **LCP do início no mobile** = imagem do 1º card do catálogo (177 px); do detalhe = arte do NFT. Ambas dependem dos
  dados, que dependem do MSW (chunk dos mocks + service worker + banco simulado).
- **Rede:** o chunk dos mocks tinha **176 KB gzip** (480 KB minificado); ~60% era a lista de sufixos públicos
  (`tldts`) que o `tough-cookie` do MSW carrega. Além disso, as seções editoriais abaixo da dobra pediam **~263 KB de
  artes** (até 960 px) antes de a API responder, disputando a banda do 4G simulado.
- **CPU (perfil, CPU 4×):** **437 ms** em `useLayoutEffect` do `@radix-ui/react-use-size` — o slider de preço da barra
  lateral do desktop era montado (escondido) também no mobile e forçava *reflow* da página a cada medição; ~500 ms na
  avaliação do chunk dos mocks; ~300–480 ms no React (render da home ao chegarem os dados); ~160 ms no zod.

## Otimizações aplicadas (efeito medido)

| # | Mudança | Efeito |
| --- | --- | --- |
| 1 | **Senhas do seed com hash pré-calculado** (PBKDF2-SHA256, 20 000 iterações — o login continua verificando com PBKDF2) | Duas derivações a menos na criação do banco. O WebCrypto roda fora da *thread* principal, então o efeito no Lighthouse ficou dentro do ruído (1 medição: início 59 → 58, detalhe 69 → 68). |
| 2 | **`modulepreload` do chunk dos mocks** no `index.html` (plugin em `vite.config.ts`): baixa em paralelo com o bundle principal; a execução continua por `import()` dinâmico | Cascata de rede eliminada (o chunk passou a ser pedido junto com o bundle, não depois). Sozinho, efeito dentro do ruído: o gargalo era CPU. |
| 3 | **Barra lateral, ordenação e barra mobile montadas só no breakpoint em que aparecem** (antes: versões escondidas com CSS) | Remove os 437 ms de *reflow* forçado. Perfil: imagem do 1º card completa em 3,43 s → 2,87 s. Lighthouse (1 medição): início 58 → 64, LCP 5,90 → 5,56 s. |
| 4 | **Seções editoriais (Promos, Diário) montadas depois da 1ª resposta do catálogo**, numa tarefa própria (`requestIdleCallback`, máx. 1 s) | As artes de 960 px deixam de competir com os dados e o LCP; o render da home é dividido em duas tarefas. Mediana de 3: início LCP 5,56 → 4,86 s. O skeleton segura a altura (CLS 0). |
| 5 | **`tldts` substituído por uma função mínima** (`src/mocks/lib/tldts-lite.ts`, alias só para esse import) — usado apenas pelo pote de cookies do MSW, que os handlers não usam | Chunk dos mocks **176 → 63 KB gzip** (480 → 213 KB minificado). Lighthouse (1 medição): início LCP 4,86 → 4,34 s; detalhe 4,52 → 3,85 s. |

Já existiam da etapa 9 e continuam: inicialização progressiva (shell e skeletons renderizam antes do MSW; as
requisições aguardam `whenNetworkReady()`), hero só da variante do breakpoint, header desktop sob demanda, artes em WebP
320/640/960 com `srcset`/`sizes`, `fetchpriority="high"`/`loading="eager"` e dimensões explícitas na imagem do LCP,
rotas com *code splitting*, socket.io-client sob demanda, `min-h-dvh` no conteúdo (CLS 0).

### Avaliadas e não aplicadas

- **Preload da imagem do LCP no HTML:** o LCP é o 1º card do catálogo (início) ou a arte do NFT (detalhe), definidos
  pela resposta da API. Fixar a imagem no HTML seria apostar no resultado da API — otimização só para a auditoria.
- **Preload da fonte:** a fonte usa `font-display: swap` e `unicode-range` (só o subconjunto latino, 32 KB, é baixado);
  o texto aparece imediatamente com a fonte reserva e o LCP é uma imagem. O preload só competiria com o JS crítico.
- **Sonner (avisos) sob demanda:** o Sonner descarta avisos emitidos antes de o `<Toaster>` montar (problema já visto
  na sessão expirada); o ganho (~10 KB gzip) não compensa o risco funcional.
- **`zod/mini` ou validação só em desenvolvimento:** reduziria ~25 KB gzip e ~160 ms de CPU simulada, mas exige
  reescrever todos os contratos ou abrir mão da validação de contrato em produção.

## Por que a performance mobile continua abaixo de 90

O perfil mobile do Lighthouse simula **CPU 4× mais lenta** e **4G lento** (150 ms de RTT, ~1,6 Mbps). As métricas de
maior peso (TBT 30%, LCP 25%) ficam presas a custos estruturais da entrega exigida:

1. **O "servidor" roda na página.** Antes do primeiro dado, a mesma *thread* que renderiza precisa baixar e avaliar o
   MSW (63 KB gzip), registrar e ativar o *service worker* (1º acesso, sem cache — cada medição usa um Chrome novo),
   criar o banco simulado (239 NFTs, persistido em `localStorage`) e responder com a latência do cenário padrão
   (150 ms). Num app com API real esse trabalho estaria no servidor. Na simulação do Lighthouse isso soma ~1,5–2 s ao LCP.
2. **O LCP depende dos dados.** A imagem do LCP só é conhecida depois da resposta da API: HTML → JS → MSW → API → render
   → imagem é uma cadeia de dependências que não pode ser encurtada sem antecipar dados (SSR/SSG, fora do escopo de
   uma SPA estática com mocks) ou fixar a imagem no HTML (simplificação proibida).
3. **TBT = renders do React a 4× de CPU.** Cada consulta que chega (catálogo, destaques, carrinho, favoritos) re-renderiza
   a página; as maiores tarefas restantes (~200–300 ms simulados) são esses renders e a avaliação de React DOM,
   TanStack Router/Query, Axios e zod (~115 KB gzip no carregamento inicial), todos exigidos pelo desafio.

No **desktop** (sem multiplicador de CPU) o mesmo código fica em 99, com LCP < 1 s e TBT < 60 ms.

Caminhos para ≥ 90 no mobile, fora do escopo atual: servir a API simulada fora da *thread* principal (backend de
demonstração ou MSW com o banco dentro do próprio *service worker*); pré-renderizar a home com os dados (SSR/SSG);
trocar zod por `zod/mini` nos contratos.

## Variação entre medições

Cada medição usa um Chrome novo (sem cache, storage ou *service worker*), o pior caso de primeiro acesso. Nesta
máquina (Windows, processos de desenvolvimento abertos), medições isoladas do mesmo código variaram até ±6 pontos e
±400 ms de TBT (ex.: detalhe mobile 75 e 69 em execuções seguidas sem mudança de código). Por isso os números da
tabela final são medianas de 3, e as medições isoladas acima servem só como indicação do efeito de cada passo.
Medições finais: início mobile 70/63/70, detalhe mobile 68/70/66, desktop 97–99.
