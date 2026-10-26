import Anthropic from '@anthropic-ai/sdk'
import { requireUser, signInFirst } from '../../lib/requireUser'
import { textOf } from '../../lib/ai'
import { IMAGE_BEST } from '../../lib/seriesRules'

export async function POST(request: Request) {
  if (!(await requireUser(request))) return signInFirst()
  const { title, hook, content, series, style, shape } = await request.json()
  if (!String(content || '').trim() && !String(title || '').trim()) return Response.json({ error: 'Write something first' }, { status: 400 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 500 })
  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 500, messages: [{ role: 'user', content:
`You are an art director. Read this piece and write ONE prompt for an image generator to make its header image.

${title ? `Title: ${title}\n` : ''}${hook ? `Hook: ${hook}\n` : ''}${series ? `Series: ${series}\n` : ''}"""
${String(content || '').slice(0, 12000)}
"""

Default direction: ${IMAGE_BEST}
${style ? `This series' image style (follow it): ${style}\n` : ''}${shape ? `Shape: ${shape}.\n` : ''}
Capture the piece's central idea or tension through a concrete visual metaphor. Describe subject, setting, composition, mood, color and medium in 60 to 110 words. Never ask for text, captions, logos, or real people's faces.
Return ONLY the prompt.` }] })
    return Response.json({ prompt: textOf(msg).replace(/^["“]|["”]$/g, '') })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
