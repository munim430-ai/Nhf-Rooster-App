import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useDutyBankHistory } from '@/hooks/useData'
import { monthKeyLabel } from '@/lib/utils'
import { PiggyBank } from 'lucide-react'

export default function DutyBankPage() {
  const { doctors, fridayNightHistory } = useAppStore()
  const { rows, isLoading } = useDutyBankHistory()

  const monthKeys = useMemo(() => {
    const keys = Array.from(new Set((rows || []).map(r => r.month_key)))
    return keys.sort().reverse()
  }, [rows])

  const [selectedMonth, setSelectedMonth] = useState('')
  const activeMonth = selectedMonth || monthKeys[0] || ''

  const monthRows = (rows || [])
    .filter(r => r.month_key === activeMonth)
    .sort((a, b) => b.balance - a.balance)

  const doctorName = (id: string) => doctors.find(d => d.id === id)?.name || 'Unknown doctor'
  const fridayCounts = fridayNightHistory[activeMonth] || {}

  if (!isLoading && monthKeys.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
            Duty Bank
          </h1>
          <p className="text-sm text-[#5c6f6a] mt-1">Carries over- or under-worked duties into next month's targets</p>
        </div>
        <div className="text-center py-16 text-[#5c6f6a]">
          <PiggyBank className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No duty bank history yet. It's created automatically when you save a generated roster.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Duty Bank
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">
          A doctor who worked over target this month gets that many fewer duties expected next month
        </p>
      </div>

      <select
        value={activeMonth}
        onChange={e => setSelectedMonth(e.target.value)}
        className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm mb-4"
      >
        {monthKeys.map(k => <option key={k} value={k}>{monthKeyLabel(k)}</option>)}
      </select>

      <div className="bg-white rounded-xl border border-[#c9d8d1] overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#eef3f0] text-[#5c6f6a] text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Doctor</th>
                <th className="text-right px-4 py-2.5 font-medium">Base Target</th>
                <th className="text-right px-4 py-2.5 font-medium">Effective Target</th>
                <th className="text-right px-4 py-2.5 font-medium">Assigned</th>
                <th className="text-right px-4 py-2.5 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map(r => (
                <tr key={r.doctor_id} className="border-t border-[#eef3f0]">
                  <td className="px-4 py-2.5 font-medium text-[#16221f]">{doctorName(r.doctor_id)}</td>
                  <td className="px-4 py-2.5 text-right text-[#5c6f6a]">{r.base_target}</td>
                  <td className="px-4 py-2.5 text-right text-[#5c6f6a]">{r.effective_target}</td>
                  <td className="px-4 py-2.5 text-right text-[#16221f]">{r.assigned}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={r.balance > 0 ? 'text-[#b5602a] font-semibold' : r.balance < 0 ? 'text-[#a83a2c] font-semibold' : 'text-[#16221f]'}>
                      {r.balance > 0 ? '+' : ''}{r.balance}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-[#16221f] mb-2">Friday Night Duties</h2>
      <p className="text-xs text-[#5c6f6a] mb-3">
        Doctors with 0 Friday nights this month are prioritized for one next month.
      </p>
      <div className="bg-white rounded-xl border border-[#c9d8d1] p-4">
        {Object.keys(fridayCounts).length === 0 ? (
          <p className="text-sm text-[#5c6f6a]">No Friday-night data recorded for this month yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(fridayCounts).map(([id, count]) => (
              <span
                key={id}
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  count === 0 ? 'bg-[#f7dfd9] text-[#a83a2c]' : 'bg-[#eef3f0] text-[#5c6f6a]'
                }`}
              >
                {doctorName(id)}: {count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
