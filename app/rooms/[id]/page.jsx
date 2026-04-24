'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getRoom, checkAvailability } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'
import BackButton from '@/components/BackButton'

// 편의시설 정의 (API 반환값 기준 키)
const AMENITIES_MAP = {
  'Wi-Fi':    { label: 'Wi-Fi',   icon: '📶' },
  'wi-fi':    { label: 'Wi-Fi',   icon: '📶' },
  'wifi':     { label: 'Wi-Fi',   icon: '📶' },
  '에어컨':   { label: '에어컨',  icon: '❄️' },
  'TV':       { label: 'TV',      icon: '📺' },
  'tv':       { label: 'TV',      icon: '📺' },
  '냉장고':   { label: '냉장고',  icon: '🧊' },
  '욕조':     { label: '욕조',    icon: '🛁' },
  '샤워부스': { label: '샤워부스',icon: '🚿' },
  '드라이기': { label: '드라이기',icon: '💨' },
  '전기포트': { label: '전기포트',icon: '☕' },
  '미니바':   { label: '미니바',  icon: '🍾' },
  '테라스':   { label: '테라스',  icon: '🌿' },
  '세탁기':   { label: '세탁기',  icon: '🫧' },
  '주방':     { label: '주방',    icon: '🍳' },
}

// 오늘 날짜 문자열 (YYYY-MM-DD)
const getTodayStr = () => new Date().toISOString().split('T')[0]

