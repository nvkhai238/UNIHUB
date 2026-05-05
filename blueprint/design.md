# UniHub Workshop — Technical Design

> **Stack đã chốt:** Java 21 + Spring Boot 3.x · React + Vite (PWA) · Supabase (PostgreSQL) · Redis · Gemini API · SMTP
>
> **Phân công:** Thành viên 1 — Đăng ký & Giao dịch | Thành viên 2 — Quản trị & AI | Thành viên 3 — Vận hành & Đồng bộ

---

## 1. Kiến trúc tổng thể

### Lựa chọn kiến trúc: Modular Monolith

Nhóm chọn kiến trúc **Modular Monolith** cho backend Spring Boot. Toàn bộ nghiệp vụ nằm trong một deployable unit duy nhất, nhưng được tổ chức thành các module/package độc lập theo domain:

```
com.unihub.workshop
├── module.auth          (TV2 — Spring Security, JWT)
├── module.workshop      (TV1, TV2 — CRUD, AI summary)
├── module.registration  (TV1 — đăng ký, seat locking)
├── module.payment       (TV1 — Circuit Breaker, Idempotency)
├── module.checkin       (TV3 — API ghi nhận, sync offline)
├── module.notification  (TV3 — Email, in-app)
└── module.csvimport     (TV3 — Spring Batch)
```

**Lý do không chọn Microservices:**

| Tiêu chí                     | Modular Monolith           | Microservices                  |
| ---------------------------- | -------------------------- | ------------------------------ |
| Thời gian setup              | Thấp — 1 project, 1 repo   | Cao — nhiều repo, service mesh |
| Phù hợp nhóm 3 người, 1 tuần | ✅                         | ❌                             |
| Giao tiếp giữa module        | Method call (zero latency) | HTTP/gRPC (network overhead)   |
| Debug và test                | Dễ — chạy 1 service        | Khó — nhiều service cùng lúc   |
| Ranh giới module rõ ràng     | ✅ (package private)       | ✅                             |
| Có thể tách ra sau này       | ✅ (ranh giới đã có sẵn)   | N/A                            |

**Lý do chọn Java 21 + Spring Boot 3.x:**

- **Spring Batch:** Giải quyết bài toán CSV import phức tạp với cơ chế chunk processing, retry, skip, restart — không cần tự viết từ đầu.
- **Resilience4j:** Tích hợp sẵn Circuit Breaker, Rate Limiter, Retry với annotation `@CircuitBreaker`, `@RateLimiter` — không cần tự implement thuật toán.
- **Spring Security:** RBAC + JWT filter chain được thiết lập chặt chẽ, không để lọt request không hợp lệ qua bất kỳ tầng nào.
- **JPA + Pessimistic Locking:** `@Lock(LockModeType.PESSIMISTIC_WRITE)` giải quyết race condition chỗ ngồi trực tiếp ở tầng ORM.

---

## 2. C4 Diagram

### Level 1 — System Context

Sơ đồ này thể hiện UniHub Workshop trong bức tranh toàn cảnh: ai dùng hệ thống và hệ thống ngoài nào được tích hợp.

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║    [Sinh viên]          [Ban tổ chức]        [Nhân sự check-in]         ║
║    Xem workshop         Tạo/sửa/hủy          Quét QR tại cửa           ║
║    Đăng ký, nhận QR     workshop             phòng (có/không có mạng)  ║
║         │                    │                        │                  ║
║         └────────────────────┼────────────────────────┘                  ║
║                              ▼                                           ║
║              ┌───────────────────────────────┐                          ║
║              │      UniHub Workshop           │                          ║
║              │  (React + Vite / Spring Boot)  │                          ║
║              └───────┬────────────┬───────────┘                          ║
║                      │            │                                      ║
║          ┌───────────┘            └──────────────┐                      ║
║          ▼                                       ▼                      ║
║  [Mock Payment Gateway]              [Gemini API / Google AI]           ║
║  Giả lập success/fail/               Tạo tóm tắt nội dung               ║
║  timeout để test Circuit             từ PDF workshop                     ║
║  Breaker & Idempotency               (do Thành viên 2 tích hợp)         ║
║                                                                          ║
║  [SMTP Email Server]                 [Legacy Student System]             ║
║  Gửi email xác nhận                  Export CSV sinh viên lúc           ║
║  đăng ký, thông báo                  2:00 AM — không có API,            ║
║  workshop thay đổi                   chỉ đọc file một chiều              ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### Level 2 — Container Diagram

Sơ đồ này phân rã UniHub Workshop thành các container, chỉ rõ công nghệ và cách giao tiếp.

