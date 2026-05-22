# StayPass 객실관리 앱 프로토타입

고객이 모바일 앱에서 객실을 예약하고 결제하면, 예약 기간에만 사용할 수 있는 락프로 H5000 IOT / Tuya Zigbee 도어락 임시 비밀번호를 발급하는 흐름의 프론트엔드 프로토타입입니다.

## 실행

```bash
npm install
npm run live
```

실제 Tuya API가 붙은 미리보기 서버는 기본으로 `http://127.0.0.1:4173`에서 열립니다.

## 현재 구현

- 객실 선택, 투숙객 정보, 체크인/체크아웃 날짜 입력
- 모의 결제 승인
- 체크인일 15:00부터 체크아웃일 11:00까지 유효한 6자리 임시 비밀번호 생성
- Tuya Cloud `password-ticket` 요청
- ticket key 복호화 후 비밀번호 AES 암호화
- Tuya Cloud `door-lock/temp-password` 실제 등록 요청
- Zigbee lock용 `issue-password` 동기화 요청
- `delivery_status` 조회
- 고객 안내 메시지 미리보기
- Tuya Smart Lock API 응답 상태 표시

## 실제 서비스 전환 구조

프로덕션에서는 비밀번호 발급 로직을 프론트엔드가 아니라 서버에서 처리해야 합니다.

1. 앱에서 예약 요청 생성
2. PG 결제창 또는 인앱 결제 진행
3. PG 웹훅을 서버가 검증
4. 서버가 예약 상태를 `paid`로 변경
5. 서버가 Tuya Cloud API에서 password ticket 요청
6. 서버가 6자리 비밀번호를 AES-128-ECB/PKCS7 방식으로 암호화
7. 서버가 Tuya `door-lock/temp-password` API 호출
8. 성공/실패 상태를 폴링하거나 재시도 큐에 등록
9. 성공 시 카카오 알림톡/SMS/앱 푸시로 고객에게 비밀번호 전달
10. 체크아웃 후 비밀번호 삭제 또는 만료 상태 동기화

## 실제 H5000 연결 방법

1. Tuya IoT Platform에서 Cloud Project를 생성합니다.
2. H5000이 연결된 Tuya/Smart Life 계정을 프로젝트에 Link Devices로 연결합니다.
3. Cloud Project의 Authorization Key에서 Access ID와 Access Secret을 확인합니다.
4. H5000의 `device_id`를 확인합니다.
5. `.env.example`을 `.env`로 복사하고 값을 채웁니다.
6. `npm run live`를 실행합니다.
7. 앱에서 `실제 발급`을 누릅니다.
8. 운영 콘솔의 `delivery_status`가 `2`가 되면 키패드에서 해당 6자리 번호로 열려야 합니다.

Tuya 문서 기준 Zigbee lock의 `delivery_status`는 다음 의미입니다.

- `1`: 비밀번호 설정 중
- `2`: 비밀번호 설정 성공
- `3`: 비밀번호 설정 실패
- `4`: 비밀번호가 이미 존재
- `5`: 비밀번호 개수 초과
- `6`: 유효 기간 겹침

`delivery_status`가 `2`가 아닌 경우에는 도어락에 비밀번호가 아직 내려가지 않았거나 실패한 상태라서 문이 열리지 않습니다.

## 확인해야 할 장비 조건

- 락프로 H5000 IOT 모델이 Tuya Cloud 프로젝트에 연결되어 있어야 합니다.
- Zigbee 모델은 게이트웨이와 도어락의 온라인 상태가 중요합니다.
- Tuya 문서 기준 Zigbee lock 임시 비밀번호는 원본 6자리입니다.
- Tuya Cloud API에서 해당 `device_id`가 smart lock API 권한을 가져야 합니다.
- 일부 배치 또는 펌웨어는 임시 비밀번호 기능 지원 여부가 다를 수 있어, 실제 H5000 장비 1대로 API 발급 테스트가 필요합니다.

## 필요한 환경 변수 예시

```bash
TUYA_ACCESS_ID=
TUYA_ACCESS_SECRET=
TUYA_ENDPOINT=https://openapi-sg.iotbing.com
TUYA_ROOM_1201_DEVICE_ID=
PAYMENT_WEBHOOK_SECRET=
NOTIFICATION_PROVIDER_KEY=
```

한국 리전/계정이면 Tuya 프로젝트가 사용하는 데이터센터에 맞춰 endpoint를 바꿔야 합니다.

## 자주 막히는 지점

- Tuya 데이터센터 endpoint가 프로젝트와 다르면 `sign invalid` 또는 권한 오류가 납니다.
- Cloud Project에 Smart Lock 관련 API 권한이 없으면 호출이 실패합니다.
- H5000이 Zigbee 게이트웨이와 온라인 상태가 아니면 `delivery_status`가 성공으로 바뀌지 않을 수 있습니다.
- 같은 시간대에 겹치는 임시 비밀번호 정책이 있으면 Zigbee lock에서 `delivery_status: 6`이 나올 수 있습니다.
- ticket 복호화가 실패하면 `.env`의 `TUYA_AES_SECRET_MODE`를 `first16`, `last16`, `full32`, `sha256` 순서로 바꿔 테스트합니다.