// 내일 날짜 문자열
const getTomorrowStr = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// 박 수 계산
const calcNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0
  const diff = new Date(checkOut) - new Date(checkIn)
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export default function RoomDetailPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.id

  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [checkIn, setCheckIn] = useState(getTodayStr())
  const [checkOut, setCheckOut] = useState(getTomorrowStr())
  const [availability, setAvailability] = useState(null)
  const [checking, setChecking] = useState(false)

  // 객실 상세 조회
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        setLoading(true)
        const data = await getRoom(roomId)
        setRoom(data.room || data)
      } catch (err) {
        console.error('객실 상세 조회 실패:', err)
        setError('객실 정보를 불러오는 데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }
    if (roomId) fetchRoom()
  }, [roomId])

  // 예약 가능 여부 확인
  const handleCheckAvailability = async () => {
    if (!checkIn || !checkOut) return
    if (new Date(checkOut) <= new Date(checkIn)) {
      setAvailability({ available: false, message: '체크아웃은 체크인 이후여야 합니다.' })
      return
    }
    try {
      setChecking(true)
      const data = await checkAvailability(roomId, checkIn, checkOut)
      setAvailability(data)
    } catch (err) {
      console.error('예약 가능 여부 확인 실패:', err)
      setAvailability({ available: false, message: '확인 중 오류가 발생했습니다.' })
    } finally {
      setChecking(false)
    }
  }

  // 날짜 변경 시 자동 가능 여부 확인
  useEffect(() => {
    if (checkIn && checkOut && room) {
      const nights = calcNights(checkIn, checkOut)
      if (nights > 0) {
        handleCheckAvailability()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut, room])

  const nights = calcNights(checkIn, checkOut)
  const basePrice = room?.price || room?.basePrice || room?.pricePerNight || 0
  const totalPrice = basePrice * nights

  const formatPrice = (p) => Number(p).toLocaleString('ko-KR')

  // 편의시설 목록 파싱
  const amenities = (() => {
    if (!room) return []
    const raw = room.amenities || room.facilities || []
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'object') return Object.keys(raw).filter((k) => raw[k])
    return []
  })()

  // 다음 단계 이동
  const handleNext = () => {
    const bookingInfo = {
      roomId,
      roomName: room?.name || room?.roomName,
      checkIn,
      checkOut,
      nights,
      basePrice,
      totalPrice,
    }
    sessionStorage.setItem('bookingInfo', JSON.stringify(bookingInfo))
    router.push('/guest-info')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center">
        <LoadingSpinner size="lg" text="객실 정보를 불러오는 중..." />
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-red-400 mb-4">{error || '객실을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.push('/rooms')}
            className="bg-[#e94560] text-white px-6 py-3 rounded-xl font-bold"
          >
            객실 목록으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <BackButton href="/rooms" />
        </div>

        {/* 객실 정보 카드 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
          <h1 className="text-2xl font-bold text-white mb-1">
            {room.name || room.roomName || `객실 ${roomId}`}
          </h1>
          <div className="text-[#e94560] text-2xl font-bold mb-3">
            {formatPrice(basePrice)}원
            <span className="text-gray-500 text-sm font-normal ml-1">/ 1박</span>
          </div>
          {room.description && (
            <p className="text-gray-400 text-sm leading-relaxed">{room.description}</p>
          )}
        </div>

        {/* 체크인/아웃 시간 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-gray-500 text-xs mb-1">체크인</div>
              <div className="text-white font-bold text-lg">15:00</div>
            </div>
            <div className="border-l border-white/10">
              <div className="text-gray-500 text-xs mb-1">체크아웃</div>
              <div className="text-white font-bold text-lg">11:00</div>
            </div>
          </div>
        </div>

        {/* 편의시설 */}
        {amenities.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
            <h2 className="text-white font-bold mb-4">편의시설</h2>
            <div className="grid grid-cols-3 gap-3">
              {amenities.map((key) => {
                const item = AMENITIES_MAP[key] || { label: key, icon: '✓' }
                return (
                  <div
                    key={key}
                    className="flex flex-col items-center gap-1 bg-white/5 rounded-xl py-3 px-2"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-gray-400 text-xs text-center">{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 날짜 선택 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
          <h2 className="text-white font-bold mb-4">날짜 선택</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-gray-500 text-xs mb-1 block">체크인</label>
              <input
                type="date"
                value={checkIn}
                min={getTodayStr()}
                onChange={(e) => {
                  setCheckIn(e.target.value)
                  setAvailability(null)
                  if (e.target.value >= checkOut) {
                    const d = new Date(e.target.value)
                    d.setDate(d.getDate() + 1)
                    setCheckOut(d.toISOString().split('T')[0])
                  }
                }}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-[#e94560]"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block">체크아웃</label>
              <input
                type="date"
                value={checkOut}
                min={checkIn || getTodayStr()}
                onChange={(e) => {
                  setCheckOut(e.target.value)
                  setAvailability(null)
                }}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-[#e94560]"
              />
            </div>
          </div>

          {/* 예약 가능 여부 표시 */}
          {checking && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
              확인 중...
            </div>
          )}
          {!checking && availability && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                availability.available
                  ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                  : 'bg-red-500/15 border border-red-500/30 text-red-400'
              }`}
            >
              {availability.available
                ? '✓ 예약 가능합니다'
                : `✗ ${availability.message || '해당 날짜는 예약이 불가합니다.'}`}
            </div>
          )}
        </div>

        {/* 금액 요약 */}
        {nights > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
            <h2 className="text-white font-bold mb-3">금액 확인</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>
                  {formatPrice(basePrice)}원 × {nights}박
                </span>
                <span>{formatPrice(totalPrice)}원</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-white text-base">
                <span>총 결제 금액</span>
                <span className="text-[#e94560]">{formatPrice(totalPrice)}원</span>
              </div>
            </div>
          </div>
        )}

        {/* 다음 단계 버튼 */}
        <button
          onClick={handleNext}
          disabled={!availability?.available || nights <= 0}
          className={`
            w-full py-5 rounded-2xl text-white font-bold text-xl transition-all duration-200
            ${availability?.available && nights > 0
              ? 'bg-[#e94560] hover:bg-[#c73652] active:scale-95 brand-glow'
              : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {availability?.available && nights > 0
            ? `예약 진행하기 (${formatPrice(totalPrice)}원)`
            : nights <= 0
            ? '날짜를 선택해 주세요'
            : '예약 불가능한 날짜입니다'}
        </button>
      </div>
    </div>
  )
}
