import { supabase } from './supabase'

export type RatioKey = 'original' | 'square' | 'landscape' | 'portrait'

export const RATIOS: Record<RatioKey, { label: string; w: number; h: number; maxWidth: number; hint: string; genSize: string; px: string }> = {
  original: { label: 'Original', w: 0, h: 0, maxWidth: 1600, hint: 'No crop — keeps the whole image', genSize: '1024x1024', px: 'as uploaded' },
  landscape: { label: 'Landscape 16:9', w: 16, h: 9, maxWidth: 1600, hint: 'X, Bluesky, Substack header', genSize: '1536x1024', px: '1600×900' },
  portrait: { label: 'Portrait 4:5', w: 4, h: 5, maxWidth: 1080, hint: 'Threads, LinkedIn feed', genSize: '1024x1536', px: '1080×1350' },
  square: { label: 'Square 1:1', w: 1, h: 1, maxWidth: 1080, hint: 'Safe everywhere', genSize: '1024x1024', px: '1080×1080' },
}

// What each platform shows best, as of 2026. Sizes are the recommended output pixels.
export const PLATFORM_SPEC: Record<string, { ratio: RatioKey; size: string; note: string }> = {
  threads: { ratio: 'portrait', size: '1080×1350', note: '4:5 fills the most feed; 1:1 also shows uncropped' },
  twitter: { ratio: 'landscape', size: '1600×900', note: '16:9 shows whole in the timeline' },
  bluesky: { ratio: 'landscape', size: '1600×900', note: '16:9, must be under 1 MB (we compress)' },
  linkedin: { ratio: 'portrait', size: '1080×1350', note: '4:5 takes the most feed space; 1.91:1 for link cards' },
  blog: { ratio: 'landscape', size: '1456×816', note: 'Substack header is 1456×816 (16:9)' },
}

// The ratio that suits the most of the chosen platforms; square when they disagree evenly
export function bestRatioFor(platforms: string[]): RatioKey {
  const votes: Partial<Record<RatioKey, number>> = {}
  for (const p of platforms) { const r = PLATFORM_SPEC[p]?.ratio; if (r) votes[r] = (votes[r] || 0) + 1 }
  const ranked = (Object.entries(votes) as [RatioKey, number][]).sort((a, b) => b[1] - a[1])
  if (!ranked.length) return 'square'
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return 'square'
  return ranked[0][0]
}

export const PLATFORM_RATIO: Record<string, RatioKey> = {
  threads: 'portrait',
  twitter: 'landscape',
  bluesky: 'landscape',
  linkedin: 'landscape',
  blog: 'landscape',
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Browser could not decode this image'))
    img.src = src
  })

// Center-crop to the target ratio, downscale, and re-encode as JPEG (keeps Bluesky under its 1MB cap)
export async function cropToRatio(src: string, ratio: RatioKey): Promise<Blob> {
  const { w, h, maxWidth } = RATIOS[ratio]
  const img = await loadImage(src)
  const srcRatio = img.width / img.height
  const target = ratio === 'original' ? srcRatio : w / h

  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (ratio !== 'original') {
    if (srcRatio > target) { sw = Math.round(img.height * target); sx = Math.round((img.width - sw) / 2) }
    else if (srcRatio < target) { sh = Math.round(img.width / target); sy = Math.round((img.height - sh) / 2) }
  }

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
  if (error) throw new Error(error.message)
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

// Logos: square center-crop, max 512px, PNG so transparency survives
export async function logoBlob(file: File): Promise<Blob> {
  const img = await loadImage(await fileToDataUrl(file))
  const side = Math.min(img.width, img.height)
  const out = Math.min(512, side)
  const c = document.createElement('canvas'); c.width = c.height = out
  c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out)
  return new Promise((resolve) => c.toBlob((b) => resolve(b!), 'image/png'))
}

export async function uploadLogo(blob: Blob, userId: string): Promise<string> {
  const path = `${userId}/logos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: 'image/png' })
  if (error) throw new Error(error.message)
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
