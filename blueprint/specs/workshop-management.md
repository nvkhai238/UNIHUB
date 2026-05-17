# Đặc tả: Quản lý workshop (Thành viên 2)

> **Phạm vi:** CRUD workshop, quản lý trạng thái workshop, thống kê đăng ký. Tách riêng từ ai-summary.md.

---

## Mô tả

Ban tổ chức tạo, chỉnh sửa, hủy workshop. Hệ thống:
- Cho phép ORGANIZER quản lý workshop từ DRAFT → PUBLISHED → CANCELLED
- Public có thể xem danh sách workshop đã PUBLISHED
- Cung cấp thống kê đăng ký, check-in và doanh thu cho ORGANIZER
- Hỗ trợ Supabase Realtime cập nhật số chỗ còn lại (xem [realtime-updates.md](realtime-updates.md))

---

## Luồng chính

### Luồng: CRUD & Status Management

```
1. ORGANIZER tạo workshop → status = DRAFT, remainingSeats = capacity
2. ORGANIZER có thể:
   - Cập nhật details (PUT /workshops/{id})
   - Upload PDF (POST /workshops/{id}/pdf) — xem ai-summary.md
   - Publish (PATCH /workshops/{id}/status → PUBLISHED)
   - Cancel (PATCH /workshops/{id}/status hoặc POST /workshops/{id}/cancel → CANCELLED)
3. Khi PUBLISHED: sinh viên có thể xem + đăng ký
4. Khi CANCELLED: 
   - Notify tất cả sinh viên có registration liên quan via email + in-app
   - Tất cả registrations active/waitlisted → CANCELLED
   - Payment `SUCCESS` → `REFUNDED`, payment `PENDING` → `FAILED`
5. ORGANIZER xem stats realtime (số confirmed, waitlisted, checked-in)
```

---

## Kịch bản lỗi

| Tình huống | HTTP | Code | Hành vi |
|-----------|------|------|--------|
| **Workshop không tồn tại** | 404 | `WORKSHOP_NOT_FOUND` | Trả lỗi |
| **Giảm capacity** | 200/409 | tùy validation | Codebase hiện tại cập nhật capacity, điều chỉnh `remainingSeats=max(0, oldRemaining+diff)` và promote waitlist nếu còn chỗ; trước demo không giảm dưới số active registrations |
| **Cập nhật workshop CANCELLED** | 409 | `WORKSHOP_ALREADY_CANCELLED` | Reject |
| **Quay lại PUBLISHED → DRAFT** | 409 | `INVALID_STATE_TRANSITION` | Reject |
| **Không phải ORGANIZER** | 403 | `FORBIDDEN` | Reject |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Consistency** | `remaining_seats` không âm; active seat reservation (`PENDING` + `CONFIRMED`) không vượt capacity trong luồng đăng ký; waitlist có thể vượt capacity |
| **Immutability** | Không thể revert PUBLISHED → DRAFT |
| **Notification** | Khi cancel: email + in-app gửi async, không block response |
| **Realtime** | Số ghế cập nhật via Supabase Realtime (xem [realtime-updates.md](realtime-updates.md)) |
| **Data integrity** | startTime < endTime; capacity > 0; price >= 0 |

---

## Tiêu chí chấp nhận

- ✅ ORGANIZER tạo workshop → status = DRAFT
- ✅ Cập nhật capacity → remainingSeats được điều chỉnh nhất quán và waitlist được promote nếu có chỗ
- ✅ Publish → status = PUBLISHED, sinh viên thấy ngay
- ✅ Cancel → notify tất cả → async email gửi không block
- ✅ Stats real-time: confirmed, waitlisted, checkedIn count chính xác
- ✅ 50 concurrent requests → workshop data consistent
- ✅ Số ghế cập nhật realtime trên frontend (WebSocket)

---

## API Endpoints

### Base path: `/api`

#### `GET /api/workshops` — Danh sách workshop (Public)

Xem tất cả workshop PUBLISHED. Không cần đăng nhập.

**Query Params:**
- `?page=0&size=20` — phân trang
- Public endpoint chỉ trả workshop `PUBLISHED` và chưa kết thúc; lọc theo `status` dùng endpoint admin.

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "content": [
      {
        "id": "a1b2c3d4-...",
        "title": "Workshop AI trong giáo dục",
        "speakerName": "TS. Nguyễn Văn X",
        "room": "B4-301",
        "startTime": "2026-05-10T08:00:00Z",
        "endTime": "2026-05-10T10:00:00Z",
        "capacity": 60,
        "remainingSeats": 15,
        "price": 50000,
        "status": "PUBLISHED",
        "aiSummaryStatus": "DONE"
      }
    ],
    "totalElements": 8,
    "totalPages": 1,
    "page": 0,
    "size": 20
  }
}
```

---

#### `GET /api/workshops/{id}` — Chi tiết workshop (Public)

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "id": "a1b2c3d4-...",
    "title": "Workshop AI trong giáo dục",
    "description": "Khám phá ứng dụng AI trong lớp học...",
    "speakerName": "TS. Nguyễn Văn X",
    "speakerBio": "Tiến sĩ CNTT, 10 năm nghiên cứu...",
    "room": "B4-301",
    "roomLayoutUrl": "https://storage.supabase.co/...",
    "startTime": "2026-05-10T08:00:00Z",
    "endTime": "2026-05-10T10:00:00Z",
    "capacity": 60,
    "remainingSeats": 15,
    "price": 50000,
    "status": "PUBLISHED",
    "pdfUrl": "https://storage.supabase.co/...",
    "aiSummary": "Workshop trình bày 3 ứng dụng chính của AI...",
    "aiSummaryStatus": "DONE",
    "createdAt": "2026-05-01T10:00:00Z"
  }
}
```

