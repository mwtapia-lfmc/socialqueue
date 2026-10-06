import { userClient } from '../../../lib/supabaseServer'

// Starts the Threads OAuth dance. Carries the user's Supabase JWT in `state`
// so the callback (a plain browser redirect, no auth header) can save the
// connection as the right user.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const jwt = url.searchParams.get('jwt')
  if (!jwt) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const db = userClient(new Request(request.url, { headers: { authorization: `Bearer ${jwt}` } }))
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const appId = process.env.NEXT_PUBLIC_THREADS_APP_ID
  const redirect = `${url.origin}/api/auth/threads/callback`
  const state = Buffer.from(JSON.stringify({ jwt, t: Date.now() })).toString('base64url')
  const auth = new URL('https://threads.net/oauth/authorize')
  auth.searchParams.set('client_id', appId!)
  auth.searchParams.set('redirect_uri', redirect)
  auth.searchParams.set('scope', 'threads_basic,threads_content_publish')
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('state', state)
  return Response.redirect(auth.toString(), 302)
}
