import { supabase } from './supabase'

export type RatioKey = 'square' | 'landscape' | 'portrait'

export const RATIOS: Record<RatioKey, { label: string; w: number; h: number; maxWidth: number; hint: string; genSize: string }> = {
  landscape: { label: 'Landscape 16:9', w: 16, h: 9, maxWidth: 1600, hint: 'X, Bluesky, blog header', genSize: '1536x1024' },
  portrait: { label: 'Portrait 4:5', w: 4, h: 5, maxWidth: 1080, hint: 'Threads feed', genSize: '1024x1536' },
  square: { label: 'Square 1:1', w: 1, h: 1, maxWidth: 1080, hint: 'Works everywhere', genSize: '1024x1024' },
}

export const PLATFORM_RATIO: Record<string, RatioKey> = {
  threads: 'portrait',
  twitter: 'landscape',
  bluesky: 'landscape',
  blog: 'landscape',
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

// Center-crop to the target ratio, downscale, and re-encode as JPEG (keeps Bluesky under its 1MB cap)
export async function cropToRatio(src: string, ratio: RatioKey): Promise<Blob> {
  const { w, h, maxWidth } = RATIOS[ratio]
  const img = await loadImage(src)
  const target = w / h
  const srcRatio = img.width / img.height

  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (srcRatio > target) { sw = Math.round(img.height * target); sx = Math.round((img.width - sw) / 2) }
  else if (srcRatio < target) { sh = Math.round(img.width / target); sy = Math.round((img.height - sh) / 2) }

  const outW = Math.min(maxWidth, sw)
  const outH = Math.round(outW / target)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.86))
}

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })

export async function uploadToStorage(blob: Blob, userId: string): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
