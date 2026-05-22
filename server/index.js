import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cancelPayment,
  confirmPayment,
  PaymentApiError,
  PaymentConfigError,
  preparePayment,
  publicPaymentStatus,
  readPaymentConfig
} from "./paymentClient.js";
import {
  publicNotificationStatus,
  readNotificationConfig,
  sendKakaoReservationMessage
} from "./notificationClient.js";
import { AdminStoreError, createAdminStore } from "./adminStore.js";
import { createRoomStore, RoomStoreError } from "./roomStore.js";
import {
  deleteTemporaryPassword,
  issueTemporaryPassword,
  publicTuyaStatus,
  readTuyaConfig,
  TuyaApiError,
  TuyaConfigError
} from "./tuyaClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const app = express();
const port = Number(process.env.PORT || 4173);
const adminStore = createAdminStore(rootDir);
const roomStore = createRoomStore(rootDir);
const brandingImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, adminStore.brandingUploadDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname || "").toLowerCase() || ".png";
      cb(null, `brand-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`);
    }
  }),
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  }
});
const roomImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, roomStore.uploadDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`);
    }
  }),
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  }
});

app.use(express.json({ limit: "1mb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});
app.use("/uploads", express.static(path.join(rootDir, "server", "uploads")));

app.get("/api/tuya/status", (_req, res) => {
  res.json(publicTuyaStatus(readTuyaConfig()));
});

app.get("/api/payments/status", (_req, res) => {
  res.json({ success: true, result: publicPaymentStatus(readPaymentConfig()) });
});

app.get("/api/notifications/status", (_req, res) => {
  res.json({ success: true, result: publicNotificationStatus(readNotificationConfig()) });
});

app.get("/api/rooms", (_req, res) => {
  res.json({ success: true, result: roomStore.readRooms() });
});

app.post("/api/rooms", (_req, res, next) => {
  try {
    res.json({ success: true, result: roomStore.createRoom() });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/rooms/:roomId", (req, res, next) => {
  try {
    res.json({ success: true, result: roomStore.updateRoom(req.params.roomId, req.body) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/rooms/:roomId", (req, res, next) => {
  try {
    res.json({ success: true, result: roomStore.deleteRoom(req.params.roomId) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rooms/:roomId/image", roomImageUpload.single("image"), (req, res, next) => {
  try {
    if (!req.file) {
      throw new RoomStoreError("업로드할 객실 사진이 없습니다.");
    }
    const imageUrl = `/uploads/rooms/${req.file.filename}`;
    res.json({
      success: true,
      result: roomStore.updateRoom(req.params.roomId, { imageUrl })
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/settings", async (req, res, next) => {
  try {
    res.json({ success: true, result: await adminStore.readSettings(getDetectedServerAddress(req)) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/settings", async (req, res, next) => {
  try {
    res.json({ success: true, result: await adminStore.updateSettings(req.body, getDetectedServerAddress(req)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/branding/logo", brandingImageUpload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AdminStoreError("업로드할 로고 이미지가 없습니다.");
    }
    const coverLogoUrl = `/uploads/branding/${req.file.filename}`;
    res.json({
      success: true,
      result: await adminStore.updateSettings({ coverLogoUrl }, getDetectedServerAddress(req))
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/reservations", async (_req, res, next) => {
  try {
    await cleanupExpiredReservations();
    res.json({ success: true, result: adminStore.readReservations() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/reservations", (req, res, next) => {
  try {
    res.json({ success: true, result: adminStore.createReservation(req.body) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/reservations/:reservationId/cancel", async (req, res, next) => {
  try {
    const reservation = adminStore
      .readReservations()
      .find((item) => item.id === req.params.reservationId);
    if (!reservation) {
      throw new AdminStoreError("예약을 찾을 수 없습니다.", 404);
    }
    const paymentCancelResult = await cancelPayment({
      paymentId: reservation.paymentId,
      cancelReason: req.body?.cancelReason || "관리자 예약 취소"
    });
    const doorPasswordDeleteResult = await deleteReservationDoorPassword(reservation, "cancel");
    res.json({
      success: true,
      result: adminStore.cancelReservation(req.params.reservationId, paymentCancelResult, doorPasswordDeleteResult)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/reservations/:reservationId/check-out", async (req, res, next) => {
  try {
    const reservation = adminStore
      .readReservations()
      .find((item) => item.id === req.params.reservationId);
    if (!reservation) {
      throw new AdminStoreError("?덉빟??李얠쓣 ???놁뒿?덈떎.", 404);
    }
    const doorPasswordDeleteResult = await deleteReservationDoorPassword(reservation, "check-out");
    res.json({
      success: true,
      result: adminStore.checkOutReservation(req.params.reservationId, doorPasswordDeleteResult)
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/reservations/:reservationId/room", async (req, res, next) => {
  try {
    const reservation = adminStore
      .readReservations()
      .find((item) => item.id === req.params.reservationId);
    if (!reservation) {
      throw new AdminStoreError("예약을 찾을 수 없습니다.", 404);
    }

    const nextRoomId = String(req.body?.roomId || "");
    const nextRoom = roomStore.readRooms().find((room) => room.id === nextRoomId);
    if (!nextRoom) {
      throw new AdminStoreError("변경할 객실을 찾을 수 없습니다.", 404);
    }

    const conflict = adminStore.readReservations().find((item) => {
      if (item.id === reservation.id || item.roomId !== nextRoomId || !shouldBlockRoomChange(item)) return false;
      return reservation.checkInDate < item.checkOutDate && reservation.checkOutDate > item.checkInDate;
    });
    if (conflict) {
      throw new AdminStoreError("해당 기간에 이미 예약된 객실입니다.", 409);
    }

    let passwordPatch = {};
    if (shouldReissueDoorPassword(reservation)) {
      const plainPassword = String(reservation.doorPasswordCode).replace(/\D/g, "").slice(0, 6);
      const newPassword = await issueTemporaryPassword({
        roomId: nextRoom.id,
        guestName: reservation.guestName,
        guestPhone: reservation.guestPhone,
        bookingId: reservation.bookingId || reservation.id,
        deviceId: nextRoom.deviceId,
        password: plainPassword,
        effectiveAt: reservation.doorPasswordEffectiveAt,
        expiresAt: reservation.doorPasswordExpiresAt
      });
      await deleteReservationDoorPassword(reservation, "room-change");
      passwordPatch = {
        doorPasswordCode: `${newPassword.code}*`,
        doorPasswordEffectiveAt: newPassword.effectiveAt,
        doorPasswordExpiresAt: newPassword.expiresAt,
        doorPasswordStatus: Number(newPassword.tuya?.delivery?.delivery_status) === 2 ? "issued" : "failed",
        tuyaPasswordId: newPassword.passwordId,
        doorPasswordDeliveryStatus: newPassword.tuya?.delivery?.delivery_status,
        doorLockDeviceId: newPassword.deviceId,
        doorPasswordDeletedAt: undefined,
        doorPasswordDeleteStatus: undefined
      };
    }

    res.json({
      success: true,
      result: adminStore.changeReservationRoom(req.params.reservationId, {
        roomId: nextRoom.id,
        ...passwordPatch
      })
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/members", (_req, res) => {
  res.json({ success: true, result: adminStore.readMembers() });
});

app.post("/api/admin/members", (req, res, next) => {
  try {
    res.json({ success: true, result: adminStore.createMember(req.body) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/members/:memberId", (req, res, next) => {
  try {
    res.json({ success: true, result: adminStore.updateMember(req.params.memberId, req.body) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/members/:memberId", (req, res, next) => {
  try {
    res.json({ success: true, result: adminStore.deleteMember(req.params.memberId) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/prepare", (req, res, next) => {
  try {
    res.json({ success: true, result: preparePayment(req.body) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/confirm", async (req, res, next) => {
  try {
    res.json({ success: true, result: await confirmPayment(req.body) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/door-lock/temp-password", async (req, res, next) => {
  try {
    const result = await issueTemporaryPassword(req.body);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

app.post("/api/notifications/kakao/reservation", async (req, res, next) => {
  try {
    const result = await sendKakaoReservationMessage(req.body);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(distDir));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(distDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const publicMessage =
    error instanceof TuyaConfigError ||
    error instanceof TuyaApiError ||
    error instanceof PaymentConfigError ||
    error instanceof PaymentApiError ||
    error instanceof AdminStoreError ||
    error instanceof RoomStoreError
      ? error.message
      : "서버 오류가 발생했습니다.";

  res.status(statusCode).json({
    success: false,
    message: publicMessage,
    details: error.details
  });
});

if (!process.env.VERCEL) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`StayPass live preview: http://127.0.0.1:${port}`);
    cleanupExpiredReservations().catch((error) =>
      console.warn("Initial reservation cleanup failed", error.message)
    );
  });

  setInterval(() => {
    cleanupExpiredReservations().catch((error) =>
      console.warn("Scheduled reservation cleanup failed", error.message)
    );
  }, 10 * 60 * 1000);
}

