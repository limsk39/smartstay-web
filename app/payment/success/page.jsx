'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaymentSuccessPage() {
  const router = useRouter()
  const [paymentResult, setPaymentResult] = useState(null)
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    const stored = sessionStorage.getItem('paymentResult')
    if (!stored) {
      router.push('/')
      return
    }
    setPaymentResult(JSON.parse(stored))
  }, [router])

  // 30초 카운트다운 → 홈으로
  useEffect(() => {
    if (!paymentResult) return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // sessionStorage 정리
          sessionStorage.removeItem('bookingInfo')
          sessionStorage.removeItem('paymentInfo')
          sessionStorage.removeItem('paymentResult')
          router.push('/')
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [paymentResult, router])

  const formatDate = (str) => {
    if (!str) return '-'
    return new Date(str).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  }
  const formatPrice = (p) => Number(p || 0).toLocaleString('ko-KR')

  if (!paymentResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-[#e94560] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] px-4 py-8 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full mx-auto text-center">
        {/* 성공 아이콘 */}
        <div className="w-24 h-24 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-6 fade-in">
          <svg className="w-14 h-14 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2 fade-in">결제 완료!</h1>
        <p className="text-gray-400 mb-8 fade-in">예약이 성공적으로 완료되었습니다</p>

        {/* 도어락 비밀번호 강조 표시 */}
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] border-2 border-yellow-500/50 rounded-2xl p-8 mb-6 fade-in">
          <div className="text-gray-400 text-sm mb-2">도어락 비밀번호</div>
          <div
            className="font-bold tracking-widest"
            style={{
              fontSize: '4.5rem',
              lineHeight: 1.1,
              color: '#FFD700',
              textShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
            }}
          >
            {paymentResult.doorLockPassword || '----'}
          </div>
          <p className="text-yellow-500/70 text-xs mt-3">
            이 비밀번호를 꼭 메모해 두세요
          </p>
        </div>

        {/* 예약 정보 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-left fade-in">
          <h2 className="text-white font-bold mb-3">예약 정보</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">예약자</span>
              <span className="text-white font-medium">{paymentResult.guestName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">객실</span>
              <span className="text-white font-medium">{paymentResult.roomName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">체크인</span>
              <span className="text-white">{formatDate(paymentResult.checkIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">체크아웃</span>
              <span className="text-white">{formatDate(paymentResult.checkOut)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">숙박</span>
              <span className="text-white">{paymentResult.nights}박</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
              <span className="text-white">결제 금액</span>
              <span className="text-[#e94560]">{formatPrice(paymentResult.totalPrice)}원</span>
            </div>
          </div>
        </div>

        {/* 카운트다운 */}
        <div className="mb-6">
          <div className="text-gray-500 text-sm mb-2">
            {countdown}초 후 홈으로 이동합니다
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div
              className="bg-[#e94560] h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${(countdown / 30) * 100}%` }}
            />
          </div>
        </div>

        {/* 홈으로 버튼 */}
        <button
          onClick={() => {
            sessionStorage.removeItem('bookingInfo')
            sessionStorage.removeItem('paymentInfo')
            sessionStorage.removeItem('paymentResult')
            router.push('/')
          }}
          className="w-full bg-white/10 hover:bg-white/15 text-white font-bold py-4 rounded-2xl transition-all"
        >
          홈으로 이동
        </button>
      </div>
    </div>
  )
}
