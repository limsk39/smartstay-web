import { ANONYMOUS, loadTossPayments } from "@tosspayments/tosspayments-sdk";
import type { Booking, DoorPassword, PaymentPrepareResult, PaymentResult, Room } from "./types";

const timezone = "Asia/Seoul";
const pendingPaymentPrefix = "staypass:pending-payment:";

type PendingPayment = {
  booking: Booking;
  room: Room;
};

export function nightsBetween(checkInDate: string, checkOutDate: string) {
  const start = new Date(`${checkInDate}T00:00:00+09:00`);
  const end = new Date(`${checkOutDate}T00:00:00+09:00`);
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.round(diff / 86_400_000));
}

export function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone
  }).format(new Date(value));
}

export async function requestPayment(booking: Booking, room: Room): Promise<PaymentResult | null> {
  const prepared = await createPaymentOrder(booking, room);
  savePendingPayment(prepared.orderId, { booking, room });

  if (prepared.provider === "mock") {
    return confirmPayment({
      orderId: prepared.orderId,
      amount: prepared.amount
    });
  }

  if (!prepared.clientKey) {
    throw new Error("토스페이먼츠 Client Key가 설정되어 있지 않습니다.");
  }

  const tossPayments = await loadTossPayments(prepared.clientKey);
  const payment = tossPayments.payment({ customerKey: ANONYMOUS });

  await withTimeout(
    payment.requestPayment({
      method: "CARD",
      amount: {
        currency: "KRW",
        value: prepared.amount
      },
      orderId: prepared.orderId,
      orderName: prepared.orderName,
      successUrl: prepared.successUrl,
      failUrl: prepared.failUrl,
      customerName: booking.guestName,
      customerMobilePhone: normalizePhone(booking.guestPhone),
      card: {
        flowMode: "DEFAULT",
        useEscrow: false
      }
    }),
    10_000,
    "토스 결제창이 열리지 않았습니다. Chrome에서 다시 열거나 테스트 결제 모드를 확인해 주세요."
  );

  return null;
}

export async function handlePaymentRedirect(): Promise<{
  payment: PaymentResult;
  booking: Booking;
  room: Room;
} | null> {
  if (window.location.pathname === "/payment/fail") {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message") || "결제가 취소되었거나 실패했습니다.";
    clearUrl();
    throw new Error(`토스 결제 실패: ${message}`);
  }

  if (window.location.pathname !== "/payment/success") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId") || "";
  const amount = Number(params.get("amount") || 0);
  const paymentKey = params.get("paymentKey") || "";
  const pending = loadPendingPayment(orderId);

  if (!pending) {
    clearUrl();
    throw new Error("결제는 완료됐지만 예약 정보를 찾지 못했습니다. 같은 브라우저에서 다시 시도해 주세요.");
  }

  const payment = await confirmPayment({ paymentKey, orderId, amount });
  removePendingPayment(orderId);
  clearUrl();

  return {
    payment,
    booking: pending.booking,
    room: pending.room
  };
}

export async function issueDoorPassword(
  booking: Booking,
  room: Room,
  schedule?: { startTime?: string; endTime?: string }
): Promise<DoorPassword> {
  const startTime = normalizeTime(schedule?.startTime, "15:00");
  const endTime = normalizeTime(schedule?.endTime, "11:00");
  const effectiveAt = new Date(`${booking.checkInDate}T${startTime}:00+09:00`).toISOString();
  const expiresAt = new Date(`${booking.checkOutDate}T${endTime}:00+09:00`).toISOString();
  return postDoorPassword(booking, room, effectiveAt, expiresAt);
}

async function postDoorPassword(
  booking: Booking,
  room: Room,
  effectiveAt: string,
  expiresAt: string
): Promise<DoorPassword> {
  const code = createSixDigitCode(booking.id, room.deviceId);
  const response = await fetch("/api/door-lock/temp-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      roomId: room.id,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      bookingId: booking.id,
      deviceId: isConfiguredDeviceId(room.deviceId) ? room.deviceId : undefined,
      password: code,
      effectiveAt,
      expiresAt
    })
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || "Tuya 도어락 임시비밀번호 발급에 실패했습니다.");
  }

  const deliveryStatus = json.result?.tuya?.delivery?.delivery_status;
  const isDelivered = Number(deliveryStatus) === 2;

  return {
    id: `door_${json.result.passwordId ?? booking.id}`,
    code: json.result.code,
    effectiveAt: json.result.effectiveAt,
    expiresAt: json.result.expiresAt,
    status: isDelivered ? "issued" : "failed",
    tuyaPasswordId: String(json.result.passwordId ?? ""),
    deliveryStatus,
    deviceId: json.result.deviceId
  };
}

export function buildTuyaTempPasswordPayload(password: DoorPassword, booking: Booking) {
  return {
    endpoint: "/v1.0/devices/{device_id}/door-lock/temp-password",
    body: {
      name: `예약 ${booking.id}`,
      password: "AES128_ECB_PKCS7_ENCRYPTED_PASSWORD",
      password_type: "ticket",
      ticket_id: "TICKET_FROM_TUYA_PASSWORD_TICKET_API",
      effective_time: Math.floor(new Date(password.effectiveAt).getTime() / 1000),
      invalid_time: Math.floor(new Date(password.expiresAt).getTime() / 1000),
      type: 0,
      time_zone: timezone
    }
  };
}

async function createPaymentOrder(booking: Booking, room: Room): Promise<PaymentPrepareResult> {
  const response = await fetch("/api/payments/prepare", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      bookingId: booking.id,
      roomName: room.name,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      amount: booking.amount,
      origin: window.location.origin
    })
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || "결제 준비에 실패했습니다.");
  }

  return json.result;
}

async function confirmPayment({
  paymentKey,
  orderId,
  amount
}: {
  paymentKey?: string;
  orderId: string;
  amount: number;
}): Promise<PaymentResult> {
  const response = await fetch("/api/payments/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ paymentKey, orderId, amount })
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || "결제 승인에 실패했습니다.");
  }

  return json.result;
}

function savePendingPayment(orderId: string, value: PendingPayment) {
  const compactValue: PendingPayment = {
    booking: value.booking,
    room: {
      ...value.room,
      imageUrl: ""
    }
  };
  try {
    window.localStorage.setItem(`${pendingPaymentPrefix}${orderId}`, JSON.stringify(compactValue));
  } catch {
    clearOldPendingPayments();
    window.localStorage.setItem(`${pendingPaymentPrefix}${orderId}`, JSON.stringify(compactValue));
  }
}

function loadPendingPayment(orderId: string) {
  const raw = window.localStorage.getItem(`${pendingPaymentPrefix}${orderId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingPayment;
  } catch {
    return null;
  }
}

function removePendingPayment(orderId: string) {
  window.localStorage.removeItem(`${pendingPaymentPrefix}${orderId}`);
}

function clearOldPendingPayments() {
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(pendingPaymentPrefix)) {
      window.localStorage.removeItem(key);
    }
  }
}

function clearUrl() {
  window.history.replaceState({}, "", "/");
}

function normalizePhone(phone = "") {
  return String(phone).replace(/\D/g, "").slice(0, 20);
}

function normalizeTime(value = "", fallback: string) {
  return /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function isConfiguredDeviceId(deviceId = "") {
  return Boolean(deviceId && deviceId !== "미연결" && deviceId !== "Lockpro H5000");
}

function createSixDigitCode(seedA: string, seedB: string) {
  const seed = `${seedA}:${seedB}:${Date.now()}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1_000_000;
  }
  return String(hash).padStart(6, "0");
}
