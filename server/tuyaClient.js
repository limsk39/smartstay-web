import crypto from "node:crypto";

const emptyBodySha256 = sha256("");

export class TuyaConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "TuyaConfigError";
    this.statusCode = 400;
  }
}

export class TuyaApiError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "TuyaApiError";
    this.details = details;
    this.statusCode = 502;
  }
}

export function readTuyaConfig() {
  return {
    accessId: process.env.TUYA_ACCESS_ID,
    accessSecret: process.env.TUYA_ACCESS_SECRET,
    endpoint: process.env.TUYA_ENDPOINT || "https://openapi-sg.iotbing.com",
    timezone: process.env.TUYA_TIME_ZONE || "Asia/Seoul",
    aesSecretMode: process.env.TUYA_AES_SECRET_MODE || "first16",
    defaultDeviceId: process.env.TUYA_DEVICE_ID || "",
    roomDeviceIds: {
      "room-1201": process.env.TUYA_ROOM_1201_DEVICE_ID || process.env.TUYA_DEVICE_ID || "",
      "room-803": process.env.TUYA_ROOM_803_DEVICE_ID || "",
      "room-502": process.env.TUYA_ROOM_502_DEVICE_ID || ""
    }
  };
}

export function publicTuyaStatus(config = readTuyaConfig()) {
  return {
    configured: Boolean(config.accessId && config.accessSecret && hasAnyDevice(config)),
    endpoint: config.endpoint,
    timezone: config.timezone,
    deviceMapped: hasAnyDevice(config),
    rooms: Object.fromEntries(
      Object.entries(config.roomDeviceIds).map(([roomId, deviceId]) => [roomId, Boolean(deviceId)])
    )
  };
}

export async function issueTemporaryPassword({
  roomId,
  guestName,
  guestPhone,
  bookingId,
  deviceId: requestedDeviceId,
  password,
  effectiveAt,
  expiresAt
}) {
  const config = readTuyaConfig();
  validateConfig(config, roomId);
  validatePlainPassword(password);

  const deviceId = normalizeDeviceId(requestedDeviceId) || config.roomDeviceIds[roomId] || config.defaultDeviceId;
  const client = new TuyaOpenApi(config);
  const accessToken = await client.getAccessToken();
  const ticket = await client.request(
    "POST",
    `/v1.0/devices/${encodeURIComponent(deviceId)}/door-lock/password-ticket`,
    undefined,
    accessToken
  );

  const originalKey = decryptTicketKey(ticket.ticket_key, config.accessSecret, config.aesSecretMode);
  const encryptedPassword = encryptLockPassword(password, originalKey);
  const createBody = {
    name: `${bookingId || "booking"} ${guestName || ""}`.trim().slice(0, 40),
    password: encryptedPassword,
    password_type: "ticket",
    ticket_id: ticket.ticket_id,
    effective_time: toUnixSeconds(effectiveAt),
    invalid_time: toUnixSeconds(expiresAt),
    phone: normalizePhone(guestPhone),
    type: 0,
    time_zone: config.timezone
  };

  const created = await client.request(
    "POST",
    `/v1.0/devices/${encodeURIComponent(deviceId)}/door-lock/temp-password`,
    createBody,
    accessToken
  );

  const passwordId = created.id ?? created.password_id;
  let syncResult = null;
  if (passwordId) {
    syncResult = await client.request(
      "POST",
      `/v1.0/devices/${encodeURIComponent(deviceId)}/door-lock/issue-password`,
      { password_id: String(passwordId) },
      accessToken
    );
  }

  const delivery = passwordId
    ? await pollPasswordDelivery(client, accessToken, deviceId, passwordId)
    : null;

  return {
    code: password,
    deviceId,
    passwordId,
    effectiveAt,
    expiresAt,
    tuya: {
      ticketId: ticket.ticket_id,
      createResult: created,
      syncResult,
      delivery
    }
  };
}

export async function deleteTemporaryPassword({ deviceId, passwordId }) {
  if (!deviceId || !passwordId) return { skipped: true };

  const config = readTuyaConfig();
  const client = new TuyaOpenApi(config);
  const accessToken = await client.getAccessToken();
  return client.request(
    "DELETE",
    `/v1.0/devices/${encodeURIComponent(deviceId)}/door-lock/temp-passwords/${encodeURIComponent(passwordId)}`,
    undefined,
    accessToken
  );
}

class TuyaOpenApi {
  constructor(config) {
    this.config = config;
    this.cachedToken = null;
  }

