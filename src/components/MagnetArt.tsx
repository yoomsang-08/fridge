import type { SVGProps } from 'react'
import { partsOf, type ArtMagnet } from '../lib/magnets'

/** 자석·명절 장식 그림 (24×24, 토큰 색). 냉장고 SVG 안에서도 x·y·width·height 로 놓을 수 있다 */
export function MagnetArt({ kind, size = 20, ...props }: { kind: ArtMagnet; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {partsOf(kind).map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill ? `var(--color-${p.fill})` : 'none'}
          stroke={p.stroke ? `var(--color-${p.stroke})` : undefined}
          strokeWidth={p.w}
        />
      ))}
    </svg>
  )
}
