import { requireUser, signInFirst } from '../../lib/requireUser'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  if (!(await requireUser(request))) return signInFirst()
  const { notes = [], existing = [], series = [], trends = [], focus } = await request.json()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 500 })
  try {
    const client = new Anthropic({ apiKey })
    const prompt = `You are an editor for a creator (real people, folks, void of corporatization, millennial, West Coast) writing a Substack about media literacy. Plain words.

${focus ? `They want ideas about: ${focus}\n` : ''}Series: ${series.map((s: any) => `${s.name}${s.description ? ` (${s.description})` : ''}`).join('; ') || 'none'}
${trends.length ? `Trending now: ${trends.join('; ')}\n` : ''}
Their saved notes (their own raw material):
${notes.map((n: any, i: number) => `[N${i}] ${n.title}: ${n.text}`).join('\n') || '(none)'}

Their existing ideas and drafts:
${existing.map((e: any, i: number) => `[E${i}] (${e.where}) ${e.title}${e.text ? `: ${e.text}` : ''}`).join('\n') || '(none)'}

Do two things.
1. "ready": from the existing ideas, drafts and notes above, pick up to 4 that already look strong enough to develop into a piece now. For each give the reference id (like N3 or E2) and one sentence on why it's good.
2. "ideas": suggest 6 NEW article or note ideas that are NOT already covered by the existing list. Ground them in their notes where you can (list note ids in "from"). Each has a short title (under 12 words), "format" ("longform" or "note"), an optional "series" (exactly one of the series names, or null), and "why" (one sentence).

Return ONLY JSON: {"ready":[{"ref":"N3","why":"..."}],"ideas":[{"title":"...","format":"longform","series":null,"why":"...","from":["N1"]}]}`
    const msg = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Could not read the suggestions')
    const j = JSON.parse(m[0])
    const ref = (r: string) => (r?.[0] === 'N' ? notes[+r.slice(1)]?.title : existing[+r.slice(1)]?.title)
    return Response.json({
      ready: (j.ready || []).map((x: any) => ({ title: ref(x.ref), where: x.ref?.[0] === 'N' ? 'note' : existing[+String(x.ref).slice(1)]?.where, why: x.why })).filter((x: any) => x.title),
      ideas: (j.ideas || []).map((x: any) => ({ ...x, from: (x.from || []).map(ref).filter(Boolean) })),
    })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
