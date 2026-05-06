# Đặc tả: Notification System (Thành viên 3)

> **Phạm vi:** Gửi email xác nhận, thông báo workshop thay đổi, in-app notifications.

---

## Mô tả

Hệ thống thông báo đa kênh:
- **Email (SMTP):** Xác nhận đăng ký, workshop bị hủy/đổi phòng
- **In-app:** Insert vào bảng `notifications`, frontend polling hoặc Supabase Realtime subscribe
- **Thiết kế mở rộng:** Dễ dàng thêm Telegram, SMS trong tương lai mà không thay đổi core logic

---

## API Endpoints

### Base path: `/api/notifications`

#### `GET /api/notifications` — Danh sách notifications (STUDENT)

Lấy notifications của user đang đăng nhập.

**Header:** `Authorization: Bearer {accessToken}`

**Query Params:**
- `?is_read=false` — chỉ unread (tùy chọn)
- `?page=0&size=20` — phân trang
- `?sort=createdAt,desc` — sắp xếp

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "content": [
      {
        "id": "n1n2n3n4-...",
        "type": "REGISTRATION_CONFIRMED",
        "title": "Đăng ký thành công",
        "body": "Bạn đã đăng ký thành công workshop 'AI trong giáo dục'",
        "is_read": false,
        "created_at": "2026-05-03T10:15:00Z",
        "data": {
          "workshopId": "a1b2c3d4-...",
          "registrationId": "r1r2r3r4-..."
        }
      }
    ],
    "totalElements": 15,
    "totalPages": 1,
    "page": 0,
    "size": 20,
    "unreadCount": 3
  }
}
```

---

#### `PATCH /api/notifications/{notificationId}` — Mark as read (STUDENT)

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "is_read": true
}
```

**Validation:**
- Notification thuộc về user đang đăng nhập
- Chỉ có thể set `is_read` (không thể modify `type`, `title`, `body`)

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "id": "n1n2n3n4-...",
    "is_read": true,
    "updatedAt": "2026-05-03T10:20:00Z"
  }
}
```

---

#### `PATCH /api/notifications` — Bulk mark as read (STUDENT)

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "action": "mark_all_read",
  "filter": {
    "type": "WORKSHOP_CANCELLED"
  }
}
```

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "updatedCount": 5
  }
}
```

---

#### `DELETE /api/notifications/{notificationId}` — Xóa notification (STUDENT)

**Header:** `Authorization: Bearer {accessToken}`

**Response 204 — No Content**

---

#### `DELETE /api/notifications` — Bulk delete (STUDENT)

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "action": "delete_all",
  "filter": {
    "type": "WORKSHOP_CANCELLED",
    "olderThan": "2026-04-01"
  }
}
```

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "deletedCount": 3
  }
}
```

---

### Additional API Endpoints

#### `POST /api/notifications` — Create Notification

Allows ORGANIZER to create a new notification for a specific workshop.

**Request Body:**
```json
{
  "workshopId": "abc123",
  "type": "WORKSHOP_UPDATED",
  "title": "Workshop Updated",
  "body": "The workshop schedule has been updated."
}
```

**Response 201:**
```json
{
  "status": 201,
  "message": "Notification created successfully."
}
```

---

## Luồng chính

### Luồng A: Email Registration Confirmation

```
Event: Registration CONFIRMED (miễn phí hoặc thanh toán thành công)
  │
  ├── [1] Async trigger: EmailService.sendRegistrationConfirmation()
  │       └── @Async method (ThreadPool xử lý)
  │
  ├── [2] Prepare email
  │       ├── Load template: "registration_confirmation.html"
  │       ├── Render variables:
  │       │   - {studentName}, {workshopTitle}, {startTime}, {room}
  │       │   - {qrCode} → Generate QR SVG từ UUID
  │       └── Subject: "[UniHub] Đăng ký thành công - {workshopTitle}"
  │
  ├── [3] Send via SMTP
  │       ├── From: noreply@unihub.edu.vn
  │       ├── To: student.email
  │       ├── Body: HTML + QR code attachment
  │       └── Retry 3 lần nếu SMTP fail (exponential backoff)
  │
  └── [4] Log result (success/failure)
