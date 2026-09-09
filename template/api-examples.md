---
outline: deep
---

# Runtime API Examples

This page demonstrates usage of some of the runtime APIs provided by VitePress.

The main `useData()` API can be used to access site, theme, and page data for the current page. It works both in `.md` pages (page-scope `<script>`) and in custom theme `.tsx` components:

```md
<script>
import { useData } from '@10coding/vitepress-react'

export function DataView({ label, field }) {
  const data = useData()
  return (
    <section>
      <h3>{label}</h3>
      <pre>{JSON.stringify(data[field], null, 2)}</pre>
    </section>
  )
}
</script>

## Results

<DataView label="Theme Data" field="theme" />
<DataView label="Page Data" field="page" />
<DataView label="Page Frontmatter" field="frontmatter" />
```

<script>
import { useData } from '@10coding/vitepress-react'

export function DataView({ label, field }) {
  const data = useData()
  return (
    <section>
      <h3>{label}</h3>
      <pre>{JSON.stringify(data[field], null, 2)}</pre>
    </section>
  )
}
</script>

## Results

<DataView label="Theme Data" field="theme" />
<DataView label="Page Data" field="page" />
<DataView label="Page Frontmatter" field="frontmatter" />

## More

Check out the documentation for the [full list of runtime APIs](https://vitepress.dev/reference/runtime-api#usedata).
