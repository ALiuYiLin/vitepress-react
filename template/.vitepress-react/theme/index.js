// https://aliuyilin.github.io/vitepress-react/guide/custom-theme
<% if (!defaultTheme) { %>import Layout from './Layout'<% if (useTs) { %>
import type { Theme } from '@10coding/vitepress-react'<% } %>
import './style.css'

<% if (!useTs) { %>/** @type {import('@10coding/vitepress-react').Theme} */
<% } %>export default {
  Layout,
  enhanceApp({ router, siteData }) {
    // ...
  }
}<% if (useTs) { %> satisfies Theme<% } %>
<% } else { %><% if (useTs) { %>
import type { Theme } from '@10coding/vitepress-react'<% } %>
import DefaultTheme from '@10coding/vitepress-react/theme'
import './style.css'

<% if (!useTs) { %>/** @type {import('@10coding/vitepress-react').Theme} */
<% } %>export default {
  extends: DefaultTheme,
  enhanceApp({ router, siteData }) {
    // ...
  }
}<% if (useTs) { %> satisfies Theme<% } %><% } %>
