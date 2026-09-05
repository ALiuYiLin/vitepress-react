/**
 * 等价于 Vue 版的 docs/components/ModalDemo.vue:
 * 「Show Modal」按钮 + 用 `createPortal` 把弹层挂到 `<body>`(React 版的
 * Teleport)。默认不渲染弹层,SSR / 水合安全;支持 Esc 或点击遮罩关闭。
 *
 * 用法:在页面 `<script>` 顶层 import 后直接 `<ModalDemo />`。
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import './ModalDemo.css'

export default function ModalDemo() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show])

  const close = () => setShow(false)

  const modal: ReactNode = show
    ? createPortal(
        <div className="modal-mask" onClick={close}>
          <div
            className="modal-container"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p>Hello from the modal!</p>
            <div className="modal-footer">
              <button className="modal-button" onClick={close}>
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <button className="modal-button" onClick={() => setShow(true)}>
        Show Modal
      </button>
      {modal}
    </>
  )
}
