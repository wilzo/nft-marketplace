# Tokens e assets do Figma (Kurio)

Fonte: estilos nomeados do arquivo Figma do desafio (extraídos pela API REST do Figma durante o desenvolvimento).
Implementação: `src/index.css` (`@theme`) e variáveis do shadcn/ui.

## Cores (estilos nomeados)

| Token Tailwind | Estilo Figma | Valor | Uso |
| --- | --- | --- | --- |
| `ink` / `background` | Color/Ink | `#140d0a` | Fundo de todas as telas; texto sobre botão primário |
| `surface-card` / `card` | Color/Surface Card | `#241612` | Cards, painel de filtros, rodapé |
| `surface-raised` / `secondary` | Color/Surface Raised | `#2f1d15` | Superfícies elevadas |
| `surface-dark` / `accent` | Color/Surface Dark | `#38220f` | Faixa do rodapé |
| `cream` / `foreground` | Color/Foreground | `#f5f1eb` | Texto principal |
| `brand` / `primary` | Color/Primary | `#d28a4c` | Botões, preço, item ativo |
| `brand-accent` / `ring` | Text/Accent | `#e89b55` | Destaques, foco |
| `sand` / `muted-foreground` | Text/Secondary | `#cfb28c` | Texto secundário |
| `khaki` | Color/Secondary | `#b39463` | Ícones e textos terciários |
| `coral` / `destructive` | Text/Coral | `#f0805f` | Preço riscado, texto de erro |
| `amber` | Color/Amber | `#e3a44e` | — |
| `success` | Color/Success | `#00a66c` | Pedido confirmado |
| `error` | Color/Error | `#ed1b2e` | Borda/ícone de erro (contraste 4,3:1, não usar em texto pequeno) |
| `line` / `border` | Color/Border | `#3f2319` | Bordas 1px |
| `line-soft` / `input` | Color/Border Soft | `#55321f` | Bordas de campos |

## Tipografia

Família única: **Roboto Mono** (variável, servida localmente via `@fontsource-variable/roboto-mono`).
Pesos 400, 500 e 700. Escala usada (px, tamanho/altura de linha):

- Display: 43/70 bold (hero desktop), 32/42 bold ls 3.2 (hero mobile)
- Heading: 28/37, 24/32 bold
- Title: 22, 20 (regular/medium/bold)
- Body Large: 16–18 (regular/medium/bold)
- Body: 14–15 (lh 16–40)
- Caption: 12–13
- Tiny: 9–10

## Raios, sombras e espaçamentos

- Raios mais usados: 3, 4, 6, 8, 16 px → `rounded-xs/sm/md/lg/xl`.
- Sombras: `shadow-card` (0 0 20 rgba(10,6,4,.45)), `shadow-raised` (0 6 20), `shadow-soft` (0 4 12 -2 rgba(20,13,10,.15)).
- Espaçamentos (gap/padding) dominantes: 4, 6, 8, 10, 12, 16, 24, 32, 40, 48, 96, 120.
- Conteúdo desktop: 1200 px centralizado em 1440 (`max-w-(--container-content)`). Mobile: frame de 414 px.

## Assets

| Asset | Origem | Arquivo no projeto |
| --- | --- | --- |
| 4 artes de NFT (1254² PNG) | image fills `8459…`, `2986…`, `9df2…`, `8758…` | originais em `docs/figma/source-images/`; WebP 320/640/960 em `public/images/nfts/` (`npm run assets:images`) |
| Ícones Iconly, header, rodapé, login social (31 SVG) | instâncias/vetores do Figma exportados em SVG | `src/assets/icons/*.svg` (monocromáticos → `currentColor` via `npm run assets:icons`) |
| Logo "KURIO" | texto do header exportado com contorno | `src/assets/icons/logo-kurio.svg` |
| Favicon | derivado da marca (não existe no Figma) | `public/favicon.svg` |

Mapeamento das artes: `emerald-ape` (óculos/jaqueta verde), `sage-nomad` (chapéu/moletom roxo),
`neon-vessel` (gorila preto/blazer), `golden-beat` (fones/jaqueta creme).
O catálogo do Figma reutiliza essas 4 artes em todos os NFTs; as fixtures farão o mesmo.
