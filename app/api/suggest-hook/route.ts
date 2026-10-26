import Anthropic from '@anthropic-ai/sdk'
import { requireUser, signInFirst } from '../../lib/requireUser'
import { textOf } from '../../lib/ai'
import { HOOK_BEST } from '../../lib/seriesRules'

export async function POST(request: Request) {
  if (!(await requireUser(request))) return signInFirst()
  const { title, content, rules } = await request.json()
  if (!content?.trim()) return Response.json({ error: 'Write something first' }, { status: 400 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 500 })
  try {
    const client = new Anthropic({ apiKey })
    const prompt = `Find the 3 best "hook" lines in this piece: the lines a reader would screenshot, quote or share. Punchy, opinionated, specific, able to stand alone without context.

What makes a good hook:
${HOOK_BEST}
${rules ? `This series' own hook rules (these win if they conflict):\n${rules}\n` : ''}
RULES: Quote the writer's OWN words exactly as written. Don't rewrite, polish or invent. You may trim a sentence to its strongest part, but every word must appear in the text in that order. Each under 280 characters.

${title ? `Title: ${title}\n` : ''}"""
${String(content).slice(0, 20000)}
"""

Return ONLY JSON: {"hooks":[{"line":"...","why":"a few words on why it works"}]} with the strongest first.`
    for (let attempt = 0; attempt < 2; attempt++) {
      const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
      const m = textOf(msg).match(/\{[\s\S]*\}/)
      try {
        const hooks = (JSON.parse(m?.[0] || '{}').hooks || []).filter((h: any) => h?.line)
        if (hooks.length) return Response.json({ hooks })
      } catch {}
    }
    throw new Error('No hooks came back. Try again.')
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
