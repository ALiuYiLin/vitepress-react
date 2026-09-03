/** 轻量 className 拼接(Vue 版 `:class` 数组/条件类的等价物)。 */
export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')
