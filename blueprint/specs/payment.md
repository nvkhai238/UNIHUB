# Đặc tả: Xử lý thanh toán (Thành viên 1)

> **Phạm vi:** Xử lý thanh toán cho workshop có phí, SePay webhook, trạng thái thanh toán, timeout, refund, Circuit Breaker và Idempotency Key.

---

## Mô tả

Khi sinh viên đăng ký workshop có phí, hệ thống:
1. Tạo `Registration` trạng thái `PENDING` và giữ chỗ tạm thời.
2. Tạo `Payment` trạng thái `PENDING` với mã chuyển khoản `UHxxxxxx`.
3. Sinh viên chuyển khoản theo thông tin từ endpoint `payment-info`/QR SePay.
4. Webhook `/api/webhooks/sepay` xác nhận thanh toán, chuyển registration sang `CONFIRMED` và sinh QR check-in.
5. Scheduler hủy payment quá hạn sau 15 phút, hoàn ghế/promote waitlist.
6. Duy trì Circuit Breaker/Retry cho client mock gateway nội bộ phục vụ demo resilience, nhưng luồng chính hiện tại là SePay webhook.

---

## Luồng chính

### Luồng: Xử lý thanh toán

```text
POST /api/registrations
  ├── [Validation, rate limit, Redis idempotency]
  ├── [BEGIN TRANSACTION]
  │   ├── SELECT workshop FOR UPDATE
  │   ├── INSERT/REUSE registration (status=PENDING)
  │   ├── INSERT payment (status=PENDING, gateway_ref=UHxxxxxx, amount=workshop.price)
  │   ├── UPDATE workshops SET remaining_seats = remaining_seats - 1
  │   └── [COMMIT]
  ├── Cache response theo Idempotency-Key 24h
  └── Return 201 {registrationId, status: PENDING}

GET /api/registrations/{registrationId}/payment-info
  └── Return paymentCode=UHxxxxxx, amount, bankName, accountNumber, accountName

POST /api/webhooks/sepay
  ├── Nhận transferType/content/transferAmount từ SePay
  ├── Extract payment code bằng regex (UH\d{6})
  ├── Tìm Payment theo gateway_ref
  ├── Nếu amount >= payment.amount:
  │   ├── UPDATE payments SET status=SUCCESS, gateway_response={"status":"SEPAY_SUCCESS"}
  │   ├── UPDATE registrations SET status=CONFIRMED, qr_code=UUID, confirmed_at=now()
  │   └── Tạo notification PAYMENT_SUCCESS
  └── Nếu thiếu tiền/không tìm thấy mã: log warning, vẫn trả 200 để webhook không retry vô hạn
```

### Luồng: Check Payment Status

```text
GET /api/registrations/{registrationId}/payment-status
  ├── Header: Authorization
  ├── Xác thực registration thuộc user đang đăng nhập
  ├── SELECT latest payment WHERE registration_id = ?
  └── Return 200 {paymentId, status, amount, gatewayRef, createdAt, updatedAt}
```

### Luồng: Retry Payment

```text
POST /api/registrations/{registrationId}/payment/retry
  ├── Header: Authorization
  ├── Xác thực registration thuộc user đang đăng nhập
  ├── Validate registration.status = PENDING hoặc CANCELLED
  ├── Nếu CANCELLED: lock workshop, kiểm tra còn chỗ, giữ lại 1 ghế
  ├── Reset latest payment:
  │   ├── status = PENDING
  │   ├── gateway_ref = mã UHxxxxxx mới
  │   └── gateway_response = null
  ├── Nếu registration CANCELLED: chuyển lại PENDING
  ├── Cache response retry theo registrationId + user
  └── Return 200 {registrationId, status: PENDING}
```

### Thiết kế dữ liệu liên quan

