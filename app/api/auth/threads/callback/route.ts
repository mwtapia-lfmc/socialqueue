import { userClient } from '../../../../lib/supabaseServer'
import { finishOAuth, redirectClearing } from '../../../../lib/oauth'

const back = (origin: string, q: string) => Response.redirect(`${origin}/?${q}`, 302)

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error_description') || url.searchParams.get('error')
  if (err) return back(url.origin, `connect_error=${encodeURIComponent(err)}`)
  if (!code || !state) return back(url.origin, 'connect_error=Missing+code')

  const jwt = finishOAuth(request, state)
  if (!jwt) return back(url.origin, 'connect_error=Login+session+expired+%E2%80%94+try+Connect+again')
  const db = userClient(new Request(request.url, { headers: { authorization: `Bearer ${jwt}` } }))
  const { data: { user } } = await db.auth.getUser()
  if (!user) return back(url.origin, 'connect_error=Session+expired%2C+sign+in+again')

  const appId = process.env.NEXT_PUBLIC_THREADS_APP_ID!
  const secret = process.env.THREADS_APP_SECRET
  if (!secret) return back(url.origin, 'connect_error=THREADS_APP_SECRET+not+configured')
  const redirect = `${url.origin}/api/auth/threads/callback`

  // short-lived token
  const shortRes = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: appId, client_secret: secret, grant_type: 'authorization_code', redirect_uri: redirect, code }),
  })
  const short = await shortRes.json()
  if (!shortRes.ok || !short.access_token) return back(url.origin, `connect_error=${encodeURIComponent(short.error_message || short.error?.message || 'Token exchange failed')}`)

  // exchange for long-lived (60 days, refreshable)
  const longRes = await fetch(`https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${secret}&access_token=${short.access_token}`)
  const long = await longRes.json()
  const token = long.access_token || short.access_token
  const expiresAt = new Date(Date.now() + (long.expires_in || 3600) * 1000).toISOString()

  const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${token}`)
  const me = await meRes.json()
  if (!me.id) return back(url.origin, 'connect_error=Could+not+read+Threads+profile')

  const { error } = await db.from('connections').upsert(
    { user_id: user.id, platform: 'threads', handle: me.username, account_id: me.id, credentials: { accessToken: token, expiresAt } },
    { onConflict: 'user_id,platform' }
  )
  if (error) return back(url.origin, `connect_error=${encodeURIComponent(error.message)}`)
  return redirectClearing(`${url.origin}/?connected=threads`)
}
