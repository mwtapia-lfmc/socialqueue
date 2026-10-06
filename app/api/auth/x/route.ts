import { encodeState, pkcePair, userFromJwt } from '../../../lib/oauth'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const jwt = url.searchParams.get('jwt')
  if (!jwt) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const { user } = await userFromJwt(request, jwt)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const clientId = (process.env.X_CLIENT_ID || process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID)
  if (!clientId || clientId.includes('YOUR_')) return Response.redirect(`${url.origin}/?connect_error=${encodeURIComponent('X client ID not configured on the server yet')}`, 302)

  const { verifier, challenge } = pkcePair()
  const auth = new URL('https://twitter.com/i/oauth2/authorize')
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('client_id', clientId)
  auth.searchParams.set('redirect_uri', `${url.origin}/api/auth/x/callback`)
  auth.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access')
  auth.searchParams.set('state', encodeState({ jwt }))
  auth.searchParams.set('code_challenge', challenge)
  auth.searchParams.set('code_challenge_method', 'S256')
  return new Response(null, {
    status: 302,
    headers: { Location: auth.toString(), 'Set-Cookie': `sq_x_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600` },
  })
}
