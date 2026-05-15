# Đặc tả: Xác thực (Thành viên 2)

> **Phạm vi:** Đăng nhập, đăng ký, làm mới token JWT, đăng xuất, bảo vệ endpoint theo role.

---

## Mô tả

| Trách nhiệm                  | Mô tả                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| Xác thực người dùng          | Kiểm tra email + password, trả về access token + refresh token                           |
| Cấp JWT                      | Ký token với `HS256`, chứa `sub`, `email`, `role`, `iat`, `exp`                         |
| Làm mới token                | Nhận refresh token hợp lệ → trả về access token mới (không cần đăng nhập lại)           |
| Đăng xuất                    | Blacklist refresh token trong Redis (TTL bằng thời gian còn lại của token)              |
| Bảo vệ route theo role       | JWT filter chain + method-level `@PreAuthorize` — 3 role: STUDENT, ORGANIZER, CHECKIN_STAFF |
| Khởi tạo tài khoản sinh viên | Tài khoản sinh viên được tạo từ CSV import hoặc qua luồng đăng ký OTP email              |

---

## Luồng chính

### Cấu trúc Access Token

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "nguyenvana@university.edu.vn",
  "role": "STUDENT",
  "iat": 1748908800,
  "exp": 1748995200
}
```

| Field   | Mô tả                              |
| ------- | ---------------------------------- |
| `sub`   | UUID của user trong bảng `users`   |
| `email` | Email người dùng (read-only)       |
| `role`  | `STUDENT` / `ORGANIZER` / `CHECKIN_STAFF` |
| `iat`   | Thời điểm phát hành (Unix epoch)   |
| `exp`   | Thời điểm hết hạn = `iat + 86400` (24h) |

### Token TTL

| Token Type    | TTL     | Lưu trữ phía client              |
| ------------- | ------- | -------------------------------- |
| Access Token  | 24 giờ  | `localStorage` (hoặc memory)     |
| Refresh Token | 7 ngày  | `localStorage` (httpOnly cookie nếu có thể) |

### Đăng xuất — Blacklist trong Redis

```
Key:   refresh:{refreshToken}
Value: "revoked"
TTL:   Thời gian còn lại của token (seconds)
```

Khi `/api/auth/refresh` được gọi:
1. Kiểm tra token có trong Redis blacklist không → nếu có → 401
2. Verify signature + expiry
3. Cấp access token mới

---

### Đăng ký tài khoản sinh viên bằng OTP

Luồng public hiện tại có 2 bước để tránh tạo tài khoản bằng email chưa xác thực:

```
POST /api/auth/register/request-otp
  ├── Validate email/fullName/studentId/password
  ├── Kiểm tra sinh viên hợp lệ theo dữ liệu CSV/user hiện có
  ├── Sinh OTP, lưu pending payload tạm thời
  └── EmailService.sendRegistrationOtp(...)

POST /api/auth/register/verify-otp
  ├── Validate email + otpCode
  ├── Tạo/cập nhật user STUDENT
  └── Return AuthResponse (accessToken + refreshToken)
```

Endpoint `POST /api/auth/register` vẫn tồn tại cho luồng đăng ký trực tiếp, nhưng luồng UI chính dùng OTP.

---

### Khởi tạo mật khẩu mặc định

Tài khoản sinh viên được tạo bởi CSV Import Job. Mật khẩu ban đầu = `student_id + "@UniHub"` (ví dụ: mã SV `21521234` → mật khẩu mặc định `21521234@UniHub`).

Tài khoản ORGANIZER và CHECKIN_STAFF được tạo thủ công bởi DBA/Admin hệ thống — không qua API đăng ký public.

**Không có tính năng "Quên mật khẩu" trong phạm vi đồ án.** Sinh viên quên mật khẩu liên hệ ban tổ chức để reset về mặc định.

---

### Spring Security Filter Chain

```
Request đến
    │
    ▼
JwtAuthenticationFilter (OncePerRequestFilter)
    ├── Extract Bearer token từ header Authorization
    ├── Nếu không có token → SecurityContext rỗng → tiếp tục (public endpoint tự xử lý)
    ├── Verify signature (HMAC-SHA256, secret từ application.yml)
    ├── Kiểm tra exp → 401 nếu hết hạn
    ├── Parse claims: sub, email, role
    └── Set SecurityContextHolder với UsernamePasswordAuthenticationToken
    │
    ▼
