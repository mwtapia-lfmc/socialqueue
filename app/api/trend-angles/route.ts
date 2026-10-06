import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  const { topic, detail, platforms = ['threads'], voiceSamples = [] } = await request.json()
  if (!topic) return Response.json({ error: 'Topic required' }, { status: 400 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ angles: [`Hot take on ${topic}`, `What ${topic} says about where things are going`, `The part of ${topic} nobody is talking about`] })
  try {
    const client = new Anthropic({ apiKey })
    const prompt = `A creator wants to post about a trending topic on ${platforms.join(', ')}.

Topic: ${topic}${detail ? `\nContext: ${detail}` : ''}
${voiceSamples.length ? `\nHere are a few of their past posts so you can match their voice:\n${voiceSamples.map((v: string) => `- ${v}`).join('\n')}` : ''}

Write 3 distinct, ready-to-post takes (not outlines) — a hot take, a personal angle, and a useful/insightful one. Each under 270 characters, in the creator's voice, no hashtags, no emojis unless their samples use them. Return ONLY a JSON array of 3 strings.`
    const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const m = text.match(/\[[\s\S]*\]/)
    return Response.json({ angles: m ? JSON.parse(m[0]) : [text] })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
