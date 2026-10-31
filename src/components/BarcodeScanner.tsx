import { useEffect, useRef, useState } from 'react'
import { createDetector, normalizeBarcode } from '../lib/barcode'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

/** 후면 카메라로 바코드를 읽는 전체 화면. 카메라를 못 쓰면 숫자를 직접 입력 */
export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState('카메라를 켜는 중…')
  const [typed, setTyped] = useState('')
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
              navigator.vibrate?.(80)
              onDetectedRef.current(code)
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-bold">바코드 찍기</h2>
        <button className="rounded-full px-2 text-3xl leading-none text-white/70" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-4/5 max-w-sm rounded-xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        <p className="absolute inset-x-0 bottom-4 px-6 text-center text-sm">{status}</p>
      </div>
      <form
        className="flex gap-2 bg-slate-900 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (typedCode) onDetected(typedCode)
        }}
      >
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          inputMode="numeric"
          placeholder="바코드 숫자 직접 입력"
          className="min-w-0 flex-1 rounded-xl bg-white px-3 py-3 text-base text-slate-900"
        />
        <button disabled={!typedCode} className="rounded-xl bg-sky-600 px-4 font-semibold disabled:opacity-40">
          찾기
        </button>
      </form>
    </div>
  )
}
