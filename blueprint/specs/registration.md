# Đặc tả: Registration (Thành viên 1)

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
  ├── [3] Redis GET idem:{key} → nếu có → return cached response
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
  ├── [5] Redis SET idem:{key} {response} EX 86400
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
  │       ├── INSERT payments (status=PENDING, idempotency_key=?, amount=?)
  │       └── COMMIT
  │
  ├── [5] Call Payment Gateway (Circuit Breaker + Retry)
  │       ├── SUCCESS:
  │       │   ├── UPDATE payments SET status=SUCCESS, gateway_ref=?
  │       │   ├── UPDATE registrations SET status=CONFIRMED, qr_code=UUID.new()
  │       │   ├── Redis SET idem:{key} {response}
  │       │   ├── Async: EmailService.sendConfirmation()
  │       │   └── Return 201 {qrCode, status: CONFIRMED}
  │       │
  │       ├── TIMEOUT / FAILED:
  │       │   ├── UPDATE payments SET status=FAILED
  │       │   ├── UPDATE registrations SET status=CANCELLED
  │       │   ├── UPDATE workshops SET remaining_seats = remaining_seats + 1 (hoàn ghế)
  │       │   └── Return 504 PAYMENT_TIMEOUT
  │       │
  │       └── CB OPEN (fallback ngay):
  │           ├── UPDATE registrations SET status=CANCELLED
  │           ├── UPDATE workshops SET remaining_seats = remaining_seats + 1 (hoàn ghế)
  │           └── Return 503 PAYMENT_UNAVAILABLE
```

### Luồng C: Hủy đăng ký

```
DELETE /api/registrations/{registrationId}
  ├── Header: Authorization
  ├── [1] Xác thực: registrationId thuộc về user đang đăng nhập
  ├── [2] Kiểm tra workshop chưa bắt đầu (startTime > now)
  ├── [3] Kiểm tra registration status = CONFIRMED (không hủy WAITLISTED)
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
| **Thanh toán timeout (> 5s)** | 504 | `PAYMENT_TIMEOUT` | Hoàn ghế, yêu cầu retry |
| **Circuit Breaker OPEN** | 503 | `PAYMENT_UNAVAILABLE` | Hoàn ghế, graceful degradation |
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
| **Idempotency** | Retry với cùng key không gây duplicate charge hoặc duplicate registration |
| **QR uniqueness** | Mỗi registration CONFIRMED có 1 QR code duy nhất |
| **Rate limit** | 5 requests / 10 giây per user trên POST /registrations |
| **Timeout** | Nếu transaction > 2s → timeout và rollback, hoàn ghế |
| **Waitlist FIFO** | Khi có ghế trống, promote waitlisted theo thứ tự registered_at cũ nhất |

---

## Tiêu chí chấp nhận

- ✅ Đăng ký miễn phí nhận QR code ngay (status=CONFIRMED)
- ✅ Đăng ký có phí: nếu payment success → CONFIRMED + QR; nếu fail → CANCELLED + hoàn ghế
- ✅ Hết chỗ: sinh viên mới vào WAITLISTED, không nhận QR
- ✅ Khi ai đó hủy, sinh viên đầu tiên trong waitlist được promote → CONFIRMED + nhận QR + email
- ✅ Retry với cùng Idempotency-Key trả về kết quả cũ (header: X-Idempotent-Replayed: true)
- ✅ 50 concurrent requests cho workshop 1 chỗ cuối → chỉ 1 sinh viên được nhận chỗ (không có race condition)
- ✅ Circuit Breaker OPEN khi payment GW fail → hệ thống xem workshop vẫn hoạt động 100%
- ✅ Email xác nhận gửi async, không block response
- ✅ Pagination: danh sách registration hỗ trợ page & size
