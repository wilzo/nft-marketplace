import { cn } from "cn"

/**
 * Skeleton com shimmer (exigência do desafio). Com prefers-reduced-motion,
 * a regra global em index.css congela a animação e mantém o bloco estático.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--color-surface-card)_0%,var(--color-surface-raised)_50%,var(--color-surface-card)_100%)] bg-size-[200%_100%]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
