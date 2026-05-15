# Đặc tả: Đăng ký workshop (Thành viên 1)

> **Phạm vi:** Đăng ký workshop (miễn phí và có phí), quản lý chỗ ngồi, danh sách chờ, QR code.

---

## Mô tả

Sinh viên có thể đăng ký tham dự workshop. Hệ thống phải đảm bảo:
- Không overbooking (pessimistic lock)
- QR code được phát ngay sau khi đăng ký thành công
- Hỗ trợ cả workshop miễn phí và có phí
- Khi hết chỗ, sinh viên vào danh sách chờ (waitlisted)

---

## Luồng chính

### Luồng A: Đăng ký workshop miễn phí (price = 0)

```
POST /api/registrations
  ├── Header: Authorization: Bearer {accessToken}, Idempotency-Key: UUID
  ├── Body: {workshopId}
  │
  ├── [1] Validate Idempotency-Key (UUID v4 format)
  ├── [2] Rate limit check (Resilience4j)
  ├── [3] Redis GET idem:{principal}:{key} → nếu có → return cached response
  │
  ├── [4] BEGIN TRANSACTION
  │       ├── SELECT * FROM workshops WHERE id = ? FOR UPDATE (Pessimistic Lock)
  │       ├── Kiểm tra remaining_seats > 0
  │       │   - Nếu = 0: INSERT registrations (WAITLISTED), COMMIT → 201 WAITLISTED
  │       │   - Nếu > 0: tiếp tục
  │       ├── Kiểm tra UNIQUE (user_id, workshop_id)
  │       │   - Nếu đã tồn tại: ROLLBACK → 409 ALREADY_REGISTERED
  │       ├── INSERT registrations (status=CONFIRMED, qr_code=UUID.randomUUID())
  │       ├── UPDATE workshops SET remaining_seats = remaining_seats - 1
  │       └── COMMIT
  │
  ├── [5] Redis SET idem:{principal}:{key} {response} EX 86400
  ├── [6] Async: EmailService.sendRegistrationConfirmation(userId, workshopId, qrCode)
  └── Return 201 {registrationId, status: CONFIRMED, qrCode, confirmedAt}
```

### Luồng B: Đăng ký workshop có phí (price > 0)

```
POST /api/registrations
  ├── Header: Authorization, Idempotency-Key
  ├── Body: {workshopId}
  │
  ├── [1-3] Validate & Rate limit & Idem check (giống Luồng A)
  │
  ├── [4] BEGIN TRANSACTION
  │       ├── SELECT * FROM workshops WHERE id = ? FOR UPDATE
  │       ├── Kiểm tra remaining_seats
  │       │   - Nếu = 0: INSERT registrations (WAITLISTED) → COMMIT → 201 WAITLISTED
  │       ├── INSERT registrations (status=PENDING, qr_code=null)
  │       ├── UPDATE workshops SET remaining_seats = remaining_seats - 1
  │       ├── INSERT payments (status=PENDING, gateway_ref="UHxxxxxx", amount=?)
  │       └── COMMIT
  │
  ├── [5] Redis SET idem:{principal}:{key} {response} EX 86400
  ├── [6] Sinh viên mở trang payment-info để lấy mã UHxxxxxx, số tiền và tài khoản nhận
  ├── [7] SePay webhook POST /api/webhooks/sepay khi nhận chuyển khoản
  │       ├── Extract gateway_ref UHxxxxxx từ nội dung chuyển khoản
  │       ├── Nếu amount >= payment.amount:
  │       │   ├── UPDATE payments SET status=SUCCESS
  │       │   ├── UPDATE registrations SET status=CONFIRMED, qr_code=UUID.new()
  │       │   └── Async: in-app/email payment success
  │       └── Nếu amount thiếu: giữ PENDING để đối soát/retry
  ├── [8] PaymentTimeoutScheduler quét mỗi 60s
  │       └── Nếu PENDING quá 15 phút: payment=FAILED, registration=CANCELLED, hoàn ghế/promote waitlist
  └── Return 201 {registrationId, status: PENDING, qrCode: null}
```

### Luồng C: Hủy đăng ký

```
DELETE /api/registrations/{registrationId}
  ├── Header: Authorization
  ├── [1] Xác thực: registrationId thuộc về user đang đăng nhập
  ├── [2] Xác thực registration thuộc về user đang đăng nhập
  ├── [3] Với workshop có phí: chỉ cho sinh viên tự hủy khi registration còn PENDING
  ├── [4] BEGIN TRANSACTION
  │       ├── UPDATE registrations SET status=CANCELLED, cancelled_at=now()
  │       ├── UPDATE workshops SET remaining_seats = remaining_seats + 1
  │       ├── Kiểm tra waitlist: SELECT TOP 1 FROM registrations 
  │       │   WHERE workshop_id=? AND status=WAITLISTED ORDER BY registered_at
  │       ├── Nếu có waitlisted:
  │       │   ├── UPDATE registration SET status=CONFIRMED, qr_code=UUID.new()
  │       │   ├── Async: EmailService.notifyWaitlistedPromoted()
  │       └── COMMIT
  └── Return 200 {message: "Hủy đăng ký thành công. Ghế đã được hoàn lại."}
```

---

## Kịch bản lỗi

