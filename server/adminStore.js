import fs from "node:fs";
import path from "node:path";

const defaultMembers = [
  {
    id: "member-owner",
    name: "관리자",
    phone: "010-0000-0000",
    role: "owner",
    permissions: ["객실 관리", "예약 확인", "구성원 관리", "요금 변경"],
    active: true,
    createdAt: new Date().toISOString()
  }
];

export class AdminStoreError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AdminStoreError";
    this.statusCode = statusCode;
  }
}

export function createAdminStore(rootDir) {
  const dataDir = process.env.VERCEL ? path.join("/tmp", "staypass-data") : path.join(rootDir, "server", "data");
  const brandingUploadDir = process.env.VERCEL
    ? path.join("/tmp", "staypass-uploads", "branding")
    : path.join(rootDir, "server", "uploads", "branding");
  const reservationFilePath = path.join(dataDir, "reservations.json");
  const memberFilePath = path.join(dataDir, "members.json");
  const settingsFilePath = path.join(dataDir, "settings.json");
  const seedDataDir = path.join(rootDir, "server", "data");

  ensureDirectory(dataDir);
  ensureDirectory(brandingUploadDir);
  ensureFile(reservationFilePath, readSeedJson(path.join(seedDataDir, "reservations.json"), []));
  ensureFile(memberFilePath, readSeedJson(path.join(seedDataDir, "members.json"), defaultMembers));
  ensureFile(settingsFilePath, readSeedJson(path.join(seedDataDir, "settings.json"), {
    serverAddress: "",
    assetServerAddress: "",
    hotelName: "호텔 TSSTAY",
    coverLogoUrl: "/uploads/branding/tsstay-logo.png",
    adminPassword: "admin1234",
    passwordStartTime: "15:00",
    passwordEndTime: "11:00",
    updatedAt: new Date().toISOString()
  }));

  function readReservations() {
    return readJsonArray(reservationFilePath).map(normalizeReservation);
  }

  function createReservation(input) {
    const reservations = readReservations();
    const normalized = normalizeReservation({
      ...input,
      id: input.id || `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: input.createdAt || new Date().toISOString()
    });

    const existingIndex = reservations.findIndex(
      (reservation) => reservation.bookingId && reservation.bookingId === normalized.bookingId
    );

    if (existingIndex >= 0) {
      reservations[existingIndex] = normalized;
      writeJson(reservationFilePath, reservations);
      return normalized;
    }

    writeJson(reservationFilePath, [...reservations, normalized]);
    return normalized;
  }

  function readMembers() {
    const members = readJsonArray(memberFilePath);
    return members.length ? members.map(normalizeMember) : defaultMembers;
  }

  function createMember(input = {}) {
    const members = readMembers();
    const member = normalizeMember({
      id: `member_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: input.name || "새 구성원",
      phone: input.phone || "",
      role: input.role || "front-desk",
      active: input.active ?? true,
      createdAt: new Date().toISOString()
    });
    writeJson(memberFilePath, [...members, member]);
    return member;
  }

  function updateMember(memberId, patch) {
    const members = readMembers();
    const index = members.findIndex((member) => member.id === memberId);
    if (index < 0) {
      throw new AdminStoreError("구성원을 찾을 수 없습니다.", 404);
    }
    members[index] = normalizeMember({ ...members[index], ...patch, id: memberId });
    writeJson(memberFilePath, members);
    return members[index];
  }

  function deleteMember(memberId) {
    const members = readMembers();
    if (members.length <= 1) {
      throw new AdminStoreError("구성원은 최소 1명 이상 있어야 합니다.");
    }
    const nextMembers = members.filter((member) => member.id !== memberId);
    if (nextMembers.length === members.length) {
      throw new AdminStoreError("구성원을 찾을 수 없습니다.", 404);
    }
    writeJson(memberFilePath, nextMembers);
    return nextMembers;
  }

  function cancelReservation(reservationId, paymentCancelResult, doorPasswordDeleteResult) {
    const reservations = readReservations();
    const index = reservations.findIndex((reservation) => reservation.id === reservationId);
    if (index < 0) {
      throw new AdminStoreError("예약을 찾을 수 없습니다.", 404);
    }
    reservations[index] = normalizeReservation({
      ...reservations[index],
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      paymentCancelStatus: paymentCancelResult?.status || "CANCELLED",
      ...doorPasswordDeletionPatch(doorPasswordDeleteResult)
    });
    writeJson(reservationFilePath, reservations);
    return reservations[index];
  }

  function checkOutReservation(reservationId, doorPasswordDeleteResult) {
    const reservations = readReservations();
    const index = reservations.findIndex((reservation) => reservation.id === reservationId);
    if (index < 0) {
      throw new AdminStoreError("?덉빟??李얠쓣 ???놁뒿?덈떎.", 404);
    }
    reservations[index] = normalizeReservation({
      ...reservations[index],
      status: "checked-out",
      checkedOutAt: new Date().toISOString(),
      ...doorPasswordDeletionPatch(doorPasswordDeleteResult)
    });
    writeJson(reservationFilePath, reservations);
    return reservations[index];
  }

  function changeReservationRoom(reservationId, patch) {
    const reservations = readReservations();
    const index = reservations.findIndex((reservation) => reservation.id === reservationId);
    if (index < 0) {
      throw new AdminStoreError("예약을 찾을 수 없습니다.", 404);
    }
    reservations[index] = normalizeReservation({
      ...reservations[index],
      ...patch
    });
    writeJson(reservationFilePath, reservations);
    return reservations[index];
  }

  function readSettings(detectedAddress) {
    return normalizeSettings(readJsonObject(settingsFilePath), detectedAddress);
  }

  function updateSettings(input, detectedAddress) {
    const settings = normalizeSettings(
      {
        ...readJsonObject(settingsFilePath),
        ...input,
        updatedAt: new Date().toISOString()
      },
      detectedAddress
    );
    writeJson(settingsFilePath, {
      serverAddress: settings.serverAddress,
      assetServerAddress: settings.assetServerAddress,
      hotelName: settings.hotelName,
      coverLogoUrl: settings.coverLogoUrl,
      adminPassword: settings.adminPassword,
      passwordStartTime: settings.passwordStartTime,
      passwordEndTime: settings.passwordEndTime,
      updatedAt: settings.updatedAt
    });
    return settings;
  }

  return {
    brandingUploadDir,
    cancelReservation,
    changeReservationRoom,
    checkOutReservation,
    createMember,
    createReservation,
    deleteMember,
    memberFilePath,
    readMembers,
    readReservations,
    readSettings,
    reservationFilePath,
    settingsFilePath,
    updateSettings,
    updateMember
  };
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFile(filePath, value) {
  if (!fs.existsSync(filePath)) {
    writeJson(filePath, value);
  }
}

function readJsonArray(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    writeJson(filePath, []);
    return [];
  }
}

