import { textOf } from '../../lib/ai'
import { requireUser, signInFirst } from '../../lib/requireUser'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  if (!(await requireUser(request))) return signInFirst()
  const { question, notes = [] } = await request.json()
  if (!question?.trim()) return Response.json({ error: 'Ask something first' }, { status: 400 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 500 })
  try {
    const client = new Anthropic({ apiKey })
    const prompt = `You are searching a writer's personal notes to answer their question. Use ONLY the notes below. If they don't contain the answer, say so plainly and say what's closest. Be direct and brief; plain words. Cite the notes you used by id like [N2].

Question: ${question}

Notes:
${notes.map((n: any, i: number) => `[N${i}] ${n.notebook ? `(${n.notebook}) ` : ''}${n.title}\n${n.text}`).join('\n\n') || '(no notes)'}

Return ONLY JSON: {"answer":"...","used":[0,2]}  where "used" lists the note numbers you relied on.`
    const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 900, messages: [{ role: 'user', content: prompt }] })
    const text = textOf(msg)
    const m = text.match(/\{[\s\S]*\}/)
    const j = m ? JSON.parse(m[0]) : { answer: text, used: [] }
    return Response.json({ answer: String(j.answer || '').replace(/\[N(\d+)\]/g, (_: string, d: string) => `“${notes[+d]?.title ?? 'note'}”`), sources: (j.used || []).map((i: number) => notes[i]?.title).filter(Boolean) })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