```
╔════════════════════════════════════════════════════════════════════════════════╗
║                              UniHub Workshop System                            ║
║                                                                                ║
║  ┌─────────────────────┐     ┌─────────────────────┐                         ║
║  │   React Web App     │     │  React PWA           │                         ║
║  │   (Vite + React)    │     │  Check-in App        │                         ║
║  │                     │     │  (Vite + React)      │                         ║
║  │  • Trang SV:        │     │  • Quét QR camera    │                         ║
║  │    xem, đăng ký QR  │     │  • Offline-first     │                         ║
║  │  • Trang Admin:     │     │  • Service Worker    │                         ║
║  │    CRUD, thống kê   │     │  • IndexedDB cache   │                         ║
║  └────────┬────────────┘     └──────────┬───────────┘                         ║
║           │ HTTPS REST/JSON             │ HTTPS REST/JSON                     ║
║           └──────────────┬──────────────┘                                     ║
║                          ▼                                                     ║
║           ┌──────────────────────────────────────────┐                        ║
║           │    Spring Boot 3.x — Backend API          │                        ║
║           │    Java 21 · Port 8080                    │                        ║
║           │                                           │                        ║
║           │  ┌─────────────────────────────────────┐ │                        ║
║           │  │  Spring Security Filter Chain        │ │                        ║
║           │  │  → JWT Validation → Role Check       │ │                        ║
║           │  └─────────────────────────────────────┘ │                        ║
║           │  ┌──────────────┐  ┌────────────────────┐│                        ║
║           │  │ RateLimiter  │  │  Circuit Breaker   ││                        ║
║           │  │ Resilience4j │  │  Resilience4j      ││                        ║
║           │  │ + Redis      │  │  → Payment GW      ││                        ║
║           │  └──────────────┘  └────────────────────┘│                        ║
║           │                                           │                        ║
║           │  Module: Auth    Module: Workshop         │                        ║
║           │  Module: Reg.    Module: Payment          │                        ║
║           │  Module: Checkin Module: Notification     │                        ║
║           │  Module: CsvImport (Spring Batch)         │                        ║
║           │  Module: AiSummary (Gemini API client)    │                        ║
║           └───┬───────────┬──────────────┬────────────┘                        ║
║               │           │              │                                     ║
║               ▼           ▼              ▼                                     ║
║  ┌────────────────┐ ┌──────────┐ ┌──────────────────────────────────┐        ║
║  │  Supabase      │ │  Redis   │ │  Supabase Storage                │        ║
║  │  PostgreSQL    │ │  :6379   │ │  (S3-compatible)                 │        ║
║  │                │ │          │ │  • PDF file upload               │        ║
║  │  Primary DB:   │ │  • Rate  │ │  • Sơ đồ phòng ảnh              │        ║
║  │  users,        │ │    limit │ │                                  │        ║
║  │  workshops,    │ │  • Idem. │ └──────────────────────────────────┘        ║
║  │  registrations │ │    keys  │                                             ║
║  │  payments,     │ │  • CB    │                                             ║
║  │  checkins      │ │    state │                                             ║
║  └────────────────┘ └──────────┘                                             ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

Ngoài hệ thống:
  [Mock Payment GW] ←──HTTP──→ PaymentService (Circuit Breaker wrap)
  [Gemini API]      ←──HTTP──→ AiSummaryService (async, @Async)
  [SMTP Server]     ←──SMTP──→ EmailNotificationService
  [CSV file]        ←──read──  Spring Batch CsvImportJob (cron 2:00 AM)
```

---

## 3. High-Level Architecture Diagram

Sơ đồ này thể hiện luồng dữ liệu và điểm tích hợp quan trọng, đặc biệt ở các tình huống phức tạp.

```mermaid
---
config:
  layout: elk
---
flowchart TB
 subgraph subGraph0["Client Layer"]
        Web_Student["Web App (PWA) - Sinh viên"]
        Web_Admin["Web App - Ban tổ chức"]
        Mobile_Staff["Mobile App (PWA) - Nhân sự Check-in"]
  end
 subgraph subGraph1["Core Backend Services (Spring Boot)"]
        Auth_Service["Identity Service"]
        Workshop_Service["Workshop & Catalog Service"]
        Booking_Service["Booking & Payment Service\n(Circuit Breaker)"]
        Notification_Service["Notification Service"]
        Sync_Service["CSV Sync Worker\n(Spring Batch)"]
  end
 subgraph subGraph2["Data Storage"]
        Redis[("Redis\nIdempotency Key / Rate Limit")]
        DB[("Primary Database\nPostgreSQL\n(Pessimistic Lock)")]
        LocalDB[("IndexedDB\n(PWA Offline Storage)")]
  end
 subgraph subGraph3["External Systems"]
        Legacy_System["Hệ thống cũ\n(CSV Export)"]
        Payment_Gateway["Cổng Thanh Toán Mock"]
        AI_Model["AI Model\n(Gemini API)"]
        Email_Provider["Email / App Push"]
  end
    Web_Student --> API_Gateway["API Gateway\nRate Limiting / Routing"]
    Web_Admin --> API_Gateway
    Mobile_Staff <--> LocalDB
    Mobile_Staff -- Background Sync khi có mạng --> API_Gateway
    API_Gateway --> Auth_Service & Workshop_Service & Booking_Service
    Workshop_Service --> AI_Model & DB
    Booking_Service <--> Redis
    Booking_Service --> Payment_Gateway & DB
    Booking_Service -- Publish Event --> MQ(("Message Queue<br>RabbitMQ"))
    Sync_Service -- Lấy file lúc 2:00 AM --> Legacy_System
    Sync_Service --> DB
    MQ -- Xử lý lưu vé Async --> Booking_Service
    MQ -- Kích hoạt gửi Mail --> Notification_Service
    Notification_Service --> Email_Provider
```

## 4. Thiết kế cơ sở dữ liệu

### Lựa chọn database

| Nhu cầu                                                                 | Lựa chọn                | Lý do                                                                                                              |
| ----------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Dữ liệu nghiệp vụ (users, workshops, registrations, payments, checkins) | **Supabase PostgreSQL** | ACID bắt buộc cho seat locking và thanh toán; Supabase có sẵn Real-time WebSocket để cập nhật số ghế trên frontend |
| Rate limiting counter, idempotency key cache, Circuit Breaker state     | **Redis**               | Atomic operations (INCR, SET NX EX), TTL tự động, dưới 1ms latency                                                 |
| File storage (PDF, ảnh sơ đồ phòng)                                     | **Supabase Storage**    | S3-compatible, tích hợp sẵn với Supabase, không cần cấu hình thêm                                                  |

**Không dùng NoSQL** cho dữ liệu nghiệp vụ vì: dữ liệu có quan hệ rõ ràng (user → registration → payment → workshop), cần JOIN và transaction ACID, và PostgreSQL Pessimistic Lock là công cụ chuẩn cho bài toán seat contention.

### Schema PostgreSQL

