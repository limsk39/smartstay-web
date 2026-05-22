import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  Save,
  Settings,
  Trash2,
  Upload,
  User,
  Users,
  XCircle
} from "lucide-react";
import {
  formatDateTime,
  formatWon,
  handlePaymentRedirect,
  issueDoorPassword,
  nightsBetween,
  requestPayment
} from "./integrations";
import type {
  AdminSettings,
  Booking,
  DoorPassword,
  Reservation,
  Room,
  TeamMember
} from "./types";

type AppMode = "customer" | "admin";
type AdminTab = "dashboard" | "rooms" | "reservations" | "members" | "settings";

type TuyaStatus = {
  configured: boolean;
  endpoint: string;
  timezone: string;
  deviceMapped: boolean;
  rooms: Record<string, boolean>;
};

type PaymentStatus = {
  provider: "mock" | "toss";
  ready: boolean;
  label: string;
};

type KakaoNotificationResult = {
  channel: string;
  provider: string;
  status: string;
  message: string;
  sentAt: string;
};

type ApiResult<T> = {
  success: boolean;
  result: T;
  message?: string;
};

const adminSessionKey = "staypass:admin-session";
const defaultAdminPassword = "admin1234";
const minimumPaymentAmount = 100;

const defaultRooms: Room[] = [
  {
    id: "room-1201",
    name: "1201 프리미어",
    type: "프리미어 더블",
    floor: "12층",
    deviceId: "미연결",
    nightlyRate: 118000,
    memo: "",
    imageUrl:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "room-803",
    name: "803 디럭스",
    type: "디럭스 트윈",
    floor: "8층",
    deviceId: "미연결",
    nightlyRate: 98000,
    memo: "",
    imageUrl:
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "room-502",
    name: "502 스탠다드",
    type: "스탠다드 더블",
    floor: "5층",
    deviceId: "미연결",
    nightlyRate: 76000,
    memo: "",
    imageUrl:
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=900&q=80"
  }
];

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function App() {
  const [mode, setMode] = useState<AppMode>("customer");
  const [rooms, setRooms] = useState<Room[]>(defaultRooms);
  const [selectedRoomId, setSelectedRoomId] = useState(defaultRooms[0].id);
  const [guestName, setGuestName] = useState("김민지");
  const [guestPhone, setGuestPhone] = useState("010-1234-5678");
  const [checkInDate, setCheckInDate] = useState(toDateInput(today));
  const [checkOutDate, setCheckOutDate] = useState(toDateInput(tomorrow));
  const [booking, setBooking] = useState<Booking | null>(null);
  const [doorPassword, setDoorPassword] = useState<DoorPassword | null>(null);
  const [busyLabel, setBusyLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [tuyaStatus, setTuyaStatus] = useState<TuyaStatus | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
    () => window.localStorage.getItem(adminSessionKey) === "true"
  );
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [adminRoomId, setAdminRoomId] = useState("");
  const [roomDraft, setRoomDraft] = useState<Room | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AdminSettings | null>(null);
  const [adminActionBusyId, setAdminActionBusyId] = useState("");
  const checkInInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    refreshAll();
    resumePaymentIfNeeded();
  }, []);

  useEffect(() => {
    if (!adminRoomId && rooms.length) setAdminRoomId(rooms[0].id);
  }, [adminRoomId, rooms]);

  useEffect(() => {
    const room = rooms.find((item) => item.id === adminRoomId) ?? rooms[0] ?? null;
    setRoomDraft(room ? { ...room } : null);
  }, [adminRoomId, rooms]);

  useEffect(() => {
    if (adminSettings) setSettingsDraft({ ...adminSettings });
  }, [adminSettings]);

  const activeReservations = useMemo(() => reservations.filter(isActiveReservation), [reservations]);
  const customerRooms = useMemo(
    () => rooms.filter((room) => !hasReservationOverlap(room.id, activeReservations, checkInDate, checkOutDate)),
    [activeReservations, checkInDate, checkOutDate, rooms]
  );
  const visibleRooms = customerRooms.length ? customerRooms : rooms;
  const selectedRoom = visibleRooms.find((room) => room.id === selectedRoomId) ?? visibleRooms[0] ?? defaultRooms[0];
  const nights = nightsBetween(checkInDate, checkOutDate);
  const amount = selectedRoom.nightlyRate * nights;
  const amountIsValid = amount >= minimumPaymentAmount;
  const canSubmit = Boolean(guestName.trim() && guestPhone.trim() && checkInDate < checkOutDate && amountIsValid);
  const displayedDoorCode = doorPassword?.status === "issued" ? `${doorPassword.code}*` : "------";
  const assetServerAddress = adminSettings?.assetServerAddress || window.location.origin;
  const hotelName = adminSettings?.hotelName || "호텔 TSSTAY";
  const coverLogoUrl = resolveAssetUrl(adminSettings?.coverLogoUrl || "/uploads/branding/tsstay-logo.png", assetServerAddress);

  useEffect(() => {
    if (customerRooms.length && !customerRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(customerRooms[0].id);
    }
  }, [customerRooms, selectedRoomId]);

  async function refreshAll() {
    await Promise.all([refreshRooms(), refreshAdminData(), refreshTuyaStatus(), refreshPaymentStatus()]);
  }

  async function refreshRooms() {
    const json = await apiJson<Room[]>("/api/rooms");
    setRooms(json.result.length ? json.result : defaultRooms);
  }

  async function refreshAdminData() {
    const [reservationJson, memberJson, settingsJson] = await Promise.all([
      apiJson<Reservation[]>("/api/admin/reservations"),
      apiJson<TeamMember[]>("/api/admin/members"),
      apiJson<AdminSettings>("/api/admin/settings")
    ]);
    setReservations(reservationJson.result);
    setMembers(memberJson.result);
    setAdminSettings(settingsJson.result);
  }

  async function refreshTuyaStatus() {
    const response = await fetch("/api/tuya/status");
    setTuyaStatus(await response.json());
  }

  async function refreshPaymentStatus() {
    const json = await apiJson<PaymentStatus>("/api/payments/status");
    setPaymentStatus(json.result);
  }

  async function loadLatestAdminSettings() {
    const json = await apiJson<AdminSettings>("/api/admin/settings");
    setAdminSettings(json.result);
    return json.result;
  }

  async function resumePaymentIfNeeded() {
    try {
      const redirected = await handlePaymentRedirect();
      if (!redirected) return;

      setBusyLabel("결제 승인 확인 중");
      const paidBooking: Booking = {
        ...redirected.booking,
        status: "paid",
        paymentId: redirected.payment.paymentId
      };
      setBooking(paidBooking);
      setSelectedRoomId(redirected.room.id);

      setBusyLabel("결제 완료. 도어락 임시비밀번호 발급 중");
      const latestSettings = await loadLatestAdminSettings();
      const issuedPassword = await issueDoorPassword(paidBooking, redirected.room, {
        startTime: latestSettings.passwordStartTime,
        endTime: latestSettings.passwordEndTime
      });
      setDoorPassword(issuedPassword);
      await recordReservation(paidBooking, redirected.room, issuedPassword);
      await refreshAdminData();

      if (issuedPassword.status === "failed") {
        setErrorMessage(doorPasswordDeliveryMessage(issuedPassword.deliveryStatus));
        return;
      }

      setBusyLabel("카카오 알림 메시지 저장 중");
      const kakaoResult = await sendKakaoReservationMessage(paidBooking, redirected.room, issuedPassword);
      await recordReservation(paidBooking, redirected.room, issuedPassword, kakaoResult);
      setBooking({ ...paidBooking, status: "password-issued" });
      setSuccessMessage("결제와 임시비밀번호 발급이 완료되었습니다.");
      await refreshAdminData();
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function completeFlow() {
    if (!amountIsValid) {
      setErrorMessage("결제 금액이 올바르지 않습니다. 객실 요금이 100원 이상인지 확인해 주세요.");
      return;
    }
    if (!canSubmit) return;

    setBusyLabel("결제 준비 중");
    setDoorPassword(null);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const draft: Booking = {
        id: `bk_${Date.now().toString().slice(-8)}`,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        roomId: selectedRoom.id,
        checkInDate,
        checkOutDate,
        amount,
        status: "payment-pending"
      };
      setBooking(draft);

      const payment = await requestPayment(draft, selectedRoom);
      if (!payment) {
        setBusyLabel("토스 결제창에서 결제를 완료해 주세요.");
        return;
      }

      const paidBooking: Booking = {
        ...draft,
        status: "paid",
        paymentId: payment.paymentId
      };
      setBooking(paidBooking);

      setBusyLabel("결제 완료. 도어락 임시비밀번호 발급 중");
      const latestSettings = await loadLatestAdminSettings();
      const issuedPassword = await issueDoorPassword(paidBooking, selectedRoom, {
        startTime: latestSettings.passwordStartTime,
        endTime: latestSettings.passwordEndTime
      });
      setDoorPassword(issuedPassword);
      await recordReservation(paidBooking, selectedRoom, issuedPassword);

      if (issuedPassword.status === "failed") {
        await refreshAdminData();
        setErrorMessage(doorPasswordDeliveryMessage(issuedPassword.deliveryStatus));
        return;
      }

      setBusyLabel("카카오 알림 메시지 저장 중");
      const kakaoResult = await sendKakaoReservationMessage(paidBooking, selectedRoom, issuedPassword);
      await recordReservation(paidBooking, selectedRoom, issuedPassword, kakaoResult);
      setBooking({ ...paidBooking, status: "password-issued" });
      setSuccessMessage("결제와 임시비밀번호 발급이 완료되었습니다.");
      await refreshAdminData();
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function recordReservation(
    paidBooking: Booking,
    room: Room,
    issuedPassword: DoorPassword,
    kakaoResult?: KakaoNotificationResult
  ) {
    await apiJson<Reservation>("/api/admin/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: paidBooking.id,
        roomId: room.id,
        guestName: paidBooking.guestName,
        guestPhone: paidBooking.guestPhone,
        checkInDate: paidBooking.checkInDate,
        checkOutDate: paidBooking.checkOutDate,
        amount: paidBooking.amount,
        status: "reserved",
        paymentId: paidBooking.paymentId,
        doorPasswordCode: issuedPassword.status === "issued" ? `${issuedPassword.code}*` : issuedPassword.code,
        doorPasswordEffectiveAt: issuedPassword.effectiveAt,
        doorPasswordExpiresAt: issuedPassword.expiresAt,
        doorPasswordStatus: issuedPassword.status,
        tuyaPasswordId: issuedPassword.tuyaPasswordId,
        doorPasswordDeliveryStatus: issuedPassword.deliveryStatus,
        doorLockDeviceId: issuedPassword.deviceId,
        kakaoMessage: kakaoResult?.message,
        kakaoStatus: kakaoResult?.status,
        kakaoProvider: kakaoResult?.provider,
        kakaoSentAt: kakaoResult?.sentAt
      })
    });
  }

  async function sendKakaoReservationMessage(paidBooking: Booking, room: Room, issuedPassword: DoorPassword) {
    const json = await apiJson<KakaoNotificationResult>("/api/notifications/kakao/reservation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: paidBooking.guestName,
        guestPhone: paidBooking.guestPhone,
        roomName: room.name,
        checkInDate: paidBooking.checkInDate,
        checkOutDate: paidBooking.checkOutDate,
        doorPasswordCode: `${issuedPassword.code}*`,
        validText: `${formatDateTime(issuedPassword.effectiveAt)} ~ ${formatDateTime(issuedPassword.expiresAt)}`
      })
    });
    return json.result;
  }

  function handleAdminLogin(event: FormEvent) {
    event.preventDefault();
    const expectedPassword = adminSettings?.adminPassword || defaultAdminPassword;
    if (loginPassword === expectedPassword) {
      window.localStorage.setItem(adminSessionKey, "true");
      setIsAdminLoggedIn(true);
      setLoginPassword("");
      setLoginError("");
      return;
    }
    setLoginError("관리자 비밀번호가 맞지 않습니다.");
  }

  function logoutAdmin() {
    window.localStorage.removeItem(adminSessionKey);
    setIsAdminLoggedIn(false);
  }

  async function createRoom() {
    const json = await apiJson<Room>("/api/rooms", { method: "POST" });
    setRooms((current) => [...current, json.result]);
    setAdminRoomId(json.result.id);
  }

  async function saveRoomDraft() {
    if (!roomDraft) return;
    const json = await apiJson<Room>(`/api/rooms/${roomDraft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roomDraft)
    });
    setRooms((current) => current.map((room) => (room.id === json.result.id ? json.result : room)));
    setSuccessMessage("객실 수정 내용이 저장되었습니다.");
  }

  async function deleteRoom(roomId: string) {
    await apiJson<Room[]>(`/api/rooms/${roomId}`, { method: "DELETE" });
    await refreshRooms();
  }

  async function uploadRoomImage(file: File) {
    if (!roomDraft) return;
    const formData = new FormData();
    formData.append("image", file);
    const json = await apiJson<Room>(`/api/rooms/${roomDraft.id}/image`, {
      method: "POST",
      body: formData
    });
    setRooms((current) => current.map((room) => (room.id === json.result.id ? json.result : room)));
    setRoomDraft(json.result);
  }

  async function saveSettingsDraft() {
    if (!settingsDraft) return;
    const json = await apiJson<AdminSettings>("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsDraft)
    });
    setAdminSettings(json.result);
    setSettingsDraft(json.result);
    setSuccessMessage("관리자 설정이 저장되었습니다. 다음 임시비밀번호 발급부터 이 시간이 적용됩니다.");
  }

  async function uploadCoverLogo(file: File) {
    const formData = new FormData();
    formData.append("image", file);
    const json = await apiJson<AdminSettings>("/api/admin/branding/logo", {
      method: "POST",
      body: formData
    });
    setAdminSettings(json.result);
    setSettingsDraft(json.result);
  }

  async function cancelReservation(reservationId: string) {
    setAdminActionBusyId(`cancel:${reservationId}`);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiJson<Reservation>(`/api/admin/reservations/${reservationId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelReason: "관리자 예약 취소" })
      });
      await refreshAdminData();
      setSuccessMessage("예약 취소와 임시비밀번호 삭제 요청이 완료되었습니다.");
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setAdminActionBusyId("");
    }
  }

  async function checkOutReservation(reservationId: string) {
    setAdminActionBusyId(`checkout:${reservationId}`);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiJson<Reservation>(`/api/admin/reservations/${reservationId}/check-out`, {
        method: "POST"
      });
      await refreshAdminData();
      setSuccessMessage("체크아웃 처리와 임시비밀번호 삭제 요청이 완료되었습니다.");
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setAdminActionBusyId("");
    }
  }

  async function changeReservationRoom(reservationId: string, roomId: string) {
    setAdminActionBusyId(`room:${reservationId}`);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiJson<Reservation>(`/api/admin/reservations/${reservationId}/room`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId })
      });
      await refreshAll();
      setSuccessMessage("예약 객실이 변경되었습니다. 임시비밀번호가 있으면 새 객실 도어락으로 다시 발급했습니다.");
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setAdminActionBusyId("");
    }
  }

  function openCheckInCalendar() {
    checkInInputRef.current?.focus();
    checkInInputRef.current?.showPicker?.();
  }

  async function createMember() {
    const json = await apiJson<TeamMember>("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "새 구성원", phone: "", role: "front-desk", active: true })
    });
    setMembers((current) => [...current, json.result]);
  }

  async function deleteMember(memberId: string) {
    await apiJson<TeamMember[]>(`/api/admin/members/${memberId}`, { method: "DELETE" });
    await refreshAdminData();
  }

  return (
    <main className={`app-shell ${mode === "customer" ? "customer-shell" : ""}`}>
      <div className="mode-switch">
        <button className={mode === "customer" ? "active" : ""} onClick={() => setMode("customer")} type="button">
          고객 예약
        </button>
        <button className={mode === "admin" ? "active" : ""} onClick={() => setMode("admin")} type="button">
          관리자
        </button>
      </div>

      {mode === "customer" ? (
        <section className="phone-frame">
          <div className="app-topbar">
            <div>
              <img className="hotel-cover-logo" src={coverLogoUrl} alt="TSSTAY 로고" />
              <p className="eyebrow">객실 예약</p>
              <h1>{hotelName}</h1>
            </div>
            <button className="icon-button" onClick={openCheckInCalendar} type="button" aria-label="?? ??">
              <Calendar size={22} />
            </button>
          </div>

          <div className="room-strip">
            {customerRooms.length ? (
              customerRooms.map((room) => (
                <button
                  className={`room-tile ${room.id === selectedRoom.id ? "is-active" : ""}`}
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  type="button"
                >
                  <img src={resolveAssetUrl(room.imageUrl, assetServerAddress)} alt={room.name} />
                  <span>{room.name}</span>
                  <small>{room.type}</small>
                  <small>{formatWon(room.nightlyRate)} / 박</small>
                </button>
              ))
            ) : (
              <p className="empty-room-message">선택한 날짜에 예약 가능한 객실이 없습니다.</p>
            )}
          </div>

          <div className="form-panel">
            <label>
              투숙객
              <input value={guestName} onChange={(event) => setGuestName(event.target.value)} />
            </label>
            <label>
              연락처
              <input value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} />
            </label>
            <div className="date-grid">
              <label>
                체크인
                <input ref={checkInInputRef} type="date" value={checkInDate} onChange={(event) => setCheckInDate(event.target.value)} />
              </label>
              <label>
                체크아웃
                <input type="date" value={checkOutDate} onChange={(event) => setCheckOutDate(event.target.value)} />
              </label>
            </div>
          </div>

          <div className="payment-card">
            <div>
              <small>{nights}박 결제</small>
              <strong>{formatWon(amount)}</strong>
              {paymentStatus && <span>{paymentStatus.label}</span>}
            </div>
            <button className="primary-action" disabled={!canSubmit || Boolean(busyLabel)} onClick={completeFlow} type="button">
              <CreditCard size={20} />
              결제 후 발급
            </button>
          </div>

          <div className={`mobile-key-card ${errorMessage ? "has-error" : ""}`}>
            <div className="pass-heading">
              <p className="eyebrow">Mobile Key</p>
              <KeyRound size={34} />
            </div>
            <strong>{displayedDoorCode}</strong>
            {doorPassword?.status === "issued" && (
              <p>
                도어락에서 숫자 6자리 입력 후 * 버튼을 누르세요.
                <br />
                {formatDateTime(doorPassword.effectiveAt)} ~ {formatDateTime(doorPassword.expiresAt)}
              </p>
            )}
            {busyLabel && <p>{busyLabel}</p>}
            {successMessage && <p>{successMessage}</p>}
            {errorMessage && <p>{errorMessage}</p>}
          </div>
        </section>
      ) : (
        <section className="admin-page">
          {!isAdminLoggedIn ? (
            <form className="login-card" onSubmit={handleAdminLogin}>
              <Lock size={32} />
              <h1>관리자 로그인</h1>
              <p>기본 관리자 비밀번호는 admin1234 입니다.</p>
              <label>
                비밀번호
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>
              {loginError && <p className="error-text">{loginError}</p>}
              <button className="primary-action" type="submit">로그인</button>
            </form>
          ) : (
            <AdminConsole
              activeReservations={activeReservations}
              adminActionBusyId={adminActionBusyId}
              adminRoomId={adminRoomId}
              adminTab={adminTab}
              assetServerAddress={assetServerAddress}
              cancelReservation={cancelReservation}
              changeReservationRoom={changeReservationRoom}
              checkOutReservation={checkOutReservation}
              createMember={createMember}
              createRoom={createRoom}
              deleteMember={deleteMember}
              deleteRoom={deleteRoom}
              errorMessage={errorMessage}
              logoutAdmin={logoutAdmin}
              members={members}
              reservations={reservations}
              roomDraft={roomDraft}
              rooms={rooms}
              saveRoomDraft={saveRoomDraft}
              saveSettingsDraft={saveSettingsDraft}
              selectedRoomMapped={Boolean(tuyaStatus?.rooms[adminRoomId] ?? tuyaStatus?.deviceMapped)}
              setAdminRoomId={setAdminRoomId}
              setAdminTab={setAdminTab}
              setRoomDraft={setRoomDraft}
              setSettingsDraft={setSettingsDraft}
              settingsDraft={settingsDraft}
              successMessage={successMessage}
              tuyaStatus={tuyaStatus}
              uploadCoverLogo={uploadCoverLogo}
              uploadRoomImage={uploadRoomImage}
            />
          )}
        </section>
      )}
    </main>
  );
}

