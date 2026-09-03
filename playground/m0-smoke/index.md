---
title: M0 Smoke Home
head:
  - - meta
    - name: keywords
      content: m0,smoke,react
---

# M0-SMOKE-MARKER

This page verifies the **React runtime skeleton**:

- list item A
- list item B

[Go to guide](/guide)

<script setup>
import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      count is {count}
    </button>
  )
}
</script>

<Counter />

> 字面量检查:{{ count }} 会原样显示,不会被求值。

```ts
const answer = 42
```

> a blockquote
