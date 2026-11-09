import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { OUT_OF_SCOPE_SECTIONS, type OutOfScopeSection } from '@/lib/out-of-scope'

const sections = Object.keys(OUT_OF_SCOPE_SECTIONS) as [OutOfScopeSection, ...OutOfScopeSection[]]

/**
 * Página única para as seções do Figma que não fazem parte desta entrega (Criadores, Aprenda, Suporte...).
 * Não é uma 404 nem simula a seção: informa e oferece a volta ao catálogo.
 */
export const Route = createFileRoute('/secao-indisponivel')({
  validateSearch: z.object({ secao: z.enum(sections).optional().catch(undefined) }),
  component: function UnavailableSection() {
    const { secao } = Route.useSearch()
    const name = secao ? OUT_OF_SCOPE_SECTIONS[secao] : 'Esta seção'
    return (
      <main id="conteudo" className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-24 text-center">
        <p className="text-sm font-medium tracking-[0.1em] text-brand-accent">FORA DESTA VERSÃO</p>
        <h1 className="text-2xl font-bold lg:text-3xl">{secao ? `${name} não faz parte desta versão` : 'Seção não disponível nesta versão'}</h1>
        <p className="leading-6 text-sand">
          {name} aparece no layout do Kurio, mas a página não foi incluída nesta demonstração, que cobre o catálogo, a compra,
          o perfil e as carteiras. Nenhuma ação foi realizada.
        </p>
        <Button asChild size="cta" className="mt-2 px-6">
          <Link to="/" hash="catalogo">
            Voltar ao catálogo
          </Link>
        </Button>
      </main>
    )
  },
})
