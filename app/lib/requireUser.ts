import { userClient } from './supabaseServer'

// Every route that spends money (AI, image generation) calls this first.
export async function requireUser(request: Request) {
  const auth = request.headers.get('authorization') || ''
  if (!auth.replace(/^Bearer\s*/i, '').trim()) return null
  const { data } = await userClient(request).auth.getUser()
  return data.user ?? null
}

export const signInFirst = () => Response.json({ error: 'Sign in first' }, { status: 401 })
