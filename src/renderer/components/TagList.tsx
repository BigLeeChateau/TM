import { useState } from 'react'
import { useStore } from '../store'

function formatHours(totalSeconds: number): string {
  const hours = (totalSeconds / 3600).toFixed(1)
  return `${hours}h`
}

export function TagList() {
  const { tags, selectedTagId, setSelectedTag, createTag, tagTimeSummaries } = useStore()
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createTag({ name: newName.trim() })
    setNewName('')
    setIsAdding(false)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-3 py-2 text-[11px] font-medium text-[#87867f] uppercase tracking-[0.5px]">
        Tags
      </div>
      <div className="space-y-0.5 px-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => setSelectedTag(tag.id === selectedTagId ? null : tag.id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left ${
              tag.id === selectedTagId
                ? 'bg-[#f5f4ed] text-[#141413] font-medium'
                : 'text-[#4d4c48] hover:bg-[#f5f4ed]'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="truncate flex-1">{tag.name}</span>
            {tagTimeSummaries[tag.id] > 0 && (
              <span className="text-xs text-[#b0aea5] flex-shrink-0 font-mono tabular-nums">
                {formatHours(tagTimeSummaries[tag.id])}
              </span>
            )}
          </button>
        ))}

        {isAdding ? (
          <div className="px-2 py-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setIsAdding(false)
                  setNewName('')
                }
              }}
              onBlur={() => {
                if (!newName.trim()) {
                  setIsAdding(false)
                }
              }}
              placeholder="Tag name"
              className="w-full px-2 py-1 bg-white border border-[#e8e6dc] rounded-lg text-sm text-[#141413] focus:outline-none focus:border-[#3898ec] placeholder:text-[#b0aea5]"
            />
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#b0aea5] hover:text-[#4d4c48] hover:bg-[#f5f4ed] transition-colors text-left"
          >
            <span className="text-lg leading-none">+</span>
            <span>New Tag</span>
          </button>
        )}
      </div>
    </div>
  )
}