| Tình huống | HTTP | Code | Hành vi |
|-----------|------|------|--------|
| **Idempotency-Key không hợp lệ (không UUID v4)** | 422 | `INVALID_IDEMPOTENCY_KEY` | Reject ngay, không xử lý |
| **Vượt rate limit (>5 req/10s)** | 429 | `RATE_LIMIT_EXCEEDED` | Trả Retry-After: 10 |
| **Đã đăng ký workshop này trước đó** | 409 | `ALREADY_REGISTERED` | Báo lỗi, không xử lý lại |
| **Workshop hết chỗ** | 201 | (success) | Thêm vào waitlisted, status=WAITLISTED |
| **Thanh toán quá hạn (> 15 phút)** | Async | `PENDING_PAYMENT_TIMEOUT` | Scheduler chuyển payment=`FAILED`, registration=`CANCELLED`, hoàn ghế/promote waitlist |
| **SePay webhook thiếu tiền** | 200 | (webhook accepted) | Giữ payment=`PENDING`, không confirm registration |
| **Workshop không tồn tại** | 404 | `WORKSHOP_NOT_FOUND` | Báo lỗi |
| **Hủy khi workshop đang diễn ra** | 409 | `WORKSHOP_IN_PROGRESS` | Không cho phép hủy |
| **Hủy danh sách chờ** | 200 | (success) | Cho phép hủy WAITLISTED, không hoàn ghế |
| **Redis unavailable (idempotency)** | 200/201 | (success) | Fail open: tiếp tục xử lý, không cache |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Concurrency** | Pessimistic Lock `SELECT FOR UPDATE` đảm bảo tuyệt đối không có 2 SV nhận cùng chỗ cuối |
| **Race condition** | Mọi INSERT/UPDATE trong một transaction atomic, không có dirty reads |
| **Consistency** | Số lượng confirmed + waitlisted ≤ capacity; confirmed ≥ 0; waitlisted ≥ 0 |
| **Unique registration** | DB phải có `UNIQUE (user_id, workshop_id)` để chặn duplicate và cho phép reuse record `CANCELLED` |
| **Idempotency** | Retry với cùng key không gây duplicate charge hoặc duplicate registration |
| **QR uniqueness** | Mỗi registration CONFIRMED có 1 QR code duy nhất |
| **Rate limit** | 5 requests / 10 giây per user trên POST /registrations |
| **Payment timeout** | Payment `PENDING` quá 15 phút sẽ bị scheduler hủy và hoàn ghế |
| **Waitlist FIFO** | Khi có ghế trống, promote waitlisted theo thứ tự registered_at cũ nhất |

---

## Tiêu chí chấp nhận

- ✅ Đăng ký miễn phí nhận QR code ngay (status=CONFIRMED)
- ✅ Đăng ký có phí: tạo registration/payment `PENDING`, nhận webhook đủ tiền → CONFIRMED + QR; quá hạn → CANCELLED + hoàn ghế
- ✅ Hết chỗ: sinh viên mới vào WAITLISTED, không nhận QR
- ✅ Khi ai đó hủy, sinh viên đầu tiên trong waitlist được promote → CONFIRMED + nhận QR + email
- ✅ Retry với cùng Idempotency-Key trả về kết quả cũ (header: X-Idempotent-Replayed: true)
- ✅ 50 concurrent requests cho workshop 1 chỗ cuối → chỉ 1 sinh viên được nhận chỗ (không có race condition)
- ✅ Circuit Breaker OPEN khi payment GW fail → hệ thống xem workshop vẫn hoạt động 100%
- ✅ Email xác nhận gửi async, không block response
- ✅ Pagination: danh sách registration hỗ trợ page & size

## API Endpoints

#### `POST /api/registrations`

Sinh viên đăng ký workshop. Áp dụng cho cả workshop miễn phí và workshop có phí.

#### `GET /api/registrations/my`

Sinh viên xem danh sách đăng ký của chính mình.

#### `GET /api/registrations/my/workshops/{workshopId}`

Sinh viên xem registration hiện tại của mình cho một workshop cụ thể.

#### `GET /api/registrations/{registrationId}`

Sinh viên xem chi tiết một registration thuộc về chính mình.

#### `GET /api/registrations/{registrationId}/qr`

Sinh viên lấy QR data URI khi registration đã `CONFIRMED`.

#### `POST /api/registrations/{registrationId}/payment/retry`

Sinh viên reset payment `PENDING` với mã `UHxxxxxx` mới cho registration `PENDING` hoặc `CANCELLED` còn có thể giữ chỗ lại. Idempotency retry được sinh từ `registrationId + user`, không yêu cầu header riêng.

#### `DELETE /api/registrations/{registrationId}`

Sinh viên hủy đăng ký trước khi workshop bắt đầu.

#### `GET /api/workshops/{workshopId}/registrations`

Ban tổ chức xem danh sách đăng ký theo workshop, trạng thái và phân trang.

**Query Params:**
- `?workshopId=abc123` — Lọc theo workshop ID (chỉ ORGANIZER).
- `?status=CONFIRMED` — Lọc theo trạng thái đăng ký.

**Response 200:**
```json
{
  "status": 200,
  "data": [
    {
      "id": "reg123",
      "workshopId": "abc123",
      "userId": "user456",
      "status": "CONFIRMED",
      "qrCode": "qr123",
      "createdAt": "2026-05-01T10:00:00Z"
    }
  ]
}
```