function readJsonObject(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    writeJson(filePath, {});
    return {};
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readSeedJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeReservation(reservation) {
  return {
    id: String(reservation.id || `res_${Date.now()}`),
    bookingId: reservation.bookingId ? String(reservation.bookingId) : undefined,
    roomId: String(reservation.roomId || ""),
    guestName: String(reservation.guestName || ""),
    guestPhone: String(reservation.guestPhone || ""),
    checkInDate: String(reservation.checkInDate || ""),
    checkOutDate: String(reservation.checkOutDate || ""),
    amount: Math.max(0, Number.parseInt(String(reservation.amount || 0), 10) || 0),
    status: ["reserved", "checked-in", "checked-out", "cancelled"].includes(reservation.status)
      ? reservation.status
      : "reserved",
    paymentId: reservation.paymentId ? String(reservation.paymentId) : undefined,
    doorPasswordCode: reservation.doorPasswordCode ? String(reservation.doorPasswordCode) : undefined,
    doorPasswordEffectiveAt: reservation.doorPasswordEffectiveAt
      ? String(reservation.doorPasswordEffectiveAt)
      : undefined,
    doorPasswordExpiresAt: reservation.doorPasswordExpiresAt ? String(reservation.doorPasswordExpiresAt) : undefined,
    doorPasswordStatus: ["issued", "failed"].includes(reservation.doorPasswordStatus)
      ? reservation.doorPasswordStatus
      : undefined,
    tuyaPasswordId: reservation.tuyaPasswordId ? String(reservation.tuyaPasswordId) : undefined,
    doorPasswordDeliveryStatus: optionalNumber(reservation.doorPasswordDeliveryStatus),
    doorLockDeviceId: reservation.doorLockDeviceId ? String(reservation.doorLockDeviceId) : undefined,
    cancelledAt: reservation.cancelledAt ? String(reservation.cancelledAt) : undefined,
    checkedOutAt: reservation.checkedOutAt ? String(reservation.checkedOutAt) : undefined,
    paymentCancelStatus: reservation.paymentCancelStatus ? String(reservation.paymentCancelStatus) : undefined,
    doorPasswordDeletedAt: reservation.doorPasswordDeletedAt
      ? String(reservation.doorPasswordDeletedAt)
      : undefined,
    doorPasswordDeleteStatus: reservation.doorPasswordDeleteStatus
      ? String(reservation.doorPasswordDeleteStatus)
      : undefined,
    kakaoMessage: reservation.kakaoMessage ? String(reservation.kakaoMessage) : undefined,
    kakaoStatus: reservation.kakaoStatus ? String(reservation.kakaoStatus) : undefined,
    kakaoProvider: reservation.kakaoProvider ? String(reservation.kakaoProvider) : undefined,
    kakaoSentAt: reservation.kakaoSentAt ? String(reservation.kakaoSentAt) : undefined,
    createdAt: String(reservation.createdAt || new Date().toISOString())
  };
}

function normalizeMember(member) {
  const role = ["owner", "manager", "front-desk", "housekeeping", "viewer"].includes(member.role)
    ? member.role
    : "front-desk";

  return {
    id: String(member.id || `member_${Date.now()}`),
    name: String(member.name || "새 구성원"),
    phone: String(member.phone || ""),
    role,
    permissions: permissionsForRole(role),
    active: Boolean(member.active),
    createdAt: String(member.createdAt || new Date().toISOString())
  };
}

function normalizeSettings(settings, detectedAddress) {
  const fallbackAddress = String(detectedAddress || "http://127.0.0.1:4173");
  const serverAddress = normalizePublicAddress(settings.serverAddress || fallbackAddress, fallbackAddress);
  const assetServerAddress = normalizePublicAddress(settings.assetServerAddress || serverAddress, serverAddress);
  return {
    serverAddress,
    assetServerAddress,
    hotelName: String(settings.hotelName || "호텔 TSSTAY"),
    coverLogoUrl: String(settings.coverLogoUrl || "/uploads/branding/tsstay-logo.png"),
    adminPassword: String(settings.adminPassword || "admin1234"),
    passwordStartTime: normalizeTime(settings.passwordStartTime, "15:00"),
    passwordEndTime: normalizeTime(settings.passwordEndTime, "11:00"),
    detectedAddress: fallbackAddress,
    updatedAt: String(settings.updatedAt || new Date().toISOString())
  };
}

function normalizePublicAddress(value, fallback) {
  const text = String(value || fallback).trim() || String(fallback);
  try {
    const url = new URL(text);
    if (process.env.VERCEL && url.protocol === "http:" && !isLocalHost(url.hostname)) {
      url.protocol = "https:";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return text;
  }
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizeTime(value, fallback) {
  const text = String(value || fallback);
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function doorPasswordDeletionPatch(result) {
  if (!result) return {};
  return {
    doorPasswordDeletedAt: new Date().toISOString(),
    doorPasswordDeleteStatus: result.status || (result.success === false ? "FAILED" : "DELETED")
  };
}

function permissionsForRole(role) {
  const permissions = {
    owner: ["객실 관리", "예약 확인", "구성원 관리", "요금 변경"],
    manager: ["객실 관리", "예약 확인", "요금 변경"],
    "front-desk": ["예약 확인", "비밀번호 발급 확인"],
    housekeeping: ["객실 상태 확인"],
    viewer: ["예약 확인"]
  };
  return permissions[role] || permissions["front-desk"];
}