```sql
-- =============================================
-- ENUM types
-- =============================================
CREATE TYPE user_role AS ENUM ('STUDENT', 'ORGANIZER', 'CHECKIN_STAFF');
CREATE TYPE workshop_status AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');
CREATE TYPE registration_status AS ENUM (
    'PENDING',      -- Đang xử lý thanh toán
    'CONFIRMED',    -- Đã thanh toán / đã đăng ký miễn phí thành công
    'CANCELLED',    -- Đã hủy (thanh toán lỗi hoặc SV hủy)
    'WAITLISTED'    -- Hết chỗ, vào danh sách chờ
);
CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- =============================================
-- Bảng người dùng
-- =============================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  VARCHAR(20) UNIQUE,          -- Mã SV, null nếu là Admin/Staff
    email       VARCHAR(255) UNIQUE NOT NULL,
    full_name   VARCHAR(255) NOT NULL,
    role        user_role NOT NULL DEFAULT 'STUDENT',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Bảng workshop
-- =============================================
CREATE TABLE workshops (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(500) NOT NULL,
    description      TEXT,
    speaker_name     VARCHAR(255),
    speaker_bio      TEXT,
    room             VARCHAR(100) NOT NULL,
    room_layout_url  TEXT,                    -- URL ảnh sơ đồ phòng (Supabase Storage)
    start_time       TIMESTAMPTZ NOT NULL,
    end_time         TIMESTAMPTZ NOT NULL,
    capacity         INT NOT NULL CHECK (capacity > 0),
    remaining_seats  INT NOT NULL CHECK (remaining_seats >= 0),
    price            NUMERIC(10,2) NOT NULL DEFAULT 0.00, -- 0 = miễn phí
    status           workshop_status NOT NULL DEFAULT 'DRAFT',
    pdf_url          TEXT,                    -- URL file PDF (Supabase Storage)
    ai_summary       TEXT,                    -- Tóm tắt do Gemini API tạo
    ai_summary_status VARCHAR(20) DEFAULT 'NONE', -- NONE/PROCESSING/DONE/FAILED
    created_by       UUID NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT remaining_lte_capacity CHECK (remaining_seats <= capacity)
);

-- =============================================
-- Bảng đăng ký
-- =============================================
CREATE TABLE registrations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    workshop_id   UUID NOT NULL REFERENCES workshops(id) ON DELETE RESTRICT,
    status        registration_status NOT NULL DEFAULT 'PENDING',
    qr_code       VARCHAR(255) UNIQUE,        -- UUID ngẫu nhiên, chỉ sinh khi CONFIRMED
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at  TIMESTAMPTZ,
    cancelled_at  TIMESTAMPTZ,

    UNIQUE (user_id, workshop_id)             -- Một SV không đăng ký 2 lần cùng 1 workshop
);

-- =============================================
-- Bảng thanh toán
-- =============================================
CREATE TABLE payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id  UUID NOT NULL REFERENCES registrations(id),
    idempotency_key  VARCHAR(255) UNIQUE NOT NULL,  -- UUID do client gửi
    amount           NUMERIC(10,2) NOT NULL,
    status           payment_status NOT NULL DEFAULT 'PENDING',
    gateway_ref      VARCHAR(255),            -- Mã giao dịch từ Mock Payment GW
    gateway_response JSONB,                   -- Raw response để debug
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Bảng check-in
-- =============================================
CREATE TABLE checkins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id),
    checked_in_at   TIMESTAMPTZ NOT NULL,     -- Thời điểm quét QR (local device time)
    synced_at       TIMESTAMPTZ,              -- null = chưa sync từ offline
    device_id       VARCHAR(255),             -- ID thiết bị nhân sự
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (registration_id)                  -- Mỗi SV chỉ check-in 1 lần
);

-- =============================================
-- Bảng batch import CSV
-- =============================================
CREATE TABLE student_import_batches (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name     VARCHAR(500),
    total_rows    INT DEFAULT 0,
    success_rows  INT DEFAULT 0,
    error_rows    INT DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'RUNNING',  -- RUNNING/COMPLETED/FAILED/SKIPPED
    error_log     TEXT,                       -- Chi tiết các dòng bị lỗi
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_workshops_start_time   ON workshops(start_time);
CREATE INDEX idx_workshops_status       ON workshops(status);
CREATE INDEX idx_workshops_remaining    ON workshops(remaining_seats) WHERE remaining_seats > 0;
CREATE INDEX idx_registrations_user     ON registrations(user_id);
CREATE INDEX idx_registrations_workshop ON registrations(workshop_id);
CREATE INDEX idx_registrations_qr       ON registrations(qr_code) WHERE qr_code IS NOT NULL;
CREATE INDEX idx_registrations_status   ON registrations(status);
CREATE INDEX idx_checkins_unsynced      ON checkins(registration_id) WHERE synced_at IS NULL;
CREATE INDEX idx_payments_idem          ON payments(idempotency_key);
```

### Redis Key Convention

| Key Pattern             | Type             | TTL          | Mục đích                                          |
| ----------------------- | ---------------- | ------------ | ------------------------------------------------- |
| `rl:user:{userId}`      | String (counter) | 10s          | Rate limiting per user (Resilience4j + Redis)     |
| `rl:ip:{ipAddress}`     | String (counter) | 60s          | Rate limiting per IP (fallback)                   |
| `idem:{idempotencyKey}` | String (JSON)    | 86400s (24h) | Cache response thanh toán chống double-charge     |
| `cb:payment:failures`   | String (counter) | 30s          | Đếm failures trong Circuit Breaker sliding window |
| `cb:payment:state`      | String           | —            | Trạng thái CB: CLOSED / OPEN / HALF_OPEN          |
| `ws:seats:{workshopId}` | String           | 30s          | Cache số ghế còn lại (giảm tải DB reads)          |

---

## 5. Thiết kế kiểm soát truy cập (RBAC)

### Mô hình phân quyền

