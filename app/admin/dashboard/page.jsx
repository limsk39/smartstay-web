'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  getAdminReservations,
  getAdminRooms,
  createAdminRoom,
  updateAdminRoom,
  deleteAdminRoom,
  updateReservationStatus,
  getPendingDoorCodes,
  markDoorCodeRegistered,
  unmarkDoorCodeRegistered,
} from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'

// ──────────────────────────────
// 예약 상태 정의
// ──────────────────────────────
const RESERVATION_STATUS = {
  all:       { label: '전체',    color: 'text-gray-400' },
  pending:   { label: '대기 중', color: 'text-yellow-400' },
  paid:      { label: '결제완료', color: 'text-green-400' },
  confirmed: { label: '확정',    color: 'text-green-400' },
  checkin:   { label: '체크인',  color: 'text-blue-400' },
  checkout:  { label: '체크아웃', color: 'text-purple-400' },
  cancelled: { label: '취소',    color: 'text-red-400' },
}

// ──────────────────────────────
// 객실 모달 (추가/수정)
// ──────────────────────────────
const AMENITY_OPTIONS = [
  { key: 'wifi', label: 'Wi-Fi' },
  { key: 'aircon', label: '에어컨' },
  { key: 'tv', label: 'TV' },
  { key: 'refrigerator', label: '냉장고' },
  { key: 'bathtub', label: '욕조' },
  { key: 'shower', label: '샤워부스' },
  { key: 'hairdryer', label: '드라이기' },
  { key: 'kettle', label: '전기포트' },
  { key: 'minibar', label: '미니바' },
  { key: 'terrace', label: '테라스' },
  { key: 'washer', label: '세탁기' },
  { key: 'kitchen', label: '주방' },
]

