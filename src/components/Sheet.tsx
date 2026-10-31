import { useEffect, type ReactNode } from 'react'

/** 폰에서는 아래에서 올라오는 시트, PC 에서는 가운데 모달 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="rounded-full px-2 text-2xl leading-none text-slate-400" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-6 pt-3">{children}</div>
      </div>
    </div>
  )
}
