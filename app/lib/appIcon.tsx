import { ImageResponse } from 'next/og'

export function renderIcon(size: number, maskable = false) {
  const pad = maskable ? size * 0.12 : 0
  const radius = maskable ? 0 : size * 0.22
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: maskable ? 'linear-gradient(135deg, #2563eb, #7c3aed)' : 'transparent' }}>
        <div style={{ width: size - pad * 2, height: size - pad * 2, borderRadius: radius, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 60%, #db2777 100%)', color: 'white', fontSize: size * 0.42, fontWeight: 800, letterSpacing: -size * 0.02, fontFamily: 'sans-serif' }}>
          SQ
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
