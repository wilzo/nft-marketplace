import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { Highlights, NftImage as NftImageKey } from '@/api/contracts'
import ArrowRight from '@/assets/icons/curved-arrow-right.svg?react'
import { NftImage } from '@/components/nft-image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { notAvailable } from '@/lib/out-of-scope'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

/**
 * Slides do hero. A arte é estática (não espera a API) para não atrasar o LCP;
 * o link do slide aponta para o NFT em destaque quando os destaques chegam.
 */
const HERO_SLIDES: { image: NftImageKey; fallbackId: string }[] = [
  { image: 'emerald-ape', fallbackId: 'emerald-ape-042' },
  { image: 'sage-nomad', fallbackId: 'sage-nomad-009' },
  { image: 'golden-beat', fallbackId: 'golden-beat-207' },
]

export function Hero({ highlights }: { highlights: Highlights | undefined }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [slide, setSlide] = useState(0)
  const ids = highlights ? [highlights.hero.id, highlights.spotlight.id, highlights.related[0]?.id ?? HERO_SLIDES[2].fallbackId] : null
  const current = HERO_SLIDES[slide]
  const dots = (
    <div role="group" aria-label="Destaques" className="flex gap-4">
      {HERO_SLIDES.map((s, i) => (
        <button
          key={s.image}
          type="button"
          aria-label={`Destaque ${i + 1} de ${HERO_SLIDES.length}`}
          aria-pressed={i === slide}
          onClick={() => setSlide(i)}
          // Área de toque de 24px; o ponto visível mantém 8px (Figma)
          className="group/dot -m-2 grid size-6 place-items-center"
        >
          <span aria-hidden className={cn('size-2 rounded-full bg-brand transition-opacity', i === slide ? 'opacity-100' : 'opacity-50 group-hover/dot:opacity-80')} />
        </button>
      ))}
    </div>
  )

  return (
    <section aria-labelledby="hero-title">
      {/* Só a variante do breakpoint atual é renderizada (a imagem eager do outro layout não é baixada) */}
      {isDesktop ? (
      /* Desktop (Figma "Hero": texto 600px + arte 450×450 r24) */
      <div className="relative flex h-[450px] items-center gap-[110px] overflow-hidden pl-10">
        <div className="flex w-[600px] shrink-0 flex-col gap-11">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1">
              <p className="text-sm leading-4 font-medium tracking-[0.1em]">Bem-vindo à Kurio</p>
              <h1 id="hero-title" className="mt-2 text-[43px] leading-[70px] font-bold">
                SEJA DONO DO FUTURO
                <br />
                DA ARTE DIGITAL
              </h1>
              <p className="max-w-[557px] text-sm leading-6 text-sand">
                Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da
                cultura da internet.
              </p>
            </div>
            <Button asChild size="cta" className="w-[140px]">
              <Link to="/" hash="catalogo">
                EXPLORAR
              </Link>
            </Button>
          </div>
          <div className="self-end">{dots}</div>
        </div>
        <Link
          to="/nft/$nftId"
          params={{ nftId: ids?.[slide] ?? current.fallbackId }}
          className="size-[450px] shrink-0 overflow-hidden rounded-[24px]"
          aria-label="Ver NFT em destaque"
        >
          <NftImage image={current.image} alt="" sizes="450px" priority={slide === 0} className="size-full" />
        </Link>
      </div>

      ) : (
      /* Mobile (Figma "Hero Banner": 366×190 r12, texto + 2 artes) */
      <div className="relative flex h-[190px] overflow-hidden rounded-xl bg-linear-to-br from-surface-dark via-surface-raised to-surface-card p-4">
        <div aria-hidden className="absolute -top-8 -left-20 size-62 rounded-full bg-brand/10" />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <p className="text-xs font-medium tracking-[0.05em]">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="mt-2 text-lg leading-7 font-bold">
            SEJA DONO DA CULTURA DIGITAL
          </h1>
          <p className="mt-1 text-xs leading-5 text-sand">Descubra NFTs selecionados de criadores do mundo todo.</p>
          <Link to="/" hash="catalogo" className="-my-1 mt-auto flex min-h-6 items-center gap-2 self-start py-1 text-xs font-bold text-brand">
            EXPLORAR <ArrowRight aria-hidden className="size-4 text-brand" />
          </Link>
        </div>
        <div className="relative w-[138px] shrink-0">
          <NftImage image={current.image} alt="" sizes="138px" priority={slide === 0} className="size-[138px] rounded-2xl" />
          <NftImage
            image={HERO_SLIDES[(slide + 1) % 3].image}
            alt=""
            sizes="60px"
            className="absolute -bottom-2 -left-4 size-[60px] rounded-xl border-2 border-surface-card"
          />
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">{dots}</div>
      </div>
      )}
    </section>
  )
}

