import { Link } from '@tanstack/react-router'
import { CATEGORY_LABELS, type Category } from '@/api/contracts'
import FacebookIcon from '@/assets/icons/footer-facebook.svg?react'
import InstagramIcon from '@/assets/icons/footer-instagram.svg?react'
import LinkedinIcon from '@/assets/icons/footer-linkedin.svg?react'
import TwitterIcon from '@/assets/icons/footer-twitter.svg?react'
import YoutubeIcon from '@/assets/icons/footer-youtube.svg?react'
import LogoKurio from '@/assets/icons/logo-kurio.svg?react'
import { OutOfScopeLink } from '@/components/out-of-scope-link'
import { type OutOfScopeSection } from '@/lib/out-of-scope'
import { NewsletterForm } from './newsletter-form'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const FOOTER_CATEGORIES: Category[] = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'utilidade']

const SOCIALS = [
  { label: 'Facebook', href: 'https://www.facebook.com/', Icon: FacebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com/', Icon: InstagramIcon },
  { label: 'Twitter', href: 'https://twitter.com/', Icon: TwitterIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', Icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://www.youtube.com/', Icon: YoutubeIcon },
]

const linkClass = 'text-sm leading-[30px] text-cream hover:text-brand-accent'

function Unavailable({ section, label }: { section: OutOfScopeSection; label: string }) {
  return (
    <OutOfScopeLink section={section} className={linkClass}>
      {label}
    </OutOfScopeLink>
  )
}

/** Rodapé (componente "Footer" do Figma). */
export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-(--container-content) pb-28 lg:mt-24 lg:pb-6">
      {/* Recursos + newsletter */}
      <div className="flex flex-col gap-8 bg-surface-card p-6 lg:flex-row lg:gap-7 lg:p-8">
        {FEATURES.map((f) => (
          <div key={f.letter} className="flex flex-1 flex-col gap-2.5 lg:border-r lg:border-brand lg:px-4">
            <span aria-hidden className="grid size-[74px] place-items-center rounded-full bg-brand text-2xl font-bold text-ink">
              {f.letter}
            </span>
            <h2 className="mt-2 text-lg font-bold">{f.title}</h2>
            <p className="text-sm leading-[22px] text-sand">{f.text}</p>
          </div>
        ))}
        <NewsletterForm />
      </div>

      {/* Faixa da marca */}
      <div className="grid grid-cols-1 gap-4 bg-surface-dark px-8 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
        <LogoKurio role="img" aria-label="Kurio" className="h-[18px] w-auto justify-self-start text-cream" />
        <p className="leading-[22px]">Feito para colecionadores, criadores e cultura</p>
        <a href="mailto:contato@email.com" className="hover:text-brand-accent">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:text-brand-accent">
          +55 11 4002 8922
        </a>
      </div>

      {/* Colunas de links */}
      <div className="grid grid-cols-1 gap-8 bg-surface-card px-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <nav aria-labelledby="footer-perfil">
          <h2 id="footer-perfil" className="mb-2 text-lg font-bold">
            Meu perfil
          </h2>
          <ul className="flex flex-col items-start">
            <li>
              <Link to="/perfil" className={linkClass}>
                Meu perfil
              </Link>
            </li>
            <li><Unavailable section="minha-colecao" label="Minha coleção" /></li>
            <li><Unavailable section="atividade" label="Atividade" /></li>
            <li><Unavailable section="estudio-do-criador" label="Estúdio do criador" /></li>
            <li>
              <Link to="/favoritos" className={linkClass}>
                Lista de interesse
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-ajuda">
          <h2 id="footer-ajuda" className="mb-2 text-lg font-bold">
            Central de ajuda
          </h2>
          <ul className="flex flex-col items-start">
            <li><Unavailable section="central-de-ajuda" label="Central de ajuda" /></li>
            <li><Unavailable section="como-comprar" label="Como comprar NFTs" /></li>
            <li>
              <Link to="/carteiras" className={linkClass}>
                Carteira e segurança
              </Link>
            </li>
            <li><Unavailable section="politica-do-mercado" label="Política do mercado" /></li>
            <li><Unavailable section="denunciar-item" label="Denunciar item" /></li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-colecoes">
          <h2 id="footer-colecoes" className="mb-2 text-lg font-bold">
            Coleções
          </h2>
          <ul className="flex flex-col items-start">
            {FOOTER_CATEGORIES.map((c) => (
              <li key={c}>
                <Link to="/" hash="catalogo" search={{ category: [c] }} className={linkClass}>
                  {CATEGORY_LABELS[c]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="mb-3 text-lg font-bold">Redes sociais</h2>
          <ul className="flex gap-2.5">
            {SOCIALS.map(({ label, href, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (abre em nova aba)`}
                  className="grid size-[30px] place-items-center rounded-xs border border-brand text-brand hover:bg-brand/10"
                >
                  <Icon aria-hidden className="max-h-4 w-auto" />
                </a>
              </li>
            ))}
          </ul>
          <h2 className="mt-8 mb-3 text-lg font-bold">Carteiras compatíveis</h2>
          <p className="inline-block rounded-xs border border-brand/40 bg-surface-dark px-2.5 py-1.5 text-[9px] font-bold tracking-[0.01em] text-brand">
            METAMASK&nbsp;&nbsp;•&nbsp;&nbsp;WALLETCONNECT&nbsp;&nbsp;•&nbsp;&nbsp;COINBASE
          </p>
        </div>
      </div>

      {/* Linha da marca (Figma) + crédito do autor no mesmo estilo; cada parte quebra como um bloco inteiro. */}
      <p className="flex flex-wrap justify-center gap-x-2 py-2 text-center text-sm leading-[30px]">
        <span>© 2026 Kurio. Propriedade digital para todos.</span>
        <span className="whitespace-nowrap">
          <span aria-hidden className="mr-2 hidden sm:inline">
            ·
          </span>
          Desenvolvido por{' '}
          <a
            href="https://github.com/wilzo"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Wilson Hernandes no GitHub (abre em nova aba)"
            className="inline-flex min-h-6 items-center rounded-sm underline underline-offset-4 hover:text-brand-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Wilson Hernandes
          </a>
        </span>
      </p>
    </footer>
  )
}
