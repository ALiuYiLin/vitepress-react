import { useData } from 'vitepress'

import { Separator } from './components/ui/separator'

export function Footer() {
  const { theme } = useData()
  const cfg = theme as { footer?: { message?: string; copyright?: string } }
  const { message, copyright } = cfg.footer ?? {}
  return (
    <footer>
      <Separator />
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-6 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        {message && <p>{message}</p>}
        {copyright && <p>{copyright}</p>}
      </div>
    </footer>
  )
}
