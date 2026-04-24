'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { adminLogin } from '@/lib/api'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 이미 로그인 상태이면 대시보드로
  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (token) {
      router.replace('/admin/dashboard')
    }
  }, [router])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해 주세요.')
      return
    }

    try {
      setLoading(true)
      setError('')
      const result = await adminLogin(username.trim(), password)
      const token = result.token || result.accessToken || result.adminToken
      if (!token) throw new Error('토큰을 받지 못했습니다.')
      localStorage.setItem('adminToken', token)
      router.replace('/admin/dashboard')
    } catch (err) {
      console.error('로그인 실패:', err)
      setError(err.response?.data?.message || '아이디 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* 로고 / 헤더 */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#e94560]/15 border border-[#e94560]/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#e94560]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">관리자 로그인</h1>
          <p className="text-gray-500 text-sm mt-1">TS객실제어 관리 시스템</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-2 block">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setError('')
              }}
              placeholder="admin"
              autoComplete="username"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-[#e94560] placeholder-gray-600 text-lg"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-2 block">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-[#e94560] placeholder-gray-600 text-lg"
            />
          </div>

          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white font-bold text-lg py-4 rounded-2xl transition-all active:scale-95 mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                로그인 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        {/* 홈으로 */}
        <button
          onClick={() => router.push('/')}
          className="w-full mt-4 text-gray-500 text-sm py-2 hover:text-gray-400 transition-colors"
        >
          ← 키오스크 홈으로
        </button>
      </div>
    </div>
  )
}
