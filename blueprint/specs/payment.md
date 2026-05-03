# Module Spec: Payment & Registration (Thành viên 1)

> **Phạm vi:** Đăng ký workshop (miễn phí và có phí), Rate Limiting, Circuit Breaker, Idempotency Key, hoàn ghế khi thanh toán thất bại.

---

## 1. Trách nhiệm module

| Trách nhiệm              | Mô tả                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Đăng ký workshop miễn phí | Kiểm tra chỗ, lock ghế, tạo registration CONFIRMED + phát QR ngay                            |
| Đăng ký workshop có phí  | Kiểm tra chỗ, lock ghế, tạo PENDING → gọi Mock Payment GW → cập nhật trạng thái               |
| Rate Limiting            | 5 request / 10 giây per user trên endpoint đăng ký; 30 req/10s cho đọc workshop               |
| Circuit Breaker          | Bảo vệ cuộc gọi đến Mock Payment Gateway — ngắt mạch khi failure rate >= 50%                   |
| Idempotency Key          | Chống trừ tiền hai lần khi client timeout và retry với cùng UUID                              |
| Hoàn ghế                 | Khi thanh toán thất bại/timeout hoặc CB OPEN → `remaining_seats += 1` trong cùng transaction  |
| Danh sách chờ            | Khi hết chỗ → tạo registration với status `WAITLISTED`                                        |

---

## 2. API Endpoints

### Base path: `/api`

#### `POST /api/registrations`

Đăng ký workshop. Header bắt buộc: `Idempotency-Key` (UUID v4 do client sinh).

**Header:**
```
Authorization: Bearer {accessToken}
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

**Request Body:**
```json
{
  "workshopId": "a1b2c3d4-..."
}
```

**Response 201 — Đăng ký thành công (có phí hoặc miễn phí):**
```json
{
  "status": 201,
  "data": {
    "registrationId": "r1r2r3r4-...",
    "workshopId": "a1b2c3d4-...",
    "workshopTitle": "Workshop AI trong giáo dục",
    "status": "CONFIRMED",
    "qrCode": "q1q2q3q4-...",
    "paymentStatus": "SUCCESS",
    "amount": 50000,
    "confirmedAt": "2026-05-03T09:00:00Z"
  }
}
```

**Response 201 — Vào danh sách chờ:**
```json
{
  "status": 201,
  "data": {
    "registrationId": "r1r2r3r4-...",
    "status": "WAITLISTED",
    "qrCode": null,
    "message": "Workshop đã hết chỗ. Bạn đã được thêm vào danh sách chờ."
  }
}
```

**Response 200 — Trả về từ cache (idempotent replay):**
```
Header: X-Idempotent-Replayed: true
Body: (giống response lần đầu)
```

**Response 409 — Đã đăng ký rồi:**
```json
{
  "status": 409,
  "code": "ALREADY_REGISTERED",
  "message": "Bạn đã đăng ký workshop này trước đó."
}
```

**Response 422 — Idempotency-Key không hợp lệ:**
```json
{
  "status": 422,
  "code": "INVALID_IDEMPOTENCY_KEY",
  "message": "Idempotency-Key phải là UUID v4 hợp lệ."
}
```

**Response 429 — Rate limit:**
```json
{
  "status": 429,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Quá nhiều yêu cầu. Vui lòng thử lại sau 10 giây."
}
```
Header: `Retry-After: 10`

**Response 503 — Circuit Breaker OPEN:**
```json
{
  "status": 503,
  "code": "PAYMENT_UNAVAILABLE",
  "message": "Hệ thống thanh toán đang gián đoạn. Vui lòng thử lại sau ít phút. Chức năng xem workshop vẫn hoạt động bình thường."
}
```

**Response 504 — Payment Gateway timeout:**
```json
{
  "status": 504,
  "code": "PAYMENT_TIMEOUT",
  "message": "Thanh toán thất bại do timeout. Ghế đã được hoàn lại. Vui lòng thử lại."
}
```

---

#### `GET /api/registrations/my`

Xem danh sách đăng ký của sinh viên đang đăng nhập.

**Header:** `Authorization: Bearer {accessToken}`

**Response 200:**
```json
{
  "status": 200,
  "data": [
    {
      "registrationId": "r1r2r3r4-...",
      "workshop": {
        "id": "a1b2c3d4-...",
        "title": "Workshop AI trong giáo dục",
        "startTime": "2026-05-10T08:00:00Z",
        "room": "B4-301"
      },
      "status": "CONFIRMED",
      "qrCode": "q1q2q3q4-...",
      "registeredAt": "2026-05-03T09:00:00Z"
    }
  ]
}
```

---

#### `DELETE /api/registrations/{registrationId}`

Hủy đăng ký (chỉ STUDENT, chỉ hủy registration của chính mình, chỉ khi chưa diễn ra).

**Response 200:**
```json
{
  "status": 200,
  "message": "Hủy đăng ký thành công. Ghế đã được hoàn lại."
}
```

---

#### `GET /api/admin/workshops/{workshopId}/registrations`

Danh sách đăng ký cho 1 workshop (chỉ ORGANIZER).

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "workshopId": "a1b2c3d4-...",
    "totalCapacity": 60,
    "confirmed": 45,
    "waitlisted": 12,
    "cancelled": 3,
    "registrations": [
      {
        "studentId": "21521234",
        "fullName": "Nguyễn Văn A",
        "email": "nguyenvana@university.edu.vn",
        "status": "CONFIRMED",
        "registeredAt": "2026-05-03T09:00:00Z"
      }
    ]
  }
}
```