  async getAccessToken() {
    if (this.cachedToken?.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.accessToken;
    }

    const token = await this.request("GET", "/v1.0/token?grant_type=1");
    this.cachedToken = {
      accessToken: token.access_token,
      expiresAt: Date.now() + Number(token.expire_time || 7200) * 1000
    };
    return this.cachedToken.accessToken;
  }

  async request(method, pathWithQuery, body, accessToken) {
    const bodyText = body ? JSON.stringify(body) : "";
    const headers = this.createSignedHeaders(method, pathWithQuery, bodyText, accessToken);
    const response = await fetch(`${this.config.endpoint}${pathWithQuery}`, {
      method,
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: bodyText || undefined
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.success) {
      throw new TuyaApiError(json?.msg || `Tuya API 요청 실패: HTTP ${response.status}`, {
        status: response.status,
        code: json?.code,
        response: json
      });
    }
    return json.result;
  }

  createSignedHeaders(method, pathWithQuery, bodyText, accessToken) {
    const t = String(Date.now());
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const stringToSign = [
      method.toUpperCase(),
      bodyText ? sha256(bodyText) : emptyBodySha256,
      "",
      pathWithQuery
    ].join("\n");
    const signPayload = accessToken
      ? `${this.config.accessId}${accessToken}${t}${nonce}${stringToSign}`
      : `${this.config.accessId}${t}${nonce}${stringToSign}`;
    const sign = hmacSha256(signPayload, this.config.accessSecret);

    return {
      client_id: this.config.accessId,
      sign,
      t,
      nonce,
      sign_method: "HMAC-SHA256",
      ...(accessToken ? { access_token: accessToken } : {})
    };
  }
}

async function pollPasswordDelivery(client, accessToken, deviceId, passwordId) {
  let latest = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await wait(attempt === 0 ? 1200 : 3500);
    latest = await client.request(
      "GET",
      `/v1.0/devices/${encodeURIComponent(deviceId)}/door-lock/temp-password/${passwordId}`,
      undefined,
      accessToken
    );

    if ([2, 3, 4, 5, 6].includes(Number(latest.delivery_status))) {
      return latest;
    }
  }
  return latest;
}

function decryptTicketKey(ticketKeyHex, accessSecret, mode) {
  const key = deriveAesKey(accessSecret, mode);
  const decipher = crypto.createDecipheriv(`aes-${key.length * 8}-ecb`, key, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([
    decipher.update(Buffer.from(ticketKeyHex, "hex")),
    decipher.final()
  ]).toString("utf8");
}

function encryptLockPassword(password, originalKey) {
  const key = Buffer.from(originalKey, "utf8").subarray(0, 16);
  if (key.length !== 16) {
    throw new TuyaConfigError("Tuya ticket 복호화 결과가 AES-128 키 길이가 아닙니다.");
  }

  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(password, "utf8"), cipher.final()])
    .toString("hex")
    .toUpperCase();
}

function deriveAesKey(secret, mode) {
  const raw = Buffer.from(secret, "utf8");
  if (mode === "full32") return raw.subarray(0, 32);
  if (mode === "last16") return raw.subarray(Math.max(0, raw.length - 16));
  if (mode === "sha256") return crypto.createHash("sha256").update(raw).digest().subarray(0, 16);
  return raw.subarray(0, 16);
}

function validateConfig(config, roomId) {
  if (!config.accessId || !config.accessSecret) {
    throw new TuyaConfigError("TUYA_ACCESS_ID / TUYA_ACCESS_SECRET 환경변수가 필요합니다.");
  }

  if (!(config.roomDeviceIds[roomId] || config.defaultDeviceId)) {
    throw new TuyaConfigError(`객실 ${roomId}에 연결된 TUYA_DEVICE_ID가 없습니다.`);
  }
}

function validatePlainPassword(password) {
  if (!/^\d{6}$/.test(password)) {
    throw new TuyaConfigError("Zigbee 도어락 임시 비밀번호는 숫자 6자리여야 합니다.");
  }
}

function hasAnyDevice(config) {
  return Boolean(config.defaultDeviceId || Object.values(config.roomDeviceIds).some(Boolean));
}

function normalizePhone(phone = "") {
  return String(phone).replace(/[^\d+]/g, "");
}

function normalizeDeviceId(deviceId = "") {
  const value = String(deviceId).trim();
  if (!value || value === "미연결" || value === "Lockpro H5000") return "";
  return value;
}

function toUnixSeconds(value) {
  return Math.floor(new Date(value).getTime() / 1000);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(value, secret) {
  return crypto.createHmac("sha256", secret).update(value, "utf8").digest("hex").toUpperCase();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
