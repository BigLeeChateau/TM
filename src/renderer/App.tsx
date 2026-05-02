import { useEffect } from 'react'
import { useStore } from './store'
import { useTranslation, LANGUAGE_LABELS } from './i18n'
import { TagList } from './components/TagList'
import { TaskList } from './components/TaskList'
import { TimeCanvas } from './components/TimeCanvas'
import { TaskModal } from './components/TaskModal'
import { Onboarding } from './components/Onboarding'

export default function App() {
  const { view, setView, loadTags, loadSecondaryTags, loadTasks, editingTaskId, setEditingTaskId, tasks } = useStore()
  const { t, language, setLanguage } = useTranslation()

  useEffect(() => {
    loadTags()
    loadSecondaryTags()
    loadTasks()
  }, [])

  return (
    <div className="flex h-full bg-[#f5f4ed] text-[#141413]">
      {/* Left sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-[#f0eee6] flex flex-col bg-[#faf9f5]">
        <div className="p-4 border-b border-[#f0eee6]">
          <h1 className="font-[Georgia] text-[28px] font-medium text-[#141413]">TM</h1>
        </div>
        <TagList />
        <div className="border-t border-[#f0eee6]" />
        <TaskList />
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-[#f0eee6] flex items-center px-4 gap-4 bg-[#faf9f5]">
          <nav className="flex gap-1">
            {(['canvas', 'list', 'dashboard'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                  view === v
                    ? 'bg-[#141413] text-[#faf9f5]'
                    : 'text-[#5e5d59] hover:text-[#141413] hover:bg-[#f5f4ed]'
                }`}
              >
                {t(v)}
              </button>
            ))}
          </nav>
          <div className="flex-1" />
          <button
            onClick={async () => {
              const data = await window.electronAPI.exportData()
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `tm-export-${new Date().toISOString().split('T')[0]}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="px-3 py-1.5 text-sm text-[#5e5d59] hover:text-[#141413] hover:bg-[#f5f4ed] border border-[#e8e6dc] rounded-lg transition-colors"
          >
            {t('exportJSON')}
          </button>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
            className="px-2 py-1.5 text-xs rounded-lg border border-[#e8e6dc] bg-white text-[#141413] focus:outline-none focus:border-[#3898ec] cursor-pointer"
          >
            {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder={t('search')}
            className="w-48 px-3 py-1.5 bg-white border border-[#e8e6dc] rounded-xl text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#9a9890]"
          />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === 'canvas' && <TimeCanvas />}
          {view === 'list' && <ListView />}
          {view === 'dashboard' && <DashboardView />}
        </div>
      </main>

      <TaskModal
        taskId={editingTaskId}
        onClose={() => setEditingTaskId(null)}
      />

      {tasks.length === 0 && <Onboarding />}
    </div>
  )
}

function ListView() {
  const { tasks, tags } = useStore()
  const getTagName = (tid: number | null) =>
    tags.find((t) => t.id === tid)?.name || 'Other'

  const { t } = useTranslation()

  return (
    <div className="p-4 overflow-auto h-full">
      <h2 className="text-lg font-medium mb-4">{t('allTasks')}</h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-[#f0eee6]"
          >
            <StatusBadge status={task.status} />
            <span className="flex-1">{task.title}</span>
            <span className="text-xs text-[#87867f]">{getTagName(task.major_tag_id)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardView() {
  const { tasks, tags } = useStore()
  const { t } = useTranslation()
  const doneCount = tasks.filter((t) => t.status === 'done').length
  const totalCount = tasks.length

  return (
    <div className="p-4 overflow-auto h-full">
      <h2 className="text-lg font-medium mb-4">{t('dashboard')}</h2>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('tags')} value={tags.length} />
        <StatCard label={t('totalTasks')} value={totalCount} />
        <StatCard label={t('done')} value={doneCount} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-[#f0eee6] rounded-lg p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-[#87867f]">{label}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    inbox: 'bg-[#b0aea5]',
    next: 'bg-[#c96442]',
    waiting: 'bg-[#d97757]',
    done: 'bg-[#4d4c48]',
  }
  return (
    <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-[#5e5d59]'}`} />
  )
}
