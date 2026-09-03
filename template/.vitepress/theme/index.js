// https://vitepress-react.dev/guide/custom-theme
<% if (!defaultTheme) { %>import Layout from './Layout'<% if (useTs) { %>
import type { Theme } from 'vitepress'<% } %>
import './style.css'

<% if (!useTs) { %>/** @type {import('vitepress').Theme} */
<% } %>export default {
  Layout,
  enhanceApp({ router, siteData }) {
    // ...
  }
}<% if (useTs) { %> satisfies Theme<% } %>
<% } else { %><% if (useTs) { %>
import type { Theme } from 'vitepress'<% } %>
import DefaultTheme from 'vitepress/theme'
import './style.css'

<% if (!useTs) { %>/** @type {import('vitepress').Theme} */
<% } %>export default {
  extends: DefaultTheme,
  enhanceApp({ router, siteData }) {
    // ...
  }
}<% if (useTs) { %> satisfies Theme<% } %><% } %>
