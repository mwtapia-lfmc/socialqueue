import Anthropic from '@anthropic-ai/sdk'

const fallbackSplit = (raw: string) => raw.split(/\n\s*\n|^\s*---\s*$/m).map((s) => s.trim()).filter(Boolean)

export async function POST(request: Request) {
  const { raw, tone = 'casual', limit = 280, target } = await request.json()
  if (!raw?.trim()) return Response.json({ error: 'Nothing to split' }, { status: 400 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ posts: fallbackSplit(raw), mock: true })

  try {
    const client = new Anthropic({ apiKey })
    const prompt = `You are helping someone turn a stream-of-consciousness brain dump into individual social media posts.

Brain dump:
"""
${raw}
"""

Rules:
- Split into separate, self-contained posts. ${target ? `Aim for about ${target} posts.` : 'One post per distinct idea.'}
- Keep the author's voice and wording as much as possible; tighten, don't rewrite. Tone: ${tone}.
- Each post must be under ${limit} characters.
- No hashtags unless the author wrote them. No numbering. No emojis the author didn't use.
- Return ONLY a JSON array of strings, nothing else.`
    const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const m = text.match(/\[[\s\S]*\]/)
    const posts = m ? (JSON.parse(m[0]) as string[]).map((s) => String(s).trim()).filter(Boolean) : fallbackSplit(raw)
    return Response.json({ posts })
  } catch (e) {
    console.error('batch-split error:', e)
    return Response.json({ posts: fallbackSplit(raw), mock: true })
  }
}
