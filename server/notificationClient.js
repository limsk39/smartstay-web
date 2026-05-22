export function readNotificationConfig() {
  return {
    provider: process.env.KAKAO_ALIMTALK_PROVIDER || "mock",
    webhookUrl: process.env.KAKAO_ALIMTALK_WEBHOOK_URL || "",
    webhookToken: process.env.KAKAO_ALIMTALK_WEBHOOK_TOKEN || "",
    senderKey: process.env.KAKAO_ALIMTALK_SENDER_KEY || "",
    templateCode: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE || "staypass_room_key",
    hotelName: process.env.HOTEL_NAME || "호텔 TSSTAY"
  };
}

export function publicNotificationStatus(config = readNotificationConfig()) {
  return {
    channel: "kakao",
    provider: config.provider,
    ready: config.provider === "webhook" ? Boolean(config.webhookUrl) : true,
    label:
      config.provider === "webhook" && config.webhookUrl
        ? "카카오 알림톡 실발송 준비됨"
        : "카카오 알림톡 모의 발송"
  };
}

export async function sendKakaoReservationMessage(input, config = readNotificationConfig()) {
  const message = renderKakaoReservationMessage(input, config);
  const to = normalizePhone(input.guestPhone);

  if (!to) {
    return {
      channel: "kakao",
      provider: config.provider,
      status: "skipped",
      message,
      sentAt: new Date().toISOString(),
      reason: "missing_phone"
    };
  }

  if (config.provider !== "webhook" || !config.webhookUrl) {
    return {
      channel: "kakao",
      provider: "mock",
      status: "mocked",
      message,
      sentAt: new Date().toISOString()
    };
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.webhookToken ? { Authorization: `Bearer ${config.webhookToken}` } : {})
      },
      body: JSON.stringify({
        channel: "kakao",
        type: "alimtalk",
        to,
        senderKey: config.senderKey,
        templateCode: config.templateCode,
        message,
        variables: {
          hotelName: config.hotelName,
          guestName: input.guestName,
          roomName: input.roomName,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          doorPasswordCode: input.doorPasswordCode,
          validText: input.validText
        }
      })
    });

    const json = await response.json().catch(() => null);
    return {
      channel: "kakao",
      provider: "webhook",
      status: response.ok ? "sent" : "failed",
      message,
      sentAt: new Date().toISOString(),
      response: json
    };
  } catch (error) {
    return {
      channel: "kakao",
      provider: "webhook",
      status: "failed",
      message,
      sentAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
}

function renderKakaoReservationMessage(input, config) {
  const validText = input.validText || `${input.checkInDate} ~ ${input.checkOutDate}`;
  return [
    `[${config.hotelName}] 객실 예약이 확정되었습니다.`,
    "",
    `${input.guestName || "고객"}님, ${input.roomName || "객실"} 예약이 완료되었습니다.`,
    `이용 일정: ${input.checkInDate} ~ ${input.checkOutDate}`,
    `출입 비밀번호: ${input.doorPasswordCode}`,
    `유효 시간: ${validText}`,
    "",
    "도어락에서 숫자 6자리를 입력한 뒤 * 버튼을 눌러주세요."
  ].join("\n");
}

function normalizePhone(phone = "") {
  return String(phone).replace(/\D/g, "").slice(0, 20);
}
