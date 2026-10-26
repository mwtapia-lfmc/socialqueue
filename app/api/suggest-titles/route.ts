import { textOf } from '../../lib/ai'
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
    // Claude sometimes wraps the list or adds a sentence; accept any of those shapes, and retry once
    const read = (t: string): { title: string; style: string }[] => {
      const arr = t.match(/\[[\s\S]*\]/)
      if (arr) { try { const j = JSON.parse(arr[0]); if (Array.isArray(j)) return j.map((x: any) => (typeof x === 'string' ? { title: x, style: '' } : { title: String(x.title || ''), style: String(x.style || '') })).filter((x) => x.title) } catch {} }
      const obj = t.match(/\{[\s\S]*\}/)
      if (obj) { try { const j = JSON.parse(obj[0]); if (Array.isArray(j.titles)) return read(JSON.stringify(j.titles)) } catch {} }
      return t.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["“]|["”]$/g, '').trim()).filter((l) => l && l.length < 120 && !/^(here|sure|titles?)\b/i.test(l)).slice(0, 6).map((title) => ({ title, style: '' }))
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
      const titles = read(textOf(msg))
      if (titles.length) return Response.json({ titles })
    }
    throw new Error('Claude did not return any titles. Try again.')
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
