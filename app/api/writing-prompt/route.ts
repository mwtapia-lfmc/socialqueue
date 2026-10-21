import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  const { format = 'note', trend, series, bucket, tags = [], angle, previous = [], voiceSamples = [] } = await request.json()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 500 })
  try {
    const client = new Anthropic({ apiKey })
    const lines = [
      `Format: ${format === 'longform' ? 'a longform article or video (about 1 per week)' : 'a short Note (a few sentences, quotable, built to be found)'}`,
      series ? `Series: ${series.name}${series.description ? ` — ${series.description}` : ''}` : '',
      bucket ? `Content bucket: ${bucket}` : '',
      tags.length ? `Tags / lenses: ${tags.join(', ')}` : '',
      trend ? `Trending now: ${trend.topic}${trend.summary ? ` — ${trend.summary}` : ''}` : '',
      angle ? `Angle the writer wants: ${angle}` : '',
    ].filter(Boolean).join('\n')
    const prompt = `You are a writing coach for a creator whose voice is real people, folks, void of corporatization, millennial, West Coast. Plain words. No "content journey" language.

Give ONE writing prompt: a specific question, scene or angle they could start writing from right now. One or two sentences, under 45 words. Make it concrete enough to start typing, not a generic topic.

${lines || 'No constraints: surprise them with something fresh about media literacy.'}
${voiceSamples.length ? `\nTheir past posts, for voice:\n${voiceSamples.map((v: string) => `- ${v}`).join('\n')}` : ''}
${previous.length ? `\nDon't repeat these earlier prompts:\n${previous.map((p: string) => `- ${p}`).join('\n')}` : ''}

Return ONLY the prompt text, no quotes or preamble.`
    const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
    const out = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return Response.json({ prompt: out.replace(/^["“]|["”]$/g, '') })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