---

## 3. Luồng đăng ký chi tiết

### Workshop miễn phí (`price = 0`)

```
POST /api/registrations
    │
    ├── [1] Validate Idempotency-Key (UUID v4 format)
    ├── [2] Rate limit check (Resilience4j)
    ├── [3] Redis GET idem:{key} → nếu có → return cached response
    ├── [4] BEGIN TRANSACTION
    │       SELECT * FROM workshops WHERE id = ? FOR UPDATE   <- Pessimistic Lock
    │       Kiểm tra remaining_seats > 0
    │           = 0: INSERT registrations (WAITLISTED), COMMIT, return 201 WAITLISTED
    │       Kiểm tra UNIQUE (user_id, workshop_id) → 409 nếu đã có
    │       INSERT registrations (status=CONFIRMED, qr_code=UUID.randomUUID())
    │       UPDATE workshops SET remaining_seats = remaining_seats - 1
    │       COMMIT
    ├── [5] Redis SET idem:{key} {response} EX 86400
    ├── [6] Async: EmailService.sendConfirmation(userId, workshopId)
    └── Return 201 với qrCode
```

### Workshop có phí (`price > 0`)

```
POST /api/registrations
    │
    ├── [1] Validate Idempotency-Key
    ├── [2] Rate limit check
    ├── [3] Redis GET idem:{key} → cached response?
    ├── [4] BEGIN TRANSACTION
    │       SELECT * FROM workshops WHERE id = ? FOR UPDATE
    │       Kiểm tra remaining_seats > 0
    │       Kiểm tra chưa đăng ký
    │       INSERT registrations (status=PENDING)
    │       UPDATE workshops SET remaining_seats = remaining_seats - 1
    │       INSERT payments (status=PENDING, idempotency_key=?)
    │       COMMIT
    ├── [5] Call Mock Payment Gateway (Circuit Breaker + Retry bao ngoài)
    │
    │   SUCCESS:
    │       UPDATE payments SET status=SUCCESS, gateway_ref=?
    │       UPDATE registrations SET status=CONFIRMED, qr_code=UUID.new(), confirmed_at=now()
    │       Redis SET idem:{key} {response} EX 86400
    │       Async: EmailService.sendConfirmation()
    │       Return 201 với qrCode
    │
    │   TIMEOUT / FAILED:
    │       UPDATE payments SET status=FAILED
    │       UPDATE registrations SET status=CANCELLED, cancelled_at=now()
    │       UPDATE workshops SET remaining_seats = remaining_seats + 1  <- Hoàn ghế
    │       Return 504
    │
    │   CB OPEN (fallback ngay lập tức):
    │       UPDATE registrations SET status=CANCELLED
    │       UPDATE workshops SET remaining_seats = remaining_seats + 1  <- Hoàn ghế
    │       Return 503
```

