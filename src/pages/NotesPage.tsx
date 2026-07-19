import { useEffect, useState } from 'react'
import { useAppSetting } from '@/hooks/useData'
import { Save, StickyNote } from 'lucide-react'

export default function NotesPage() {
  const { value: savedNotes, isLoading, saveSetting } = useAppSetting<string>('roster_notes', '')
  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!isLoading) setText(savedNotes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  const handleSave = () => {
    saveSetting.mutate(text)
    setDirty(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Notes
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">
          Shared scratchpad for anything worth remembering about this month's roster
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#c9d8d1] p-5">
        <div className="flex items-center gap-2 mb-3 text-[#5c6f6a]">
          <StickyNote className="w-4 h-4" />
          <span className="text-xs">Visible to everyone who logs in</span>
        </div>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setDirty(true) }}
          placeholder="e.g. Dr. Karim covering for Dr. Rahim's Cath duties until the 20th..."
          rows={14}
          className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c] resize-y"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-[#5c6f6a]">
            {dirty ? 'Unsaved changes' : saveSetting.isSuccess ? 'Saved' : ''}
          </span>
          <button
            onClick={handleSave}
            disabled={!dirty || saveSetting.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveSetting.isPending ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  )
}
