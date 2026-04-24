'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createReservation } from '@/lib/api'
import BackButton from '@/components/BackButton'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function GuestInfoPage() {
  const router = useRouter()

  const [bookingInfo, setBookingInfo] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [doorLockMethod, setDoorLockMethod] = useState('sms') // 'sms' | 'kakao'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // sessionStorage에서 예약 정보 읽기
  useEffect(() => {
    const stored = sessionStorage.getItem('bookingInfo')
    if (!stored) {
      router.push('/rooms')
      return
    }
    setBookingInfo(JSON.parse(stored))
  }, [router])

  const formatDate = (str) => {
    if (!str) return '-'
    return new Date(str).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  const formatPrice = (p) => Number(p || 0).toLocaleString('ko-KR')

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  const handlePhoneChange = (e) => {
    setPhone(formatPhone(e.target.value))
  }

  const validate = () => {
    if (!name.trim()) return '이름을 입력해 주세요.'
    if (name.trim().length < 2) return '이름은 2자 이상 입력해 주세요.'
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) return '올바른 전화번호를 입력해 주세요.'
    return null
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!bookingInfo) return

    try {
      setLoading(true)
      setError('')

      const payload = {
        roomId: bookingInfo.roomId,
        guestName: name.trim(),
        guestPhone: phone.replace(/\D/g, ''),
        checkIn: bookingInfo.checkIn,
        checkOut: bookingInfo.checkOut,
        totalPrice: bookingInfo.totalPrice,
        doorLockMethod,
      }

      const result = await createReservation(payload)

      // 백엔드 응답: { reservation: { id, orderId, ... } }
      const resData = result.reservation || result

      // 결제 정보를 sessionStorage에 저장
      const paymentInfo = {
        ...bookingInfo,
        guestName: name.trim(),
        guestPhone: phone,
        doorLockMethod,
        reservationId: resData.id || resData._id || resData.reservationId,
        orderId: resData.orderId || `ORDER-${Date.now()}`,
      }
      sessionStorage.setItem('paymentInfo', JSON.stringify(paymentInfo))

      router.push('/payment')
    } catch (err) {
      console.error('예약 생성 실패:', err)
      setError(
        err.response?.data?.message || '예약 처리 중 오류가 발생했습니다. 다시 시도해 주세요.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (!bookingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <BackButton href={`/rooms/${bookingInfo.roomId}`} />
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-white">예약자 정보</h1>
            <p className="text-gray-400 mt-1">예약을 위한 정보를 입력해 주세요</p>
          </div>
        </div>

        {/* 예약 요약 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-gray-400 text-sm font-medium mb-3">예약 요약</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">객실</span>
              <span className="text-white font-medium">{bookingInfo.roomName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">체크인</span>
              <span className="text-white font-medium">{formatDate(bookingInfo.checkIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">체크아웃</span>
              <span className="text-white font-medium">{formatDate(bookingInfo.checkOut)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">숙박</span>
              <span className="text-white font-medium">{bookingInfo.nights}박</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between">
              <span className="text-white font-bold">총 금액</span>
              <span className="text-[#e94560] font-bold text-lg">
                {formatPrice(bookingInfo.totalPrice)}원
              </span>
            </div>
          </div>
        </div>

        {/* 예약자 정보 입력 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
          <h2 className="text-white font-bold mb-4">예약자 정보</h2>
          <div className="space-y-4">
            {/* 이름 */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">이름 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
                placeholder="홍길동"
                maxLength={20}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white text-lg focus:outline-none focus:border-[#e94560] placeholder-gray-600"
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">전화번호 *</label>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="010-0000-0000"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white text-lg focus:outline-none focus:border-[#e94560] placeholder-gray-600"
              />
            </div>
          </div>
        </div>

        {/* 도어락 비번 전달 방법 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-white font-bold mb-1">도어락 비밀번호 전달 방법</h2>
          <p className="text-gray-500 text-xs mb-4">체크인 확정 후 도어락 비밀번호를 전달해 드립니다</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDoorLockMethod('sms')}
              className={`
                py-4 rounded-xl border-2 transition-all duration-200 font-medium
                ${doorLockMethod === 'sms'
                  ? 'border-[#e94560] bg-[#e94560]/15 text-white'
                  : 'border-white/10 bg-white/5 text-gray-400'
                }
              `}
            >
              <div className="text-2xl mb-1">📱</div>
              <div className="text-sm">문자(SMS)</div>
            </button>
            <button
              onClick={() => setDoorLockMethod('kakao')}
              className={`
                py-4 rounded-xl border-2 transition-all duration-200 font-medium
                ${doorLockMethod === 'kakao'
                  ? 'border-[#e94560] bg-[#e94560]/15 text-white'
                  : 'border-white/10 bg-white/5 text-gray-400'
                }
              `}
            >
              <div className="text-2xl mb-1">💬</div>
              <div className="text-sm">카카오톡</div>
            </button>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 결제하기 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-[#e94560] hover:bg-[#c73652] disabled:bg-white/10 disabled:text-gray-500 text-white font-bold text-xl py-5 rounded-2xl transition-all duration-200 active:scale-95 brand-glow flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              처리 중...
            </>
          ) : (
            `결제하기 (${formatPrice(bookingInfo.totalPrice)}원)`
          )}
        </button>
      </div>
    </div>
  )
}
