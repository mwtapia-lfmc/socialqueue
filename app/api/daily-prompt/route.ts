import Anthropic from '@anthropic-ai/sdk'
import { requireUser, signInFirst } from '../../lib/requireUser'
import { loadHeadlines } from '../../lib/breaking'

export const maxDuration = 60

type T = { topic: string; url?: string; source?: string }
const VOICE = 'real people, folks, void of corporatization, millennial, West Coast. Plain words. No "content journey" language.'

const parse = (text: string) => { const m = text.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null } catch { return null } }
const textOf = (msg: any) => (msg.content as any[]).filter((b) => b.type === 'text').map((b) => b.text).join('\n')

export async function POST(request: Request) {
  if (!(await requireUser(request))) return signInFirst()
  const { weekday, series, industry = [], trends = [], previous = [], allowWeb = true } = await request.json()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 500 })
  const client = new Anthropic({ apiKey })
  const headlines: T[] = (await loadHeadlines().catch(() => [])).slice(0, 30).map((h) => ({ topic: h.title, url: h.url, source: h.source }))
  const pool: T[] = [...headlines, ...(trends as T[])].slice(0, 70)
  const seriesLine = series ? `Today's series: ${series.name}${series.description ? ` (${series.description})` : ''}.` : "Today is an open day with no series, so any of their topics works."
  const avoid = previous.length ? `\nDon't repeat these earlier prompts:\n${previous.map((p: string) => `- ${p}`).join('\n')}` : ''
  const ask = `Write ONE writing prompt: a specific question, scene or angle they could start writing from right now, tied to that trend and to today's series. One or two sentences, under 45 words.`

  try {
    // 1) Free feeds first
    const first = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 400, messages: [{ role: 'user', content:
`You're a writing coach for a creator whose voice is ${VOICE} Their beat: ${industry.join(', ')}. It's ${weekday}. ${seriesLine}

Here's what's trending today (news, search, social):
${pool.map((t, i) => `[${i}] ${t.topic}${t.source ? ` (${t.source})` : ''}`).join('\n')}

Pick the ONE item most genuinely relevant to their beat and today's series. If nothing is genuinely relevant, say so. Don't force it.
${ask}${avoid}
Return ONLY JSON: {"relevant":true,"pick":3,"why":"one short line on why this fits","prompt":"..."} or {"relevant":false}` }] })
    const a = parse(textOf(first))
    if (a?.relevant && pool[a.pick]) return Response.json({ prompt: a.prompt, why: a.why, trend: pool[a.pick], via: 'feeds' })

    // 2) Live web search as a fallback
    if (allowWeb) {
      try {
        const web = await (client.messages as any).create({ model: 'claude-sonnet-5', max_tokens: 1200,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
          messages: [{ role: 'user', content:
`You're a writing coach for a creator whose voice is ${VOICE} Their beat: ${industry.join(', ')}. It's ${weekday}. ${seriesLine}
Search the web for ONE thing that is trending or in the news in the last two days that fits their beat and today's series.
${ask}${avoid}
Return ONLY JSON: {"topic":"...","url":"https://...","why":"one short line","prompt":"..."}` }] })
        const b = parse(textOf(web))
        if (b?.prompt) return Response.json({ prompt: b.prompt, why: b.why, trend: b.topic ? { topic: b.topic, url: b.url, source: 'web search' } : null, via: 'web' })
      } catch { /* web search not enabled or failed: fall through */ }
    }

    // 3) No trend fits: a plain prompt for the series
    const plain = await client.messages.create({ model: 'claude-sonnet-5', max_tokens: 200, messages: [{ role: 'user', content:
`You're a writing coach for a creator whose voice is ${VOICE} Their beat: ${industry.join(', ')}. It's ${weekday}. ${seriesLine}
Write ONE writing prompt: a specific question, scene or angle they could start writing from right now. One or two sentences, under 45 words.${avoid}
Return ONLY the prompt text.` }] })
    return Response.json({ prompt: textOf(plain).trim().replace(/^["“]|["”]$/g, ''), trend: null, via: 'none' })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
