export type Room = {
  id: string;
  name: string;
  type: string;
  floor: string;
  deviceId: string;
  nightlyRate: number;
  imageUrl: string;
  memo: string;
};

export type BookingStatus = "draft" | "payment-pending" | "paid" | "password-issued";

export type Booking = {
  id: string;
  guestName: string;
  guestPhone: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  amount: number;
  status: BookingStatus;
  paymentId?: string;
};

export type PaymentProvider = "mock" | "toss";

export type PaymentPrepareResult = {
  provider: PaymentProvider;
  orderId: string;
  orderName: string;
  amount: number;
  clientKey?: string;
  customerKey: string;
  successUrl: string;
  failUrl: string;
};

export type PaymentResult = {
  paymentId: string;
  orderId: string;
  method: string;
  approvedAt: string;
  status: string;
};

export type DoorPassword = {
  id: string;
  code: string;
  effectiveAt: string;
  expiresAt: string;
  status: "issued" | "failed";
  tuyaPasswordId?: string;
  deliveryStatus?: number;
  deviceId?: string;
};

export type ReservationStatus = "reserved" | "checked-in" | "checked-out" | "cancelled";

export type Reservation = {
  id: string;
  bookingId?: string;
  roomId: string;
  guestName: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  amount: number;
  status: ReservationStatus;
  paymentId?: string;
  doorPasswordCode?: string;
  doorPasswordEffectiveAt?: string;
  doorPasswordExpiresAt?: string;
  doorPasswordStatus?: DoorPassword["status"];
  tuyaPasswordId?: string;
  doorPasswordDeliveryStatus?: number;
  doorLockDeviceId?: string;
  checkedOutAt?: string;
  doorPasswordDeletedAt?: string;
  doorPasswordDeleteStatus?: string;
  kakaoMessage?: string;
  kakaoStatus?: string;
  kakaoProvider?: string;
  kakaoSentAt?: string;
  createdAt: string;
};

export type TeamMemberRole = "owner" | "manager" | "front-desk" | "housekeeping" | "viewer";

export type TeamMember = {
  id: string;
  name: string;
  phone: string;
  role: TeamMemberRole;
  permissions: string[];
  active: boolean;
  createdAt: string;
};

export type AdminSettings = {
  serverAddress: string;
  assetServerAddress: string;
  hotelName: string;
  coverLogoUrl: string;
  adminPassword: string;
  passwordStartTime: string;
  passwordEndTime: string;
  detectedAddress: string;
  updatedAt: string;
};
