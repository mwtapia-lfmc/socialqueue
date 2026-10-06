import { userClient } from '../../lib/supabaseServer'

// Reports whether the auto-publisher can run: env configured + whether anything is overdue.
export async function GET(request: Request) {
  const db = userClient(request)
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const configured = !!process.env.CRON_SECRET && !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const missing = [!process.env.CRON_SECRET && 'CRON_SECRET', !process.env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean)
  return Response.json({ configured, missing })
}
