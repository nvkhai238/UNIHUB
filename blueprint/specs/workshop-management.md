# Đặc tả: Workshop Management (Thành viên 2)

> **Phạm vi:** CRUD workshop, quản lý trạng thái workshop, thống kê đăng ký. Tách riêng từ ai-summary.md.

---

## Mô tả

Ban tổ chức tạo, chỉnh sửa, hủy workshop. Hệ thống:
- Cho phép ORGANIZER quản lý workshop từ DRAFT → PUBLISHED → CANCELLED
- Public có thể xem danh sách workshop đã PUBLISHED
- Cung cấp thống kê đăng ký cho ORGANIZER
- Hỗ trợ Supabase Realtime cập nhật số chỗ còn lại (xem [realtime-updates.md](realtime-updates.md))

---

## API Endpoints

### Base path: `/api`

#### `GET /api/workshops` — Danh sách workshop (Public)

Xem tất cả workshop PUBLISHED. Không cần đăng nhập.

**Query Params:**
- `?date=2026-05-10` — lọc theo ngày (tùy chọn)
- `?status=PUBLISHED` — mặc định PUBLISHED; ORGANIZER có thể query DRAFT
- `?page=0&size=20` — phân trang

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

**Request Body:** (partial update)
```json
{
  "title": "Workshop AI (Updated)",
  "room": "B4-302",
  "startTime": "2026-05-10T09:00:00Z"
}
```

**Constraint:** Không được giảm `capacity` dưới số CONFIRMED registrations.

**Response 200:** Updated workshop data.

---

#### `PATCH /api/workshops/{id}/status` — Thay đổi status (ORGANIZER)

**Request Body:**
```json
{
  "status": "PUBLISHED",
  "cancellationReason": null
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
- Khi status = CANCELLED: phải có `cancellationReason`
- Server tự động gửi email + in-app notification đến tất cả CONFIRMED registrations
- Tất cả registrations chuyển sang CANCELLED

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

#### `GET /api/admin/workshops` — Danh sách workshop (ORGANIZER)

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

#### `GET /api/admin/workshops/{id}/stats` — Thống kê workshop (ORGANIZER)

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "workshopId": "a1b2c3d4-...",
    "title": "Workshop AI trong giáo dục",
    "capacity": 60,
    "remainingSeats": 15,
    "confirmed": 45,
    "waitlisted": 12,
    "cancelled": 3,
    "checkedIn": 38,
    "fillRate": "75%",
    "checkinRate": "84%"
  }
}
```

---

### Additional API Endpoints

#### `PATCH /api/workshops/{id}` — Update Workshop Details

Allows ORGANIZER to update workshop details such as title, speaker, room, and schedule.

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

#### `DELETE /api/workshops/{id}` — Cancel Workshop

Allows ORGANIZER to cancel a workshop. Updates the status to `CANCELLED`.

**Response 200:**
```json
{
  "status": 200,
  "message": "Workshop cancelled successfully."
}
```

---

## Luồng chính

### Luồng: CRUD & Status Management

```
1. ORGANIZER tạo workshop → status = DRAFT, remainingSeats = capacity
2. ORGANIZER có thể:
   - Cập nhật details (PUT /workshops/{id})
   - Upload PDF (POST /workshops/{id}/pdf) — xem ai-summary.md
   - Publish (PATCH /workshops/{id}/status → PUBLISHED)
   - Cancel (PATCH /workshops/{id}/status → CANCELLED)
3. Khi PUBLISHED: sinh viên có thể xem + đăng ký
4. Khi CANCELLED: 
   - Notify tất cả CONFIRMED sinh viên via email + in-app
   - Tất cả registrations → CANCELLED
   - Refund nếu có phí
5. ORGANIZER xem stats realtime (số confirmed, waitlisted, checked-in)
```

---

## Kịch bản lỗi

| Tình huống | HTTP | Code | Hành vi |
|-----------|------|------|--------|
| **Workshop không tồn tại** | 404 | `WORKSHOP_NOT_FOUND` | Trả lỗi |
| **Giảm capacity dưới confirmed count** | 409 | `CAPACITY_BELOW_REGISTERED` | Reject |
| **Cập nhật workshop CANCELLED** | 409 | `WORKSHOP_ALREADY_CANCELLED` | Reject |
| **Cancel mà không có lý do** | 400 | `CANCELLATION_REASON_REQUIRED` | Reject |
| **Quay lại PUBLISHED → DRAFT** | 409 | `INVALID_STATE_TRANSITION` | Reject |
| **Không phải ORGANIZER** | 403 | `FORBIDDEN` | Reject |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Consistency** | remaining_seats = capacity - confirmed; confirmed + waitlisted ≤ capacity |
| **Immutability** | Không thể revert PUBLISHED → DRAFT |
| **Notification** | Khi cancel: email + in-app gửi async, không block response |
| **Realtime** | Số ghế cập nhật via Supabase Realtime (xem [realtime-updates.md](realtime-updates.md)) |
| **Data integrity** | startTime < endTime; capacity > 0; price >= 0 |

---

## Tiêu chí chấp nhận

- ✅ ORGANIZER tạo workshop → status = DRAFT
- ✅ Cập nhật capacity → validate không < confirmed count
- ✅ Publish → status = PUBLISHED, sinh viên thấy ngay
- ✅ Cancel → notify tất cả → async email gửi không block
- ✅ Stats real-time: confirmed, waitlisted, checkedIn count chính xác
- ✅ 50 concurrent requests → workshop data consistent
- ✅ Số ghế cập nhật realtime trên frontend (WebSocket)
