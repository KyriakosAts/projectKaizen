import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, Wallet, AlarmClock, UserPlus, TrendingUp, TrendingDown } from 'lucide-react'
import { useData } from '../../data/DataContext.jsx'
import {
  activeByGroup, attentionList, beltDistribution, fmtMoney, joinsAndLeaves, kpis, revenueByMonth,
} from '../../data/model.js'
import { SEMINAR_COLOR } from '../../data/defaults.js'
import { addMonths, fmtDay, fmtMonthLong, fmtMonthShort, monthOf, monthRange } from '../../data/dates.js'
import { Card, PageHeader, cx } from '../ui.jsx'
import { Chip } from './MembersPage.jsx'

const INK_2 = '#57534e'      // secondary text
const GRID = '#e7e5e4'
const AXIS = { fontSize: 13, fill: '#78716c' }

function Tile({ icon: Icon, label, value, sub, subTone }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-stone-500 font-semibold">
        <Icon size={18} /> {label}
      </div>
      <p className="text-3xl font-extrabold tracking-tight mt-2">{value}</p>
      {sub && <p className={cx('text-sm font-semibold mt-1', subTone ?? 'text-stone-500')}>{sub}</p>}
    </Card>
  )
}

function ChartCard({ title, subtitle, legend, children, className }) {
  return (
    <Card className={cx('p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
        </div>
        {legend}
      </div>
      {children}
    </Card>
  )
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600">
          <span className="w-3 h-3 rounded-sm ring-1 ring-black/10" style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  )
}

/** Tooltip body: values in ink, the colored swatch carries identity. */
function TipBox({ active, payload, label, money = true, labels }) {
  if (!active || !payload?.length) return null
  const rows = payload.filter(p => p.value)
  const total = rows.reduce((s, p) => s + p.value, 0)
  return (
    <div className="bg-white rounded-xl shadow-sheet border border-stone-200 px-4 py-3 text-sm min-w-44">
      <p className="font-bold mb-1.5">{labels?.[label] ?? label}</p>
      {rows.map(p => (
        <p key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color ?? p.fill }} />
          <span className="flex-1 text-stone-600">{p.name}</span>
          <span className="font-semibold">{money ? fmtMoney(p.value) : p.value}</span>
        </p>
      ))}
      {money && rows.length > 1 && (
        <p className="flex justify-between border-t border-stone-100 mt-1.5 pt-1.5 font-bold"><span>Σύνολο</span><span>{fmtMoney(total)}</span></p>
      )}
      {rows.length === 0 && <p className="text-stone-500">Καμία κίνηση</p>}
    </div>
  )
}

