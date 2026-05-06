# Đặc tả: Ngắt mạch (Thành viên 1)

> **Phạm vi:** Bảo vệ backend khỏi lỗi từ Mock Payment Gateway, graceful degradation.

---

## Mô tả

Khi Mock Payment Gateway liên tục fail, Circuit Breaker:
- **CLOSED:** Gọi gateway bình thường
- **OPEN:** Ngắt mạch, trả lỗi ngay lập tức (không gọi gateway)
- **HALF-OPEN:** Thử 1 request; nếu ok → CLOSED; nếu fail → OPEN lại

Mục tiêu: Ngăn backend spam lỗi, cho phép gateway recover, và **các tính năng khác vẫn hoạt động 100%** (graceful degradation).

---

## Luồng chính

### Luồng: 3 Trạng thái Circuit Breaker

```
Trạng thái CLOSED (bình thường)
  │
  ├── Mỗi request gọi Payment Gateway bình thường
  ├── Đếm failures trong sliding window (10 calls gần nhất)
  │
  └── Nếu:
      ├── failure_rate ≥ 50% (≥ 5 failures trong 10 calls)
      │   │   hoặc
      ├── slowCall_rate ≥ 80% (call > 2s được tính là slow failure)
      │
      └── → Chuyển sang OPEN (ngắt mạch)


Trạng thái OPEN (đang sự cố)
  │
  ├── Chặn TẤT CẢ request gọi Payment Gateway
  ├── Trả lỗi 503 ngay lập tức (không chờ timeout)
  ├── Xem workshop, checkin, etc. vẫn hoạt động 100%
  │
  └── Sau 30 giây (waitDurationInOpenState) → Chuyển HALF-OPEN


Trạng thái HALF-OPEN (đang thử phục hồi)
  │
  ├── Cho phép 1 request thử qua (permittedNumberOfCallsInHalfOpenState=1)
  │
  └── Nếu:
      ├── Request thành công:
      │   └── Chuyển CLOSED (phục hồi) → bắt đầu gọi gateway bình thường
      │
      └── Request thất bại:
          └── Chuyển OPEN (lại ngắt mạch) → chờ thêm 30s
```

### Cấu hình (application.yml)

```yaml
resilience4j:
  circuitbreaker:
    instances:
      payment:
        # Slide window config
        slidingWindowType: COUNT_BASED  # Dựa trên số lượng call
        slidingWindowSize: 10           # Xét 10 calls gần nhất
        
        # Failure threshold
        failureRateThreshold: 50        # 50% failure → OPEN
        slowCallRateThreshold: 80       # 80% slow call → OPEN
        slowCallDurationThreshold: 2000 # Call > 2s = slow call
        
        # State transition
        waitDurationInOpenState: 30s    # OPEN kéo dài 30s rồi → HALF-OPEN
        permittedNumberOfCallsInHalfOpenState: 1  # Cho 1 request thử
        automaticTransitionFromOpenToHalfOpenEnabled: true
        
        # Retry & fallback
        registerHealthIndicator: true  # Health check endpoint
        recordExceptions:
          - java.io.IOException
          - java.net.SocketTimeoutException
          - com.unihub.exception.PaymentGatewayException
          
  retry:
    instances:
      payment:
        maxAttempts: 3                  # Retry 2 lần (total 3 attempts)
        waitDuration: 500               # Chờ 500ms trước khi retry
        retryExceptions:
          - java.io.IOException
          - java.net.SocketTimeoutException

management:
  endpoints:
    web:
      exposure:
        include: health,circuitbreakers # Expose CB metrics
```

### Cài đặt service

```java
@Service
public class PaymentService {

    private final MockPaymentGatewayClient gatewayClient;
    private final RegistrationRepository registrationRepo;
    private final PaymentRepository paymentRepo;

    /**
     * Call Payment Gateway với Circuit Breaker + Retry
     * - CB: ngắt mạch khi failure_rate ≥ 50%
     * - Retry: thử 3 lần nếu IOException hoặc timeout
     */
    @CircuitBreaker(
        name = "payment",
        fallbackMethod = "paymentFallback"
    )
    @Retry(name = "payment")
    public PaymentResult processPayment(PaymentRequest request) {
        
        log.info("Processing payment: {}", request.getIdempotencyKey());
        
        try {
            // Gọi Mock Payment Gateway
            PaymentResult result = gatewayClient.pay(request);
            
            if (!result.isSuccess()) {
                throw new PaymentGatewayException(
                    "Gateway returned failure: " + result.getReason()
                );
            }
            
            return result;
            
        } catch (SocketTimeoutException e) {
            log.warn("Payment timeout: {}", e.getMessage());
            throw e;  // Retry mechanism sẽ xử lý
        }
    }

    /**
     * Fallback khi CB OPEN hoặc hết retry
     * - CB OPEN: gọi fallback ngay lập tức
     * - Retry exhausted: cũng gọi fallback
     */
    public PaymentResult paymentFallback(
            PaymentRequest request,
            Exception ex) {
        
        log.warn("Payment CB fallback triggered: {}", ex.getMessage());
        
        // Cách 1: Throw exception (client nhận 503)
        throw new PaymentUnavailableException(
            "Hệ thống thanh toán đang gián đoạn. " +
            "Vui lòng thử lại sau ít phút. " +
            "Chức năng xem workshop vẫn hoạt động bình thường.",
            ex
        );
        
        // Hoặc cách 2: Queue & retry sau (nếu muốn async recovery)
        // queueForLaterRetry(request);
        // return new PaymentResult(false, "QUEUED_FOR_RETRY");
    }
}
```