function AdminConsole({
  activeReservations,
  adminActionBusyId,
  adminRoomId,
  adminTab,
  assetServerAddress,
  cancelReservation,
  changeReservationRoom,
  checkOutReservation,
  createMember,
  createRoom,
  deleteMember,
  deleteRoom,
  errorMessage,
  logoutAdmin,
  members,
  reservations,
  roomDraft,
  rooms,
  saveRoomDraft,
  saveSettingsDraft,
  selectedRoomMapped,
  setAdminRoomId,
  setAdminTab,
  setRoomDraft,
  setSettingsDraft,
  settingsDraft,
  successMessage,
  tuyaStatus,
  uploadCoverLogo,
  uploadRoomImage
}: {
  activeReservations: Reservation[];
  adminActionBusyId: string;
  adminRoomId: string;
  adminTab: AdminTab;
  assetServerAddress: string;
  cancelReservation: (reservationId: string) => Promise<void>;
  changeReservationRoom: (reservationId: string, roomId: string) => Promise<void>;
  checkOutReservation: (reservationId: string) => Promise<void>;
  createMember: () => Promise<void>;
  createRoom: () => Promise<void>;
  deleteMember: (memberId: string) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  errorMessage: string;
  logoutAdmin: () => void;
  members: TeamMember[];
  reservations: Reservation[];
  roomDraft: Room | null;
  rooms: Room[];
  saveRoomDraft: () => Promise<void>;
  saveSettingsDraft: () => Promise<void>;
  selectedRoomMapped: boolean;
  setAdminRoomId: (roomId: string) => void;
  setAdminTab: (tab: AdminTab) => void;
  setRoomDraft: (room: Room) => void;
  setSettingsDraft: (settings: AdminSettings) => void;
  settingsDraft: AdminSettings | null;
  successMessage: string;
  tuyaStatus: TuyaStatus | null;
  uploadCoverLogo: (file: File) => Promise<void>;
  uploadRoomImage: (file: File) => Promise<void>;
}) {
  const selectedRoomReservation = activeReservations.find((reservation) => reservation.roomId === adminRoomId);
  const [reservationRoomDrafts, setReservationRoomDrafts] = useState<Record<string, string>>({});

  return (
    <>
      <div className="admin-header">
        <div>
          <p className="eyebrow">운영 콘솔</p>
          <h1>관리자 페이지</h1>
        </div>
        <button className="secondary-action" onClick={logoutAdmin} type="button">
          <LogOut size={18} />
          로그아웃
        </button>
      </div>

      <div className="admin-tabs">
        {([
          ["dashboard", "전체 현황", ClipboardList],
          ["rooms", "객실 수정", BedDouble],
          ["reservations", "예약 히스토리", KeyRound],
          ["members", "구성원", Users],
          ["settings", "설정", Settings]
        ] as const).map(([tab, label, Icon]) => (
          <button className={adminTab === tab ? "active" : ""} key={tab} onClick={() => setAdminTab(tab)} type="button">
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>

      {successMessage && <p className="success-text">{successMessage}</p>}
      {errorMessage && <p className="error-text">{errorMessage}</p>}

      {adminTab === "dashboard" && (
        <div className="room-status-grid">
          {rooms.map((room) => {
            const activeReservation = activeReservations.find((reservation) => reservation.roomId === room.id);
            return (
              <article className={`room-status-card ${activeReservation ? "occupied" : "available"}`} key={room.id}>
                <img src={resolveAssetUrl(room.imageUrl, assetServerAddress)} alt={room.name} />
                <div className="room-status-body">
                  <div className="room-status-title">
                    <strong>{room.name}</strong>
                    <span>{activeReservation ? "예약/투숙중" : "예약 가능"}</span>
                  </div>
                  <p>{room.type}</p>
                  {activeReservation && (
                    <small>
                      {activeReservation.guestName} {activeReservation.guestPhone}
                    </small>
                  )}
                  {activeReservation && (
                    <div className="room-card-actions">
                      <label className="reservation-room-change">
                        객실변경
                        <select
                          value={reservationRoomDrafts[activeReservation.id] || activeReservation.roomId}
                          onChange={(event) =>
                            setReservationRoomDrafts((current) => ({
                              ...current,
                              [activeReservation.id]: event.target.value
                            }))
                          }
                        >
                          {rooms.map((candidateRoom) => (
                            <option key={candidateRoom.id} value={candidateRoom.id}>
                              {candidateRoom.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="secondary-action"
                        disabled={
                          Boolean(adminActionBusyId) ||
                          (reservationRoomDrafts[activeReservation.id] || activeReservation.roomId) === activeReservation.roomId
                        }
                        onClick={() =>
                          changeReservationRoom(
                            activeReservation.id,
                            reservationRoomDrafts[activeReservation.id] || activeReservation.roomId
                          )
                        }
                        type="button"
                      >
                        <Save size={18} />
                        {adminActionBusyId === `room:${activeReservation.id}` ? "처리 중" : "객실변경 저장"}
                      </button>
                      <button
                        className="danger-action"
                        disabled={Boolean(adminActionBusyId)}
                        onClick={() => cancelReservation(activeReservation.id)}
                        type="button"
                      >
                        <XCircle size={18} />
                        {adminActionBusyId === `cancel:${activeReservation.id}` ? "처리 중" : "결제/예약 취소"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {adminTab === "rooms" && roomDraft && (
        <div className="admin-layout">
          <aside className="room-list-panel">
            <button className="primary-action" onClick={createRoom} type="button">
              <Plus size={18} />
              객실 추가
            </button>
            {rooms.map((room) => (
              <button className={`room-row ${room.id === adminRoomId ? "is-active" : ""}`} key={room.id} onClick={() => setAdminRoomId(room.id)} type="button">
                <img src={resolveAssetUrl(room.imageUrl, assetServerAddress)} alt={room.name} />
                <span>
                  <strong>{room.name}</strong>
                  <small>{room.type}</small>
                </span>
              </button>
            ))}
          </aside>

          <section className="room-editor active">
            <div>
              <img className="room-preview" src={resolveAssetUrl(roomDraft.imageUrl, assetServerAddress)} alt={roomDraft.name} />
              <label className="file-upload">
                <Upload size={18} />
                사진 올리기
                <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadRoomImage(event.target.files[0])} />
              </label>
            </div>

            <div className="editor-fields">
              <label>
                객실 이름
                <input value={roomDraft.name} onChange={(event) => setRoomDraft({ ...roomDraft, name: event.target.value })} />
              </label>
              <label>
                객실 형태
                <input value={roomDraft.type} onChange={(event) => setRoomDraft({ ...roomDraft, type: event.target.value })} />
              </label>
              <label>
                층
                <input value={roomDraft.floor} onChange={(event) => setRoomDraft({ ...roomDraft, floor: event.target.value })} />
              </label>
              <label>
                1박 요금
                <input
                  type="number"
                  value={roomDraft.nightlyRate}
                  onChange={(event) => setRoomDraft({ ...roomDraft, nightlyRate: Number(event.target.value) || 0 })}
                />
              </label>
              <label>
                도어락 Device ID
                <input value={roomDraft.deviceId} onChange={(event) => setRoomDraft({ ...roomDraft, deviceId: event.target.value })} />
              </label>
              <label className="memo-field">
                메모
                <textarea value={roomDraft.memo} onChange={(event) => setRoomDraft({ ...roomDraft, memo: event.target.value })} />
              </label>
              <div className="editor-footer">
                <span>도어락 연결 상태: {selectedRoomMapped ? "연결됨" : "미연결"}</span>
                <div className="admin-actions">
                  <button className="primary-action" onClick={saveRoomDraft} type="button">
                    <Save size={18} />
                    객실 수정 저장
                  </button>
                  <button className="danger-action" onClick={() => deleteRoom(roomDraft.id)} type="button">
                    <Trash2 size={18} />
                    객실 삭제
                  </button>
                </div>
              </div>
              {selectedRoomReservation && (
                <p>
                  현재 예약: {selectedRoomReservation.guestName} / {selectedRoomReservation.doorPasswordCode || "비밀번호 없음"}
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {adminTab === "reservations" && (
        <div className="reservation-history-list">
          {!reservations.length && (
            <div className="empty-admin-panel">
              <strong>현재 저장된 예약이 없습니다.</strong>
              <p>고객이 예약과 결제를 완료하면 이곳에 결제취소와 객실변경 버튼이 표시됩니다.</p>
            </div>
          )}
          {reservations.map((reservation) => {
            const canManageReservation = isActiveReservation(reservation);
            const checkoutBusy = adminActionBusyId === `checkout:${reservation.id}`;
            const cancelBusy = adminActionBusyId === `cancel:${reservation.id}`;
            const roomChangeBusy = adminActionBusyId === `room:${reservation.id}`;
            const nextRoomId = reservationRoomDrafts[reservation.id] || reservation.roomId;
            return (
            <article className="reservation-cancel-row" key={reservation.id}>
              <div>
                <strong>{rooms.find((room) => room.id === reservation.roomId)?.name || reservation.roomId}</strong>
                <p>
                  {reservation.guestName} / {reservation.guestPhone}
                  <br />
                  {reservation.checkInDate} ~ {reservation.checkOutDate}
                  <br />
                  {reservation.doorPasswordCode || "임시비밀번호 없음"}
                  <br />
                  {reservation.doorPasswordEffectiveAt && reservation.doorPasswordExpiresAt
                    ? `${formatDateTime(reservation.doorPasswordEffectiveAt)} ~ ${formatDateTime(reservation.doorPasswordExpiresAt)}`
                    : "유효시간 없음"}
                </p>
                <small>
                  상태: {reservation.status} / Tuya PW ID: {reservation.tuyaPasswordId || "없음"} / 삭제:{" "}
                  {reservation.doorPasswordDeleteStatus || "미삭제"}
                </small>
              </div>
              {canManageReservation ? (
                <div className="admin-actions">
                  <label className="reservation-room-change">
                    객실변경
                    <select
                      value={nextRoomId}
                      onChange={(event) =>
                        setReservationRoomDrafts((current) => ({
                          ...current,
                          [reservation.id]: event.target.value
                        }))
                      }
                    >
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="secondary-action"
                    disabled={Boolean(adminActionBusyId) || nextRoomId === reservation.roomId}
                    onClick={() => changeReservationRoom(reservation.id, nextRoomId)}
                    type="button"
                  >
                    <Save size={18} />
                    {roomChangeBusy ? "처리 중" : "객실변경 저장"}
                  </button>
                  <button
                    className="secondary-action"
                    disabled={Boolean(adminActionBusyId)}
                    onClick={() => checkOutReservation(reservation.id)}
                    type="button"
                  >
                    <CheckCircle2 size={18} />
                    {checkoutBusy ? "처리 중" : "체크아웃"}
                  </button>
                  <button
                    className="danger-action"
                    disabled={Boolean(adminActionBusyId)}
                    onClick={() => cancelReservation(reservation.id)}
                    type="button"
                  >
                    <XCircle size={18} />
                    {cancelBusy ? "처리 중" : "결제/예약 취소"}
                  </button>
                </div>
              ) : (
                <span className="history-done-label">처리 완료</span>
              )}
            </article>
            );
          })}
        </div>
      )}

      {adminTab === "members" && (
        <div className="member-panel">
          <button className="primary-action" onClick={createMember} type="button">
            <Plus size={18} />
            구성원 추가
          </button>
          {members.map((member) => (
            <article className="member-card" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                <p>
                  {member.role} / {member.phone || "전화번호 없음"}
                  <br />
                  권한: {member.permissions.join(", ")}
                </p>
              </div>
              <button className="danger-action" onClick={() => deleteMember(member.id)} type="button">
                <Trash2 size={18} />
                삭제
              </button>
            </article>
          ))}
        </div>
      )}

      {adminTab === "settings" && settingsDraft && (
        <div className="server-address-panel">
          <label>
            고객 화면 호텔명
            <input value={settingsDraft.hotelName} onChange={(event) => setSettingsDraft({ ...settingsDraft, hotelName: event.target.value })} />
          </label>
          <label>
            앱 서버 주소
            <input
              value={settingsDraft.serverAddress}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, serverAddress: event.target.value })}
            />
          </label>
          <label>
            사진 서버 주소
            <input
              value={settingsDraft.assetServerAddress}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, assetServerAddress: event.target.value })}
            />
          </label>
          <label>
            임시비밀번호 시작 시간
            <input
              type="time"
              value={settingsDraft.passwordStartTime}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, passwordStartTime: event.target.value })}
            />
          </label>
          <label>
            임시비밀번호 종료 시간
            <input
              type="time"
              value={settingsDraft.passwordEndTime}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, passwordEndTime: event.target.value })}
            />
          </label>
          <label>
            관리자 비밀번호 변경
            <input
              value={settingsDraft.adminPassword}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, adminPassword: event.target.value })}
            />
          </label>
          <label className="secondary-action file-button">
            <Upload size={18} />
            표지 로고 변경
            <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadCoverLogo(event.target.files[0])} />
          </label>
          <button className="primary-action" onClick={saveSettingsDraft} type="button">
            <Save size={18} />
            설정 저장
          </button>
          <p>
            저장된 시간은 다음 예약 결제 후 임시비밀번호 발급부터 반영됩니다. 현재 Tuya 서버:{" "}
            {tuyaStatus?.endpoint || "확인 중"}
          </p>
        </div>
      )}
    </>
  );
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, init);
  const json = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `${url} 요청에 실패했습니다.`);
  }
  return json;
}