export default function StatsPage() {
  const { members, payments, seminars, promotions, groups, settings, today } = useData()
  const [range, setRange] = useState(12)
  const [showTable, setShowTable] = useState(false)
  const thisMonth = monthOf(today)
  const months = useMemo(() => monthRange(thisMonth, range), [thisMonth, range])

  const k = useMemo(() => kpis(members, payments, seminars, settings, today), [members, payments, seminars, settings, today])
  const attention = useMemo(() => attentionList(members, payments, settings, today), [members, payments, settings, today])
  const revenue = useMemo(() => revenueByMonth(payments, seminars, months), [payments, seminars, months])
  const flows = useMemo(() => joinsAndLeaves(members, payments, settings, months, today), [members, payments, settings, months, today])
  const perGroup = useMemo(() => activeByGroup(members, payments, groups, settings, today), [members, payments, groups, settings, today])
  const belts = useMemo(() => beltDistribution(members, payments, promotions, groups, settings, today), [members, payments, promotions, groups, settings, today])

  const hasSeminars = revenue.some(r => r.seminars > 0)
  const revData = revenue.map(r => ({
    month: r.month,
    ...Object.fromEntries(groups.map(g => [g.id, r.groups[g.id] ?? 0])),
    seminars: r.seminars,
  }))
  const series = [
    ...groups.map(g => ({ key: g.id, name: g.name, color: g.color })),
    ...(hasSeminars ? [{ key: 'seminars', name: 'Σεμινάρια', color: SEMINAR_COLOR }] : []),
  ]
  const monthLabels = Object.fromEntries(months.map(m => [m, fmtMonthLong(m)]))
  const tick = (m) => fmtMonthShort(m, range > 12 || m.endsWith('-01'))
  const delta = k.revenuePrevMonthToDate ? Math.round(((k.revenueThisMonth - k.revenuePrevMonthToDate) / k.revenuePrevMonthToDate) * 100) : null
  const newThisMonth = flows[flows.length - 1]?.joined ?? 0
  const maxGroup = Math.max(1, ...perGroup.map(g => g.count))

  return (
    <div className="space-y-6">
      <PageHeader title="Στατιστικά" subtitle={`Έως σήμερα, ${fmtMonthLong(thisMonth)}`}>
        {[6, 12, 24].map(n => <Chip key={n} on={range === n} onClick={() => setRange(n)}>{n} μήνες</Chip>)}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile icon={Users} label="Ενεργά μέλη" value={k.active} sub={`${k.paused} σε παύση`} />
        <Tile icon={Wallet} label="Έσοδα μήνα" value={fmtMoney(k.revenueThisMonth)}
          sub={delta == null ? 'από την 1η του μήνα' : (
            <span className="inline-flex items-center gap-1">
              {delta >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {delta >= 0 ? '+' : ''}{delta}% από 1–{fmtDay(addMonths(today, -1))} ({fmtMoney(k.revenuePrevMonthToDate)})
            </span>
          )}
          subTone={delta == null ? undefined : delta >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
        <Tile icon={AlarmClock} label="Έληξαν τώρα" value={attention.expired.length} sub={`${attention.soon.length} λήγουν σύντομα`} />
        <Tile icon={UserPlus} label="Νέα μέλη μήνα" value={newThisMonth} sub="πρώτη πληρωμή αυτόν τον μήνα" />
      </div>

      <ChartCard
        title="Έσοδα ανά μήνα"
        subtitle="Με βάση την ημερομηνία πληρωμής"
        legend={<div className="flex flex-wrap items-center gap-4">
          <Legend items={series.map(s => ({ label: s.name, color: s.color }))} />
          <button type="button" onClick={() => setShowTable(!showTable)} className="text-sm font-semibold text-stone-600 underline h-9">
            {showTable ? 'Γράφημα' : 'Πίνακας'}
          </button>
        </div>}
      >
        {showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-stone-500 border-b border-stone-200">
                <th className="text-left py-2 pr-4">Μήνας</th>
                {series.map(s => <th key={s.key} className="text-right py-2 px-2">{s.name}</th>)}
                <th className="text-right py-2 pl-2">Σύνολο</th>
              </tr></thead>
              <tbody>
                {[...revenue].reverse().map(r => (
                  <tr key={r.month} className="border-b border-stone-100">
                    <td className="py-2 pr-4 font-semibold">{fmtMonthLong(r.month)}</td>
                    {series.map(s => <td key={s.key} className="text-right py-2 px-2">{fmtMoney(s.key === 'seminars' ? r.seminars : r.groups[s.key] ?? 0)}</td>)}
                    <td className="text-right py-2 pl-2 font-bold">{fmtMoney(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="month" tickFormatter={tick} tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={56} tickFormatter={v => `${v} €`} />
                <Tooltip content={<TipBox labels={monthLabels} />} cursor={{ fill: 'rgb(28 25 23 / 0.04)' }} />
                {series.map((s, i) => (
                  <Bar key={s.key} dataKey={s.key} name={s.name} stackId="rev" fill={s.color}
                    stroke="#fff" strokeWidth={2} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Ενεργά μέλη ανά τμήμα" subtitle="Όσοι δεν είναι σε παύση">
          <div className="space-y-4">
            {perGroup.map(({ group, count }) => (
              <div key={group.id}>
                <div className="flex justify-between font-semibold mb-1.5">
                  <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: group.color }} />{group.name}</span>
                  <span>{count}</span>
                </div>
                <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(count / maxGroup) * 100}%`, background: group.color }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Νέοι και όσοι σταμάτησαν"
          subtitle={`«Σταμάτησαν» = πέρασαν σε παύση (${settings.pauseDays} μέρες χωρίς πληρωμή)`}
          legend={<Legend items={[{ label: 'Νέοι', color: '#292524' }, { label: 'Σταμάτησαν', color: '#a8a29e' }]} />}
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="month" tickFormatter={tick} tick={AXIS} axisLine={false} tickLine={false} interval={range > 12 ? 2 : 0} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip content={<TipBox money={false} labels={monthLabels} />} cursor={{ fill: 'rgb(28 25 23 / 0.04)' }} />
                <Bar dataKey="joined" name="Νέοι" fill="#292524" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="left" name="Σταμάτησαν" fill="#a8a29e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {belts.length > 0 && (
        <ChartCard title="Ζώνες" subtitle="Ενεργά μέλη ανά ζώνη">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {belts.map(({ group, counts }) => {
              const total = Object.values(counts).reduce((s, n) => s + n, 0)
              return (
                <div key={group.id}>
                  <p className="font-bold mb-2 inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: group.color }} />{group.name}
                    <span className="text-stone-400 font-semibold">{total}</span>
                  </p>
                  <div className="flex h-6 rounded-lg overflow-hidden bg-stone-100 gap-[2px]">
                    {group.belts.filter(b => counts[b.id]).map(b => (
                      <div key={b.id} title={`${b.name}: ${counts[b.id]}`} className="h-full ring-1 ring-inset ring-black/10"
                        style={{ width: `${(counts[b.id] / total) * 100}%`, background: b.color }} />
                    ))}
                  </div>
                  <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                    {group.belts.map(b => (
                      <li key={b.id} className={cx('flex items-center gap-2 text-sm', !counts[b.id] && 'text-stone-400')}>
                        <span className="w-5 h-2.5 rounded-sm ring-1 ring-black/10" style={{ background: b.color }} />
                        <span className="flex-1" style={{ color: counts[b.id] ? INK_2 : undefined }}>{b.name}</span>
                        <span className="font-semibold">{counts[b.id]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </ChartCard>
      )}
    </div>
  )
}
