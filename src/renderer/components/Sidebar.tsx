import { Languages, BookOpen, Star, History, Settings, ChevronLeft, ChevronRight, Mic, SpellCheck } from 'lucide-react'
import { useUIStore, type ActiveView } from '../stores'

interface NavItem {
  id: ActiveView
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { id: 'translate', label: '翻译', icon: Languages },
  { id: 'glossary', label: '术语库', icon: BookOpen },
  { id: 'voice-dictionary', label: '语音词典', icon: SpellCheck },
  { id: 'favorites', label: '收藏夹', icon: Star },
  { id: 'history', label: '翻译历史', icon: History },
  { id: 'speech-optimization', label: '语音优化记录', icon: Mic },
  { id: 'settings', label: '设置', icon: Settings },
]

export function Sidebar() {
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebarCollapsed } = useUIStore()

  return (
    <div
      className={`
        flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transition-all duration-200 ease-in-out
        ${sidebarCollapsed ? 'w-16' : 'w-56'}
      `}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        {!sidebarCollapsed ? (
          <>
            <div className="flex items-center min-w-0">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 shrink-0">
                <Languages size={16} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate ml-2">翻译助手</span>
            </div>
            <button
              onClick={toggleSidebarCollapsed}
              title="收起侧边栏"
              className="shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        ) : (
          <button
            onClick={toggleSidebarCollapsed}
            title="展开侧边栏"
            className="mx-auto p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 py-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id
          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              title={label}
              className={`
                w-full flex items-center transition-colors
                ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-2.5'}
                ${isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-r-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-200'}
              `}
            >
              <Icon size={18} />
              {!sidebarCollapsed && <span className="text-sm">{label}</span>}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
