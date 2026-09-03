import { useEffect, useState, type ReactNode } from 'react'

/**
 * 仅在客户端渲染的内容(React 版;对上游 ClientOnly)。
 */
export function ClientOnly({ children }: { children?: ReactNode }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(true)
  }, [])

  return <>{show ? children : null}</>
}

export default ClientOnly