function isActiveReservation(reservation: Reservation) {
  return reservation.status === "reserved" || reservation.status === "checked-in";
}

function hasReservationOverlap(roomId: string, reservations: Reservation[], startDate: string, endDate: string) {
  return reservations.some((reservation) => {
    if (reservation.roomId !== roomId) return false;
    return startDate < reservation.checkOutDate && endDate > reservation.checkInDate;
  });
}

function resolveAssetUrl(value: string, assetServerAddress: string) {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  const origin = resolveReachableAssetOrigin(assetServerAddress);
  return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
}

function resolveReachableAssetOrigin(assetServerAddress: string) {
  const currentOrigin = window.location.origin.replace(/\/$/, "");
  const configuredOrigin = String(assetServerAddress || currentOrigin).replace(/\/$/, "");

  try {
    const current = new URL(currentOrigin);
    const configured = new URL(configuredOrigin);
    const configuredHost = configured.hostname;
    const currentIsPublicHttps = current.protocol === "https:" && !isLocalHost(current.hostname);

    if (currentIsPublicHttps && isLocalHost(configuredHost)) {
      return currentOrigin;
    }
    return configured.origin;
  } catch {
    return currentOrigin;
  }
}

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function normalizeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.";
}

function doorPasswordDeliveryMessage(status?: number) {
  if (Number(status) === 5) {
    return "도어락 임시비밀번호 저장 한도를 초과했습니다. 기존 임시비밀번호를 삭제한 뒤 다시 발급해 주세요.";
  }
  if (status === undefined || status === null) {
    return "도어락에서 임시비밀번호 반영 상태를 확인하지 못했습니다.";
  }
  return `도어락 임시비밀번호 반영에 실패했습니다. Tuya delivery_status: ${status}`;
}
