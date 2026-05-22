import crypto from "node:crypto";

const paymentOrders = new Map();

export class PaymentConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "PaymentConfigError";
    this.statusCode = 400;
  }
}

export class PaymentApiError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "PaymentApiError";
    this.details = details;
    this.statusCode = 502;
  }
}

export function readPaymentConfig() {
  const explicitProvider = (process.env.PAYMENT_PROVIDER || "").toLowerCase();
  const clientKey = process.env.TOSS_CLIENT_KEY || "";
  const secretKey = process.env.TOSS_SECRET_KEY || "";
  const hasTossKeys = Boolean(clientKey && secretKey);
  const provider = explicitProvider === "toss" || (!explicitProvider && hasTossKeys) ? "toss" : "mock";

  return {
    provider,
    clientKey,
    secretKey,
    ready: provider === "mock" || hasTossKeys,
    label: provider === "toss" ? "토스페이먼츠 실제 결제" : "로컬 테스트 결제"
  };
}

export function publicPaymentStatus(config = readPaymentConfig()) {
  return {
    provider: config.provider,
    ready: config.ready,
    label: config.label
  };
}

export function preparePayment(body) {
  const config = readPaymentConfig();
  if (config.provider === "toss" && (!config.clientKey || !config.secretKey)) {
    throw new PaymentConfigError("토스페이먼츠 Client Key와 Secret Key가 필요합니다.");
  }

  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < 100) {
    throw new PaymentConfigError("결제 금액이 올바르지 않습니다.");
  }

  const bookingId = sanitizeId(body.bookingId || crypto.randomUUID());
  const orderId = `staypass_${bookingId}_${Date.now()}`.slice(0, 64);
  const orderName = `${String(body.roomName || "객실 예약").slice(0, 40)} ${String(
    body.checkInDate || ""
  )}`.trim();
  const origin = normalizeOrigin(body.origin);

  paymentOrders.set(orderId, {
    amount,
    bookingId,
    orderName,
    createdAt: Date.now()
  });

  return {
    provider: config.provider,
    clientKey: config.provider === "toss" ? config.clientKey : undefined,
    orderId,
    orderName,
    amount,
    customerKey: `guest_${crypto.randomUUID()}`,
    successUrl: `${origin}/payment/success`,
    failUrl: `${origin}/payment/fail`
  };
}

export async function confirmPayment({ paymentKey, orderId, amount }) {
  const config = readPaymentConfig();
  const order = paymentOrders.get(orderId);
  const requestedAmount = Number(amount);

  if (!order) {
    throw new PaymentConfigError("결제 주문 정보를 찾을 수 없습니다.");
  }

  if (order.amount !== requestedAmount) {
    throw new PaymentConfigError("결제 금액이 예약 금액과 다릅니다.");
  }

  if (config.provider === "mock") {
    return {
      paymentId: `mock_${orderId}`,
      orderId,
      method: "LOCAL_TEST",
      approvedAt: new Date().toISOString(),
      status: "DONE"
    };
  }

  if (!paymentKey) {
    throw new PaymentConfigError("토스 결제 승인에 필요한 paymentKey가 없습니다.");
  }

  const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      paymentKey,
      orderId,
      amount: requestedAmount
    })
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PaymentApiError(json?.message || `토스 결제 승인 실패: HTTP ${response.status}`, {
      status: response.status,
      response: json
    });
  }

  return {
    paymentId: json.paymentKey,
    orderId: json.orderId,
    method: json.method || "TOSS",
    approvedAt: json.approvedAt || new Date().toISOString(),
    status: json.status
  };
}

export async function cancelPayment({ paymentId, cancelReason = "관리자 예약 취소" }) {
  const config = readPaymentConfig();
  if (!paymentId) {
    return {
      paymentId: "",
      status: "NO_PAYMENT_ID",
      cancelledAt: new Date().toISOString()
    };
  }

  if (config.provider === "mock" || String(paymentId).startsWith("mock_")) {
    return {
      paymentId,
      status: "CANCELED",
      cancelledAt: new Date().toISOString()
    };
  }

  if (!config.secretKey) {
    throw new PaymentConfigError("토스페이먼츠 Secret Key가 필요합니다.");
  }

  const response = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      cancelReason
    })
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PaymentApiError(json?.message || `토스 결제 취소 실패: HTTP ${response.status}`, {
      status: response.status,
      response: json
    });
  }

  return {
    paymentId: json.paymentKey || paymentId,
    status: json.status || "CANCELED",
    cancelledAt: new Date().toISOString()
  };
}

function normalizeOrigin(origin) {
  const fallback = "http://127.0.0.1:4173";
  if (!origin) return fallback;

  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

function sanitizeId(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9_\-=]/g, "_")
    .slice(0, 28);
}
