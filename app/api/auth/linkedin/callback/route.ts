import { fail, finishOAuth, redirectClearing, userFromJwt } from '../../../../lib/oauth'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code'); const state = url.searchParams.get('state')
  const err = url.searchParams.get('error_description') || url.searchParams.get('error')
  if (err) return fail(url.origin, err)
  if (!code || !state) return fail(url.origin, 'Missing code')
  const jwt = finishOAuth(request, state); if (!jwt) return fail(url.origin, 'Login session expired — try Connect again')
  const { db, user } = await userFromJwt(request, jwt); if (!user) return fail(url.origin, 'Session expired, sign in again')

  const tokRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: `${url.origin}/api/auth/linkedin/callback`, client_id: process.env.LINKEDIN_CLIENT_ID!, client_secret: process.env.LINKEDIN_CLIENT_SECRET || '' }),
  })
  const tok = await tokRes.json()
  if (!tok.access_token) return fail(url.origin, tok.error_description || tok.error || 'LinkedIn token exchange failed')

  const me = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json())
  if (!me.sub) return fail(url.origin, 'Could not read LinkedIn profile')

  const { error } = await db.from('connections').upsert({
    user_id: user.id, platform: 'linkedin', handle: (me.name || 'linkedin').replace(/\s+/g, '').toLowerCase(), account_id: me.sub,
    credentials: { accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt: new Date(Date.now() + (tok.expires_in || 5184000) * 1000).toISOString(), avatar: me.picture, displayName: me.name, profileAt: new Date().toISOString() },
  }, { onConflict: 'user_id,platform' })
  if (error) return fail(url.origin, error.message)
  return redirectClearing(`${url.origin}/?connected=linkedin`)
}
