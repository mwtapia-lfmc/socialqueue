import { requireUser, signInFirst } from '../../lib/requireUser'
import OpenAI from 'openai'

type GenSize = '1024x1024' | '1536x1024' | '1024x1536'
const DALLE_SIZE: Record<GenSize, '1024x1024' | '1792x1024' | '1024x1792'> = {
  '1024x1024': '1024x1024',
  '1536x1024': '1792x1024',
  '1024x1536': '1024x1792',
}

let modelCache: { at: number; ids: string[] } | null = null
async function listImageModels(openai: OpenAI): Promise<string[]> {
  if (modelCache && Date.now() - modelCache.at < 6 * 3600_000) return modelCache.ids
  const all: string[] = []
  for await (const m of openai.models.list()) all.push(m.id)
  const gpt = all.filter((id) => /^gpt-image/.test(id) && !/mini/.test(id)).sort().reverse()
  const mini = all.filter((id) => /^gpt-image.*mini/.test(id)).sort().reverse()
  const dalle = all.filter((id) => /^dall-e-3/.test(id))
  const ids = [...gpt, ...mini, ...dalle]
  modelCache = { at: Date.now(), ids }
  return ids
}

function placeholderSvg(prompt: string, size: GenSize) {
  const [w, h] = size.split('x').map(Number)
  const text = prompt.replace(/[<>&"]/g, '').slice(0, 60)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="50%" y="48%" fill="white" font-family="sans-serif" font-size="${Math.round(w / 28)}" text-anchor="middle" opacity="0.9">Sample image</text>
  <text x="50%" y="56%" fill="white" font-family="sans-serif" font-size="${Math.round(w / 40)}" text-anchor="middle" opacity="0.75">${text}</text>
  </svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export const maxDuration = 60

export async function POST(request: Request) {
  if (!(await requireUser(request))) return signInFirst()
  try {
    const { prompt, size = '1024x1024' } = (await request.json()) as { prompt: string; size?: GenSize }
    if (!prompt) return Response.json({ error: 'Prompt required' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.includes('YOUR_')) {
      return Response.json({ imageUrl: placeholderSvg(prompt, size), mock: true })
    }

    const openai = new OpenAI({ apiKey })
    // Ask OpenAI which image models this key can use, newest gpt-image first, then DALL·E
    const ids = await listImageModels(openai)
    if (!ids.length) throw new Error('This OpenAI key has no image models available. Check the key\'s project permissions at platform.openai.com.')
    const errors: string[] = []
    for (const model of ids) {
      try {
        const isDalle = model.startsWith('dall-e')
        const r = await openai.images.generate({ model, prompt, n: 1, size: (isDalle ? DALLE_SIZE[size] : size) as any })
        const d = r.data?.[0]
        if (d?.b64_json) return Response.json({ imageUrl: `data:image/png;base64,${d.b64_json}`, model })
        if (d?.url) {
          const img = await fetch(d.url)
          const b64 = Buffer.from(await img.arrayBuffer()).toString('base64')
          return Response.json({ imageUrl: `data:${img.headers.get('content-type') || 'image/png'};base64,${b64}`, model })
        }
        errors.push(`${model}: no image returned`)
      } catch (e) { errors.push(`${model}: ${(e as Error).message}`) }
    }
    throw new Error(errors.join(' | '))
  } catch (error) {
    console.error('Image generation error:', error)
    const msg = (error as Error).message || String(error)
    return Response.json({ error: msg.slice(0, 400) }, { status: 500 })
  }
}