/** "NFT EM DESTAQUE / OFERTA LIMITADA" (Figma: 310×470, gradiente, arte 310×368 r22). */
export function FeaturedBanner({ highlights }: { highlights: Highlights | undefined }) {
  const nft = highlights?.spotlight
  return (
    <section
      aria-labelledby="featured-title"
      className="hidden flex-col gap-4 overflow-hidden bg-linear-to-b from-surface-dark to-ink pt-6 lg:flex"
    >
      <div className="flex flex-col gap-4 px-5">
        <h2 id="featured-title" className="text-xl leading-8 font-bold text-brand">
          NFT EM DESTAQUE
        </h2>
        <p className="pl-5 text-base leading-4 font-bold">OFERTA LIMITADA</p>
      </div>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} aria-label={`${nft.name} — oferta limitada`} className="block">
          <NftImage image={nft.image} alt="" sizes="310px" className="h-[368px] w-full rounded-[22px] object-cover" />
        </Link>
      ) : (
        <Skeleton className="h-[368px] w-full rounded-[22px]" />
      )}
    </section>
  )
}

const PROMOS = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: 'emerald-ape' as const,
    search: { tab: 'novos' as const },
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: 'neon-vessel' as const,
    search: { category: ['arte-digital' as const] },
  },
]

/** Dois cards promocionais (Figma "Promos": 586×250, arte à esquerda, texto à direita). */
export function Promos() {
  return (
    <section aria-label="Coleções em destaque" className="grid gap-7 lg:grid-cols-2">
      {PROMOS.map((p) => (
        <article key={p.title} className="flex h-[200px] overflow-hidden rounded-lg bg-surface-card sm:h-[250px]">
          <NftImage image={p.image} alt="" sizes="(min-width: 1024px) 292px, 45vw" className="h-full w-1/2 rounded-[18px] object-cover" />
          <div className="flex flex-1 flex-col items-end justify-center gap-3 p-4 text-right sm:p-8">
            <h2 className="text-base leading-6 font-bold sm:text-lg">{p.title}</h2>
            <p className="hidden text-sm leading-6 text-sand sm:block">{p.text}</p>
            <Button asChild size="cta" className="mt-2 w-[140px] gap-1 px-3 font-medium">
              <Link to="/" hash="catalogo" search={p.search}>
                Explorar <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: 'neon-vessel' as const },
  { date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: 'emerald-ape' as const },
  { date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: 'sage-nomad' as const },
  { date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: 'golden-beat' as const },
]

/** "Diário da Cunhagem": conteúdo editorial estático (páginas editoriais estão fora do escopo). */
export function Journal() {
  return (
    <section aria-labelledby="journal-title" className="flex flex-col gap-10">
      <header className="flex flex-col gap-3 text-center">
        <h2 id="journal-title" className="text-2xl font-bold lg:text-[28px] lg:leading-[37px]">
          Diário da Cunhagem
        </h2>
        <p className="text-sm leading-[18px] text-sand">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </header>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((p) => (
          <li key={p.title} className="flex flex-col overflow-hidden rounded-lg bg-surface-card">
            <NftImage image={p.image} alt="" sizes="(min-width: 1024px) 268px, 90vw" className="aspect-auto h-[195px] w-full object-cover" />
            <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
              <p className="text-xs leading-4 font-medium text-sand">
                {p.date} &nbsp;|&nbsp; Leitura de {p.read}
              </p>
              <h3 className="text-base leading-[21px] font-bold">{p.title}</h3>
              <p className="text-xs leading-4 font-medium text-sand">{p.text}</p>
              <button
                type="button"
                onClick={() => notAvailable('O Diário da Cunhagem')}
                className="mt-auto self-start text-xs font-bold text-brand-accent hover:underline"
                aria-label={`Ler mais: ${p.title}`}
              >
                Ler mais →
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