---

## 4. Rate Limiting

### Cấu hình `application.yml`

```yaml
resilience4j:
  ratelimiter:
    instances:
      registration:
        limitForPeriod: 5
        limitRefreshPeriod: 10s
        timeoutDuration: 0
      workshop-read:
        limitForPeriod: 30
        limitRefreshPeriod: 10s
        timeoutDuration: 0
```

### Triển khai Controller

```java
@PostMapping("/registrations")
@RateLimiter(name = "registration", fallbackMethod = "registrationRateLimitFallback")
public ResponseEntity<RegistrationResponse> register(
        @RequestHeader("Idempotency-Key") String idempotencyKey,
        @Valid @RequestBody RegistrationRequest request,
        @AuthenticationPrincipal UserDetails user) {
    return ResponseEntity.status(201)
        .body(registrationService.register(request, user.getId(), idempotencyKey));
}

public ResponseEntity<?> registrationRateLimitFallback(
        String idempotencyKey, RegistrationRequest req,
        UserDetails user, RequestNotPermitted ex) {
    return ResponseEntity.status(429)
        .header("Retry-After", "10")
        .body(ApiResponse.error(429, "RATE_LIMIT_EXCEEDED",
            "Quá nhiều yêu cầu. Vui lòng thử lại sau 10 giây."));
}
```

**Hành vi frontend khi nhận 429:**
- Disable nút đăng ký
- Hiển thị countdown 10 giây
- Tự động enable lại sau khi hết countdown

---

## 5. Circuit Breaker

### Cấu hình `application.yml`

```yaml
resilience4j:
  circuitbreaker:
    instances:
      payment:
        slidingWindowType: COUNT_BASED
        slidingWindowSize: 10
        failureRateThreshold: 50
        slowCallRateThreshold: 80
        slowCallDurationThreshold: 2000ms
        waitDurationInOpenState: 30s
        permittedNumberOfCallsInHalfOpenState: 1
        automaticTransitionFromOpenToHalfOpenEnabled: true
  retry:
    instances:
      payment:
        maxAttempts: 3
        waitDuration: 500ms
        retryExceptions:
          - java.io.IOException
          - java.net.SocketTimeoutException
```

### Triển khai PaymentService

```java
@Service
public class PaymentService {

    @CircuitBreaker(name = "payment", fallbackMethod = "paymentFallback")
    @Retry(name = "payment")
    public PaymentResult processPayment(PaymentRequest request) {
        return mockPaymentGatewayClient.pay(request);
    }

    public PaymentResult paymentFallback(PaymentRequest request, Exception ex) {
        log.warn("Payment CB triggered for request {}: {}", request.getIdempotencyKey(), ex.getMessage());
        throw new PaymentUnavailableException(
            "Hệ thống thanh toán đang gián đoạn. Vui lòng thử lại sau ít phút.");
    }
}
```

### 3 trạng thái CB và hành vi

| Trạng thái | Hành vi                                        | Chuyển trạng thái khi                        |
| ---------- | ---------------------------------------------- | -------------------------------------------- |
| CLOSED     | Gọi Payment GW bình thường, đếm failure        | failure rate >= 50% trong 10 calls → OPEN    |
| OPEN       | Trả lỗi ngay lập tức, không gọi GW             | Sau 30 giây → HALF_OPEN                      |
| HALF_OPEN  | Cho 1 request thử qua                          | Thành công → CLOSED; Thất bại → OPEN (thêm 30s) |