- Bảng `payments` lưu `registration_id`, `amount`, `status`, `idempotency_key`, `gateway_ref`, `gateway_response`, `created_at`, `updated_at`.
- `gateway_ref` là mã `UHxxxxxx` để khớp nội dung chuyển khoản từ SePay.
- Redis cache dùng key `idem:{principal}:{uuid}` cho đăng ký và key retry sinh từ `registrationId + principal`, TTL 24 giờ.
- `PaymentTimeoutScheduler` quét payment `PENDING` quá 15 phút, chuyển `FAILED`, hủy registration, hoàn ghế hoặc promote waitlist.
- Khi workshop bị hủy, payment `SUCCESS` chuyển `REFUNDED`; sinh viên gửi yêu cầu hoàn tiền qua `refund_requests`.

### Hành vi Payment Demo Adapter

- `MockPaymentGatewayClient` trong backend mô phỏng `70% SUCCESS`, `20% FAILED`, `10% TIMEOUT` cho demo Circuit Breaker.
- `PaymentService.processPayment()` có `@CircuitBreaker(name = "payment")` và `@Retry(name = "payment")`.
- Luồng đăng ký thực tế không auto gọi mock gateway sau khi tạo payment; sinh viên tự chuyển khoản và hệ thống xác nhận qua SePay webhook.
- Service Node `src/mock-payment` trong Docker Compose chỉ là mock HTTP tối giản để kiểm tra container/network, không phải luồng thanh toán chính.

---

## Kịch bản lỗi

| Tình huống | HTTP | Code | Hành vi |
|-----------|------|------|--------|
| **Không tìm thấy payment** | 404 | `NOT_FOUND` | Báo lỗi cho trang trạng thái thanh toán |
| **Payment không thuộc user** | 403 | `FORBIDDEN` | Không cho xem payment-info/payment-status |
| **Webhook không có mã UH hợp lệ** | 200 | (accepted) | Log warning, không cập nhật payment |
| **Webhook amount thấp hơn amount cần thu** | 200 | (accepted) | Giữ payment=`PENDING`, chờ giao dịch đúng hoặc xử lý thủ công |
| **Payment PENDING quá 15 phút** | Async | `PENDING_PAYMENT_TIMEOUT` | payment=`FAILED`, registration=`CANCELLED`, hoàn ghế/promote waitlist |
| **Retry khi hết chỗ** | 409 | `WORKSHOP_FULL` | Không chuyển registration lại PENDING |
| **Retry khi registration không thuộc user** | 403 | `FORBIDDEN` | Reject |
| **Idempotency Key trùng** | 200 | cached response | Trả lại kết quả cũ |
| **Circuit Breaker OPEN trong demo gateway** | 503 | `PAYMENT_UNAVAILABLE` | Fallback không làm ảnh hưởng các route không liên quan payment |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Idempotency Key** | TTL `24h`, scope theo user/principal |
| **Payment timeout** | Payment `PENDING` quá `15 phút` bị hủy bởi scheduler chạy mỗi `60s` |
| **Circuit Breaker** | `50%` failure rate hoặc `80%` slow call thì chuyển `OPEN` cho demo gateway |
| **Wait duration** | `OPEN` kéo dài `30s`, sau đó thử `HALF-OPEN` |
| **Atomic transaction** | Registration, payment và remaining seats phải nhất quán trong transaction |
| **Amount precision** | Giá tiền lưu dạng `DECIMAL(10,2)` |
| **No double confirm** | Webhook idempotent: payment SUCCESS/registration CONFIRMED thì bỏ qua lần gọi sau |
| **Payment code uniqueness** | `payments.gateway_ref` cần unique khi khác null để mã `UHxxxxxx` chỉ trỏ tới một payment |
| **Graceful degradation** | Khi payment lỗi, xem workshop, auth, CSV, check-in vẫn hoạt động |

---

## Tiêu chí chấp nhận

