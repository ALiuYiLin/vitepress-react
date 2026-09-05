/**
 * 等价于 Vue 版的 docs/components/ComponentInHeader.vue:
 * 演示「把组件放进标题」的最小组件——只渲染一个 ⚡。
 *
 * 用法:在页面 `<script>` 顶层 import 后,标题行里直接写
 * `<ComponentInHeader />`(大写标签按组件解析;大纲标题只取纯文本)。
 */
export default function ComponentInHeader() {
  return <span aria-hidden="true">⚡</span>
}
