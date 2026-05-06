# Đặc tả: Xử lý thanh toán (Thành viên 1)

> **Phạm vi:** Xử lý thanh toán cho workshop có phí, Circuit Breaker, Idempotency Key chống trừ tiền hai lần.

---

## Mô tả

Khi sinh viên đăng ký workshop có phí, hệ thống:
1. Tạo payment record với trạng thái `PENDING`.
2. Gọi Mock Payment Gateway với cơ chế Circuit Breaker và Retry.
3. Dùng Idempotency Key để tránh trừ tiền hai lần khi client gửi lại request.
4. Cập nhật trạng thái registration theo kết quả thanh toán.
5. Cho phép sinh viên kiểm tra trạng thái thanh toán và thử lại khi phù hợp.

---

## Luồng chính

### Luồng: Xử lý thanh toán

```text
POST /api/registrations
  ├── [Validation & Idempotency checks]
  ├── [BEGIN TRANSACTION]
  │   ├── INSERT registrations (status=PENDING)
  │   ├── INSERT payments (status=PENDING, idempotency_key=?, amount=?)
  │   ├── UPDATE workshops SET remaining_seats = remaining_seats - 1
  │   └── [COMMIT]
  ├── [Call Payment Gateway with Circuit Breaker]
  │   ├── SUCCESS:
  │   │   ├── UPDATE payments SET status=SUCCESS, gateway_ref={ref}
  │   │   ├── UPDATE registrations SET status=CONFIRMED, qr_code={uuid}
  │   │   └── Return 201 {registrationId, status: CONFIRMED, qrCode}
  │   ├── FAILED:
  │   │   ├── UPDATE payments SET status=FAILED, error_message={msg}
  │   │   ├── Rollback registration và hoàn ghế
  │   │   └── Return 402 PAYMENT_DECLINED
  │   ├── TIMEOUT:
  │   │   ├── Không update trạng thái gateway thành SUCCESS
  │   │   ├── Rollback registration và hoàn ghế
  │   │   └── Return 504 PAYMENT_TIMEOUT
  │   └── CIRCUIT BREAKER OPEN:
  │       ├── Không gọi gateway
  │       ├── Rollback registration và hoàn ghế
  │       └── Return 503 PAYMENT_UNAVAILABLE
  └── [Async: Send email notification]
```

### Luồng: Check Payment Status

```text
GET /api/registrations/{registrationId}/payment-status
  ├── Header: Authorization
  ├── Xác thực registration thuộc user đang đăng nhập
  ├── SELECT * FROM payments WHERE registration_id = ?
  └── Return 200 {paymentId, status, amount, gatewayRef, createdAt, updatedAt}
```

### Luồng: Retry Payment

```text
POST /api/registrations/{registrationId}/payment/retry
  ├── Header: Authorization, Idempotency-Key
  ├── Xác thực registration thuộc user đang đăng nhập
  ├── Validate:
  │   ├── registration.status = PENDING
  │   ├── payment.status = FAILED
  │   └── Workshop chưa bắt đầu
  ├── [Call Payment Gateway with Circuit Breaker]
  │   ├── Nếu SUCCESS: registration → CONFIRMED, qr_code = new UUID
  │   ├── Nếu FAILED: registration → CANCELLED, hoàn ghế
  │   └── Return 201/402/504
  └── [Async: Send email notification]
```

### Thiết kế dữ liệu liên quan

- Bảng `payments` lưu `registration_id`, `workshop_id`, `user_id`, `amount`, `currency`, `status`, `idempotency_key`, `gateway_reference`, `error_message`, `created_at`, `updated_at`.
- Redis cache dùng key `payment:idempotency:{idempotencyKey}` với TTL 24 giờ để replay kết quả cũ khi client retry cùng key.
- Khi workshop bị hủy, các payment `SUCCESS` liên quan cần được chuyển sang luồng refund và registration liên quan bị `CANCELLED`.

### Hành vi Mock Payment Gateway

- `70%` `SUCCESS` → trả `200`.
- `10%` `FAILED` → trả `402`.
- `10%` `TIMEOUT` → không phản hồi trong `5s`.
- `10%` `CONNECTION_ERROR` → trả `500`.

---

## Kịch bản lỗi

| Tình huống | HTTP | Code | Hành vi |
|-----------|------|------|--------|
| **Gateway trả lỗi (402)** | 402 | `PAYMENT_DECLINED` | registration=`CANCELLED`, hoàn ghế, đề nghị retry |
| **Gateway timeout (>5s)** | 504 | `PAYMENT_TIMEOUT` | registration=`PENDING`, ghế được hoàn, sinh viên retry |
| **Circuit Breaker OPEN** | 503 | `PAYMENT_UNAVAILABLE` | registration=`CANCELLED`, hoàn ghế, graceful degradation |
| **DB transaction fail** | 500 | `PAYMENT_ERROR` | Rollback, không insert payment, sinh viên retry |
| **Idempotency Key trùng** | 200 | cached response | Trả lại kết quả cũ |
| **Retry khi registration CONFIRMED** | 409 | `PAYMENT_ALREADY_COMPLETED` | Báo lỗi, không xử lý |
| **Retry khi registration CANCELLED** | 409 | `PAYMENT_ALREADY_CANCELLED` | Báo lỗi, không xử lý |
| **Insufficient funds** | 402 | `INSUFFICIENT_FUNDS` | payment=`FAILED`, registration=`CANCELLED` |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Idempotency Key** | TTL `24h`, xác định duy nhất một giao dịch |
| **Timeout** | Payment Gateway phải phản hồi trong `< 5s` |
| **Circuit Breaker** | `50%` failure rate hoặc `80%` slow call thì chuyển `OPEN` |
| **Wait duration** | `OPEN` kéo dài `30s`, sau đó thử `HALF-OPEN` |
| **Retry limit** | Tối đa `3` lần gọi gateway |
| **Atomic transaction** | INSERT payment + UPDATE registration phải nhất quán |
| **Amount precision** | Giá tiền lưu dạng `DECIMAL(10,2)` |
| **No double charge** | Redis idempotency cache phải ngăn trừ tiền hai lần |
| **Graceful degradation** | Khi payment lỗi, các tính năng khác vẫn hoạt động bình thường |