**Chức năng không bị ảnh hưởng khi CB OPEN:** Xem danh sách workshop, tìm kiếm, xem QR, check-in.

---

## 6. Idempotency Key

### Quy tắc

- Client sinh `crypto.randomUUID()` trước khi gọi API, lưu vào `sessionStorage[workshopId]`
- Header bắt buộc: `Idempotency-Key: <UUID v4>`
- Server validate format UUID v4 — trả 422 nếu sai format
- Key được bind với `userId` — server validate key chưa được dùng bởi user khác
- TTL 24h: đủ để cover retry trong ngày sự kiện

### Triển khai IdempotencyService

```java
@Component
public class IdempotencyService {
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private static final Duration TTL = Duration.ofHours(24);

    public Optional<String> getCachedResponse(String key) {
        try {
            return Optional.ofNullable(redisTemplate.opsForValue().get("idem:" + key));
        } catch (Exception e) {
            log.warn("Redis unavailable for idempotency check, proceeding: {}", e.getMessage());
            return Optional.empty();  // Fail open
        }
    }

    public void cacheResponse(String key, Object response) {
        try {
            String json = objectMapper.writeValueAsString(response);
            redisTemplate.opsForValue().setIfAbsent("idem:" + key, json, TTL);
        } catch (Exception e) {
            log.warn("Failed to cache idempotency response: {}", e.getMessage());
        }
    }
}
```

### Luồng retry với cùng key

```
Client timeout → Retry với cùng Idempotency-Key
Server:
  1. Redis GET idem:{key} → tìm thấy response cũ
  2. Return cached response
  3. Header: X-Idempotent-Replayed: true
  4. KHÔNG gọi Payment Gateway lần nào nữa
```

---

## 7. Mock Payment Gateway

Mock Payment Gateway là service đơn giản để test Circuit Breaker và Idempotency. Không cần tài khoản merchant thật.

**Endpoint Mock:** `POST http://mock-payment-gw/pay`

**Request:**
```json
{
  "idempotencyKey": "550e8400-...",
  "amount": 50000,
  "description": "Đăng ký workshop AI trong giáo dục"
}
```

**Response được mock ngẫu nhiên theo tỷ lệ:**

| Kịch bản    | Tỷ lệ | HTTP | Body                                               |
| ----------- | ----- | ---- | -------------------------------------------------- |
| SUCCESS     | 70%   | 200  | `{"ref": "GW-001", "status": "SUCCESS"}`           |
| FAILED      | 20%   | 400  | `{"status": "FAILED", "reason": "INSUFFICIENT_FUNDS"}` |
| TIMEOUT     | 10%   | —    | Delay 5000ms → ConnectTimeout                      |

---

## 8. Checklist triển khai (Thành viên 1)

- [ ] Tạo `RegistrationService` với phân nhánh free/paid
- [ ] Implement Pessimistic Lock: `@Lock(LockModeType.PESSIMISTIC_WRITE)` trong `WorkshopRepository`
- [ ] Tạo `PaymentService` với `@CircuitBreaker` + `@Retry`
- [ ] Tạo `MockPaymentGatewayClient` (RestTemplate/WebClient) với timeout config
- [ ] Tạo `IdempotencyService` — Redis SET NX EX
- [ ] Thêm `@RateLimiter` annotation lên `RegistrationController`
- [ ] Xử lý `RequestNotPermitted` → 429 với header `Retry-After`
- [ ] Xử lý hoàn ghế trong mọi nhánh thất bại
- [ ] Validate `Idempotency-Key` header — UUID v4 regex
- [ ] Test: race condition với 50 concurrent requests cho workshop 1 chỗ cuối
- [ ] Test: retry với cùng idempotency key → X-Idempotent-Replayed header
- [ ] Test: CB chuyển CLOSED → OPEN → HALF_OPEN → CLOSED
