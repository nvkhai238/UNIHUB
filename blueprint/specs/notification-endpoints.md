# Đặc tả: Notification Endpoints (Thành viên 3)

> **Phạm vi:** API Endpoints để quản lý notifications (mark as read, fetch, delete).

---

## Mô tả

Thêm các API endpoints cho Notification system đã describe trong [notification.md](notification.md):
- Fetch notification list của user
- Mark notification as read
- Delete notification

---

## API Endpoints

### Base path: `/api`

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
- notification thuộc về user đang đăng nhập
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

Mark tất cả notifications (hoặc filter) thành read.

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "action": "mark_all_read",
  "filter": {
    "type": "WORKSHOP_CANCELLED"  // Tùy chọn: chỉ mark notifications loại nào
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

Xóa tất cả hoặc filter notifications.

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "action": "delete_all",
  "filter": {
    "type": "WORKSHOP_CANCELLED",  // Tùy chọn
    "olderThan": "2026-04-01"      // Tùy chọn: xóa notification cũ hơn
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

## Luồng chính

### Luồng: Notification Lifecycle

```
1. Event xảy ra (registration confirmed, workshop cancelled, etc.)
   └── NotificationService.createNotification(userId, type, title, body, data)

2. INSERT notifications table
   ├── is_read = false
   └── created_at = now()

3. Supabase Realtime publish event
   └── Channel: notifications:{userId}
       Payload: {id, title, body, created_at}

4. Frontend React component
   └── Subscribe → setNotifications
       Hiển thị badge unreadCount

5. User click notification
   └── PATCH /api/notifications/{id} is_read=true
       Thêm vào read list

6. User delete notification (tùy chọn)
   └── DELETE /api/notifications/{id}
       Remove khỏi list
```

---

## Kịch bản lỗi

| Tình huống | HTTP | Code | Hành vi |
|-----------|------|------|--------|
| **Notification không tồn tại** | 404 | `NOTIFICATION_NOT_FOUND` | Trả lỗi |
| **Notification của user khác** | 403 | `FORBIDDEN` | Reject |
| **Bulk action timeout** | 504 | `TIMEOUT` | Trả lỗi, user retry |
| **Invalid filter** | 400 | `INVALID_FILTER` | Trả lỗi |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Ownership** | Mỗi user chỉ xem được notifications của chính mình |
| **Retention** | Notifications lưu tối đa 90 ngày, sau đó auto-delete (batch job) |
| **Immutability** | Không thể edit type, title, body; chỉ edit is_read |
| **Rate limit** | Mỗi user 30 requests/10s tới notifications endpoints |
| **Pagination** | Mỗi trang max 50 items |
| **Realtime** | Supabase Realtime publish khi có INSERT/UPDATE |

---

## Tiêu chí chấp nhận

- ✅ GET /notifications trả về tất cả notifications của user
- ✅ Có unreadCount trong response
- ✅ PATCH /notifications/{id} is_read=true → notification cập nhật
- ✅ DELETE /notifications/{id} → notification bị xóa khỏi DB
- ✅ Bulk operations (mark all read, delete all) hoạt động
- ✅ Notification của user B không thể access từ user A
- ✅ Pagination works: GET /notifications?page=1&size=20
- ✅ Filter works: GET /notifications?type=WORKSHOP_CANCELLED
- ✅ Realtime: new notification push via Supabase WebSocket
