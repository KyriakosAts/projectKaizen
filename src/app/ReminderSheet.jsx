import { useState } from 'react'
import { MessageCircle, MessageSquare, Phone } from 'lucide-react'
import { useData } from '../data/DataContext.jsx'
import { backend } from '../data/backend.js'
import { enrollmentStatus } from '../data/model.js'
import { reminderLinks, reminderText } from '../data/reminder.js'
import { copyText } from '../utils/platform.js'
import { Button, ErrorNote, Field, Sheet, toast, useAction } from './ui.jsx'

/** Opens WhatsApp / SMS / Viber with a ready message; Theofilos presses send. */
export default function ReminderSheet({ member, groupId, onClose }) {
  const { groups, payments, settings, today } = useData()
  const group = groups.find(g => g.id === groupId) ?? groups.find(g => g.id === member.enrollments?.[0]?.groupId)
  const enrollment = member.enrollments?.find(e => e.groupId === group?.id)
  const st = enrollment ? enrollmentStatus(payments, member, enrollment, settings, today) : null
  const [text, setText] = useState(() => reminderText(settings.reminderText, {
    member, group, until: st?.until, state: st?.state, gymName: settings.gymName,
  }))
  const links = reminderLinks(member.phone, text)
  const { error, run } = useAction()

  const open = (url, afterText) => run(async () => {
    await backend.openUrl(url)
    if (afterText) toast(afterText)
    onClose()
  })

  return (
    <Sheet title={`Υπενθύμιση · ${member.name}`} onClose={onClose}>
      {!links ? (
        <ErrorNote error="Δεν υπάρχει (σωστό) τηλέφωνο. Πρόσθεσέ το από τα «Στοιχεία» του μέλους." />
      ) : (
        <>
          <Field label="Μήνυμα" hint="Μπορείς να το αλλάξεις εδώ. Το σταθερό κείμενο αλλάζει από τις Ρυθμίσεις.">
            <textarea className="field" rows={4} value={text} onChange={e => setText(e.target.value)} />
          </Field>
          <p className="text-stone-600">Θα ανοίξει η εφαρμογή με το μήνυμα έτοιμο — εσύ πατάς «Αποστολή».</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Button size="lg" variant="pay" icon={MessageCircle} onClick={() => open(links.whatsapp)}>WhatsApp</Button>
            <Button size="lg" variant="primary" icon={MessageSquare} onClick={() => open(links.sms)}>SMS</Button>
            <Button size="lg" icon={Phone} className="!bg-violet-600 !text-white !border-violet-600"
              onClick={() => { copyText(text); open(links.viber, 'Το μήνυμα αντιγράφηκε — στο Viber κάνε «Επικόλληση»') }}>
              Viber
            </Button>
          </div>
        </>
      )}
      <ErrorNote error={error} />
    </Sheet>
  )
}
