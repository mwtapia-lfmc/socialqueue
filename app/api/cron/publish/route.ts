import { serviceClient } from '../../../lib/supabaseServer'
import { publishItem } from '../../../lib/publish'

function nowIn(tz: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date()).reduce((a, p) => ({ ...a, [p.type]: p.value }), {} as Record<string, string>)
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}` }
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()
  const { date, time } = nowIn(process.env.DEFAULT_TZ || 'America/Los_Angeles')
  const { data: due, error } = await db
    .from('items')
    .select('*')
    .eq('status', 'scheduled')
    .eq('kind', 'post')
    .or(`schedule_date.lt.${date},and(schedule_date.eq.${date},schedule_time.lte.${time})`)
    .limit(20)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const results = []
  for (const item of due || []) results.push({ id: item.id, ...(await publishItem(db, item)) })
  return Response.json({ checked: `${date} ${time}`, published: results })
}
