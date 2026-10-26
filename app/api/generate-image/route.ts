import { requireUser, signInFirst } from '../../lib/requireUser'
import OpenAI from 'openai'

type GenSize = '1024x1024' | '1536x1024' | '1024x1536'
const DALLE_SIZE: Record<GenSize, '1024x1024' | '1792x1024' | '1024x1792'> = {
  '1024x1024': '1024x1024',
  '1536x1024': '1792x1024',
  '1024x1536': '1024x1792',
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

export const maxDuration = 60

export async function POST(request: Request) {
  if (!(await requireUser(request))) return signInFirst()
  try {
    const { prompt, size = '1024x1024' } = (await request.json()) as { prompt: string; size?: GenSize }
    if (!prompt) return Response.json({ error: 'Prompt required' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.includes('YOUR_')) {
      // No OpenAI key: use the free Pollinations generator (real image, small corner mark)
      try {
        const [w, h] = size.split('x').map(Number)
        const u = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1500))}?width=${w}&height=${h}&nologo=true&model=flux&seed=${Math.floor(Math.random() * 1e6)}`
        const r = await fetch(u, { signal: AbortSignal.timeout(55000) })
        if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) throw new Error(`generator said ${r.status}`)
        const b64 = Buffer.from(await r.arrayBuffer()).toString('base64')
        return Response.json({ imageUrl: `data:${r.headers.get('content-type')};base64,${b64}`, free: true })
      } catch (e) {
        console.warn('free generator failed:', (e as Error).message)
        return Response.json({ imageUrl: placeholderSvg(prompt, size), mock: true })
      }
    }

    const openai = new OpenAI({ apiKey })
    try {
      const r = await openai.images.generate({ model: 'gpt-image-1', prompt, n: 1, size })
      const b64 = r.data?.[0]?.b64_json
      if (!b64) throw new Error('No image returned')
      return Response.json({ imageUrl: `data:image/png;base64,${b64}` })
    } catch (primaryErr) {
      console.warn('gpt-image-1 failed, falling back to dall-e-3:', (primaryErr as Error).message)
      const first = (primaryErr as Error).message
      try {
      const r = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: DALLE_SIZE[size],
        response_format: 'b64_json',
      })
      const b64 = r.data?.[0]?.b64_json
      if (!b64) throw new Error('No image returned')
      return Response.json({ imageUrl: `data:image/png;base64,${b64}` })
      } catch (secondErr) {
        throw new Error(`gpt-image-1: ${first} | dall-e-3: ${(secondErr as Error).message}`)
      }
    }
  } catch (error) {
    console.error('Image generation error:', error)
    const msg = (error as Error).message || String(error)
    return Response.json({ error: msg.slice(0, 400) }, { status: 500 })
  }
}