Sử dụng **Role-Based Access Control (RBAC)** thông qua Spring Security + JWT. Mỗi JWT access token chứa claim `role` để backend xác định quyền mà không cần query database mỗi request.

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "nguyenvana@university.edu.vn",
  "role": "STUDENT",
  "iat": 1748908800,
  "exp": 1748995200
}
```

### Ba nhóm người dùng và quyền hạn

| Tính năng / Endpoint      | STUDENT | ORGANIZER | CHECKIN_STAFF |
| ------------------------- | ------- | --------- | ------------- |
| Xem danh sách workshop    | ✅      | ✅        | ✅            |
| Xem chi tiết workshop     | ✅      | ✅        | ✅            |
| Đăng ký workshop          | ✅      | ❌        | ❌            |
| Xem registration của mình | ✅      | ❌        | ❌            |
| Tạo workshop mới          | ❌      | ✅        | ❌            |
| Sửa / hủy workshop        | ❌      | ✅        | ❌            |
| Upload PDF workshop       | ❌      | ✅        | ❌            |
| Xem thống kê đăng ký      | ❌      | ✅        | ❌            |
| Quét QR check-in          | ❌      | ❌        | ✅            |
| Preload danh sách QR      | ❌      | ❌        | ✅            |
| Sync check-in offline     | ❌      | ❌        | ✅            |

### Triển khai trong Spring Security (Thành viên 2)

**Tầng 1 — HTTP Security Config:**

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
        .authorizeHttpRequests(auth -> auth
            // Public endpoints
            .requestMatchers(GET, "/api/workshops/**").permitAll()
            .requestMatchers(POST, "/api/auth/**").permitAll()

            // Student only
            .requestMatchers(POST, "/api/registrations/**").hasRole("STUDENT")
            .requestMatchers(GET, "/api/registrations/my/**").hasRole("STUDENT")

            // Organizer only
            .requestMatchers("/api/admin/**").hasRole("ORGANIZER")
            .requestMatchers(POST, "/api/workshops/**").hasRole("ORGANIZER")
            .requestMatchers(PUT, "/api/workshops/**").hasRole("ORGANIZER")
            .requestMatchers(DELETE, "/api/workshops/**").hasRole("ORGANIZER")

            // Check-in staff only
            .requestMatchers("/api/checkins/**").hasRole("CHECKIN_STAFF")

            .anyRequest().authenticated()
        )
        .addFilterBefore(jwtAuthenticationFilter,
                         UsernamePasswordAuthenticationFilter.class);
    return http.build();
}
```

**Tầng 2 — Method-level Security (defense in depth):**

```java
@Service
@PreAuthorize("hasRole('ORGANIZER')")
public class WorkshopAdminService {
    public Workshop createWorkshop(CreateWorkshopRequest req) { ... }
    public Workshop updateWorkshop(UUID id, UpdateWorkshopRequest req) { ... }
}
```

**Tầng 3 — Data-level: SV chỉ xem được registration của chính mình:**

```java
@GetMapping("/registrations/my")
public List<RegistrationDto> getMyRegistrations(
        @AuthenticationPrincipal UserDetails user) {
    // userDetails.getId() lấy từ JWT, không tin vào request param
    return registrationService.findByUserId(user.getId());
}
```

---

## 6. Luồng nghiệp vụ quan trọng

### Luồng A — Đăng ký Workshop có phí (Thành viên 1)

Từ lúc sinh viên bấm "Đăng ký" đến khi nhận mã QR.

```
SV (Browser)         React Frontend        Spring Boot API         Redis / PostgreSQL
      │                     │                     │                       │
      │── Click "Đăng ký" ─▶│                     │                       │
      │                     │ Sinh idempotencyKey  │                       │
      │                     │ = UUID.randomUUID()  │                       │
      │                     │                     │                       │
      │                     │──POST /registrations▶│                       │
      │                     │  Header:             │                       │
      │                     │  Idempotency-Key:    │                       │
      │                     │  {uuid}              │                       │
      │                     │  Body: {workshopId}  │                       │
      │                     │                     │                       │
      │                     │                     │── ① Rate limit check ─▶│ Redis INCR rl:user:{id}
      │                     │                     │◀─ OK (< 5 req/10s) ───│
      │                     │                     │   hoặc 429 (exceeded) │
      │                     │                     │                       │
      │                     │                     │── ② Idem key check ──▶│ Redis GET idem:{key}
      │                     │                     │◀─ null (chưa có) ─────│
      │                     │                     │   (nếu có → return    │
      │                     │                     │    cached response)   │
      │                     │                     │                       │
      │                     │                     │── ③ BEGIN TRANSACTION ─▶│ PostgreSQL
      │                     │                     │   SELECT * FROM         │
      │                     │                     │   workshops             │
      │                     │                     │   WHERE id = ?          │
      │                     │                     │   FOR UPDATE            │ ← Pessimistic Lock
      │                     │                     │                         │
      │                     │                     │   remaining_seats = 0?  │
      │                     │                     │   → ROLLBACK            │
      │                     │                     │   → 409 Conflict        │
      │                     │                     │                         │
      │                     │                     │   INSERT registrations  │
      │                     │                     │   status = 'PENDING'    │
      │                     │                     │                         │
      │                     │                     │   UPDATE workshops      │
      │                     │                     │   SET remaining_seats   │
      │                     │                     │       = remaining_seats │
      │                     │                     │       - 1               │
      │                     │                     │                         │
      │                     │                     │   INSERT payments       │
      │                     │                     │   status = 'PENDING'    │
      │                     │                     │── COMMIT ───────────────│
      │                     │                     │                         │
      │                     │                     │── ④ Call Payment GW ───── (Circuit Breaker)
      │                     │                     │   POST mock-payment/pay │
      │                     │                     │   + Idempotency-Key hdr │
      │                     │                     │                         │
      │                     │                     │◀─── [Kịch bản SUCCESS] ──
      │                     │                     │   UPDATE payments       │
      │                     │                     │   status = 'SUCCESS'    │
      │                     │                     │   UPDATE registrations  │
      │                     │                     │   status = 'CONFIRMED'  │
      │                     │                     │   qr_code = UUID.new()  │
      │                     │                     │── ⑤ Cache idem key ────▶│ Redis SET idem:{key}
      │                     │                     │                    EX 86400
      │                     │                     │── ⑥ Send Email ─────────── EmailService (async)
      │                     │◀── 201 {qrCode} ────│                         │
      │◀── Hiển thị QR ─────│                     │                         │
      │                     │                     │                         │
      │                     │                     │◀─── [Kịch bản TIMEOUT] ──
      │                     │                     │   UPDATE payments FAILED│
      │                     │                     │   UPDATE registrations  │
      │                     │                     │   status = 'CANCELLED'  │
      │                     │                     │   UPDATE workshops      │
      │                     │                     │   remaining_seats += 1  │ ← Hoàn lại ghế
      │                     │◀── 504 + message ───│                         │
      │◀── "Thanh toán lỗi, │                     │                         │
      │    vui lòng thử lại"│                     │                         │
      │                     │                     │                         │
      │                     │                     │◀─── [CB OPEN state] ─────
      │                     │                     │   Ngay lập tức 503      │
      │                     │                     │   Không gọi gateway     │
      │                     │                     │   remaining_seats += 1  │
      │                     │◀── 503 + message ───│                         │
```

