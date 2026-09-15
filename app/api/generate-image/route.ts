import OpenAI from 'openai'

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.includes('YOUR_')) {
      // Return mock image for demo
      return new Response(
        JSON.stringify({
          imageUrl: 'https://via.placeholder.com/512?text=' + encodeURIComponent(prompt),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    try {
      const openai = new OpenAI({ apiKey })
      const image = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
      })

      const imageUrl = image.data?.[0]?.url
      if (!imageUrl) throw new Error('No image returned')

      return new Response(
        JSON.stringify({ imageUrl }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (openaiError) {
      // Fallback to mock on API error
      return new Response(
        JSON.stringify({
          imageUrl: 'https://via.placeholder.com/512?text=' + encodeURIComponent(prompt),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Image generation error:', error)
    return new Response(JSON.stringify({ error: 'Generation failed' }), { status: 500 })
  }
}
