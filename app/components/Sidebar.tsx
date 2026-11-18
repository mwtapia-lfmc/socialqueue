'use client'

export interface Tab { key: string; label: string; count?: number; group?: string }

interface Props {
  tabs: Tab[]
  view: string
  go: (key: any) => void
  collapsed: boolean
  onToggle: () => void
  user: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null
  onSignOut: () => void
  version?: string
}

// Group accent colors: a thin tinted line and dot per section
const GROUP_COLOR: Record<string, string> = { Gather: '#0ea5e9', Plan: '#8b5cf6', Write: '#2563eb', Publish: '#10b981', Setup: '#9ca3af' }

export default function Sidebar({ tabs, view, go, collapsed, onToggle, user, onSignOut, version }: Props) {
  return (
    <aside className={`hidden md:flex flex-col sticky top-0 h-screen shrink-0 border-r border-white/80 bg-white/70 backdrop-blur-xl transition-[width] duration-200 ${collapsed ? 'w-[76px]' : 'w-[232px]'}`}>
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 h-16`}>
        <button onClick={() => go('home')} className="flex items-center gap-2.5 text-left" aria-label="Home" title="Home">
          <span className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-md shadow-indigo-500/30" style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>SQ</span>
          {!collapsed && <span className="leading-tight"><span className="block text-[15px] font-extrabold tracking-tight text-gray-900">SocialQueue</span><span className="block text-[10px] font-medium text-gray-400">v{version}</span></span>}
        </button>
      </div>

      <nav className="flex-1 px-3 pb-2 overflow-y-auto sq-scroll">
        {tabs.map((t) => {
          const [icon, ...rest] = t.label.split(' ')
          const label = rest.join(' ')
          const active = view === t.key
          const color = t.group ? GROUP_COLOR[t.group] || '#9ca3af' : '#9ca3af'
          return (
            <div key={t.key}>
              {t.group && (collapsed
                ? <div className="mx-3 mt-3 mb-1.5 h-px" style={{ background: `${color}55` }} />
                : <p className="flex items-center gap-1.5 pt-4 pb-1 pl-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{t.group}</p>)}
              <button onClick={() => go(t.key)} title={label}
                className={`sq-tab group relative w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13px] ${collapsed ? 'justify-center' : ''} ${active ? 'text-white font-semibold' : 'text-gray-700 hover:bg-white font-medium'}`}
                style={active ? { background: 'linear-gradient(135deg, #2563eb, #7c3aed)', boxShadow: '0 8px 20px -10px rgba(99,102,241,0.8)' } : undefined}>
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center text-[15px] leading-none shrink-0 ${active ? 'bg-white/20' : 'bg-gray-100/80 group-hover:bg-indigo-50'}`}>{icon}</span>
                {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
                {t.count ? <span className={`text-[10px] font-semibold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ${active ? 'bg-white/25 text-white' : 'bg-indigo-50 text-indigo-700'} ${collapsed ? 'absolute -top-1 -right-0.5' : ''}`}>{t.count}</span> : null}
              </button>
            </div>
          )
        })}
      </nav>

      <div className="px-3 pb-3 pt-2 border-t border-gray-100">
        <div className={`flex items-center gap-2 rounded-xl px-2 py-2 ${collapsed ? 'justify-center' : 'bg-gray-50/80'}`}>
          {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow" /> : <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />}
          {!collapsed && <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate text-gray-900">{user?.user_metadata?.full_name || 'You'}</p><p className="text-[11px] text-gray-500 truncate">{user?.email}</p></div>}
        </div>
        <div className={`flex ${collapsed ? 'flex-col' : ''} gap-1 mt-1`}>
          <button onClick={() => go('help')} title="Help & how-to" className={`rounded-lg px-2.5 py-1.5 text-xs transition ${view === 'help' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-white hover:text-gray-900'}`}>{collapsed ? '?' : '? Help'}</button>
          <button onClick={onSignOut} title="Sign out" className={`rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-white hover:text-gray-900 transition ${collapsed ? '' : 'flex-1 text-left'}`}>{collapsed ? '⎋' : 'Sign out'}</button>
          <button onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'} className="rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-white hover:text-gray-900 transition">{collapsed ? '»' : '«'}</button>
        </div>
      </div>
    </aside>
  )
}
