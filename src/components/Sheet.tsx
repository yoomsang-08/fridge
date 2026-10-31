import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { IconButton } from './ui'

/** 폰에서는 아래에서 올라오는 시트, PC 에서는 가운데 모달. footer 는 아래에 고정된다 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex animate-[fade-in_150ms_ease-out] items-end justify-center bg-ink/40 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full animate-[sheet-up_220ms_cubic-bezier(.2,.8,.2,1)] flex-col rounded-t-[1.75rem] bg-surface shadow-2xl sm:max-w-lg sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line sm:hidden" />
        <div className="flex items-center gap-2 px-5 pt-3 pb-2 sm:pt-5">
          <h2 className="flex-1 text-lg font-extrabold tracking-tight">{title}</h2>
          <IconButton className="bg-sunken" onClick={onClose} aria-label="닫기">
            <X size={18} strokeWidth={2.4} />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pt-2 pb-6">{children}</div>
        {footer && (
          <div className="flex gap-2 border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