**Kịch bản client retry với cùng idempotency key:**

```
Client gửi lại request với cùng Idempotency-Key
→ API: Redis GET idem:{key} → Tìm thấy response cũ
→ Return cached response ngay, không xử lý lại
→ Header: X-Idempotent-Replayed: true
```

### Luồng B — Check-in offline và đồng bộ (Thành viên 3)

```mermaid
sequenceDiagram
  autonumber
  actor Staff as Nhân sự
  participant PWA as UI (Trình duyệt PWA)
  participant SW as Service Worker
  participant IDB as IndexedDB (Local)
  participant API as Spring Boot API
  participant DB as PostgreSQL

  Note over Staff, DB: GIAI ĐOẠN 1: CÓ MẠNG (Tải trước dữ liệu đầu ngày)
  Staff->>PWA: Mở ứng dụng Check-in
  PWA->>API: GET /api/checkins/preload?date=today
  API->>DB: Query confirmed registrations (Hôm nay)
  DB-->>API: Danh sách hợp lệ
  API-->>PWA: [{qr, name, workshop_id}]
  PWA->>IDB: Lưu vào store `qr_registry`
  IDB-->>PWA: OK
  PWA-->>Staff: Hiển thị: "Đã tải xong dữ liệu Offline"

  Note over Staff, DB: GIAI ĐOẠN 2: MẤT MẠNG (Check-in tại cửa sự kiện)
  Staff->>PWA: Quét mã QR của Sinh viên
  PWA->>PWA: Kiểm tra navigator.onLine == false
  PWA->>IDB: SELECT * FROM `qr_registry` WHERE qr = qr_code
  
  alt Không hợp lệ (Không tìm thấy)
    IDB-->>PWA: null
    PWA-->>Staff: Báo lỗi Đỏ & Gợi ý nhập tay/kiểm tra lại
  else Hợp lệ (Tìm thấy)
    IDB-->>PWA: {name, workshop_id}
    PWA->>IDB: INSERT store `pending_sync` {qr_code, timestamp, synced: 0}
    Note over PWA, IDB: UNIQUE constraint ngăn lưu trùng (SV quét 2 lần)
    IDB-->>PWA: Insert Success
    PWA-->>Staff: Báo Xanh "Check-in thành công: [Tên SV]"
  end

  Note over Staff, DB: GIAI ĐOẠN 3: CÓ MẠNG TRỞ LẠI (Đồng bộ nền)
  Note right of SW: Sự kiện 'sync' được hệ điều hành kích hoạt ngầm
  SW->>IDB: Lấy dữ liệu: SELECT * FROM `pending_sync` WHERE synced = 0
  IDB-->>SW: [{qr_code, timestamp, device_id, ...}]
  SW->>API: POST /api/checkins/sync (Gửi Array Batch)
  API->>DB: UPSERT checkins 
  Note right of API: ON CONFLICT (reg_id) DO NOTHING
  
  alt Kết nối chập chờn / Lỗi Server
    DB-->>API: Error / Timeout
    API-->>SW: 500 Internal Server Error
    SW->>SW: Giữ nguyên `synced=0`, chờ lần trigger Background Sync tiếp theo
  else Thành công
    DB-->>API: Số dòng bị ảnh hưởng
    API-->>SW: 200 OK {synced_ids: [...]}
    SW->>IDB: UPDATE `pending_sync` SET synced = 1
  end
```

```
Nhân sự (PWA)        Service Worker        Spring Boot API        IndexedDB    PostgreSQL
      │                    │                      │                    │             │
      │ [Trước sự kiện - có mạng]                 │                    │             │
      │── Mở app ─────────▶│                      │                    │             │
      │                    │── GET /checkins/      │                    │             │
      │                    │   preload?date=today ▶│                    │             │
      │                    │                      │── Query confirmed ──│─────────────▶
      │                    │◀── [{qr, name,        │    registrations   │             │
      │                    │     workshopId}]      │    for today       │             │
      │                    │── Cache vào ──────────│────────────────────▶│            │
      │                    │   IndexedDB           │                    │ INSERT batch│
      │◀── "Đã tải xong" ──│                      │                    │             │
      │                    │                      │                    │             │
      │ [Tại cửa phòng - mất mạng]               │                    │             │
      │── Quét QR SV ─────▶│                      │                    │             │
      │                    │── navigator.onLine?  │                    │             │
      │                    │   = false            │                    │             │
      │                    │── Lookup local ───────│────────────────────▶│            │
      │                    │◀── {name, workshop}   │                    │ SELECT by   │
      │                    │                       │                    │ qr_code     │
      │                    │── Save pending ───────│────────────────────▶│            │
      │                    │   checkin             │                    │ INSERT:     │
      │                    │                       │                    │ {qr_code,   │
      │                    │                       │                    │  timestamp, │
      │                    │                       │                    │  synced:0}  │
      │◀── "Check-in OK!" ─│                      │                    │             │
      │    (hiển thị tên)  │                      │                    │             │
      │                    │                      │                    │             │
      │ [Khi mạng trở lại]                        │                    │             │
      │                    │── Background Sync ────│                    │             │
      │                    │   event triggered     │                    │             │
      │                    │── GET pending ─────────│────────────────────▶│            │
      │                    │   WHERE synced=0      │                    │ SELECT      │
      │                    │── POST /checkins/sync▶│                    │             │
      │                    │   [{qr_code,          │                    │             │
      │                    │     timestamp,        │── UPSERT ──────────│─────────────▶
      │                    │     device_id}]       │   checkins         │             │ ON CONFLICT
      │                    │                      │   ON CONFLICT      │             │ (reg_id)
      │                    │◀── {synced: [ids]} ───│   DO NOTHING       │             │ DO NOTHING
      │                    │── Mark synced=1 ───────│────────────────────▶│            │
      │                    │                      │                    │ UPDATE      │
```

