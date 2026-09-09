---
outline: deep
---

# Runtime API Examples

This page demonstrates usage of some of the runtime APIs provided by VitePress.

The main `useData()` API can be used to access site, theme, and page data for the current page. It works both in `.md` pages (page-scope `<script>`) and in custom theme `.tsx` components:

```md
<script>
import { useData } from '@10coding/vitepress-react'

const { theme, page } = useData()
</script>

### Theme Data
<>{JSON.stringify(theme)}</>

### Page
<>{JSON.stringify(page)}</>
```

<script>
import { useData } from '@10coding/vitepress-react'

const { theme, page } = useData()
</script>

## Results

### Theme Data
<>{JSON.stringify(theme)}</>

### Page
<>{JSON.stringify(page)}</>

## More

Check out the documentation for the [full list of runtime APIs](https://vitepress.dev/reference/runtime-api#usedata).