Authorization Check (Spring Security)
    ├── /api/auth/**         → permitAll (public)
    ├── GET /api/workshops/** → permitAll (public)
    ├── POST /api/registrations/** → hasRole("STUDENT")
    ├── GET /api/registrations/my/** → hasRole("STUDENT")
    ├── /api/admin/**        → hasRole("ORGANIZER")
    ├── POST/PUT/DELETE /api/workshops/** → hasRole("ORGANIZER")
    ├── /api/checkins/**     → hasRole("CHECKIN_STAFF")
    └── anyRequest()        → authenticated()
```

---

## Ràng buộc

```yaml
app:
  jwt:
    secret: "${JWT_SECRET}"        # 256-bit base64 encoded, set qua env var
    access-token-ttl: 86400        # 24 giờ (seconds)
    refresh-token-ttl: 604800      # 7 ngày (seconds)

spring:
  security:
    filter-order: 10
```

**Lưu ý bảo mật:**
- `JWT_SECRET` không được commit vào source code — set qua biến môi trường hoặc `.env` file (không commit `.env`).
- Secret phải dài ít nhất 32 ký tự (256 bit) để đảm bảo an toàn cho HMAC-SHA256.

---

## Kịch bản lỗi

Mọi response lỗi từ module Auth đều theo format chung:

```json
{
  "status": <HTTP status code>,
  "code": "<ERROR_CODE>",
  "message": "<Thông báo tiếng Việt cho người dùng>"
}
```

| Tình huống                     | HTTP | Code                    |
| ------------------------------ | ---- | ----------------------- |
| Sai email hoặc password        | 401  | `INVALID_CREDENTIALS`   |
| Tài khoản bị vô hiệu hóa      | 403  | `ACCOUNT_DISABLED`      |
| Access token hết hạn           | 401  | `TOKEN_EXPIRED`         |
| Access token không hợp lệ     | 401  | `TOKEN_INVALID`         |
| Refresh token bị blacklist     | 401  | `REFRESH_TOKEN_INVALID` |
| Thiếu header Authorization    | 401  | `UNAUTHORIZED`          |
| Role không đủ quyền           | 403  | `FORBIDDEN`             |
| Mật khẩu hiện tại sai         | 400  | `WRONG_CURRENT_PASSWORD`|

---

## Tiêu chí chấp nhận

- [ ] Tạo `JwtAuthenticationFilter` extends `OncePerRequestFilter`
- [ ] Tạo `JwtService` — `generateAccessToken()`, `validateToken()`, `extractClaims()`
- [ ] Tạo `RefreshTokenService` — lưu/xóa/blacklist trong Redis
- [ ] Cấu hình `SecurityFilterChain` bean trong `SecurityConfig`
- [ ] Tạo `AuthController` với endpoints: login, refresh, logout, change-password, register, request-otp, verify-otp
- [ ] Tạo `UserDetailsServiceImpl` — load user từ PostgreSQL theo email
- [ ] Viết `PasswordEncoder` bean (BCrypt, strength 12)
- [ ] Test: login thành công, sai password, token hết hạn, blacklist refresh token
- [ ] Test: endpoint STUDENT không cho ORGANIZER truy cập và ngược lại

---

## API Endpoints

### Base path: `/api/auth`

#### `POST /api/auth/login`

Đăng nhập bằng email + password. Áp dụng cho cả 3 role.

**Request Body:**
```json
{
  "email": "nguyenvana@university.edu.vn",
  "password": "Abc@12345"
}
```

**Response 200 — Thành công:**
```json
{
  "status": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "d4e5f6a7-...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "nguyenvana@university.edu.vn",
      "fullName": "Nguyễn Văn A",
      "role": "STUDENT"
    }
  }
}
```

**Response 401 — Sai thông tin:**
```json
{
  "status": 401,
  "code": "INVALID_CREDENTIALS",
  "message": "Email hoặc mật khẩu không chính xác."
}
```

**Response 403 — Tài khoản bị khóa:**
```json
{
  "status": 403,
  "code": "ACCOUNT_DISABLED",
  "message": "Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ ban tổ chức."
}
```

---

#### `POST /api/auth/refresh`

Làm mới access token mà không cần đăng nhập lại.

**Request Body:**
```json
{
  "refreshToken": "d4e5f6a7-b8c9-..."
}
```

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

**Response 401 — Token hết hạn hoặc đã bị blacklist:**
```json
{
  "status": 401,
  "code": "REFRESH_TOKEN_INVALID",
  "message": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
}
```

---

#### `POST /api/auth/logout`

Đăng xuất — blacklist refresh token trong Redis.

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "refreshToken": "d4e5f6a7-..."
}
```

**Response 204 — Thành công (no body).**

**Yêu cầu UI:**
- Sau khi đăng nhập thành công, giao diện của từng role phải có action `Đăng xuất` rõ ràng.
- Khi người dùng bấm đăng xuất, client phải gọi `POST /api/auth/logout`, xóa access token + refresh token ở local storage, rồi điều hướng về màn hình đăng nhập.
- Với app check-in offline, khi đăng xuất phải dọn `qr_registry` local để tránh giữ dữ liệu preload của phiên trước.

---

#### `POST /api/auth/change-password`

Đổi mật khẩu cho user đã đăng nhập.

---

#### `POST /api/auth/register/request-otp`

Gửi OTP xác thực đăng ký tài khoản sinh viên qua email.

**Request Body:**
```json
{
  "studentId": "21521234",
  "fullName": "Nguyễn Văn A",
  "email": "nguyenvana@university.edu.vn",
  "password": "Abc@12345"
}
```

**Response 202:**
```json
{
  "status": 202,
  "code": "OTP_REQUIRED",
  "message": "OTP has been sent to the provided email."
}
```

---

#### `POST /api/auth/register/verify-otp`

Xác thực OTP và hoàn tất đăng ký.

**Request Body:**
```json
{
  "email": "nguyenvana@university.edu.vn",
  "otpCode": "123456"
}
```

**Response 201:** Trả về payload giống `POST /api/auth/login`.

Đổi mật khẩu. Yêu cầu đã đăng nhập.

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "currentPassword": "Abc@12345",
  "newPassword": "NewPass@678"
}
```

**Response 200:**
```json
{
  "status": 200,
  "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."
}
```

---




