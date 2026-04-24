'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function TossFailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const code = searchParams.get('code') || 'UNKNOWN'
  const message = searchParams.get('message') || '결제에 실패했습니다.'

  const getErrorDescription = (code) => {
    const descriptions = {
      PAY_PROCESS_CANCELED: '사용자가 결제를 취소했습니다.',
      PAY_PROCESS_ABORTED: '결제 진행 중 오류가 발생했습니다.',
      REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다.',
      INVALID_CARD_EXPIRATION: '카드 유효기간이 올바르지 않습니다.',
      INVALID_STOPPED_CARD: '정지된 카드입니다.',
      EXCEED_MAX_DAILY_PAYMENT_COUNT: '일일 결제 한도를 초과했습니다.',
      NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: '할부 결제가 지원되지 않는 카드입니다.',
      INVALID_CARD_LOST_OR_STOLEN_CARD: '분실/도난 카드입니다.',
      EXCEED_MAX_AMOUNT: '결제 금액 한도를 초과했습니다.',
    }
    return descriptions[code] || '알 수 없는 오류가 발생했습니다.'
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-lg w-full text-center">
        {/* 실패 아이콘 */}
        <div className="w-24 h-24 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-14 h-14 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">결제 실패</h1>
        <p className="text-gray-400 mb-8">{getErrorDescription(code)}</p>

        {/* 오류 상세 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 text-left">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">오류 코드</span>
              <span className="text-red-400 font-mono">{code}</span>
            </div>
            <div className="flex justify-between items-start gap-4">
              <span className="text-gray-500 flex-shrink-0">오류 메시지</span>
              <span className="text-gray-300 text-right">{message}</span>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/payment')}
            className="w-full bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-5 rounded-2xl transition-all active:scale-95 brand-glow"
          >
            다시 결제하기
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-white/10 hover:bg-white/15 text-white py-4 rounded-2xl transition-all"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TossFailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a]">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-[#e94560] animate-spin" />
          </div>
        }
      >
        <TossFailContent />
      </Suspense>
    </div>
  )
}
