---
'@10coding/vitepress-react': patch
---

Author-written tags in markdown (HTML tags and component tags) are now handed to
React as JSX consistently, instead of depending on what markdown-it's HTML
grammar happens to tokenize.

A tag whose attribute value is unquoted and contains spaces — for example
`<button onClick={() => setCount(count + 1)}>+1</button>` — was never recognized
as inline HTML: the opening tag became plain text, the closing tag was dropped,
and the whole line rendered as escaped literal text. Such tags (inline or on
their own line, including several sibling elements in a row and elements nested
in a list item or a container) now become JSX elements.

Attributes in these regions are JSX attributes: write `className`,
`style={{ … }}` and camelCase events (`onClick`). Author-written block tags
(`<div>`, `<table>`, …) take the same path, so they are no longer
attribute-converted; HTML produced by the markdown layer itself — `{.class}`
attrs, heading anchors, containers, Shiki output, markup injected by plugins —
still goes through the HTML→JSX serializer and keeps its conversion.

Internally the takeover decision now lives in a single place (the new
markdown-it rule backed by a brace/quote-aware element scanner), replacing the
old heuristics that inspected token shapes in the core phase.