function RoomModal({ room, onClose, onSave }) {
  const isEdit = !!room
  const [form, setForm] = useState({
    name: room?.name || room?.roomName || '',
    roomNumber: room?.roomNumber || room?.number || '',
    price: room?.price || room?.basePrice || room?.pricePerNight || '',
    description: room?.description || '',
    status: room?.status || 'available',
    amenities: room?.amenities || [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleAmenity = (key) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(key)
        ? prev.amenities.filter((a) => a !== key)
        : [...prev.amenities, key],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('객실명을 입력해 주세요.'); return }
    if (!form.price || isNaN(Number(form.price))) { setError('올바른 가격을 입력해 주세요.'); return }

    try {
      setSaving(true)
      setError('')
      const payload = { ...form, price: Number(form.price) }
      if (isEdit) {
        await onSave('update', room.id || room._id, payload)
      } else {
        await onSave('create', null, payload)
      }
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-white font-bold text-lg">{isEdit ? '객실 수정' : '객실 추가'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 객실명 */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">객실명 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 디럭스 더블룸"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#e94560]"
            />
          </div>

          {/* 객실 번호 */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">객실 번호</label>
            <input
              type="text"
              value={form.roomNumber}
              onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
              placeholder="예: 101"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#e94560]"
            />
          </div>

          {/* 가격 */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">1박 가격 (원) *</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="예: 80000"
              min={0}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#e94560]"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">객실 설명</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="객실에 대한 간략한 설명을 입력하세요"
              rows={3}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#e94560] resize-none"
            />
          </div>

          {/* 상태 */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#e94560]"
            >
              <option value="available" className="bg-[#1a1a2e]">예약 가능</option>
              <option value="occupied" className="bg-[#1a1a2e]">사용 중</option>
              <option value="maintenance" className="bg-[#1a1a2e]">점검 중</option>
            </select>
          </div>

          {/* 편의시설 */}
          <div>
            <label className="text-gray-400 text-sm mb-2 block">편의시설</label>
            <div className="grid grid-cols-3 gap-2">
              {AMENITY_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleAmenity(key)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                    form.amenities.includes(key)
                      ? 'border-[#e94560] bg-[#e94560]/15 text-white'
                      : 'border-white/10 bg-white/5 text-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/10 text-white py-3 rounded-xl font-medium hover:bg-white/15 transition-all"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#e94560] text-white py-3 rounded-xl font-bold hover:bg-[#c73652] transition-all flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                isEdit ? '수정하기' : '추가하기'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────
// 메인 대시보드 페이지
// ──────────────────────────────
export default function AdminDashboardPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('reservations')
  const [loading, setLoading] = useState(false)

  // 예약 상태
  const [reservations, setReservations] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [resLoading, setResLoading] = useState(false)

  // 객실 상태
  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [roomModal, setRoomModal] = useState(null) // null | 'create' | room object

  // 도어락 등록 대기 상태
  const [pendingDoorCodes, setPendingDoorCodes] = useState([])
  const [pendingLoading, setPendingLoading] = useState(false)

  // 인증 확인
  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      router.replace('/admin/login')
    }
  }, [router])

  // 예약 목록 조회
  const fetchReservations = useCallback(async () => {
    try {
      setResLoading(true)
      const data = await getAdminReservations(statusFilter !== 'all' ? statusFilter : undefined)
      setReservations(Array.isArray(data) ? data : data.reservations || [])
    } catch (err) {
      console.error('예약 목록 조회 실패:', err)
    } finally {
      setResLoading(false)
    }
  }, [statusFilter])

  // 객실 목록 조회
  const fetchRooms = useCallback(async () => {
    try {
      setRoomsLoading(true)
      const data = await getAdminRooms()
      setRooms(Array.isArray(data) ? data : data.rooms || [])
    } catch (err) {
      console.error('객실 목록 조회 실패:', err)
    } finally {
      setRoomsLoading(false)
    }
  }, [])

  // 도어락 등록 대기 목록 조회
  const fetchPendingDoorCodes = useCallback(async () => {
    try {
      setPendingLoading(true)
      const data = await getPendingDoorCodes()
      setPendingDoorCodes(data.pending || [])
    } catch (err) {
      console.error('도어락 등록 대기 조회 실패:', err)
    } finally {
      setPendingLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'reservations') fetchReservations()
  }, [activeTab, fetchReservations])

  useEffect(() => {
    if (activeTab === 'rooms') fetchRooms()
  }, [activeTab, fetchRooms])

  useEffect(() => {
    if (activeTab === 'doorcodes') fetchPendingDoorCodes()
  }, [activeTab, fetchPendingDoorCodes])

  // 등록 대기 카운트 (탭 옆 배지용) - 항상 최신 데이터 유지
  useEffect(() => {
    fetchPendingDoorCodes()
    const interval = setInterval(fetchPendingDoorCodes, 30000) // 30초마다 갱신
    return () => clearInterval(interval)
  }, [fetchPendingDoorCodes])

  // 도어락 등록 완료 처리
  const handleMarkRegistered = async (reservationId) => {
    try {
      await markDoorCodeRegistered(reservationId)
      fetchPendingDoorCodes()
      if (activeTab === 'reservations') fetchReservations()
    } catch (err) {
      alert(err.response?.data?.error || '처리 중 오류가 발생했습니다.')
    }
  }

  // 클립보드 복사
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      // 간단한 피드백 (alert 대신)
      const el = document.activeElement
      if (el && el.tagName === 'BUTTON') {
        const original = el.innerText
        el.innerText = '복사됨!'
        setTimeout(() => { el.innerText = original }, 1500)
      }
    })
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    router.push('/admin/login')
  }

  const formatDate = (str) => {
    if (!str) return '-'
    return new Date(str).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }
  const formatPrice = (p) => Number(p || 0).toLocaleString('ko-KR')

  // 예약 상태 변경
  const handleReservationStatus = async (reservationId, newStatus) => {
    try {
      await updateReservationStatus(reservationId, newStatus)
      fetchReservations()
    } catch (err) {
      alert(err.response?.data?.message || '상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 객실 저장 (생성/수정)
  const handleRoomSave = async (action, id, data) => {
    if (action === 'create') {
      await createAdminRoom(data)
    } else {
      await updateAdminRoom(id, data)
    }
    fetchRooms()
  }

  // 객실 삭제
  const handleRoomDelete = async (room) => {
    const confirmDelete = window.confirm(`"${room.name || room.roomName}" 객실을 삭제하시겠습니까?`)
    if (!confirmDelete) return
    try {
      await deleteAdminRoom(room.id || room._id)
      fetchRooms()
    } catch (err) {
      alert(err.response?.data?.message || '삭제 중 오류가 발생했습니다.')
    }
  }

  const getStatusBadge = (status) => {
    const s = RESERVATION_STATUS[status] || RESERVATION_STATUS.pending
    return (
      <span className={`text-xs px-2 py-1 rounded-lg bg-white/5 font-medium ${s.color}`}>
        {s.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] flex flex-col">
      {/* 모달 */}
      {roomModal !== null && (
        <RoomModal
          room={roomModal === 'create' ? null : roomModal}
          onClose={() => setRoomModal(null)}
          onSave={handleRoomSave}
        />
      )}

      {/* 상단 헤더 */}
      <header className="bg-[#1a1a2e]/80 border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#e94560]/20 border border-[#e94560]/40 rounded-lg flex items-center justify-center">
            <span className="text-[#e94560] text-xs font-bold">TS</span>
          </div>
          <div>
            <h1 className="text-white font-bold">관리자 대시보드</h1>
            <p className="text-gray-500 text-xs">TS객실제어</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82V15a1 1 0 01-1.447.894L15 13.5M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            고객 화면
          </button>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            로그아웃
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* 사이드바 */}
        <aside className="w-52 bg-[#16213e]/50 border-r border-white/10 p-4 flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('reservations')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
              activeTab === 'reservations'
                ? 'bg-[#e94560] text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            예약 현황
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
              activeTab === 'rooms'
                ? 'bg-[#e94560] text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            객실 관리
          </button>
          <button
            onClick={() => setActiveTab('doorcodes')}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
              activeTab === 'doorcodes'
                ? 'bg-[#e94560] text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              도어락 등록
            </span>
            {pendingDoorCodes.length > 0 && (
              <span className="bg-yellow-500 text-black text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {pendingDoorCodes.length}
              </span>
            )}
          </button>

          <div className="mt-auto">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-500 hover:text-gray-400 transition-all w-full text-left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              키오스크 홈
            </button>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-6 overflow-auto">
          {/* ── 예약 현황 탭 ── */}
          {activeTab === 'reservations' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">예약 현황</h2>
                <button
                  onClick={fetchReservations}
                  className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  새로고침
                </button>
              </div>

              {/* 상태 필터 탭 */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {Object.entries(RESERVATION_STATUS).map(([key, { label }]) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      statusFilter === key
                        ? 'bg-[#e94560] text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {resLoading ? (
                <div className="flex justify-center py-16">
                  <LoadingSpinner text="예약 목록을 불러오는 중..." />
                </div>
              ) : reservations.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-4xl mb-3">📋</div>
                  <p>예약 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reservations.map((res) => (
                    <div
                      key={res.id || res._id}
                      className="bg-white/5 border border-white/10 rounded-2xl p-5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-white font-bold">
                            {res.guestName || res.name || '이름 없음'}
                          </div>
                          <div className="text-gray-400 text-sm">{res.guestPhone || res.phone || ''}</div>
                        </div>
                        {getStatusBadge(res.status)}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-gray-500 text-xs mb-1">객실</div>
                          <div className="text-white">{res.roomName || res.room?.name || '-'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs mb-1">체크인</div>
                          <div className="text-white">{formatDate(res.checkIn)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs mb-1">체크아웃</div>
                          <div className="text-white">{formatDate(res.checkOut)}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                        <div className="text-gray-500 text-xs">
                          예약번호: {(res.id || res._id || '').toString().slice(-8).toUpperCase()}
                        </div>
                        <div className="text-[#e94560] font-bold">
                          {formatPrice(res.totalPrice || res.amount)}원
                        </div>
                      </div>
                      {/* 상태 변경 버튼 */}
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {res.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleReservationStatus(res.id || res._id, 'confirmed')}
                              className="flex-1 py-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-all"
                            >
                              ✓ 확정
                            </button>
                            <button
                              onClick={() => handleReservationStatus(res.id || res._id, 'cancelled')}
                              className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all"
                            >
                              ✕ 취소
                            </button>
                          </>
                        )}
                        {(res.status === 'paid' || res.status === 'confirmed') && (
                          <>
                            <button
                              onClick={() => handleReservationStatus(res.id || res._id, 'checkin')}
                              className="flex-1 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-all"
                            >
                              → 체크인
                            </button>
                            <button
                              onClick={() => handleReservationStatus(res.id || res._id, 'cancelled')}
                              className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all"
                            >
                              ✕ 취소
                            </button>
                          </>
                        )}
                        {res.status === 'checkin' && (
                          <button
                            onClick={() => handleReservationStatus(res.id || res._id, 'checkout')}
                            className="flex-1 py-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-400 text-xs font-medium hover:bg-purple-500/30 transition-all"
                          >
                            → 체크아웃 완료
                          </button>
                        )}
                        {res.status === 'checkout' && (
                          <div className="flex-1 py-2 text-center text-gray-500 text-xs">
                            ✓ 퇴실 완료
                          </div>
                        )}
                        {res.status === 'cancelled' && (
                          <div className="flex-1 py-2 text-center text-gray-500 text-xs">
                            ✕ 취소된 예약
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 객실 관리 탭 ── */}
          {activeTab === 'rooms' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">객실 관리</h2>
                <button
                  onClick={() => setRoomModal('create')}
                  className="bg-[#e94560] hover:bg-[#c73652] text-white px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  객실 추가
                </button>
              </div>

              {roomsLoading ? (
                <div className="flex justify-center py-16">
                  <LoadingSpinner text="객실 목록을 불러오는 중..." />
                </div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-4xl mb-3">🏨</div>
                  <p className="mb-4">등록된 객실이 없습니다.</p>
                  <button
                    onClick={() => setRoomModal('create')}
                    className="bg-[#e94560] text-white px-6 py-3 rounded-xl font-bold"
                  >
                    첫 객실 추가하기
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {rooms.map((room) => {
                    const statusLabel =
                      room.status === 'available' ? '예약 가능'
                      : room.status === 'occupied' ? '사용 중'
                      : '점검 중'
                    const statusColor =
                      room.status === 'available' ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : room.status === 'occupied' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                      : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'

                    return (
                      <div
                        key={room.id || room._id}
                        className="bg-white/5 border border-white/10 rounded-2xl p-5"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-white font-bold text-lg">
                              {room.name || room.roomName}
                            </h3>
                            {room.roomNumber && (
                              <div className="text-gray-500 text-xs">객실 번호: {room.roomNumber}</div>
                            )}
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-lg border font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>

                        <div className="text-[#e94560] font-bold text-xl mb-2">
                          {formatPrice(room.price || room.basePrice || room.pricePerNight)}원
                          <span className="text-gray-500 text-sm font-normal ml-1">/ 1박</span>
                        </div>

                        {room.description && (
                          <p className="text-gray-400 text-sm mb-3 line-clamp-2">{room.description}</p>
                        )}

                        {room.amenities?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-4">
                            {room.amenities.slice(0, 5).map((a) => (
                              <span key={a} className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-lg">
                                {AMENITY_OPTIONS.find((o) => o.key === a)?.label || a}
                              </span>
                            ))}
                            {room.amenities.length > 5 && (
                              <span className="text-xs text-gray-500 px-2 py-1">
                                +{room.amenities.length - 5}개
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2 pt-3 border-t border-white/10">
                          <button
                            onClick={() => setRoomModal(room)}
                            className="flex-1 bg-white/10 hover:bg-white/15 text-white text-sm py-2.5 rounded-xl transition-all font-medium"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleRoomDelete(room)}
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm py-2.5 rounded-xl transition-all font-medium border border-red-500/20"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 도어락 등록 대기 탭 ── */}
          {activeTab === 'doorcodes' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  🔐 도어락 등록 대기
                  {pendingDoorCodes.length > 0 && (
                    <span className="bg-yellow-500 text-black text-sm px-3 py-1 rounded-full font-bold">
                      {pendingDoorCodes.length}건
                    </span>
                  )}
                </h2>
                <button
                  onClick={fetchPendingDoorCodes}
                  className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
                >
                  새로고침
                </button>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                결제 완료된 예약의 도어락 비밀번호를 <b className="text-yellow-400">Tuya 앱</b>에서 수동 등록한 후 "등록 완료"를 눌러주세요.
              </p>

              {pendingLoading ? (
                <div className="flex justify-center py-16">
                  <LoadingSpinner text="등록 대기 목록 불러오는 중..." />
                </div>
              ) : pendingDoorCodes.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="text-lg">모든 예약의 도어락이 등록되어 있습니다.</p>
                  <p className="text-xs text-gray-600 mt-2">새 예약이 들어오면 자동으로 여기에 표시됩니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingDoorCodes.map((p) => (
                    <div
                      key={p.reservationId}
                      className="bg-yellow-500/5 border border-yellow-500/30 rounded-2xl p-5"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="text-white font-bold text-lg">{p.guestName}</div>
                          <div className="text-gray-400 text-sm">{p.guestPhone}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-yellow-400 text-xs font-medium mb-1">등록 필요</div>
                          <div className="text-gray-500 text-xs">{formatDate(p.checkIn)} ~ {formatDate(p.checkOut)}</div>
                        </div>
                      </div>

                      {/* Tuya 앱 등록용 정보 카드 */}
                      <div className="bg-black/30 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs">객실</span>
                          <span className="text-white font-medium">{p.roomName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs">도어락 ID</span>
                          <button
                            onClick={() => copyToClipboard(p.tuyaDeviceId, '디바이스 ID')}
                            className="text-blue-400 hover:text-blue-300 text-xs font-mono"
                          >
                            {p.tuyaDeviceId || '-'} 📋
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs">비밀번호</span>
                          <button
                            onClick={() => copyToClipboard(p.doorCode, '비밀번호')}
                            className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 px-3 py-1 rounded-lg font-mono font-bold text-base"
                          >
                            {p.doorCode}# 📋
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs">유효 기간</span>
                          <span className="text-white text-sm">
                            {new Date(p.checkIn).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            {' → '}
                            {new Date(p.checkOut).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* 안내 + 액션 */}
                      <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg text-xs text-blue-200">
                        <b>📱 Tuya 앱에서:</b> 스마트 도어락 → 임시 비밀번호 → 위 비밀번호와 기간 입력 → 저장
                      </div>

                      <button
                        onClick={() => handleMarkRegistered(p.reservationId)}
                        className="w-full mt-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-400 py-3 rounded-xl font-bold transition-all"
                      >
                        ✓ Tuya 앱에 등록 완료
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