### Xử lý exception

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(PaymentUnavailableException.class)
    public ResponseEntity<ApiResponse> handlePaymentUnavailable(
            PaymentUnavailableException ex) {
        
        return ResponseEntity
            .status(503)
            .body(ApiResponse.error(
                503,
                "PAYMENT_UNAVAILABLE",
                ex.getMessage()
            ));
    }
}
```

### Xử lý phía frontend

```javascript
// React component
const handleRegister = async () => {
  try {
    const response = await registerWorkshop(workshopId);
    toast.success('Đăng ký thành công!');
  } catch (error) {
    if (error.status === 503) {
      // Circuit Breaker OPEN
      toast.error(
        'Hệ thống thanh toán đang gián đoạn. ' +
        'Các tính năng khác vẫn hoạt động bình thường. ' +
        'Vui lòng thử lại sau vài phút.'
      );
      // Show banner thay vì block UI
      setShowPaymentDownBanner(true);
    } else if (error.status === 504) {
      // Payment timeout
      toast.warning('Thanh toán bị timeout. Ghế đã được hoàn lại. Thử lại?');
    }
  }
};
```

---

## Kịch bản lỗi

| Tình huống | CB State | HTTP | Hành vi |
|-----------|----------|------|--------|
| **Payment GW OK** | CLOSED | 201 | Bình thường, đăng ký OK |
| **5/10 calls fail** | CLOSED→OPEN | 503 | Ngắt mạch, fallback 503 |
| **Request khi OPEN** | OPEN | 503 | Trả 503 ngay (không gọi GW) |
| **30s sau, try 1 call** | HALF-OPEN | 200 | Thành công → CLOSED (recover) |
| **30s sau, try 1 call fail** | HALF-OPEN | 503 | Thất bại → OPEN (30s nữa) |
| **Call > 2s (slow)** | CLOSED | 200 | Tính là slow failure, đếm vào threshold |
| **80% calls > 2s** | CLOSED→OPEN | — | Chuyển OPEN dù success rate cao |
| **IOException hoặc timeout** | CLOSED | — | Retry 2 lần, nếu vẫn fail → fallback |
| **CB config sai** | — | — | Warning log, CB disable, request pass |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Failure detection** | 50% failure rate trong 10 calls gần nhất → OPEN |
| **Slow call detection** | 80% calls > 2s → OPEN (tính là failure) |
| **Recovery time** | OPEN kéo dài 30s, sau đó HALF-OPEN |
| **HALF-OPEN test** | Cho 1 request thử; success → CLOSED; fail → OPEN |
| **Metrics** | Expose `/actuator/circuitbreakers/payment` |
| **Health check** | registerHealthIndicator=true → `/actuator/health/circuitbreakers` |
| **Retry behavior** | Max 3 attempts, exponential backoff 500ms |
| **Graceful degradation** | Xem workshop, check-in, etc. KHÔNG bị ảnh hưởng khi CB OPEN |

---

## Tiêu chí chấp nhận

- ✅ Payment GW fail 5/10 calls → CB chuyển OPEN → client nhận 503
- ✅ Khi CB OPEN, request tiếp theo trả 503 ngay lập tức (không timeout)
- ✅ Banner hiển thị: "Hệ thống thanh toán tạm gián đoạn" (graceful)
- ✅ Xem danh sách workshop vẫn hoạt động 100% khi CB OPEN
- ✅ Check-in không bị ảnh hưởng (CB chỉ wrap payment service)
- ✅ Sau 30s, CB thử 1 call; nếu ok → CLOSED (recover)
- ✅ Nếu lần thử còn fail → OPEN thêm 30s
- ✅ Metrics available: `/actuator/metrics/resilience4j.circuitbreaker.state`
- ✅ Health check: `/actuator/health/circuitbreakers` show status OPEN/CLOSED/HALF_OPEN
- ✅ Load test: 10 calls, 5 fail → CB OPEN, các call tiếp theo 503 (không slow)

---

---

## API Endpoints

#### `GET /api/circuit-breaker/status` — Check Circuit Breaker State

Cho phép ADMIN xem trạng thái hiện tại của circuit breaker cho cổng thanh toán.

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "state": "CLOSED",
    "failureRate": 10,
    "slowCallRate": 5
  }
}
```



