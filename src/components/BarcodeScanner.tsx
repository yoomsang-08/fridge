import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createDetector, normalizeBarcode } from '../lib/barcode'
import { Button, IconButton, TextInput } from './ui'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

/** 후면 카메라로 바코드를 읽는 전체 화면. 카메라를 못 쓰면 숫자를 직접 입력 */
export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState('카메라를 켜는 중…')
  const [typed, setTyped] = useState('')
  const [hit, setHit] = useState(false)
  // 부모가 다시 그려져도 스캔 루프를 다시 시작하지 않도록
  const onDetectedRef = useRef(onDetected)
  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('이 브라우저에서는 카메라를 쓸 수 없어요. 숫자를 직접 입력해 주세요.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch {
        setStatus('카메라 권한이 없어요. 브라우저 설정에서 카메라를 허용하거나 숫자를 직접 입력해 주세요.')
        return
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop())
      const video = videoRef.current!
      video.srcObject = stream
      await video.play().catch(() => {})

      const detector = await createDetector().catch(() => null)
      if (stopped) return
      if (!detector) {
        setStatus('바코드 인식기를 불러오지 못했어요. 숫자를 직접 입력해 주세요.')
        return
      }
      setStatus('바코드를 네모 안에 맞춰 주세요')

      const tick = async () => {
        if (stopped) return
        if (video.readyState >= 2) {
          const found = await detector.detect(video).catch(() => [])
          for (const b of found) {
            const code = normalizeBarcode(b.rawValue)
            if (code && !stopped) {
              stopped = true
              // 화면을 안 보고 찍는 경우가 많아 진동과 테두리 색으로 알려준다
              navigator.vibrate?.(40)
              setHit(true)
              timer = window.setTimeout(() => onDetectedRef.current(code), 350)
              return
            }
          }
        }
        timer = window.setTimeout(tick, 200)
      }
      tick()
    }
    start()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const typedCode = normalizeBarcode(typed)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-white" role="dialog" aria-modal="true" aria-label="바코드 찍기">
      <div className="flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <IconButton className="text-white active:bg-white/10" onClick={onClose} aria-label="닫기">
          <X size={22} strokeWidth={2.4} />
        </IconButton>
        <h2 className="text-lg font-extrabold tracking-tight">바코드 찍기</h2>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`h-32 w-4/5 max-w-sm rounded-2xl border-[3px] transition-colors ${hit ? 'border-accent' : 'border-white/90'} shadow-[0_0_0_9999px_color-mix(in_srgb,var(--color-ink)_55%,transparent)]`} />
        </div>
        <p className="absolute inset-x-0 bottom-4 px-6 text-center text-sm font-semibold">{status}</p>
      </div>
      <form
        className="mx-auto flex w-full max-w-md gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault()
          if (typedCode) onDetected(typedCode)
        }}
      >
        <TextInput
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          inputMode="numeric"
          placeholder="바코드 숫자 직접 입력"
          className="tabular min-w-0 flex-1 text-ink"
        />
        <Button type="submit" size="md" className="h-12" disabled={!typedCode}>
          찾기
        </Button>
      </form>
    </div>
  )
}
