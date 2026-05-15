# Đặc tả: Giới hạn tần suất (Thành viên 1)

> **Phạm vi:** Kiểm soát tải đột biến, chống brute-force, đảm bảo công bằng giữa sinh viên.

---

## Mô tả

Hệ thống giới hạn số request mỗi sinh viên có thể gửi trong 10 giây để:
- Ngăn chặn sinh viên spam request (DoS)
- Bảo vệ backend khỏi bị quá tải
- Đảm bảo công bằng: người nhanh tay không chiếm hết tài nguyên

---

## Luồng chính

### Luồng: Sliding Window Rate Limiting

```
POST /api/registrations
  │
  ├── [1] Extract user ID từ JWT token
  │
  ├── [2] RegistrationSlidingWindowService (Redis Sorted Set)
  │       ├── Key: rate:registration:{principal}
  │       ├── Remove request cũ hơn 10 giây
  │       ├── Count request của user trong window hiện tại
  │       │
  │       ├── Nếu count < limitForPeriod (5):
  │       │   ├── Increment counter
  │       │   ├── Cho request đi vào (pass-through)
  │       │   └── Xử lý business logic bình thường
  │       │
  │       └── Nếu count >= 5:
  │           ├── Không gọi business logic
  │           └── Return 429 {
  │               "status": 429,
  │               "code": "RATE_LIMIT_EXCEEDED",
  │               "message": "Quá nhiều yêu cầu. Vui lòng thử lại sau 10 giây."
  │             }
  │             Headers: Retry-After: 10
  │
  └── Response → Client
```

### Cấu hình (application.yml)

```yaml
resilience4j:
  ratelimiter:
    instances:
      registration:
        limitForPeriod: 5              # 5 requests
        limitRefreshPeriod: 10s         # per 10 seconds
        timeoutDuration: 0              # Fail fast, không queue
        registerHealthIndicator: true   # Expose health check
        
      workshop-read:
        limitForPeriod: 30              # 30 requests
        limitRefreshPeriod: 10s
        timeoutDuration: 0

management:
  endpoints:
    web:
      exposure:
        include: health,metrics         # Expose rate limiter metrics
```

### Cài đặt controller/service

```java
@RestController
@RequestMapping("/api")
public class RegistrationController {

    @PostMapping("/registrations")
    public ResponseEntity<RegistrationResponse> register(
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody RegistrationRequest request,
            Authentication authentication) {
        if (!registrationSlidingWindowService.tryAcquire(authentication.getName())) {
            long retryAfter = registrationSlidingWindowService.retryAfterSeconds();
            return ResponseEntity
                .status(429)
                .header("Retry-After", String.valueOf(retryAfter))
                .body(ApiResponse.error(
                    429,
                    "RATE_LIMIT_EXCEEDED",
                    "Quá nhiều yêu cầu. Vui lòng thử lại sau " + retryAfter + " giây."
                ));
        }
        
        // Business logic
        return ResponseEntity.status(201).body(...);
    }

    @GetMapping("/workshops")
    public ResponseEntity<?> getWorkshops(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // WorkshopReadSlidingWindowService: 30 req/10s
        // ...
        return ResponseEntity.ok(...);
    }
}
```

### Xử lý phía frontend

```javascript
// React component
const [isLoading, setIsLoading] = useState(false);
const [cooldown, setCooldown] = useState(0);

const handleRegister = async () => {
  if (cooldown > 0) {
    toast.warning(`Vui lòng đợi ${cooldown}s trước khi thử lại`);
    return;
  }
  
  try {
    setIsLoading(true);
    const response = await fetch('/api/registrations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Idempotency-Key': crypto.randomUUID(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workshopId })
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 10;
      setCooldown(parseInt(retryAfter));
      
      // Countdown timer
      const interval = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      toast.error('Quá nhiều yêu cầu. Vui lòng đợi...');
    } else if (response.ok) {
      toast.success('Đăng ký thành công!');
    }
  } finally {
    setIsLoading(false);
  }
};

return (
  <button 
    onClick={handleRegister}
    disabled={isLoading || cooldown > 0}
  >
    {cooldown > 0 ? `Chờ ${cooldown}s...` : 'Đăng ký'}
  </button>
);
```

---

## Kịch bản lỗi

| Tình huống | HTTP | Hành vi |
|-----------|------|--------|
| **User gửi 6 requests trong 10s** | 429 | 5 requests đầu pass, thứ 6 reject với Retry-After: 10 |
| **User gửi nhiều requests liên tục** | 429 | Mỗi lần vượt → 429, countdown reset lại 10s |
| **Window slide qua, request mới lại được tiếp** | 200 | Sau 10s, counter reset, request mới đi được |
| **Nhiều user cùng rate limit** | 429 | Rate limit per user (userId), không ảnh hưởng user khác |
| **Redis unavailable** | 200/201 | Fail-open: cho request đi tiếp, dựa vào DB lock/idempotency để bảo vệ consistency |
| **Config limit/window sai** | — | Dùng default trong service/config, không crash app |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Per-user isolation** | Rate limit tính riêng từng user (userId từ JWT) |
| **Sliding window** | Không fixed window (tránh burst ở edge) |
| **Timeout behavior** | timeoutDuration=0 → fail fast (không queue) |
| **Endpoints** | POST /registrations: 5 req/10s; GET /workshops: 30 req/10s |
| **Metrics** | Actuator expose `health,metrics`; custom Redis keys có thể quan sát qua Redis |
| **Health check** | Redis health và app health qua `/actuator/health` |
| **Logging** | Log mỗi lần 429, nhưng không log spam (max log rate) |

---

## Tiêu chí chấp nhận

- ✅ Sinh viên A gửi 5 requests → pass; request thứ 6 → 429
- ✅ Response 429 có header `Retry-After: 10`
- ✅ Frontend countdown timer hiển thị "Chờ 10s..."
- ✅ Sau 10s, user có thể gửi request mới
- ✅ User B không bị ảnh hưởng bởi rate limit của user A
- ✅ Xem workshop endpoint (30 req/10s) không bị limit chặt như registration (5 req/10s)
- ✅ Redis sliding window keys `rate:registration:*` và `rate:workshop-read:*` được set TTL
- ✅ Nếu Redis lỗi → request không bị crash, hệ thống fail-open
- ✅ Rate limit không block non-API requests (static files, health check)
- ✅ Load test: 1000 users trong 10 phút → backend không sập, rate limit hoạt động

---

## API Endpoints

#### `POST /api/registrations` — Endpoint áp dụng rate limit



