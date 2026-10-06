import { beginOAuth, userFromJwt } from '../../../lib/oauth'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const jwt = url.searchParams.get('jwt')
  if (!jwt) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const { user } = await userFromJwt(request, jwt)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId || clientId.includes('YOUR_')) return Response.redirect(`${url.origin}/?connect_error=${encodeURIComponent('LinkedIn client ID not configured on the server yet')}`, 302)

  const auth = new URL('https://www.linkedin.com/oauth/v2/authorization')
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('client_id', clientId)
  auth.searchParams.set('redirect_uri', `${url.origin}/api/auth/linkedin/callback`)
  auth.searchParams.set('scope', 'openid profile w_member_social')
  return beginOAuth(auth.toString(), jwt)
}