**Xử lý lỗi:**

| Tình huống                   | Hành vi                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| QR không có trong IndexedDB  | Hiện "Không tìm thấy sinh viên", ghi log, cho phép nhập thủ công                                  |
| Sync thất bại (mạng đứt lại) | Giữ nguyên `synced=0`, Background Sync retry tự động                                              |
| Check-in trùng (SV đã scan)  | IndexedDB UNIQUE constraint ngăn lưu trùng; PostgreSQL `ON CONFLICT DO NOTHING` ngăn trùng server |
| File preload quá lớn         | Phân trang theo `workshop_id`, chỉ load workshop của ngày hôm nay                                 |

---

### Luồng C — Luồng nhập dữ liệu từ CSV đêm (Thành viên 3)

```mermaid
sequenceDiagram
  autonumber
  participant Cron as Scheduler (Cronjob)
  participant Worker as Spring Batch Job
  participant FTP as Legacy System (FTP)
  participant DB as PostgreSQL
  participant Log as Hệ thống Monitor / Log

  Cron->>Worker: Kích hoạt lúc 02:00 AM
  Worker->>FTP: Request tải file `students_export.csv`
  
  alt File không tồn tại / Lỗi kết nối FTP
    FTP-->>Worker: Error (404 / Timeout)
    Worker->>Log: Báo lỗi CRITICAL "Không lấy được file CSV"
    Note over Worker: Đóng Job (Status = FAILED), kết thúc luồng.
  else Lấy file thành công
    FTP-->>Worker: Stream file CSV (UTF-8)
    
    loop Đọc từng Chunk (vd: 1000 dòng/lần)
      Worker->>Worker: FlatFileItemReader (Bỏ qua dòng Header)
      Worker->>Worker: ItemProcessor (Parse & Validate)
      
      alt Có dòng lỗi format (Thiếu cột, sai định dạng)
        Worker->>Log: Ghi cảnh báo "Skip dòng X: Format không hợp lệ"
        Note over Worker: SkipPolicy: Bỏ qua dòng lỗi, tiếp tục xử lý các dòng khác
      end
      
      Worker->>DB: JdbcBatchItemWriter (Gửi mảng dữ liệu đã validate)
      Note right of DB: UPSERT: ON CONFLICT (student_id) <br/> DO UPDATE SET email=EXCLUDED.email, <br/> full_name=EXCLUDED.full_name <br/> (TUYỆT ĐỐI KHÔNG ghi đè Role)
      DB-->>Worker: Trả về số dòng bị ảnh hưởng
    end
    
    Worker->>Log: Báo cáo Job hoàn tất (Thành công: X, Bỏ qua: Y)
    Note over Worker: Job Status = COMPLETED
  end
```

## 7. Thiết kế các cơ chế bảo vệ hệ thống

### 7.1 Kiểm soát tải đột biến — Rate Limiting (Thành viên 1)

**Lý do chọn Sliding Window (Resilience4j):**

So sánh các thuật toán:

| Thuật toán     | Điểm mạnh           | Điểm yếu                            | Phù hợp bài này? |
| -------------- | ------------------- | ----------------------------------- | ---------------- |
| Fixed Window   | Đơn giản            | Burst cuối window: 2× rate trong 1s | ❌               |
| Sliding Window | Công bằng, smooth   | Tốn RAM hơn chút                    | ✅ Chọn          |
| Token Bucket   | Cho phép burst ngắn | Khó integrate với Resilience4j      | Có thể           |
| Leaky Bucket   | Rate đều tuyệt đối  | Queue delay — không công bằng       | ❌               |

Sliding Window được chọn vì: công bằng nhất giữa các sinh viên, Resilience4j hỗ trợ native, không cần tự viết Lua script.

**Cấu hình (application.yml):**

```yaml
resilience4j:
  ratelimiter:
    instances:
      registration:
        limitForPeriod: 5 # 5 requests
        limitRefreshPeriod: 10s # mỗi 10 giây
        timeoutDuration: 0 # fail fast, không queue
      workshop-read:
        limitForPeriod: 30
        limitRefreshPeriod: 10s
        timeoutDuration: 0
```

**Triển khai (Thành viên 1):**

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
        .body(ApiResponse.error(429, "Quá nhiều yêu cầu. Vui lòng thử lại sau 10 giây."));
}
```

**Hành vi khi vượt ngưỡng:**

- HTTP 429 với JSON body rõ ràng + header `Retry-After: 10`
- Frontend hiển thị countdown timer, nút đăng ký bị disable
- Không ghi log cho mỗi lần 429 (tránh log flooding)

**Bảo vệ bổ sung tầng Nginx (nếu deploy):**

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
limit_req zone=api burst=20 nodelay;
limit_req_status 429;
```

---

### 7.2 Xử lý cổng thanh toán không ổn định — Circuit Breaker (Thành viên 1)

**Cơ chế hoạt động 3 trạng thái:**

