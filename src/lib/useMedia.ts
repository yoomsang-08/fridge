import { useEffect, useState } from 'react'

/** 화면 조건(예: '(min-width: 1024px)')이 지금 맞는지. 창 크기가 바뀌면 따라간다 */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const f = () => setOn(m.matches)
    f()
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [query])
  return on
}
