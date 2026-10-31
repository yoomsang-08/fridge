import { useCallback, useState, type ReactNode } from 'react'
import { Sheet } from './Sheet'
import { Button, TextInput } from './ui'

type Request =
  | { kind: 'ask'; title: string; initial: string; resolve: (v: string | null) => void }
  | { kind: 'confirm'; title: string; message: string; action: string; resolve: (v: boolean) => void }

/**
 * 브라우저 기본 prompt/confirm 대신 앱 모양 그대로의 시트로 묻는다.
 * const { ask, confirm, dialog } = useDialog() 후 dialog 를 화면에 그려 두면 된다.
 */
export function useDialog() {
  const [req, setReq] = useState<Request | null>(null)

  const ask = useCallback(
    (title: string, initial = '') =>
      new Promise<string | null>((resolve) => setReq({ kind: 'ask', title, initial, resolve })),
    [],
  )
  const confirm = useCallback(
    (title: string, message: string, action = '삭제') =>
      new Promise<boolean>((resolve) => setReq({ kind: 'confirm', title, message, action, resolve })),
    [],
  )

  let dialog: ReactNode = null
  if (req?.kind === 'ask') {
    dialog = <AskSheet key={req.title} req={req} onDone={() => setReq(null)} />
  } else if (req?.kind === 'confirm') {
    const done = (v: boolean) => {
      req.resolve(v)
      setReq(null)
    }
    dialog = (
      <Sheet
        title={req.title}
        onClose={() => done(false)}
        footer={
          <>
            <Button variant="ghost" className="flex-1" onClick={() => done(false)}>
              취소
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => done(true)}>
              {req.action}
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-muted">{req.message}</p>
      </Sheet>
    )
  }

  return { ask, confirm, dialog }
}

function AskSheet({ req, onDone }: { req: Extract<Request, { kind: 'ask' }>; onDone: () => void }) {
  const [value, setValue] = useState(req.initial)
  const done = (v: string | null) => {
    req.resolve(v?.trim() || null)
    onDone()
  }
  return (
    <Sheet
      title={req.title}
      onClose={() => done(null)}
      footer={
        <>
          <Button variant="ghost" className="flex-1" onClick={() => done(null)}>
            취소
          </Button>
          <Button className="flex-1" disabled={!value.trim()} onClick={() => done(value)}>
            확인
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) done(value)
        }}
      >
        <TextInput id="dialog-input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </form>
    </Sheet>
  )
}
