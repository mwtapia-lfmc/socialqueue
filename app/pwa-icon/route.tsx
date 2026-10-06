import { renderIcon } from '../lib/appIcon'

export const runtime = 'edge'

export function GET(request: Request) {
  const u = new URL(request.url)
  const s = Math.min(1024, Math.max(48, Number(u.searchParams.get('s')) || 512))
  return renderIcon(s, u.searchParams.get('maskable') === '1')
}
