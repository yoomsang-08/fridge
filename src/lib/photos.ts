/** 냉장고 문 사진: 집마다 몇 장만, 화질은 지키면서 가볍게 */
export const PHOTO_LIMIT = 10
/** 긴 변 최대 길이(px) */
export const PHOTO_MAX_SIDE = 1600
/** 이보다 크면 화질을 조금씩 낮춰 다시 굽는다 (버킷 한도는 1MB) */
const TARGET_BYTES = 400 * 1024

export interface PreparedPhoto {
  blob: Blob
  width: number
  height: number
}

/**
 * 고른 사진을 긴 변 maxSide 로 줄이고 WebP(안 되면 JPEG)로 굽는다.
 * 폰 사진의 회전 정보(EXIF)는 createImageBitmap 이 반영한다.
 */
export async function preparePhoto(file: File, maxSide = PHOTO_MAX_SIDE, target = TARGET_BYTES): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * k))
  const height = Math.max(1, Math.round(bitmap.height * k))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const encode = (type: string, q: number) =>
    new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, q))
  // Safari 는 WebP 로 못 구워서 PNG 를 돌려주니, 그땐 JPEG 로
  let type = 'image/webp'
  let blob = await encode(type, 0.82)
  if (!blob || blob.type !== type) {
    type = 'image/jpeg'
    blob = await encode(type, 0.85)
  }
  for (const q of [0.75, 0.65, 0.55]) {
    if (!blob || blob.size <= target) break
    blob = await encode(type, q)
  }
  if (!blob) throw new Error('encode_failed')
  return { blob, width, height }
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader()
    r.onload = () => ok(r.result as string)
    r.onerror = () => fail(r.error)
    r.readAsDataURL(blob)
  })
