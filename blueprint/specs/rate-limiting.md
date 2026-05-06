# Đặc tả: Rate Limiting (Thành viên 1)

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
POST /api/registrations (hoặc bất kỳ endpoint có @RateLimiter)
  │
  ├── [1] Extract user ID từ JWT token
  │
  ├── [2] RateLimiter Filter (Resilience4j)
  │       ├── Check sliding window (10 giây gần nhất)
  │       ├── Count request của user trong window
  │       │
  │       ├── Nếu count < limitForPeriod (5):
  │       │   ├── Increment counter
  │       │   ├── Cho request đi vào (pass-through)
  │       │   └── Xử lý business logic bình thường
  │       │
  │       └── Nếu count >= 5:
  │           ├── Gọi fallbackMethod: registrationRateLimitFallback()
  │           └── Return 429 {
  │               "status": 429,
  │               "code": "RATE_LIMIT_EXCEEDED",
  │               "message": "Quá nhiều yêu cầu. Vui lòng thử lại sau 10 giây."
  │             }
  │             Headers: Retry-After: 10
  │
  └── Response → Client
```

### Configuration (application.yml)

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

### Controller Implementation

```java
@RestController
@RequestMapping("/api")
public class RegistrationController {

    @PostMapping("/registrations")
    @RateLimiter(name = "registration", 
                 fallbackMethod = "registrationRateLimitFallback")
    public ResponseEntity<RegistrationResponse> register(
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody RegistrationRequest request,
            @AuthenticationPrincipal UserDetails user) {
        
        // Business logic
        return ResponseEntity.status(201)
            .body(registrationService.register(request, user.getId(), idempotencyKey));
    }

    // Fallback method được gọi khi vượt rate limit
    public ResponseEntity<?> registrationRateLimitFallback(
            String idempotencyKey,
            RegistrationRequest request,
            UserDetails user,
            RequestNotPermitted ex) {
        
        return ResponseEntity
            .status(429)
            .header("Retry-After", "10")
            .body(ApiResponse.error(
                429,
                "RATE_LIMIT_EXCEEDED",
                "Quá nhiều yêu cầu. Vui lòng thử lại sau 10 giây."
            ));
    }

    @GetMapping("/workshops")
    @RateLimiter(name = "workshop-read")
    public ResponseEntity<?> getWorkshops(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // ...
        return ResponseEntity.ok(...);
    }

    @GetMapping("/rate-limits")
    public ResponseEntity<?> getRateLimits() {
        // Return current rate limit status for users
        return ResponseEntity.ok(...);
    }
}
```

### Frontend Handling

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
| **Resilience4j config sai (limitForPeriod = -1)** | — | Disable rate limiting (warning log), request pass |
| **Redis unavailable (nếu dùng Redis-backed)** | 429 | Fallback to in-memory counter (local to instance) |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Per-user isolation** | Rate limit tính riêng từng user (userId từ JWT) |
| **Sliding window** | Không fixed window (tránh burst ở edge) |
| **Timeout behavior** | timeoutDuration=0 → fail fast (không queue) |
| **Endpoints** | POST /registrations: 5 req/10s; GET /workshops: 30 req/10s |
| **Metrics** | Expose `/actuator/metrics/resilience4j.ratelimiter` |
| **Health check** | registerHealthIndicator=true → `/actuator/health` show status |
| **Logging** | Log mỗi lần 429, nhưng không log spam (max log rate) |

---

## Tiêu chí chấp nhận

- ✅ Sinh viên A gửi 5 requests → pass; request thứ 6 → 429
- ✅ Response 429 có header `Retry-After: 10`
- ✅ Frontend countdown timer hiển thị "Chờ 10s..."
- ✅ Sau 10s, user có thể gửi request mới
- ✅ User B không bị ảnh hưởng bởi rate limit của user A
- ✅ Xem workshop endpoint (30 req/10s) không bị limit chặt như registration (5 req/10s)
- ✅ Metrics available tại `/actuator/metrics/resilience4j.ratelimiter.requested`
- ✅ Nếu Resilience4j config fail → System startup warning nhưng không crash
- ✅ Rate limit không block non-API requests (static files, health check)
- ✅ Load test: 1000 users trong 10 phút → backend không sập, rate limit hoạt động
