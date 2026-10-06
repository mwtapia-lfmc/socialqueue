import Anthropic from '@anthropic-ai/sdk'

const TONE_GUIDE: Record<string, string> = {
  casual: 'relaxed, conversational, like texting a smart friend; contractions fine; no corporate words',
  professional: 'clear, polished, confident; no slang; short sentences; still human, not stiff',
  funny: 'witty and playful with a light punchline; never mean; keep it quick',
  inspirational: 'warm, encouraging, forward-looking; concrete rather than fluffy; no clichés',
  urgent: 'direct, energetic, action-oriented; lead with the point; one clear call to action',
}

export async function POST(request: Request) {
  const { text, tone = 'casual', kind = 'post', limit } = await request.json()
  if (!text?.trim()) return Response.json({ error: 'Nothing to rewrite' }, { status: 400 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 500 })
  try {
    const client = new Anthropic({ apiKey })
    const prompt = `Rewrite this ${kind} in a ${tone} tone: ${TONE_GUIDE[tone] || tone}.

Keep the meaning, facts, names, links, and any hashtags exactly. Keep roughly the same length${limit ? ` and stay under ${limit} characters` : ''}. Preserve line breaks and any **bold** / _italic_ markers. Do not add emojis unless the original has them. Return ONLY the rewritten text — no preamble, no quotes.

Text:
${text}`
    const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
    const out = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return Response.json({ text: out.replace(/^["“]|["”]$/g, '') })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
