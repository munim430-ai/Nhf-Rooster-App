import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Heart, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginScreen() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(password)
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#eef3f0] px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0f6e5c] mb-4 shadow-lg">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
            NHF&RI
          </h1>
          <p className="text-sm text-[#5c6f6a] mt-1">Doctor's Duty Roster Creator</p>
          <p className="text-xs text-[#5c6f6a] mt-0.5">Developed by Dr. Alif</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-sm border border-[#c9d8d1] p-6">
          <h2 className="text-sm font-semibold text-[#16221f] mb-4 text-center uppercase tracking-wide">
            Enter Password to Continue
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6f6a]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-10 py-3 rounded-lg border border-[#c9d8d1] bg-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#0f6e5c] focus:border-transparent
                  placeholder:text-[#5c6f6a]/60"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c6f6a]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-[#a83a2c] bg-[#f7dfd9] rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 rounded-lg bg-[#0f6e5c] text-white text-sm font-semibold
                hover:bg-[#0a4f42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Unlock'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#5c6f6a] mt-4">
          Forgot password? Contact Dr. Alif
        </p>
      </div>
    </div>
  )
}
