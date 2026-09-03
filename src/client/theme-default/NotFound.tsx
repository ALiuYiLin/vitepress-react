import { useData } from 'vitepress'

/** 404 视图(默认主题缺省;Layout 内容区由框架 <Content /> 渲染) */
export function NotFound() {
  const { site } = useData()
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-2 text-center">
      <code className="text-4xl font-bold text-muted-foreground">404</code>
      <h1 className="text-2xl font-bold tracking-tight">Page Not Found</h1>
      <p className="text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      {site.title ? (
        <a
          href="/"
          className="mt-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Go to {site.title} home
        </a>
      ) : null}
    </div>
  )
}