- ✅ Đăng ký có phí tạo payment `PENDING` và mã `UHxxxxxx`.
- ✅ `GET payment-info` trả đủ thông tin để render QR SePay.
- ✅ Webhook SePay đúng mã và đủ tiền chuyển payment `SUCCESS`, registration `CONFIRMED`, sinh QR.
- ✅ Payment quá 15 phút chuyển `FAILED`, registration `CANCELLED`, ghế được hoàn/promote waitlist.
- ✅ Retry payment sinh mã `UHxxxxxx` mới và không tạo duplicate registration.
- ✅ Retry replay trả kết quả cũ khi key retry scoped đã được cache.
- ✅ Circuit Breaker có endpoint status cho organizer theo dõi.
- ✅ Organizer xem được thống kê payment theo workshop, trạng thái, khoảng thời gian.

---

## API Endpoints

### Base path: `/api`

#### `GET /api/registrations/{registrationId}/payment-status`

Xem trạng thái thanh toán của một registration.

**Header:** `Authorization: Bearer {accessToken}`

**Path Params:**
- `registrationId` — UUID của registration

**Response 200 — Thành công:**
```json
{
  "status": 200,
  "data": {
    "paymentId": "p1p2p3p4-...",
    "registrationId": "r1r2r3r4-...",
    "amount": 50000,
    "paymentStatus": "SUCCESS",
    "gatewayReference": "UH123456",
    "createdAt": "2026-05-03T10:00:00Z",
    "updatedAt": "2026-05-03T10:05:00Z"
  }
}
```

---

#### `GET /api/registrations/{registrationId}/payment-info`

Lấy thông tin chuyển khoản cho payment đang chờ.

**Header:** `Authorization: Bearer {accessToken}`

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "paymentCode": "UH123456",
    "amount": 50000,
    "bankName": "MBBank",
    "accountNumber": "0123456789",
    "accountName": "NGUYEN VAN A"
  }
}
```

---

#### `POST /api/registrations/{registrationId}/payment/retry`

Reset payment về `PENDING` và sinh mã `UHxxxxxx` mới.

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:** (empty)
```json
{}
```

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "id": "r1r2r3r4-...",
    "status": "PENDING",
    "qrCode": null
  }
}
```

---

#### `POST /api/webhooks/sepay`

Webhook công khai nhận thông báo chuyển khoản từ SePay.

**Request Body:**
```json
{
  "transferType": "in",
  "content": "Thanh toan UH123456",
  "transferAmount": 50000
}
```

**Response 200:**
```json
{
  "status": 200,
  "data": "Webhook processed"
}
```

---

#### `GET /api/admin/payments/stats`

Xem thống kê thanh toán (`ORGANIZER` only).

**Header:** `Authorization: Bearer {accessToken}`

**Query Params:**
- `?from=2026-05-01T00:00:00Z&to=2026-05-05T23:59:59Z` — Lọc theo thời gian (tùy chọn)
- `?workshopId=abc123` — Lọc theo workshop (tùy chọn)
- `?status=SUCCESS` — Lọc theo payment status: `SUCCESS`, `FAILED`, `PENDING`, `REFUNDED`

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "totalPayments": 156,
    "totalAmount": 7800000,
    "currency": "VND",
    "byStatus": {
      "SUCCESS": { "count": 145, "amount": 7250000 },
      "FAILED": { "count": 8, "amount": 400000 },
      "PENDING": { "count": 3, "amount": 150000 },
      "REFUNDED": { "count": 0, "amount": 0 }
    },
    "successRate": "92.95%",
    "averageAmount": 50000,
    "topWorkshops": []
  }
}
```

---

#### `GET /api/admin/payments/circuit-breaker-status`

Organizer xem trạng thái circuit breaker payment demo.

#### `GET /api/admin/refunds`

Organizer xem hàng đợi hoàn tiền.

#### `PATCH /api/admin/refunds/{refundRequestId}`

Organizer đánh dấu yêu cầu hoàn tiền đã xử lý/chưa xử lý.

#### `GET /api/refunds/my/registrations/{registrationId}`

Sinh viên xem yêu cầu hoàn tiền của registration.

#### `POST /api/refunds/my/registrations/{registrationId}`

Sinh viên tạo/cập nhật thông tin hoàn tiền sau khi workshop có phí bị hủy.
