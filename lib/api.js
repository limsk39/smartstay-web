import axios from 'axios'

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 요청 인터셉터: 관리자 토큰 자동 첨부
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('adminToken')
      if (token) {
        config.headers['x-admin-token'] = token
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 응답 인터셉터: 에러 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('adminToken')
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  }
)

// ──────────────────────────────
// 객실 API
// ──────────────────────────────

/** 전체 객실 목록 조회 */
export const getRooms = () => api.get('/rooms').then((r) => r.data)

/** 특정 객실 상세 조회 */
export const getRoom = (id) => api.get(`/rooms/${id}`).then((r) => r.data)

/** 객실 예약 가능 여부 확인 */
export const checkAvailability = (id, checkIn, checkOut) =>
  api
    .get(`/rooms/${id}/availability`, { params: { checkIn, checkOut } })
    .then((r) => r.data)

// ──────────────────────────────
// 예약 API
// ──────────────────────────────

/** 예약 생성 */
export const createReservation = (data) =>
  api.post('/reservations', data).then((r) => r.data)

// ──────────────────────────────
// 결제 API
// ──────────────────────────────

/** 결제 확인 (토스 콜백 또는 데모 결제) */
export const confirmPayment = (data) =>
  api.post('/payments/confirm', data).then((r) => r.data)

// ──────────────────────────────
// 관리자 API
// ──────────────────────────────

/** 관리자 로그인 */
export const adminLogin = (username, password) =>
  api.post('/admin/login', { username, password }).then((r) => r.data)

/** 관리자: 예약 목록 조회 */
export const getAdminReservations = (status) =>
  api
    .get('/admin/reservations', { params: status ? { status } : {} })
    .then((r) => r.data)

/** 관리자: 객실 목록 조회 */
export const getAdminRooms = () => api.get('/admin/rooms').then((r) => r.data)

/** 관리자: 객실 추가 */
export const createAdminRoom = (data) =>
  api.post('/admin/rooms', data).then((r) => r.data)

/** 관리자: 객실 수정 */
export const updateAdminRoom = (id, data) =>
  api.put(`/admin/rooms/${id}`, data).then((r) => r.data)

/** 관리자: 객실 삭제 */
export const deleteAdminRoom = (id) =>
  api.delete(`/admin/rooms/${id}`).then((r) => r.data)

/** 관리자: 예약 상태 변경 */
export const updateReservationStatus = (id, status) =>
  api.patch(`/admin/reservations/${id}/status`, { status }).then((r) => r.data)

// ──────────────────────────────
// 도어락 수동 등록 관리 API (Hybrid 모드)
// ──────────────────────────────

/** 관리자: 도어락 등록 대기 예약 목록 */
export const getPendingDoorCodes = () =>
  api.get('/admin/door-codes/pending').then((r) => r.data)

/** 관리자: Tuya 앱에서 수동 등록 완료 처리 */
export const markDoorCodeRegistered = (reservationId) =>
  api.post(`/admin/reservations/${reservationId}/mark-door-registered`).then((r) => r.data)

/** 관리자: 등록 완료 취소 (실수로 처리한 경우) */
export const unmarkDoorCodeRegistered = (reservationId) =>
  api.post(`/admin/reservations/${reservationId}/unmark-door-registered`).then((r) => r.data)

export default api
