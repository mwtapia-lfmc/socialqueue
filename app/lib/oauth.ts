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
