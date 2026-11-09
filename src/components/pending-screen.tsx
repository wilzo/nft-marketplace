import { Link } from '@tanstack/react-router'

/** Tela provisória para rotas ainda em implementação (substituída nas próximas etapas). */
export function PendingScreen({ title }: { title: string }) {
  return (
    <main id="conteudo" className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sand">Esta tela está em implementação.</p>
      <Link to="/" className="text-brand-accent underline underline-offset-4">
        Voltar ao início
      </Link>
    </main>
  )
}
