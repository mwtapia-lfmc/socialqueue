import { back, decodeState, fail, readCookie, userFromJwt } from '../../../../lib/oauth'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code'); const state = url.searchParams.get('state')
  const err = url.searchParams.get('error_description') || url.searchParams.get('error')
  if (err) return fail(url.origin, err)
  if (!code || !state) return fail(url.origin, 'Missing code')
  const st = decodeState<{ jwt: string }>(state); if (!st?.jwt) return fail(url.origin, 'Bad state')
  const verifier = readCookie(request, 'sq_x_verifier'); if (!verifier) return fail(url.origin, 'Login took too long, try again')
  const { db, user } = await userFromJwt(request, st.jwt); if (!user) return fail(url.origin, 'Session expired, sign in again')

  const clientId = (process.env.X_CLIENT_ID || process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID)!, secret = (process.env.X_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET) || ''
  const tokRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(secret ? { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}` } : {}) },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: `${url.origin}/api/auth/x/callback`, code_verifier: verifier, client_id: clientId }),
  })
  const tok = await tokRes.json()
  if (!tok.access_token) return fail(url.origin, tok.error_description || tok.error || 'X token exchange failed')

  const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username', { headers: { Authorization: `Bearer ${tok.access_token}` } })
  const me = (await meRes.json()).data
  if (!me?.id) return fail(url.origin, 'Could not read X profile')

  const { error } = await db.from('connections').upsert({
    user_id: user.id, platform: 'twitter', handle: me.username, account_id: me.id,
    credentials: { accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt: new Date(Date.now() + (tok.expires_in || 7200) * 1000).toISOString(), avatar: me.profile_image_url?.replace('_normal', '_400x400'), displayName: me.name, profileAt: new Date().toISOString() },
  }, { onConflict: 'user_id,platform' })
  if (error) return fail(url.origin, error.message)
  return new Response(null, { status: 302, headers: { Location: `${url.origin}/?connected=twitter`, 'Set-Cookie': 'sq_x_verifier=; Path=/; Max-Age=0' } })
}
