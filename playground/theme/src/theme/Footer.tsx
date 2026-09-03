import { useData } from '../lib/vp-store'

export function Footer() {
  const { theme } = useData()
  const { message, copyright } = theme.footer ?? {}
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-6 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        {message && <p>{message}</p>}
        {copyright && <p>{copyright}</p>}
        <p className="text-xs text-muted-foreground/70">
          playground · Vite + React + TypeScript + Tailwind v4 + shadcn/ui
        </p>
      </div>
    </footer>
  )
}