export default app;

function getDetectedServerAddress(req) {
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const host = forwardedHost || req.get("host") || `127.0.0.1:${port}`;
  const protocol = forwardedProto || (process.env.VERCEL ? "https" : req.protocol);
  return `${protocol}://${host}`;
}

let cleanupRunning = false;

async function cleanupExpiredReservations() {
  if (cleanupRunning) return [];
  cleanupRunning = true;
  try {
    const now = new Date();
    const cleaned = [];
    const reservations = adminStore.readReservations();
    for (const reservation of reservations) {
      if (!shouldAutoCheckOut(reservation, now)) continue;
      const doorPasswordDeleteResult = await deleteReservationDoorPassword(reservation, "auto-check-out");
      cleaned.push(adminStore.checkOutReservation(reservation.id, doorPasswordDeleteResult));
    }
    return cleaned;
  } finally {
    cleanupRunning = false;
  }
}

function shouldAutoCheckOut(reservation, now) {
  if (!["reserved", "checked-in"].includes(reservation.status)) return false;
  if (reservation.doorPasswordExpiresAt) {
    const expiresAt = new Date(reservation.doorPasswordExpiresAt);
    if (!Number.isNaN(expiresAt.getTime())) return expiresAt <= now;
  }
  if (reservation.checkOutDate) {
    const endOfCheckoutDate = new Date(`${reservation.checkOutDate}T23:59:59+09:00`);
    return !Number.isNaN(endOfCheckoutDate.getTime()) && endOfCheckoutDate <= now;
  }
  return false;
}

function shouldBlockRoomChange(reservation) {
  return reservation.status === "reserved" || reservation.status === "checked-in";
}

function shouldReissueDoorPassword(reservation) {
  const plainPassword = String(reservation.doorPasswordCode || "").replace(/\D/g, "").slice(0, 6);
  return (
    shouldBlockRoomChange(reservation) &&
    plainPassword.length === 6 &&
    Boolean(reservation.doorPasswordEffectiveAt && reservation.doorPasswordExpiresAt)
  );
}

async function deleteReservationDoorPassword(reservation, reason) {
  if (!reservation.doorLockDeviceId || !reservation.tuyaPasswordId || reservation.doorPasswordDeletedAt) {
    return { status: "SKIPPED" };
  }

  try {
    await deleteTemporaryPassword({
      deviceId: reservation.doorLockDeviceId,
      passwordId: reservation.tuyaPasswordId
    });
    return { status: "DELETED", reason };
  } catch (error) {
    console.warn(`Failed to delete Tuya temporary password during ${reason}`, error.message);
    return { status: "FAILED", reason, message: error.message };
  }
}
