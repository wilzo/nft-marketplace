# Análise da auditoria Lighthouse

Resultados completos (medianas, medições individuais, ambiente e throttling): [RESULTADOS.md](RESULTADOS.md).
Relatórios HTML/JSON: `lighthouse/reports/`. Configuração versionada: [config.mjs](config.mjs). Execução: `npm run lighthouse`.

## Resumo (mediana de 3 medições)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | **55** | 100 | 100 | 100 | 6,00 s | 0 | 987 ms |
| Início | desktop | 98 | 100 | 100 | 100 | 1,10 s | 0,003 | 75 ms |
| Detalhe | mobile | **65** | 100 | 100 | 100 | 4,72 s | 0 | 747 ms |
| Detalhe | desktop | 98 | 100 | 100 | 100 | 1,05 s | 0 | 0 ms |

Todas as metas foram atingidas no **desktop** e, no **mobile**, em Accessibility, Best Practices e SEO.
A única meta não atingida é **Performance no perfil mobile** (55 e 65, meta ≥ 90).

## Por que a performance mobile fica abaixo da meta

O perfil mobile do Lighthouse simula CPU **4× mais lenta** e rede **4G lenta** (150 ms de RTT, ~1,6 Mbps).
Nesse perfil, as duas métricas que mais pesam (TBT 30% e LCP 25%) são dominadas por custos **estruturais da entrega exigida**:

1. **A API é um servidor simulado rodando no navegador (MSW).** O desafio exige que a auditoria use o build com o
   cenário padrão dos mocks. Isso coloca no caminho crítico, na *thread* principal da página:
   - o chunk do MSW (~170 KB gzip: `msw`, `@mswjs/interceptors`, `tough-cookie` + `tldts` usados pelo MSW para cookies,
     handlers e fixtures) — ~630 ms de CPU simulada;
   - o registro/ativação do *service worker* e a criação do banco simulado (239 NFTs, hash PBKDF2 das senhas do seed);
   - a latência artificial do cenário padrão (150 ms por requisição REST).
   Em produção real esse trabalho estaria num servidor; aqui ele compete com a renderização.
2. **O LCP do início no mobile é a imagem do primeiro card do catálogo** (o card de 177 px é maior que a arte do hero
   mobile, de 138 px, no layout do Figma). Ele depende dos dados → espera o MSW subir e responder.
   No detalhe, o LCP é a arte do NFT, que também depende da resposta da API.
3. **Custo de JavaScript do framework**: React DOM, TanStack Router/Query, Axios, zod (contratos validados em tempo de
   execução) — ~115 KB gzip no chunk principal, ~1 s de CPU simulada. As *long tasks* restantes são renderizações do
   React ao chegarem os dados (catálogo, destaques, carrinho) e o carregamento do socket.io-client.

No **desktop** (CPU sem multiplicador), os mesmos custos somam LCP ≈ 1,1 s, TBT < 80 ms e nota 97–99.

## O que foi otimizado (sem simplificações para a auditoria)

| Mudança | Efeito |
| --- | --- |
| **Inicialização progressiva**: a interface renderiza imediatamente; Axios e Socket.IO aguardam o MSW (`src/lib/boot.ts`) | FCP ~0,9 s no mobile; nenhuma requisição escapa do MSW |
| Área de conteúdo com altura mínima de uma tela | CLS do detalhe desktop de **0,288 → 0** (o rodapé era empurrado ao carregar) |
| Hero renderiza só a variante do breakpoint | O mobile deixou de baixar a arte de 960 px do hero desktop (imagem *eager* oculta) |
| Header desktop carregado sob demanda | Menu, diálogo de busca e Floating UI fora do bundle do mobile |
| Artes em WebP responsivo (320/640/960, `srcset`/`sizes`, `fetchpriority` no LCP) | Imagens de ~2 MB → 8–64 KB |
| socket.io-client sob demanda; rotas com *code splitting*; fonte local com `font-display: swap` | Menos JS no carregamento inicial |
| Alvos de toque ≥ 24 px (pontos dos carrosséis, ícones de compartilhar, link do hero), `role="img"` nas estrelas, ordem de títulos | Accessibility **94–96 → 100** |
| `robots.txt` real | SEO 100 (o *rewrite* de SPA devolvia HTML em `/robots.txt`) |

## Caminhos para atingir ≥ 90 no mobile (não aplicados por mudarem o escopo)

- Servir a API simulada fora da *thread* principal (ex.: backend de demonstração ou MSW apenas no service worker
  com o banco no próprio worker) — removeria ~170 KB e ~0,6 s de CPU do caminho crítico.
- Trocar `zod` por `zod/mini` ou validar só em desenvolvimento (perde a validação de contrato em produção).
- Pré-renderização (SSR/SSG) da home com os dados do catálogo — exigiria um servidor, fora do escopo de SPA estática com mocks.

## Variação entre medições

As três medições de cada página/perfil variaram pouco (mobile: 53–59 no início, 63–66 no detalhe; desktop: 97–99).
Cada medição usa um Chrome novo (sem cache, storage ou *service worker* anteriores), o que corresponde ao **primeiro acesso**
— o pior caso, pois inclui o registro do *service worker* do MSW e a criação do banco simulado.
