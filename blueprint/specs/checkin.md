# Đặc tả: Check-in & Offline Sync (Thành viên 3)

> **Phạm vi:** Quét QR tại cửa phòng (online và offline), đồng bộ nền khi mạng trở lại qua PWA. (Phần CSV và Notification đã được tách riêng).

---

## Mô tả

Hệ thống cho phép nhân sự (CHECKIN_STAFF) quét mã QR để ghi nhận sinh viên tham dự. Hỗ trợ preload danh sách để quét offline (không có mạng) và tự động đồng bộ (Background Sync) khi có mạng trở lại.

---

## Luồng chính

### Luồng 1: Preload dữ liệu (Khi có mạng)

1. Staff mở PWA vào buổi sáng, gọi `GET /api/checkins/preload?date={today}`
2. Trả về danh sách QR hợp lệ cho các workshop trong ngày.
3. Frontend lưu toàn bộ vào IndexedDB (bảng `qr_registry`).

### Luồng 2: Check-in Offline

1. Staff quét QR qua camera (`html5-qrcode`).
2. Nếu mất mạng: Frontend tra cứu `qrCode` trong IndexedDB (`qr_registry`).
   - Nếu không tìm thấy: Báo lỗi "Không tìm thấy SV".
   - Nếu đã check-in: Cảnh báo trùng lặp.
   - Nếu hợp lệ: Ghi vào IndexedDB (bảng `pending_sync`), báo thành công.

### Luồng 3: Background Sync

1. Mạng có lại → Service Worker kích hoạt sự kiện `sync`.
2. Đọc IndexedDB lấy các bản ghi chưa sync.
3. Gửi batch lên `POST /api/checkins/sync`.
4. DB Backend xử lý `INSERT ... ON CONFLICT DO NOTHING`.
5. Trả về 200 OK → Frontend đánh dấu đã sync trong IndexedDB.

---

## Kịch bản lỗi

| Tình huống                        | HTTP/Trạng thái | Hành vi                                                      |
| --------------------------------- | --------------- | ------------------------------------------------------------ |
| **QR không hợp lệ/không tồn tại** | 404             | Báo lỗi "Mã QR không hợp lệ"                                 |
| **Đã check-in trước đó (Online)** | 409             | Báo lỗi "SV đã check-in lúc..."                              |
| **Check-in trùng (Offline)**      | Local           | Chặn bằng flag `alreadyCheckedIn` trong IndexedDB            |
| **Đứt mạng khi đang Sync**        | Local           | Service worker kẹt lại trạng thái pending, tự động retry sau |

---

## Ràng buộc

- **Offline First:** Luôn kiểm tra `navigator.onLine`, ưu tiên ghi log local nếu rớt mạng.
- **Idempotency Check-in:** Backend dùng `ON CONFLICT (registration_id) DO NOTHING` để tránh insert đúp nếu sync 2 lần.
- **Performance:** `html5-qrcode` quét đạt tốc độ < 1 giây/lần.

---

## Tiêu chí chấp nhận

- ✅ Mở app, tải được danh sách SV hôm nay về IndexedDB.
- ✅ Tắt Wifi, quét QR hợp lệ → Báo thành công, lưu local.
- ✅ Quét lại mã QR đó khi tắt Wifi → Báo đã check-in.
- ✅ Bật Wifi lại → Payload tự động gửi lên server qua `POST /api/checkins/sync` mà không cần staff bấm nút.

### Additional API Endpoints

#### `GET /api/checkins/{workshopId}` — List Check-ins

Allows CHECKIN_STAFF to view all check-ins for a specific workshop.

**Response 200:**
```json
{
  "status": 200,
  "data": [
    {
      "id": "checkin123",
      "userId": "user456",
      "workshopId": "workshop789",
      "checkinTime": "2026-05-10T08:00:00Z"
    }
  ]
}
```
