import { Languages, BookOpen, Settings, SpellCheck } from 'lucide-react'
import { useUIStore, type ActiveView } from '../stores'
import logoUrl from '../assets/logo.png'

interface NavItem {
  id: ActiveView
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { id: 'translate', label: '翻译', icon: Languages },
  { id: 'glossary', label: '术语库', icon: BookOpen },
  { id: 'voice-dictionary', label: '语音词典', icon: SpellCheck },
]

export function Sidebar() {
  const { activeView, setActiveView } = useUIStore()

  return (
    <div className="flex flex-col h-full w-56 bg-stone-50 dark:bg-stone-950 border-r border-stone-200 dark:border-stone-800">
      <div className="flex items-center px-4 py-4">
        <div className="flex items-center min-w-0">
          <img src={logoUrl} alt="翻译助手" className="w-7 h-7 rounded-lg shrink-0" />
          <span className="text-base font-bold text-stone-900 dark:text-stone-100 truncate ml-2">翻译助手</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <NavButton
            key={id}
            id={id}
            label={label}
            Icon={Icon}
            isActive={activeView === id}
            onClick={() => setActiveView(id)}
          />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-stone-200 dark:border-stone-800">
        <NavButton
          id="settings"
          label="设置"
          Icon={Settings}
          isActive={activeView === 'settings'}
          onClick={() => setActiveView('settings')}
        />
      </div>
    </div>
  )
}

interface NavButtonProps {
  id: ActiveView
  label: string
  Icon: React.ElementType
  isActive: boolean
  onClick: () => void
}

function NavButton({ label, Icon, isActive, onClick }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors
        ${isActive
          ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100'
          : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60 hover:text-stone-700 dark:hover:text-stone-200'}
      `}
    >
      <Icon size={18} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
