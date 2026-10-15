import type { SupabaseClient } from '@supabase/supabase-js'

export interface ConnectionRow { user_id: string; platform: string; handle: string; account_id: string | null; credentials: Record<string, unknown> }

// Matches on (user, platform, account) so reconnecting the same account refreshes it and a different
// account is added alongside. Works with the old one-per-platform constraint too: the insert then fails
// and we tell the user to run the multi-account SQL.
export async function saveConnection(db: SupabaseClient, row: ConnectionRow): Promise<{ error?: string }> {
  let q = db.from('connections').select('id').eq('user_id', row.user_id).eq('platform', row.platform)
  q = row.account_id ? q.eq('account_id', row.account_id) : q.eq('handle', row.handle)
  const { data: existing } = await q.maybeSingle()
  if (existing) {
    const { error } = await db.from('connections').update({ handle: row.handle, account_id: row.account_id, credentials: row.credentials }).eq('id', existing.id)
    return error ? { error: error.message } : {}
  }
  const { error } = await db.from('connections').insert(row)
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) return { error: 'Only one account per platform is allowed until the multi-account SQL (MIGRATION.md block 5) is run in Supabase.' }
    return { error: error.message }
  }
  return {}
}