---

## Tiêu chí chấp nhận

- ✅ Đăng ký có phí thành công thì registration chuyển `CONFIRMED` và có QR.
- ✅ Payment fail thì registration chuyển `CANCELLED` và ghế được hoàn lại.
- ✅ Payment timeout thì sinh viên có thể retry theo đúng trạng thái.
- ✅ Retry với cùng `Idempotency-Key` phải trả kết quả cũ, không gọi gateway lần hai.
- ✅ Circuit Breaker `OPEN` thì trả `503` ngay, không spam gateway.
- ✅ Organizer xem được thống kê payment theo workshop, trạng thái, khoảng thời gian.
- ✅ 100 concurrent checkout không tạo duplicate charge.

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
    "workshopId": "w1w2w3w4-...",
    "amount": 50000,
    "currency": "VND",
    "paymentStatus": "SUCCESS",
    "gatewayReference": "MOC_PAY_12345",
    "errorMessage": null,
    "createdAt": "2026-05-03T10:00:00Z",
    "updatedAt": "2026-05-03T10:05:00Z"
  }
}
```

**Response 404 — Không tìm thấy payment:**
```json
{
  "status": 404,
  "code": "PAYMENT_NOT_FOUND",
  "message": "Không tìm thấy thông tin thanh toán cho registration này."
}
```

**Response 403 — Không có quyền truy cập:**
```json
{
  "status": 403,
  "code": "FORBIDDEN",
  "message": "Bạn không có quyền xem thông tin thanh toán này."
}
```

---

#### `POST /api/registrations/{registrationId}/payment/retry`

Thử lại thanh toán cho registration có status `PENDING` hoặc `FAILED`.

**Header:** `Authorization: Bearer {accessToken}`, `Idempotency-Key: {UUID}`

**Path Params:**
- `registrationId` — UUID của registration

**Request Body:** (empty)
```json
{}
```

**Response 201 — Thanh toán thành công:**
```json
{
  "status": 201,
  "data": {
    "paymentId": "p1p2p3p4-...",
    "paymentStatus": "SUCCESS",
    "registrationStatus": "CONFIRMED",
    "qrCode": "qr-code-uuid",
    "message": "Thanh toán thành công. Vui lòng kiểm tra email xác nhận."
  }
}
```

**Response 402 — Thanh toán bị từ chối:**
```json
{
  "status": 402,
  "code": "PAYMENT_DECLINED",
  "message": "Thanh toán bị từ chối. Vui lòng kiểm tra thông tin thẻ hoặc thử lại."
}
```

**Response 504 — Payment timeout:**
```json
{
  "status": 504,
  "code": "PAYMENT_TIMEOUT",
  "message": "Thanh toán vượt quá thời gian chờ. Ghế đã được hoàn lại. Vui lòng thử đăng ký lại."
}
```

**Response 503 — Payment service unavailable (CB OPEN):**
```json
{
  "status": 503,
  "code": "PAYMENT_UNAVAILABLE",
  "message": "Dịch vụ thanh toán tạm thời không khả dụng. Ghế đã được hoàn lại. Vui lòng thử lại sau."
}
```

**Response 409 — Conflict (already completed/cancelled):**
```json
{
  "status": 409,
  "code": "REGISTRATION_ALREADY_COMPLETED",
  "message": "Đăng ký này đã được hoàn tất hoặc hủy. Không thể thực hiện thanh toán lại."
}
```

---

#### `GET /api/admin/payments/stats`

Xem thống kê thanh toán (`ORGANIZER` only).

**Header:** `Authorization: Bearer {accessToken}`

**Query Params:**
- `?from=2026-05-01&to=2026-05-05` — Lọc theo ngày (tùy chọn)
- `?workshopId=abc123` — Lọc theo workshop (tùy chọn)
- `?status=SUCCESS` — Lọc theo payment status: `SUCCESS`, `FAILED`, `TIMEOUT`, `PENDING`

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "totalPayments": 156,
    "totalAmount": 7800000,
    "currency": "VND",
    "byStatus": {
      "SUCCESS": {
        "count": 145,
        "amount": 7250000
      },
      "FAILED": {
        "count": 8,
        "amount": 400000
      },
      "TIMEOUT": {
        "count": 3,
        "amount": 150000
      },
      "PENDING": {
        "count": 0,
        "amount": 0
      }
    },
    "successRate": "92.95%",
    "averageAmount": 50000,
    "topWorkshops": [
      {
        "workshopId": "w1w2w3w4-...",
        "title": "AI trong giáo dục",
        "totalPayments": 45,
        "successCount": 42,
        "revenue": 2100000
      }
    ],
    "period": {
      "from": "2026-05-01T00:00:00Z",
      "to": "2026-05-05T23:59:59Z"
    }
  }
}
```




