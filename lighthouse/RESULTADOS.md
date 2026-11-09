# Resultados Lighthouse

Gerado por `npm run lighthouse` em 2026-11-09T21:01:11.353Z.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio (`/`) | mobile | **70** ⚠️ | 100 | 100 | 100 | 4.14 s | 0 | 673 ms |
| inicio (`/`) | desktop | 99 | 100 | 100 | 100 | 0.97 s | 0.003 | 56 ms |
| detalhe (`/nft/emerald-ape-042`) | mobile | **68** ⚠️ | 100 | 100 | 100 | 4.16 s | 0 | 766 ms |
| detalhe (`/nft/emerald-ape-042`) | desktop | 99 | 100 | 100 | 100 | 0.95 s | 0 | 0 ms |

Valores = **mediana de 3 medições**. Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.

## Medições individuais

| Execução | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio-mobile-1 | 70 | 100 | 100 | 100 | 4138 ms | 0 | 667 ms |
| inicio-mobile-2 | 63 | 100 | 100 | 100 | 4342 ms | 0 | 1019 ms |
| inicio-mobile-3 | 70 | 100 | 100 | 100 | 4078 ms | 0 | 673 ms |
| inicio-desktop-1 | 99 | 100 | 100 | 100 | 953 ms | 0.003 | 17 ms |
| inicio-desktop-2 | 99 | 100 | 100 | 100 | 975 ms | 0.003 | 56 ms |
| inicio-desktop-3 | 97 | 100 | 100 | 100 | 1054 ms | 0.003 | 112 ms |
| detalhe-mobile-1 | 68 | 100 | 100 | 100 | 4184 ms | 0 | 766 ms |
| detalhe-mobile-2 | 70 | 100 | 100 | 100 | 3966 ms | 0 | 696 ms |
| detalhe-mobile-3 | 66 | 100 | 100 | 100 | 4160 ms | 0 | 871 ms |
| detalhe-desktop-1 | 99 | 100 | 100 | 100 | 954 ms | 0 | 0 ms |
| detalhe-desktop-2 | 99 | 100 | 100 | 100 | 908 ms | 0 | 54 ms |
| detalhe-desktop-3 | 99 | 100 | 100 | 100 | 958 ms | 0 | 0 ms |

## Ambiente e condições

- Lighthouse 13.6.0; navegador: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.0.0 Safari/537.36
- Node v24.18.0; Windows_NT 10.0.26200 (x64); CPU Intel(R) Processor U300 × 6; 8 GB RAM
- Servidor: vite preview (build de produção) em http://localhost:4175
- Mocks: MSW ativo, cenário padrão ("padrao": latência fixa de 150 ms por requisição REST)
- Throttling mobile: `{"rttMs":150,"throughputKbps":1638.4,"requestLatencyMs":562.5,"downloadThroughputKbps":1474.5600000000002,"uploadThroughputKbps":675,"cpuSlowdownMultiplier":4}`
- Throttling desktop: `{"rttMs":40,"throughputKbps":10240,"requestLatencyMs":0,"downloadThroughputKbps":0,"uploadThroughputKbps":0,"cpuSlowdownMultiplier":1}`
- Cada medição usa um Chrome novo (sem cache, storage ou service worker de execuções anteriores).
- Relatórios completos: `lighthouse/reports/*.report.html` e `*.report.json`.
