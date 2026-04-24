'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getRooms } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'
import BackButton from '@/components/BackButton'

export default function RoomsPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true)
        const data = await getRooms()
        setRooms(Array.isArray(data) ? data : data.rooms || [])
      } catch (err) {
        console.error('객실 목록 조회 실패:', err)
        setError('객실 정보를 불러오는 데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }
    fetchRooms()
  }, [])

  const formatPrice = (price) => {
    if (!price) return '-'
    return Number(price).toLocaleString('ko-KR') + '원'
  }

  const getStatusBadge = (room) => {
    if (room.status === 'available' || !room.status) {
      return { text: '예약 가능', className: 'bg-green-500/20 text-green-400 border border-green-500/30' }
    }
    if (room.status === 'occupied') {
      return { text: '사용 중', className: 'bg-red-500/20 text-red-400 border border-red-500/30' }
    }
    return { text: '점검 중', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <BackButton href="/" />
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-white">객실 선택</h1>
            <p className="text-gray-400 mt-1">원하시는 객실을 선택해 주세요</p>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex justify-center items-center py-24">
            <LoadingSpinner size="lg" text="객실 정보를 불러오는 중..." />
          </div>
        )}

        {/* 에러 상태 */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#e94560] text-white px-6 py-3 rounded-xl font-bold"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 객실 목록 — 2열 그리드 */}
        {!loading && !error && (
          <>
            {rooms.length === 0 ? (
              <div className="text-center py-24 text-gray-500">
                <div className="text-5xl mb-4">🏨</div>
                <p>등록된 객실이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {rooms.map((room) => {
                  const badge = getStatusBadge(room)
                  const isAvailable = room.status === 'available' || !room.status
                  return (
                    <button
                      key={room.id || room._id}
                      onClick={() => isAvailable && router.push(`/rooms/${room.id || room._id}`)}
                      disabled={!isAvailable}
                      className={`
                        bg-white/5 border border-white/10 rounded-2xl p-6 text-left
                        transition-all duration-200 card-hover
                        ${isAvailable
                          ? 'hover:border-[#e94560]/40 hover:bg-white/8 active:scale-95 cursor-pointer'
                          : 'opacity-50 cursor-not-allowed'
                        }
                      `}
                    >
                      {/* 객실 번호 아이콘 */}
                      <div className="w-12 h-12 bg-[#e94560]/15 border border-[#e94560]/30 rounded-xl flex items-center justify-center mb-4">
                        <span className="text-[#e94560] font-bold text-lg">
                          {(room.roomNumber || room.number || '').toString().slice(-2) || '🏠'}
                        </span>
                      </div>

                      {/* 객실명 */}
                      <h3 className="text-white font-bold text-lg leading-tight mb-1">
                        {room.name || room.roomName || `객실 ${room.id}`}
                      </h3>

                      {/* 가격 */}
                      <div className="text-[#e94560] font-bold text-xl mb-3">
                        {formatPrice(room.price || room.basePrice || room.pricePerNight)}
                        <span className="text-gray-500 text-sm font-normal ml-1">/ 1박</span>
                      </div>

                      {/* 상태 배지 */}
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${badge.className}`}>
                        {badge.text}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
