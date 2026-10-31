import { RoundedBox } from '@react-three/drei'
import type { Shape3D } from '../lib/fridgeShape'

/**
 * 식품 용기 실루엣. 기본 도형에 '이게 뭔지 알려 주는 특징 하나'만 얹는다
 * (병은 목과 뚜껑, 우유팩은 박공 지붕, 캔은 윗테, 통은 뚜껑 띠, 달걀판은 볼록 칸).
 * s 는 바닥 한 변 기준 크기, 원점은 바닥 가운데.
 */

const CAP = '#5f6b66'
const METAL = '#c9cfcc'
const WHITE = '#f6f6f3'

export function Container3D({ shape, s, color }: { shape: Shape3D; s: number; color: string }) {
  const body = <meshStandardMaterial color={color} roughness={0.7} />
  const r = s * 0.04
  switch (shape) {
    case 'bottle':
      return (
        <group>
          <mesh position={[0, s * 0.4, 0]}>
            <cylinderGeometry args={[s * 0.24, s * 0.26, s * 0.8, 20]} />
            {body}
          </mesh>
          <mesh position={[0, s * 0.92, 0]}>
            <cylinderGeometry args={[s * 0.1, s * 0.24, s * 0.24, 20]} />
            {body}
          </mesh>
          <mesh position={[0, s * 1.15, 0]}>
            <cylinderGeometry args={[s * 0.11, s * 0.11, s * 0.2, 16]} />
            <meshStandardMaterial color={CAP} roughness={0.5} />
          </mesh>
        </group>
      )
    case 'jar':
      return (
        <group>
          <mesh position={[0, s * 0.3, 0]}>
            <cylinderGeometry args={[s * 0.32, s * 0.32, s * 0.6, 24]} />
            {body}
          </mesh>
          <mesh position={[0, s * 0.66, 0]}>
            <cylinderGeometry args={[s * 0.3, s * 0.3, s * 0.12, 24]} />
            <meshStandardMaterial color={CAP} roughness={0.5} />
          </mesh>
        </group>
      )
    case 'carton':
      return (
        <group>
          <RoundedBox args={[s * 0.5, s * 0.78, s * 0.5]} radius={r} position={[0, s * 0.39, 0]}>
            {body}
          </RoundedBox>
          {/* 박공 지붕: 삼각기둥 */}
          <mesh position={[0, s * 0.86, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[s * 0.18, s * 0.18, s * 0.5, 3]} />
            {body}
          </mesh>
          <mesh position={[0, s * 1.02, 0]}>
            <boxGeometry args={[s * 0.5, s * 0.05, s * 0.06]} />
            {body}
          </mesh>
        </group>
      )
    case 'can':
      return (
        <group>
          <mesh position={[0, s * 0.29, 0]}>
            <cylinderGeometry args={[s * 0.27, s * 0.27, s * 0.58, 24]} />
            {body}
          </mesh>
          <mesh position={[0, s * 0.6, 0]}>
            <cylinderGeometry args={[s * 0.25, s * 0.27, s * 0.04, 24]} />
            <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      )
    case 'tub':
      return (
        <group>
          <RoundedBox args={[s * 0.84, s * 0.4, s * 0.66]} radius={s * 0.06} position={[0, s * 0.2, 0]}>
            {body}
          </RoundedBox>
          <RoundedBox args={[s * 0.88, s * 0.1, s * 0.7]} radius={s * 0.04} position={[0, s * 0.45, 0]}>
            <meshStandardMaterial color={CAP} roughness={0.6} />
          </RoundedBox>
        </group>
      )
    case 'box':
      return (
        <RoundedBox args={[s * 0.82, s * 0.6, s * 0.62]} radius={r} position={[0, s * 0.3, 0]}>
          {body}
        </RoundedBox>
      )
    case 'bag':
      return (
        <group>
          {/* 볼록한 봉지 + 위쪽 접합선 */}
          <mesh position={[0, s * 0.36, 0]} scale={[s * 0.42, s * 0.36, s * 0.2]}>
            <sphereGeometry args={[1, 24, 16]} />
            {body}
          </mesh>
          <RoundedBox args={[s * 0.62, s * 0.08, s * 0.08]} radius={s * 0.03} position={[0, s * 0.74, 0]}>
            {body}
          </RoundedBox>
        </group>
      )
    case 'tray':
      return (
        <group>
          <RoundedBox args={[s * 0.92, s * 0.1, s * 0.68]} radius={s * 0.04} position={[0, s * 0.05, 0]}>
            <meshStandardMaterial color={WHITE} roughness={0.8} />
          </RoundedBox>
          <mesh position={[0, s * 0.1, 0]} scale={[s * 0.38, s * 0.12, s * 0.26]}>
            <sphereGeometry args={[1, 24, 12]} />
            {body}
          </mesh>
        </group>
      )
    case 'loose':
      return (
        <mesh position={[0, s * 0.3, 0]}>
          <sphereGeometry args={[s * 0.3, 24, 16]} />
          {body}
        </mesh>
      )
    case 'egg':
      return (
        <group>
          <RoundedBox args={[s * 0.92, s * 0.14, s * 0.62]} radius={s * 0.04} position={[0, s * 0.07, 0]}>
            {body}
          </RoundedBox>
          {[-1, 0, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <mesh key={`${x}${z}`} position={[x * s * 0.28, s * 0.14, z * s * 0.15]} scale={[s * 0.12, s * 0.13, s * 0.12]}>
                <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                {body}
              </mesh>
            )),
          )}
        </group>
      )
  }
}
