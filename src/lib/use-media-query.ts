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

export const DESKTOP_QUERY = '(min-width: 1024px)'
