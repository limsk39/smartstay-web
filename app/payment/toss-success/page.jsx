'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { confirmPayment } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'

function TossSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState(null)

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')
    const amount = searchParams.get('amount')

    if (!paymentKey || !orderId || !amount) {
      setError('결제 정보가 올바르지 않습니다.')
      return
    }

    const processConfirm = async () => {
      try {
        const storedPayment = sessionStorage.getItem('paymentInfo')
        const paymentInfo = storedPayment ? JSON.parse(storedPayment) : {}

        const result = await confirmPayment({
          paymentKey,
          orderId,
          amount: Number(amount),
          reservationId: paymentInfo.reservationId,
        })

        const paymentResult = {
          ...paymentInfo,
          paymentKey,
          orderId,
          amount: Number(amount),
          doorLockPassword: result.doorCode || result.doorLockPassword || result.password || '------',
          paidAt: new Date().toISOString(),
        }
        sessionStorage.setItem('paymentResult', JSON.stringify(paymentResult))
        router.replace('/payment/success')
      } catch (err) {
        console.error('결제 확인 실패:', err)
        setError(err.response?.data?.message || '결제 확인 중 오류가 발생했습니다.')
      }
    }

    processConfirm()
  }, [searchParams, router])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="text-5xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-white mb-2">결제 확인 실패</h1>
        <p className="text-red-400 mb-8 text-center">{error}</p>
        <button
          onClick={() => router.push('/payment')}
          className="bg-[#e94560] text-white px-8 py-4 rounded-2xl font-bold"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" text="결제를 확인하는 중..." />
    </div>
  )
}

export default function TossSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a]">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size="lg" text="로딩 중..." />
          </div>
        }
      >
        <TossSuccessContent />
      </Suspense>
    </div>
  )
}
