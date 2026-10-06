import { renderIcon } from './lib/appIcon'
export const runtime = 'edge'
export const size = { width: 64, height: 64 }
export const contentType = 'image/png'
export default function Icon() { return renderIcon(64) }
