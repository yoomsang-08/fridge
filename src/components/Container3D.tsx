import { Suspense, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { LookVariant } from '../lib/foodLook'
import { MODEL_SCALE, type ModelKey } from '../lib/model3d'

const CONTAINER_URL = import.meta.glob<string>('../assets/container3d/*.glb', { query: '?url', import: 'default', eager: true })
const FOOD_URL = import.meta.glob<string>('../assets/food3d/*.glb', { query: '?url', import: 'default', eager: true })

// 장면이 열릴 때 모델을 미리 받아 둔다(식품이 늘 때마다 깜빡이지 않게). 모델 하나가 늦어도 그 자리만 비운다
Object.values({ ...CONTAINER_URL, ...FOOD_URL }).forEach((u) => useGLTF.preload(u, false, false))

/** 모델 노드(메시) 이름: body 는 몸통 색, band 는 띠 색, 나머지(cap·fixed)는 모델에 정해진 색 그대로 */
function GlbModel({ model, s, color, band }: { model: ModelKey; s: number; color: string; band?: string }) {
  const url = (model.kind === 'container' ? CONTAINER_URL : FOOD_URL)[`../assets/${model.kind === 'container' ? 'container3d' : 'food3d'}/${model.name}.glb`]
  const { scene } = useGLTF(url, false, false)
  const root = useMemo(() => {
    const c = scene.clone(true)
    const hide: THREE.Object3D[] = []
    c.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = (m.material as THREE.MeshStandardMaterial).clone()
      m.material = mat
      if (mat.name === 'tint_body') mat.color.set(color)
      else if (mat.name === 'tint_band') {
        if (band) mat.color.set(band)
        else hide.push(m) // 라벨이 없는 식품은 띠를 숨긴다
      }
    })
    hide.forEach((o) => (o.visible = false))
    return c
  }, [scene, color, band])
  const k = model.kind === 'food' ? (MODEL_SCALE[model.name] ?? 1) : 1
  return <primitive object={root} scale={s * k} />
}

/** 낱개 채소·과일의 특징 모양. 꼭지·잎은 모두 같은 초록(LEAF) */
const LEAF = '#4f7a3a'

function Produce({ variant, s, color }: { variant: LookVariant; s: number; color: string }) {
  const body = <meshStandardMaterial color={color} roughness={0.55} />
  switch (variant) {
    case 'apple':
      return (
        <group>
          <mesh position={[0, s * 0.28, 0]} scale={[1, 0.92, 1]}>
            <sphereGeometry args={[s * 0.3, 24, 16]} />
            {body}
          </mesh>
          <mesh position={[0, s * 0.58, 0]}>
            <cylinderGeometry args={[s * 0.012, s * 0.016, s * 0.1, 8]} />
            <meshStandardMaterial color={LEAF} roughness={0.6} />
          </mesh>
          <mesh position={[s * 0.07, s * 0.58, 0]} rotation={[0, 0, -0.5]} scale={[1, 0.4, 0.7]}>
            <sphereGeometry args={[s * 0.06, 12, 8]} />
            <meshStandardMaterial color={LEAF} roughness={0.6} />
          </mesh>
        </group>
      )
    case 'carrot':
      return (
        <group>
          <mesh position={[0, s * 0.3, 0]} rotation={[0, 0, Math.PI / 2.6]}>
            <coneGeometry args={[s * 0.15, s * 0.7, 16]} />
            {body}
          </mesh>
          <mesh position={[-s * 0.16, s * 0.52, 0]}>
            <sphereGeometry args={[s * 0.07, 10, 8]} />
            <meshStandardMaterial color={LEAF} roughness={0.6} />
          </mesh>
        </group>
      )
    case 'long':
      return (
        <group>
          <mesh position={[0, s * 0.17, 0]} rotation={[0, 0.5, Math.PI / 2]}>
            <cylinderGeometry args={[s * 0.14, s * 0.12, s * 0.8, 20]} />
            {body}
          </mesh>
          <mesh position={[0, s * 0.17, s * 0.28]} rotation={[0, 0.5, Math.PI / 2]}>
            <cylinderGeometry args={[s * 0.07, s * 0.07, s * 0.3, 12]} />
            <meshStandardMaterial color={LEAF} roughness={0.6} />
          </mesh>
        </group>
      )
    case 'potato':
      return (
        <mesh position={[0, s * 0.2, 0]} scale={[1.25, 0.85, 0.95]} rotation={[0, 0.4, 0]}>
          <sphereGeometry args={[s * 0.24, 20, 14]} />
          {body}
        </mesh>
      )
    case 'banana':
      return (
        <group>
          {[-1, 0, 1].map((i) => (
            <mesh key={i} position={[i * s * 0.22, s * 0.18 + Math.abs(i) * s * 0.02, 0]} rotation={[0, 0, Math.PI / 2 + i * 0.25]} scale={[1, 1, 0.75]}>
              <capsuleGeometry args={[s * 0.07, s * 0.55, 6, 14]} />
              {body}
            </mesh>
          ))}
        </group>
      )
    case 'label':
      return null
  }
}

/**
 * 식품·용기 3D. 용기·식품 모델(GLB)이 있으면 그것을, 없는 낱개 채소·과일은 기본 도형으로 그린다.
 * s 는 바닥 한 변 기준 크기, 원점은 바닥 가운데.
 */
export function Container3D({ s, color, variant, band, model }: { s: number; color: string; variant?: LookVariant; band?: string; model?: ModelKey | null }) {
  if (model)
    return (
      <Suspense fallback={null}>
        <GlbModel model={model} s={s} color={color} band={band} />
      </Suspense>
    )
  // 모델이 없는 낱개 채소·과일(귤·키위·고구마·딸기·쌈채소 등)은 지금까지의 도형 그대로
  if (variant && variant !== 'label') return <Produce variant={variant} s={s} color={color} />
  return (
    <mesh position={[0, s * 0.3, 0]}>
      <sphereGeometry args={[s * 0.3, 24, 16]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  )
}
