import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useAuth } from '@/hooks/useAuth'
import { useMakerPasswords } from '@/hooks/useMakerPasswords'
import { useAppSetting, useRestoreBackup, type BackupData } from '@/hooks/useData'
import { Shield, Plus, Trash2, X, Copy, Check, Upload, Download } from 'lucide-react'

interface HospitalConfig {
  name: string
  preparedBy: string
}

export default function SettingsPage() {
  const { doctors, wards, stations, demands, holidays, settings, meta, setSettings, setMeta } = useAppStore()
  const { isMaster } = useAuth()
  const { passwords, createPassword, deactivatePassword, deletePassword } = useMakerPasswords()
  const restoreBackup = useRestoreBackup()
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [restoreMsg, setRestoreMsg] = useState('')

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be chosen again later
    if (!file) return
    setRestoreMsg('')

    let parsed: BackupData
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      setRestoreMsg('Could not read that file — it is not valid JSON.')
      return
    }
    if (!parsed || !Array.isArray(parsed.doctors) || !Array.isArray(parsed.wards)) {
      setRestoreMsg('This file does not look like a roster backup.')
      return
    }

    const stationsObj = parsed.stations
    const stationCount = stationsObj
      ? (['morning', 'evening', 'night'] as const).reduce((n, s) => n + (stationsObj[s]?.length ?? 0), 0)
      : 0
    const ok = window.confirm(
      'Restore this backup?\n\n' +
      'This REPLACES all current data for everyone with:\n' +
      `• ${parsed.doctors.length} doctors\n` +
      `• ${parsed.wards.length} wards\n` +
      `• ${stationCount} stations\n` +
      `• ${parsed.demands?.length ?? 0} demands\n` +
      `• ${parsed.holidays?.length ?? 0} holidays\n\n` +
      'The current data will be permanently deleted. This cannot be undone.'
    )
    if (!ok) return

    setRestoreMsg('Restoring...')
    try {
      const result = await restoreBackup.mutateAsync(parsed)
      if (result.settings) {
        setSettings({
          ...settings,
          hospitalName: result.settings.hospitalName,
          preparedByName: result.settings.preparedByName,
        })
      }
      if (result.meta && result.meta.year && result.meta.month) setMeta(result.meta)
      const c = result.counts
      setRestoreMsg(`Restored ${c.doctors} doctors, ${c.wards} wards, ${c.stations} stations, ${c.demands} demands, ${c.holidays} holidays.`)
    } catch (err) {
      setRestoreMsg(err instanceof Error ? `Restore failed: ${err.message}` : 'Restore failed.')
    }
  }
  const { value: hospitalConfig, isLoading: configLoading, saveSetting: saveHospitalConfig } = useAppSetting<HospitalConfig>(
    'hospital_config',
    { name: settings.hospitalName, preparedBy: settings.preparedByName }
  )

  useEffect(() => {
    if (!configLoading && hospitalConfig) {
      setSettings({ ...settings, hospitalName: hospitalConfig.name, preparedByName: hospitalConfig.preparedBy })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoading])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateLetterhead = (next: { hospitalName: string; preparedByName: string }) => {
    setSettings({ ...settings, ...next })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveHospitalConfig.mutate({ name: next.hospitalName, preparedBy: next.preparedByName })
    }, 600)
  }

  const [showAddMaker, setShowAddMaker] = useState(false)
  const [newMakerPassword, setNewMakerPassword] = useState('')
  const [newMakerLabel, setNewMakerLabel] = useState('')
  const [newMakerExpiry, setNewMakerExpiry] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCreateMaker = async () => {
    if (!newMakerPassword || !newMakerLabel) return
    await createPassword.mutateAsync({
      password: newMakerPassword,
      label: newMakerLabel,
      expires_at: newMakerExpiry || null,
    })
    setShowAddMaker(false)
    setNewMakerPassword('')
    setNewMakerLabel('')
    setNewMakerExpiry('')
  }

  const copyPassword = (password: string, id: string) => {
    navigator.clipboard.writeText(password)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Settings & Backup
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">Manage passwords, letterhead, and data</p>
      </div>

      {/* Master Password Info */}
      <div className="bg-white rounded-xl border border-[#c9d8d1] p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-[#0f6e5c]" />
          <h2 className="text-sm font-semibold text-[#16221f]">Master Password</h2>
        </div>
        <p className="text-sm text-[#5c6f6a] mb-3">
          The master password is set by Dr. Alif and grants full control over the app.
          Current master: <span className="font-mono bg-[#eef3f0] px-2 py-0.5 rounded text-[#0a4f42]">MediCat15@</span>
        </p>
        {isMaster && (
          <div className="text-xs text-[#b5602a] bg-[#f6e3d3] rounded-lg px-3 py-2">
            You are logged in as Master. You can create and manage roster maker passwords below.
          </div>
        )}
      </div>

      {/* Maker Passwords */}
      {isMaster && (
        <div className="bg-white rounded-xl border border-[#c9d8d1] p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#16221f]">Roster Maker Passwords</h2>
            <button
              onClick={() => setShowAddMaker(!showAddMaker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f6e5c] text-white text-xs font-medium hover:bg-[#0a4f42] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Password
            </button>
          </div>

          {showAddMaker && (
            <div className="bg-[#eef3f0] rounded-lg p-4 mb-4 space-y-3">
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-1">Password</label>
                <input
                  type="text"
                  value={newMakerPassword}
                  onChange={e => setNewMakerPassword(e.target.value)}
                  placeholder="e.g. JulySept2026"
                  className="w-full px-3 py-2 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-1">Label (e.g. "July-Sept 2026")</label>
                <input
                  type="text"
                  value={newMakerLabel}
                  onChange={e => setNewMakerLabel(e.target.value)}
                  placeholder="e.g. July-Sept 2026"
                  className="w-full px-3 py-2 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-1">Expires (optional)</label>
                <input
                  type="date"
                  value={newMakerExpiry}
                  onChange={e => setNewMakerExpiry(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateMaker}
                  disabled={!newMakerPassword || !newMakerLabel || createPassword.isPending}
                  className="px-4 py-2 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] disabled:opacity-50"
                >
                  {createPassword.isPending ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => setShowAddMaker(false)}
                  className="px-4 py-2 rounded-lg border border-[#c9d8d1] text-sm hover:bg-[#eef3f0]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Password list */}
          <div className="space-y-2">
            {passwords?.length === 0 && (
              <p className="text-sm text-[#5c6f6a] text-center py-4">No maker passwords yet.</p>
            )}
            {passwords?.map(pw => (
              <div key={pw.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                pw.active ? 'bg-white border-[#c9d8d1]' : 'bg-[#f8f9f7] border-[#e2ece7] opacity-60'
              }`}>
                <div>
                  <div className="text-sm font-medium text-[#16221f]">{pw.label}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-[#eef3f0] px-2 py-0.5 rounded font-mono text-[#0a4f42]">
                      {pw.password_hash}
                    </code>
                    <button
                      onClick={() => copyPassword(pw.password_hash, pw.id)}
                      className="text-[#5c6f6a] hover:text-[#0f6e5c]"
                    >
                      {copiedId === pw.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {pw.expires_at && (
                    <div className="text-xs text-[#5c6f6a] mt-1">
                      Expires: {new Date(pw.expires_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {pw.active ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#dcefe9] text-[#0f6e5c] font-medium">Active</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#f7dfd9] text-[#a83a2c] font-medium">Inactive</span>
                  )}
                  <button
                    onClick={() => deactivatePassword.mutate(pw.id)}
                    disabled={!pw.active}
                    className="p-1.5 rounded-lg text-[#5c6f6a] hover:bg-[#f7dfd9] hover:text-[#a83a2c] disabled:opacity-30"
                    title="Deactivate"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePassword.mutate(pw.id)}
                    className="p-1.5 rounded-lg text-[#5c6f6a] hover:bg-[#f7dfd9] hover:text-[#a83a2c]"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Letterhead */}
      <div className="bg-white rounded-xl border border-[#c9d8d1] p-5 mb-4">
        <h2 className="text-sm font-semibold text-[#16221f] mb-3">Printed Roster Letterhead</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#5c6f6a] mb-1">Hospital / Institute Name</label>
            <input
              type="text"
              value={settings.hospitalName}
              onChange={e => updateLetterhead({ hospitalName: e.target.value, preparedByName: settings.preparedByName })}
              className="w-full px-3 py-2 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#5c6f6a] mb-1">Prepared By (optional)</label>
            <input
              type="text"
              value={settings.preparedByName}
              onChange={e => updateLetterhead({ hospitalName: settings.hospitalName, preparedByName: e.target.value })}
              placeholder="e.g. Dr. Sourav Barman"
              className="w-full px-3 py-2 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
            />
          </div>
        </div>
      </div>

      {/* Backup */}
      <div className="bg-white rounded-xl border border-[#c9d8d1] p-5">
        <h2 className="text-sm font-semibold text-[#16221f] mb-3">Backup & Restore</h2>
        <p className="text-sm text-[#5c6f6a] mb-4">
          Download your data as a JSON file for safekeeping, or restore a previous backup file to
          replace the current data.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const data = JSON.stringify({ doctors, wards, stations, demands, holidays, settings, meta }, null, 2)
              const blob = new Blob([data], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `nhf-roster-backup-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0f6e5c] text-[#0f6e5c] text-sm font-medium hover:bg-[#dcefe9]"
          >
            <Download className="w-4 h-4" />
            Download Backup
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleRestoreFile}
            className="hidden"
          />
          <button
            onClick={() => restoreInputRef.current?.click()}
            disabled={restoreBackup.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#c9d8d1] text-[#5c6f6a] text-sm font-medium hover:bg-[#eef3f0] disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {restoreBackup.isPending ? 'Restoring...' : 'Restore Backup'}
          </button>
        </div>
        {restoreMsg && (
          <p className={`text-xs mt-3 ${restoreMsg.startsWith('Restore failed') || restoreMsg.includes('not ') ? 'text-[#a83a2c]' : 'text-[#5c6f6a]'}`}>
            {restoreMsg}
          </p>
        )}
        <div className="text-xs text-[#b5602a] bg-[#f6e3d3] rounded-lg px-3 py-2 mt-4">
          Restoring replaces all doctors, wards, stations, demands, and holidays for everyone. Download a
          fresh backup first if you might need the current data.
        </div>
      </div>
    </div>
  )
}
