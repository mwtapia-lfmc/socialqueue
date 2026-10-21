import { requireUser, signInFirst } from '../../lib/requireUser'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  if (!(await requireUser(request))) return signInFirst()
  const { title, text, kind = 'longform' } = await request.json()
  if (!text?.trim()) return Response.json({ error: 'Nothing to grade yet' }, { status: 400 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 500 })
  try {
    const client = new Anthropic({ apiKey })
    const prompt = `You are a tough but fair editor grading a ${kind === 'longform' ? 'Substack essay' : 'short post'} by a creator whose voice is real, plain, millennial, West Coast, anti-corporate. Grade it on: hook, clarity, structure and flow, voice, specificity (concrete examples over abstractions), and ending.

${title ? `Title: ${title}\n` : ''}
"""
${text.slice(0, 24000)}
"""

STRICT RULES: Do NOT rewrite, fix or paraphrase any of their sentences. Do not supply replacement wording. Notes point at what's working or not and why, and may quote a few words from the draft to show where. The writer will do the fixing.

Return ONLY JSON: {"grade":"B+","score":0-100,"summary":"two sentences","strengths":["..."],"notes":[{"area":"Hook|Clarity|Structure|Voice|Specificity|Ending|Other","note":"what's weak and why, plus a question or direction to think about"}]}
Give 2-3 strengths and 3-6 notes, most important first.`
    const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
    const out = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const m = out.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Could not read the grade')
    return Response.json(JSON.parse(m[0]))
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
