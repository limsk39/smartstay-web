'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { confirmPayment } from '@/lib/api'
import BackButton from '@/components/BackButton'

const IS_DEMO =
  !process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ||
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY.includes('여기에')

const PAYMENT_METHODS = [
  { id: 'card', label: '신용/체크카드', icon: '💳', color: 'from-blue-600 to-blue-800' },
  { id: 'kakaopay', label: '카카오페이', icon: '💛', color: 'from-yellow-400 to-yellow-600' },
  { id: 'naverpay', label: '네이버페이', icon: '🟢', color: 'from-green-500 to-green-700' },
  { id: 'tosspay', label: '토스페이', icon: '🔵', color: 'from-sky-500 to-sky-700' },
]

// 토스페이먼츠 SDK 동적 로드
const loadTossSDK = () => {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) {
      resolve(window.TossPayments)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.tosspayments.com/v1/payment'
    script.onload = () => resolve(window.TossPayments)
    script.onerror = () => reject(new Error('토스페이먼츠 SDK 로드 실패'))
    document.head.appendChild(script)
  })
}

export default function PaymentPage() {
  const router = useRouter()
  const [paymentInfo, setPaymentInfo] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState('card')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('paymentInfo')
    if (!stored) {
      router.push('/rooms')
      return
    }
    setPaymentInfo(JSON.parse(stored))
  }, [router])

  const formatPrice = (p) => Number(p || 0).toLocaleString('ko-KR')
  const formatDate = (str) => {
    if (!str) return '-'
    return new Date(str).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  const handlePayment = async () => {
    if (!paymentInfo) return
    setError('')
    setLoading(true)

    try {
      if (IS_DEMO) {
        // 데모 모드: 즉시 결제 확인 API 호출
        const result = await confirmPayment({
          orderId: paymentInfo.orderId,
          amount: paymentInfo.totalPrice,
          paymentKey: `DEMO-${Date.now()}`,
          paymentMethod: selectedMethod,
          reservationId: paymentInfo.reservationId,
        })

        const paymentResult = {
          ...paymentInfo,
          paymentKey: result.paymentKey || `DEMO-${Date.now()}`,
          doorLockPassword: result.doorCode || result.doorLockPassword || result.password || '------',
          paymentMethod: selectedMethod,
          paidAt: new Date().toISOString(),
        }
        sessionStorage.setItem('paymentResult', JSON.stringify(paymentResult))
        router.push('/payment/success')
      } else {
        // 실결제 모드: 토스페이먼츠 SDK
        const TossPayments = await loadTossSDK()
        const tossPayments = TossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY)

        const methodMap = {
          card: '카드',
          kakaopay: '카카오페이',
          naverpay: '네이버페이',
          tosspay: '토스페이',
        }

        await tossPayments.requestPayment(methodMap[selectedMethod], {
          amount: paymentInfo.totalPrice,
          orderId: paymentInfo.orderId,
          orderName: `${paymentInfo.roomName} ${paymentInfo.nights}박`,
          customerName: paymentInfo.guestName,
          customerMobilePhone: paymentInfo.guestPhone?.replace(/-/g, ''),
          successUrl: `${window.location.origin}/payment/toss-success`,
          failUrl: `${window.location.origin}/payment/toss-fail`,
        })
      }
    } catch (err) {
      console.error('결제 오류:', err)
      setError(err.message || '결제 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!paymentInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-3 border-white/20 border-t-[#e94560] animate-spin" style={{ borderWidth: 3 }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <BackButton href="/guest-info" />
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-white">결제</h1>
            <p className="text-gray-400 mt-1">결제 수단을 선택해 주세요</p>
          </div>
        </div>

        {/* 데모 배너 */}
        {IS_DEMO && (
          <div className="bg-yellow-500/15 border border-yellow-500/30 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
            <span className="text-2xl">🔧</span>
            <div>
              <div className="text-yellow-400 font-bold text-sm">데모 모드</div>
              <div className="text-yellow-400/70 text-xs">실제 결제 없이 예약 과정을 테스트합니다</div>
            </div>
          </div>
        )}

        {/* 예약 요약 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-gray-400 text-sm font-medium mb-3">예약 요약</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">객실</span>
              <span className="text-white font-medium">{paymentInfo.roomName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">예약자</span>
              <span className="text-white font-medium">{paymentInfo.guestName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">체크인</span>
              <span className="text-white font-medium">{formatDate(paymentInfo.checkIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">체크아웃</span>
              <span className="text-white font-medium">{formatDate(paymentInfo.checkOut)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">숙박</span>
              <span className="text-white font-medium">{paymentInfo.nights}박</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between">
              <span className="text-white font-bold text-lg">총 결제 금액</span>
              <span className="text-[#e94560] font-bold text-2xl">
                {formatPrice(paymentInfo.totalPrice)}원
              </span>
            </div>
          </div>
        </div>

        {/* 결제 수단 선택 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-white font-bold mb-4">결제 수단</h2>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`
                  py-5 rounded-xl border-2 transition-all duration-200
                  ${selectedMethod === method.id
                    ? 'border-[#e94560] bg-[#e94560]/15'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                  }
                `}
              >
                <div className="text-3xl mb-2">{method.icon}</div>
                <div className={`text-sm font-medium ${selectedMethod === method.id ? 'text-white' : 'text-gray-400'}`}>
                  {method.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 결제하기 버튼 */}
        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white font-bold text-xl py-5 rounded-2xl transition-all duration-200 active:scale-95 brand-glow flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              결제 진행 중...
            </>
          ) : (
            <>
              {PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.icon}&nbsp;
              {formatPrice(paymentInfo.totalPrice)}원 결제하기
            </>
          )}
        </button>

        <p className="text-gray-600 text-xs text-center mt-4">
          결제 진행 시 이용약관에 동의하는 것으로 간주됩니다
        </p>
      </div>
    </div>
  )
}
