import { createHash, randomBytes } from 'crypto'
import { userClient } from './supabaseServer'

export const b64url = (b: Buffer) => b.toString('base64url')
export const pkcePair = () => { const verifier = b64url(randomBytes(32)); return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) } }
export const encodeState = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
export const decodeState = <T = any>(s: string): T | null => { try { return JSON.parse(Buffer.from(s, 'base64url').toString()) } catch { return null } }

export async function userFromJwt(request: Request, jwt: string) {
  const db = userClient(new Request(request.url, { headers: { authorization: `Bearer ${jwt}` } }))
  const { data: { user } } = await db.auth.getUser()
  return { db, user }
}

export const back = (origin: string, q: string) => Response.redirect(`${origin}/?${q}`, 302)
export const fail = (origin: string, msg: string) => back(origin, `connect_error=${encodeURIComponent(msg)}`)

export function readCookie(request: Request, name: string) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

// Keep the user's JWT in an httpOnly cookie during the OAuth round-trip (providers cap `state` size)
export function beginOAuth(location: string, jwt: string, extra: Record<string, string> = {}) {
  const nonce = b64url(randomBytes(16))
  const cookies = [`sq_oauth_jwt=${encodeURIComponent(jwt)}`, `sq_oauth_state=${nonce}`, ...Object.entries(extra).map(([k, v]) => `${k}=${v}`)]
    .map((c) => `${c}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)
  const url = new URL(location); url.searchParams.set('state', nonce)
  const headers = new Headers({ Location: url.toString() })
  cookies.forEach((c) => headers.append('Set-Cookie', c))
  return new Response(null, { status: 302, headers })
}

export function finishOAuth(request: Request, state: string | null) {
  const jwt = readCookie(request, 'sq_oauth_jwt'); const expected = readCookie(request, 'sq_oauth_state')
  if (!jwt || !expected || state !== expected) return null
  return jwt
}

export const clearOAuthCookies = ['sq_oauth_jwt', 'sq_oauth_state', 'sq_x_verifier'].map((n) => `${n}=; Path=/; Max-Age=0`)

export function redirectClearing(location: string) {
  const headers = new Headers({ Location: location })
  clearOAuthCookies.forEach((c) => headers.append('Set-Cookie', c))
  return new Response(null, { status: 302, headers })
}
