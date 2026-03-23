import { useState } from 'react'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'

import { useSchedule } from '../contexts/ScheduleContext'
import Card from './ui/Card'

export default function MemberNotesCard({ member, memberNotes, addMemberNote, deleteMemberNote, attendance, services }) {
  const [newNoteText, setNewNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const { classes: scheduleClasses, events: scheduleEvents } = useSchedule()

  const profileNotes = memberNotes
    .filter(n => n.memberId === member.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // Session notes from attendance records
  const sessionNotes = (attendance ?? [])
    .filter(a => a.memberId === member.id && a.note)
    .map(a => {
      // Resolve source label and color from classId
      let source, sourceColor

      let sourceType = 'service' // 'event' | 'class' | 'service'

      if (a.classId) {
        const linkedEvent = (scheduleEvents ?? []).find(ev => ev.id === a.classId)
        if (linkedEvent) {
          source      = linkedEvent.title   // icon added by badge; no ★ in the string
          sourceColor = linkedEvent.color ?? '#f59e0b'
          sourceType  = 'event'
        } else {
          const linkedClass = (scheduleClasses ?? []).find(cls => cls.id === a.classId)
          if (linkedClass) {
            const svcIds = linkedClass.serviceIds ?? (linkedClass.serviceId ? [linkedClass.serviceId] : [])
            const svcNames = svcIds
              .map(sid => services?.find(s => s.id === sid)?.name ?? sid)
              .filter(Boolean)
            const titlePart = linkedClass.title || svcNames.join(' · ') || a.sessionType
            const svcPart   = linkedClass.title && svcNames.length > 0 ? ` · ${svcNames.join(' · ')}` : ''
            source      = `${titlePart}${svcPart}`
            const firstSvc = svcIds.length > 0 ? services?.find(s => s.id === svcIds[0]) : null
            sourceColor = firstSvc?.color ?? '#94a3b8'
            sourceType  = 'class'
          }
        }
      }

      // Fall back to sessionType service
      if (!source) {
        const svc = services?.find(s => s.id === a.sessionType)
        source      = svc?.name ?? a.sessionType
        sourceColor = svc?.color ?? '#94a3b8'
        sourceType  = 'service'
      }

      return {
        id: `session_${a.id}`,
        type: 'session',
        sourceType,
        text: a.note,
        source,
        sourceColor,
        date: new Date(a.date),
        sessionDate: a.date,
      }
    })
    .sort((a, b) => b.date - a.date)

  // Combined unified timeline
  const allNotes = [
    ...profileNotes.map(n => ({
      id: n.id,
      type: 'profile',
      sourceType: 'profile',
      text: n.text,
      source: 'Profile Note',
      sourceColor: '#6366f1',
      date: n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt),
      originalNote: n,
    })),
    ...sessionNotes,
  ].sort((a, b) => b.date - a.date)

  const INITIAL_SHOW = 5
  const visibleNotes = showAll ? allNotes : allNotes.slice(0, INITIAL_SHOW)

  async function handleAdd() {
    const text = newNoteText.trim()
    if (!text) return
    setSaving(true)
    try {
      await addMemberNote(member.id, text)
      setNewNoteText('')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Notes & Activity Log</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {profileNotes.length} profile note{profileNotes.length !== 1 ? 's' : ''} · {sessionNotes.length} session note{sessionNotes.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Add note input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newNoteText}
          onChange={e => setNewNoteText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a profile note..."
          className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-primary-400 transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newNoteText.trim()}
          className="px-3 py-2 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>

      {allNotes.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No notes yet. Add profile notes above or log session notes in the Activity tab.</p>
      ) : (
        <div className="space-y-2">
          {visibleNotes.map(note => (
            <div key={note.id} className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl group">
              {/* Source badge */}
              <div className="shrink-0 mt-0.5">
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    background: note.sourceColor + '18',
                    color: note.sourceColor,
                  }}
                >
                  {note.sourceType === 'event' ? '★' : note.sourceType === 'class' ? '◈' : note.type === 'session' ? '◆' : '●'}{' '}{note.source}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 leading-relaxed">{note.text}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {format(note.date, 'd MMM yyyy')}
                  {note.type === 'session' && (
                    <span className="ml-1 text-gray-300">· Session log</span>
                  )}
                </p>
              </div>
              {note.type === 'profile' && (
                <button
                  onClick={() => deleteMemberNote(note.originalNote.id)}
                  className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded shrink-0"
                  title="Delete note"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          {allNotes.length > INITIAL_SHOW && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="w-full text-xs text-primary-600 hover:text-primary-700 font-medium py-2 transition-colors"
            >
              {showAll ? '↑ Show less' : `↓ Show ${allNotes.length - INITIAL_SHOW} more`}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
