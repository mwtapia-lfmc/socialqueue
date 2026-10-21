import { requireUser, signInFirst } from '../../lib/requireUser'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  if (!(await requireUser(request))) return signInFirst()
  const { title, hook, content, series, tags = [], previous = [] } = await request.json()
  if (!content?.trim() && !title?.trim() && !hook?.trim()) return Response.json({ error: 'Write a little first, or add a hook' }, { status: 400 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 500 })
  try {
    const client = new Anthropic({ apiKey })
    const prompt = `Suggest titles for a Substack article by a creator whose voice is real people, folks, void of corporatization, millennial, West Coast. Plain words, no clickbait formulas, no "Unlocking" or "Ultimate Guide" language, no colon-subtitle unless it earns it.

${title ? `Working title: ${title}\n` : ''}${hook ? `Hook line: ${hook}\n` : ''}${series ? `Series: ${series}\n` : ''}${tags.length ? `Tags: ${tags.join(', ')}\n` : ''}
Article${content?.length > 9000 ? ' (start)' : ''}:
"""
${(content || '').slice(0, 9000)}
"""
${previous.length ? `\nAlready suggested, so give different ones:\n${previous.map((p: string) => `- ${p}`).join('\n')}` : ''}

Give 6 titles, each a different approach: one plain and direct, one a bit funny, one a question, one that makes a claim, one short (under 5 words), one that's intriguing without giving it away. Each under 12 words.
Return ONLY a JSON array of objects: [{"title":"...","style":"plain"}]`
    const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const m = text.match(/\[[\s\S]*\]/)
    if (!m) throw new Error('Could not read the titles')
    return Response.json({ titles: JSON.parse(m[0]) })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