```

### Luồng B: Email Workshop Cancellation

```
Event: Workshop status → CANCELLED (BTC hủy workshop)
  │
  ├── [1] GET all registrations WHERE workshop_id=? AND status=CONFIRMED
  ├── [2] For each registration:
  │       ├── Async: EmailService.sendWorkshopCancellation()
  │       │   ├── Template: "workshop_cancelled.html"
  │       │   ├── Variables: {studentName}, {workshopTitle}, {cancellationReason}
  │       │   ├── Subject: "[UniHub] Thông báo hủy workshop - {workshopTitle}"
  │       │   └── Send to student.email
  │       │
  │       └── Async: NotificationService.createInAppNotification()
  │           └── INSERT notifications (user_id, type=WORKSHOP_CANCELLED, ...)
  │
  └── [3] Log batch send result
```

### Luồng C: In-app Notification

```
Event: Bất kỳ sự kiện quan trọng (workshop cancelled, status updated, ...)
  │
  ├── [1] Async trigger: NotificationService.createNotification()
  │
  ├── [2] INSERT notifications
  │       ├── user_id: SV liên quan
  │       ├── type: REGISTRATION_CONFIRMED / WORKSHOP_CANCELLED / WORKSHOP_UPDATED / ...
  │       ├── title: Tiêu đề ngắn
  │       ├── body: Nội dung chi tiết
  │       ├── is_read: false
  │       ├── created_at: now()
  │       └── data: {workshopId, registrationId, ...} (JSON)
  │
  ├── [3] Supabase Realtime publish
  │       └── Channel: `notifications:{userId}`
  │           Event: INSERT
  │           Payload: {id, title, body, created_at}
  │
  └── [4] Frontend React component
         └── useEffect(() => {
               const subscription = supabase
                 .channel(`notifications:${userId}`)
                 .on('postgres_changes', ..., (payload) => {
                   setNotifications(prev => [payload.new, ...prev])
                 })
                 .subscribe()
             })
```

### Luồng D: Mark Notification as Read

```
PATCH /api/notifications/{notificationId}
  ├── Header: Authorization
  ├── Body: {is_read: true}
  │
  ├── [1] Verify ownership: notification.user_id == current_user.id
  ├── [2] UPDATE notifications SET is_read = true WHERE id = ?
  └── Return 200 {is_read: true}
```

---

## Kịch bản lỗi

| Tình huống | Hành vi |
|-----------|--------|
| **SMTP connection failed** | Retry 3 lần (50ms, 100ms, 200ms exponential backoff), log error, không fail request chính |
| **Email address invalid** | Skip this email, log warning, tiếp tục send cho người khác |
| **Template file không tìm thấy** | Log error, send generic fallback email, không crash |
| **Supabase connection down** | In-app notification fail insert, log error, email vẫn send (fallback to email) |
| **Notification table write fail** | Log error, retry sau 1 phút qua Spring Batch, không block |
| **Recipient không tồn tại** | Bỏ qua, không báo lỗi |
| **Rate limit SMTP server** | Backoff & retry, đừng spam email liên tục |
| **User unsubscribed from notifications** | Check flag `notification_enabled=false`, bỏ qua |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Async safety** | Email gửi không được block response; ThreadPool size ≥ 5, queue ≥ 100 |
| **Idempotency** | Không gửi email duplicate (check via idempotency key hoặc bảng `email_sent`) |
| **Retention** | Notifications lưu tối đa 90 ngày, sau đó auto-delete |
| **Rate limit** | Mỗi user không nhận >100 notifications/ngày |
| **SMTP config** | Timeout: 5s, Max retries: 3, Connection pool: 10 |
| **Template** | UTF-8 encoding, HTML-safe, responsive design |
| **Performance** | Batch send ≤ 1000 emails/phút (không overload SMTP server) |

---

## Tiêu chí chấp nhận

- ✅ Sinh viên nhận email xác nhận trong 5 phút sau khi đăng ký thành công
- ✅ Email chứa QR code có thể scan được
- ✅ Khi workshop bị hủy, tất cả SV đã đăng ký nhận email thông báo
- ✅ In-app notification xuất hiện trên dashboard ngay (Supabase Realtime push)
- ✅ Unread badge hiển thị số notification chưa đọc
- ✅ Email không bị spam (mỗi sự kiện 1 email, không gửi lại)
- ✅ Notification có thể mark as read (PATCH endpoint)
- ✅ Nếu SMTP down, email queue lại và retry; không làm sập hệ thống
- ✅ Frontend có cách unsubscribe từ in-app notifications
- ✅ Template email hiển thị đúng trên mobile & desktop