---

#### `POST /api/workshops` — Tạo workshop (ORGANIZER)

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "title": "Workshop AI trong giáo dục",
  "description": "Khám phá ứng dụng AI trong lớp học...",
  "speakerName": "TS. Nguyễn Văn X",
  "speakerBio": "Tiến sĩ CNTT, 10 năm nghiên cứu...",
  "room": "B4-301",
  "startTime": "2026-05-10T08:00:00Z",
  "endTime": "2026-05-10T10:00:00Z",
  "capacity": 60,
  "price": 50000
}
```

**Validation:**
- `title`: không rỗng, tối đa 500 ký tự
- `startTime` < `endTime`
- `capacity` > 0
- `price` >= 0

**Response 201:**
```json
{
  "status": 201,
  "data": {
    "id": "a1b2c3d4-...",
    "status": "DRAFT",
    "remainingSeats": 60
  }
}
```

**Note:** Workshop mới luôn DRAFT. ORGANIZER phải publish thủ công.

---

#### `PUT /api/workshops/{id}` — Cập nhật workshop (ORGANIZER)

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:** full update payload theo `WorkshopRequest`
```json
{
  "title": "Workshop AI (Updated)",
  "description": "Nội dung cập nhật...",
  "speakerName": "TS. Nguyễn Văn X",
  "speakerBio": "Tiểu sử cập nhật...",
  "room": "B4-302",
  "roomLayoutUrl": "https://storage.supabase.co/...",
  "startTime": "2026-05-10T09:00:00Z",
  "endTime": "2026-05-10T11:00:00Z",
  "capacity": 60,
  "price": 50000,
  "pdfUrl": "https://storage.supabase.co/..."
}
```
**Constraint:** Không cập nhật workshop đã `CANCELLED`; thay đổi capacity sẽ điều chỉnh `remainingSeats` theo chênh lệch capacity và có thể promote waitlist.

**Response 200:** Updated workshop data.

---

#### `PATCH /api/workshops/{id}/status` — Thay đổi status (ORGANIZER)

**Request Body:**
```json
{
  "status": "PUBLISHED"
}
```

**State machine:**
```
DRAFT → PUBLISHED
DRAFT → CANCELLED
PUBLISHED → CANCELLED
(CANNOT revert PUBLISHED → DRAFT)
```

**Special handling:**
- `PATCH /status` chỉ đổi state hợp lệ.
- `POST /api/workshops/{id}/cancel` chạy logic hủy đầy đủ: gửi email + in-app notification, chuyển registrations liên quan sang `CANCELLED`, cập nhật payment.

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "id": "a1b2c3d4-...",
    "status": "PUBLISHED"
  }
}
```

---

#### `GET /api/workshops/admin` — Danh sách workshop (ORGANIZER)

Xem tất cả workshop (DRAFT, PUBLISHED, CANCELLED).

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "content": [
      {
        "id": "a1b2c3d4-...",
        "title": "...",
        "status": "PUBLISHED",
        "confirmedCount": 45,
        "waitlistedCount": 12,
        "checkinCount": 38
      }
    ],
    "totalElements": 20,
    "totalPages": 1
  }
}
```

---

#### `GET /api/workshops/statistics` — Thống kê workshop (ORGANIZER)

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "totalWorkshops": 8,
    "totalRegistrations": 320,
    "totalConfirmedRegistrations": 240,
    "totalWaitlistedRegistrations": 36,
    "totalPendingRegistrations": 24,
    "totalCancelledRegistrations": 20,
    "totalCheckins": 180,
    "successfulPayments": 92,
    "totalRevenue": 4600000,
    "breakdown": [
      {
        "workshopId": "a1b2c3d4-...",
        "workshopTitle": "Workshop AI trong giáo dục",
        "registrationsCount": 60,
        "confirmedCount": 45,
        "waitlistedCount": 12,
        "pendingCount": 3,
        "cancelledCount": 0,
        "checkinCount": 38,
        "checkinRate": 0.84,
        "capacity": 60,
        "remainingSeats": 15,
        "revenue": 2250000
      }
    ]
  }
}
```

---

### API bổ sung

#### `GET /api/workshops/{id}/registrations` — Danh sách registration theo workshop

Cho phép ORGANIZER xem danh sách đăng ký theo workshop, có filter `status` và phân trang.

#### `POST /api/workshops/{id}/cancel` — Cancel Workshop

Cho phép ORGANIZER hủy workshop qua endpoint hành động riêng. Backend chuyển workshop sang `CANCELLED`, xử lý registration/payment liên quan và gửi notification/email theo luồng cancellation.

#### `PUT /api/workshops/{id}` — Update Workshop Details

Cho phép ORGANIZER cập nhật thông tin workshop như tiêu đề, diễn giả, phòng và lịch trình.

**Request Body:**
```json
{
  "title": "Updated Workshop Title",
  "speakerName": "Updated Speaker",
  "room": "Updated Room",
  "startTime": "2026-05-10T10:00:00Z",
  "endTime": "2026-05-10T12:00:00Z"
}
```

**Response 200:**
```json
{
  "status": 200,
  "message": "Workshop updated successfully."
}
```

#### `PATCH /api/workshops/{id}/status` — Update Workshop Status

Cho phép ORGANIZER đổi trạng thái workshop, chủ yếu `DRAFT -> PUBLISHED` và `PUBLISHED/DRAFT -> CANCELLED`.

**Response 200:**
```json
{
  "status": 200,
  "message": "Workshop cancelled successfully."
}
```

---