```
Trạng thái CLOSED (bình thường):
  → Mọi request gọi Payment Gateway bình thường
  → Đếm failures trong sliding window (10 calls gần nhất)
  → failure rate ≥ 50% → chuyển sang OPEN

Trạng thái OPEN (đang sự cố):
  → Chặn TẤT CẢ request gọi Payment Gateway
  → Trả về lỗi ngay lập tức (không chờ timeout)
  → Sau 30 giây → chuyển sang HALF-OPEN
  → Tính năng KHÔNG liên quan đến thanh toán:
    xem workshop, tìm kiếm, xem QR — vẫn hoạt động 100%

Trạng thái HALF-OPEN (đang thử phục hồi):
  → Cho phép 1 request thử đi qua
  → Thành công → CLOSED (phục hồi)
  → Thất bại → OPEN lại (thêm 30 giây)
```

**Cấu hình (application.yml):**

```yaml
resilience4j:
  circuitbreaker:
    instances:
      payment:
        slidingWindowType: COUNT_BASED
        slidingWindowSize: 10 # Tính trên 10 calls gần nhất
        failureRateThreshold: 50 # 50% failure → OPEN
        slowCallRateThreshold: 80 # 80% slow → cũng tính là failure
        slowCallDurationThreshold: 2000ms # Call > 2s = slow
        waitDurationInOpenState: 30s # OPEN kéo dài 30s
        permittedNumberOfCallsInHalfOpenState: 1
        automaticTransitionFromOpenToHalfOpenEnabled: true
```

**Triển khai (Thành viên 1):**

```java
@Service
public class PaymentService {

    @CircuitBreaker(name = "payment", fallbackMethod = "paymentFallback")
    @Retry(name = "payment")  // Retry 2 lần trước khi tính là failure
    public PaymentResult processPayment(PaymentRequest request) {
        return mockPaymentGatewayClient.pay(request);
    }

    // Fallback khi CB OPEN hoặc sau khi hết retry
    public PaymentResult paymentFallback(PaymentRequest request, Exception ex) {
        log.warn("Payment CB triggered: {}", ex.getMessage());
        throw new PaymentUnavailableException(
            "Hệ thống thanh toán đang gián đoạn. " +
            "Vui lòng thử lại sau ít phút. " +
            "Chức năng xem và tìm kiếm workshop vẫn hoạt động bình thường.");
    }
}
```

**Graceful Degradation — Frontend nhận response:**

```json
// HTTP 503
{
  "status": 503,
  "code": "PAYMENT_UNAVAILABLE",
  "message": "Hệ thống thanh toán đang gián đoạn. Vui lòng thử lại sau ít phút.",
  "data": null
}
```

Frontend hiển thị banner cảnh báo chỉ trên luồng đăng ký có phí. Trang xem danh sách workshop, trang chi tiết, tính năng check-in — không bị ảnh hưởng.

---

### 7.3 Chống trừ tiền hai lần — Idempotency Key (Thành viên 1)

**Cơ chế hoạt động:**

```
TRƯỚC KHI GỌI API:
  Client (React) sinh idempotencyKey = crypto.randomUUID()
  Lưu vào sessionStorage theo workshopId

GỌI API LẦN 1:
  POST /api/registrations
  Header: Idempotency-Key: "550e8400-e29b-41d4-a716-446655440000"

  Server:
  1. Redis GET "idem:550e8400-..."  → null (chưa có)
  2. Xử lý thanh toán (atomic transaction)
  3. Redis SET "idem:550e8400-..." "{response_json}" EX 86400
     (SET NX — chỉ set nếu key chưa tồn tại, atomic)
  4. Return response

CLIENT TIMEOUT → RETRY (cùng key):
  POST /api/registrations
  Header: Idempotency-Key: "550e8400-e29b-41d4-a716-446655440000"

  Server:
  1. Redis GET "idem:550e8400-..."  → "{...response cũ...}"
  2. Return cached response NGAY
     Header: X-Idempotent-Replayed: true
  3. KHÔNG gọi Payment Gateway, KHÔNG trừ tiền lại
```

**Triển khai (Thành viên 1):**

```java
@Component
public class IdempotencyService {
    private final RedisTemplate<String, String> redisTemplate;
    private static final Duration TTL = Duration.ofHours(24);

    public Optional<String> getCachedResponse(String key) {
        try {
            String value = redisTemplate.opsForValue().get("idem:" + key);
            return Optional.ofNullable(value);
        } catch (Exception e) {
            log.warn("Redis unavailable for idempotency check, proceeding without cache");
            return Optional.empty();  // Fail open: tiếp tục xử lý nếu Redis down
        }
    }

    public void cacheResponse(String key, Object response) {
        String json = objectMapper.writeValueAsString(response);
        // SET NX EX: chỉ set nếu chưa có, atomic
        redisTemplate.opsForValue().setIfAbsent("idem:" + key, json, TTL);
    }
}
```

**Ràng buộc bảo mật:**

- Key được bind với `userId` trong validation: key của user A không thể được user B dùng
- TTL 24h: sau 1 ngày key hết hạn, đủ để cover mọi retry trong ngày sự kiện
- Key phải là UUID v4 hợp lệ — bác bỏ key không đúng format với 422

---

## 8. Thiết kế AI Summary (Thành viên 2)

```
Admin                   Spring Boot               Supabase Storage    Gemini API     PostgreSQL
  │                          │                          │                  │               │
  │── Upload PDF ───────────▶│                          │                  │               │
  │                          │── Store PDF ────────────▶│                  │               │
  │                          │◀── pdf_url ──────────────│                  │               │
  │                          │── UPDATE workshops ───────│──────────────────│──────────────▶│
  │                          │   pdf_url = ...,          │                  │               │
  │                          │   ai_summary_status =     │                  │               │
  │                          │   'PROCESSING'            │                  │               │
  │◀── 202 Accepted ─────────│                          │                  │               │
  │    (xử lý nền)           │                          │                  │               │
  │                          │── @Async processAiSummary │                  │               │
  │                          │── Download PDF bytes ────▶│                  │               │
  │                          │◀── PDF bytes ─────────────│                  │               │
  │                          │── Extract text            │                  │               │
  │                          │   (Apache PDFBox)         │                  │               │
  │                          │── Clean text              │                  │               │
  │                          │   (remove headers/footers)│                  │               │
  │                          │── POST generateContent ───│──────────────────▶│              │
  │                          │   {model: gemini-pro,     │                  │               │
  │                          │    contents: [{           │                  │               │
  │                          │      text: "Tóm tắt nội  │                  │               │
  │                          │      dung workshop sau:" │                  │               │
  │                          │      + extractedText}]}   │                  │               │
  │                          │◀── {summary_text} ────────│──────────────────│               │
  │                          │── UPDATE workshops ───────│──────────────────│──────────────▶│
  │                          │   ai_summary = ...,       │                  │               │
  │                          │   ai_summary_status = 'DONE'                 │               │
```

