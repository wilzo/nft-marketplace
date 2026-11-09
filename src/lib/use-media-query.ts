import { useSyncExternalStore } from 'react'

/** Media query reativa (ex.: '(min-width: 1024px)' = breakpoint lg do layout desktop). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * Breakpoint do layout desktop = `lg` do Tailwind (64rem). Em rem, como o CSS: com a fonte do navegador ampliada,
 * CSS e JS trocam de layout juntos (com px, o JS montava partes do desktop sobre o CSS mobile).
 */
export const DESKTOP_QUERY = '(min-width: 64rem)'
