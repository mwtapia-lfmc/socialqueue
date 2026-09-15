import OpenAI, { toFile } from 'openai'

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const image = form.get('image')
    const prompt = String(form.get('prompt') || '')
    const size = String(form.get('size') || '1024x1024') as '1024x1024' | '1536x1024' | '1024x1536'

    if (!(image instanceof File) || !prompt) {
      return Response.json({ error: 'Image and prompt required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    const buf = Buffer.from(await image.arrayBuffer())

    if (!apiKey || apiKey.includes('YOUR_')) {
      return Response.json({
        imageUrl: `data:${image.type || 'image/png'};base64,${buf.toString('base64')}`,
        mock: true,
      })
    }

    const openai = new OpenAI({ apiKey })
    const r = await openai.images.edit({
      model: 'gpt-image-1',
      image: await toFile(buf, 'image.png', { type: image.type || 'image/png' }),
      prompt,
      size,
    })
    const b64 = r.data?.[0]?.b64_json
    if (!b64) throw new Error('No image returned')
    return Response.json({ imageUrl: `data:image/png;base64,${b64}` })
  } catch (error) {
    console.error('Image edit error:', error)
    return Response.json({ error: 'Edit failed', details: String(error) }, { status: 500 })
  }
}
