import { userClient } from '../../lib/supabaseServer'
import { publishItem } from '../../lib/publish'

export async function POST(request: Request) {
  const db = userClient(request)
  const { id } = await request.json()
  const { data: item, error } = await db.from('items').select('*').eq('id', id).single()
  if (error || !item) return Response.json({ error: 'Item not found' }, { status: 404 })
  if (item.kind !== 'post') return Response.json({ error: 'Blogs are published manually (copy into Substack)' }, { status: 400 })
  const result = await publishItem(db, item)
  return Response.json(result)
}
