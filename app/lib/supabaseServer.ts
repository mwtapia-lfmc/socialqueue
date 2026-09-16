import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Acts as the signed-in user (RLS applies) using the JWT the browser sends
export function userClient(request: Request) {
  const auth = request.headers.get('authorization') || ''
  return createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
}

export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  return createClient(url, key, { auth: { persistSession: false } })
}