**Xử lý lỗi:** Nếu Gemini API thất bại → `ai_summary_status = 'FAILED'` → Admin thấy nút "Thử lại". Không ảnh hưởng đến trang chi tiết workshop (chỉ không hiển thị phần AI Summary).

---

## 9. Thiết kế CSV Import (Thành viên 3)

**Cấu trúc Spring Batch Job:**

```
StudentImportJob
  │
  ├── Step 1: ValidateFileTasklet
  │   ├── Kiểm tra file tồn tại (/data/students_{date}.csv)
  │   ├── Kiểm tra header đúng format (student_id, full_name, email)
  │   ├── Lỗi → INSERT batch record status='SKIPPED', gửi alert email admin
  │   └── OK → tiếp tục Step 2
  │
  ├── Step 2: ImportStudentsStep (chunk-oriented, size=100)
  │   ├── ItemReader: FlatFileItemReader
  │   │   └── Đọc CSV, skip header row, encoding UTF-8
  │   ├── ItemProcessor:
  │   │   ├── Validate student_id không rỗng
  │   │   ├── Validate email format
  │   │   ├── Normalize: email.toLowerCase().trim()
  │   │   ├── Skip row không hợp lệ (SkipPolicy: ghi log, tiếp tục)
  │   │   └── Map → UserEntity (role=STUDENT, is_active=true)
  │   └── ItemWriter: JpaItemWriter với UPSERT
  │       └── INSERT INTO users (...)
  │           ON CONFLICT (student_id) DO UPDATE
  │           SET full_name = EXCLUDED.full_name,
  │               email = EXCLUDED.email,
  │               updated_at = now()
  │           (KHÔNG xóa account, KHÔNG ảnh hưởng registrations đang có)
  │
  └── Step 3: ReportTasklet
      └── UPDATE student_import_batches
          SET status='COMPLETED', success_rows=?, error_rows=?,
              error_log=?, completed_at=now()
```

**Cron trigger:**

```java
@Scheduled(cron = "0 0 2 * * *")  // 2:00 AM mỗi ngày
public void runCsvImportJob() {
    jobLauncher.run(studentImportJob, new JobParametersBuilder()
        .addDate("runDate", new Date())
        .toJobParameters());
}
```

---

## 10. Các quyết định kỹ thuật quan trọng (ADR)

### ADR-01: Chọn Supabase thay vì self-hosted PostgreSQL

**Quyết định:** Dùng Supabase (managed PostgreSQL).

**Lý do:**

- Supabase Real-time cung cấp WebSocket subscription cho số ghế còn lại — frontend tự động cập nhật mà không cần polling.
- Supabase Storage tích hợp sẵn cho file PDF và ảnh sơ đồ phòng.
- Free tier đủ cho đồ án, không cần cấu hình DB server.

**Đánh đổi:** Phụ thuộc vào vendor. Nếu Supabase có downtime, toàn bộ system affected.

---

### ADR-02: Chọn PWA (Service Worker) thay vì React Native

**Quyết định:** Dùng React + Vite với Service Worker cho check-in app, không dùng React Native.

**Lý do:**

- Nhóm chỉ có 3 người, 1 tuần — không đủ thời gian setup Expo + build native.
- PWA với Service Worker + IndexedDB đáp ứng đầy đủ yêu cầu offline.
- Camera access qua `getUserMedia` đủ để quét QR (dùng thư viện `html5-qrcode`).
- Không cần publish lên App Store.

**Đánh đổi:** PWA camera trên iOS Safari có giới hạn nhất định. Nếu thiết bị check-in dùng iPhone cũ, cần test kỹ.

---

### ADR-03: Pessimistic Locking thay vì Optimistic Locking cho seat

**Quyết định:** Dùng `SELECT FOR UPDATE` (Pessimistic Lock).

**Lý do:**

- Workshop 60 chỗ với hàng trăm request đồng thời → Optimistic Lock sẽ gây ra rất nhiều retry (version conflict), trải nghiệm SV xấu.
- Pessimistic Lock đảm bảo đúng một SV được xử lý tại một thời điểm cho mỗi workshop.
- Transaction ngắn (< 100ms) nên lock không giữ lâu.

**Đánh đổi:** Throughput thấp hơn một chút, nhưng correctness tuyệt đối quan trọng hơn.

---

### ADR-04: Chọn Gemini API thay vì OpenAI

**Quyết định:** Dùng Google Gemini API cho AI Summary.

**Lý do:** Google cung cấp free tier Gemini API đủ cho đồ án, không cần billing setup. OpenAI yêu cầu credit card ngay từ đầu.

**Đánh đổi:** API response format khác nhau, nhưng không ảnh hưởng nghiệp vụ.

---

### ADR-05: Một codebase React cho cả 3 app (SV, Admin, Check-in)

**Quyết định:** Một React + Vite project, routing theo role.

**Lý do:**

- Ba thành viên dùng chung component library, tránh duplicate code.
- Build ra 1 bundle, deploy 1 nơi.
- Protected routes theo role: `/admin/*` chỉ cho ORGANIZER, `/checkin/*` chỉ cho CHECKIN_STAFF.

**Đánh đổi:** Bundle size lớn hơn. Giải pháp: React lazy loading + code splitting theo route.
