import { createContentLoader } from '@10coding/vitepress-react'

export default createContentLoader('posts/**/*.md', { render: true })
