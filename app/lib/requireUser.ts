import { createClient } from '@supabase/supabase-js'

// Every route that spends money (AI, image generation) calls this first.
// getUser(token) asks Supabase Auth to validate the browser's JWT.
export async function requireUser(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s*/i, '').trim()
  if (!token) return null
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data, error } = await db.auth.getUser(token)
  return error ? null : data.user ?? null
}

export const signInFirst = () => Response.json({ error: 'Sign in first' }, { status: 401 })
