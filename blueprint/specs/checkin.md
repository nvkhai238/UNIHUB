# Đặc tả: Check-in và đồng bộ offline (Thành viên 3)

> **Phạm vi:** Quét QR tại cửa phòng (online và offline), đồng bộ lại khi mạng trở lại qua mobile app native. (Phần CSV và Notification đã được tách riêng).

---

## Mô tả

Hệ thống cho phép nhân sự (CHECKIN_STAFF) quét mã QR để ghi nhận sinh viên tham dự. Hỗ trợ preload danh sách để quét offline (không có mạng) và tự động đồng bộ khi có mạng trở lại hoặc khi app quay lại foreground.

---

## Luồng chính

### Luồng 1: Preload dữ liệu (Khi có mạng)

1. Staff mở mobile app vào buổi sáng, gọi `GET /api/checkins/preload?date={today}`
2. Trả về danh sách QR hợp lệ cho các workshop trong ngày.
3. App lưu toàn bộ vào local database của thiết bị.

### Luồng 2: Check-in Offline

1. Staff quét QR qua camera (`html5-qrcode`).
2. Nếu mất mạng: App tra cứu `qrCode` trong local database.
   - Nếu không tìm thấy: Báo lỗi "Không tìm thấy SV".
   - Nếu đã check-in: Cảnh báo trùng lặp.
   - Nếu hợp lệ: Ghi vào local pending store, báo thành công.

### Luồng 3: Re-sync khi có mạng

1. Mạng có lại hoặc app quay lại foreground.
2. Đọc local pending store lấy các bản ghi chưa sync.
3. Gửi batch lên `POST /api/checkins/sync`.
4. DB Backend xử lý `INSERT ... ON CONFLICT DO NOTHING`.
5. Trả về 200 OK → App đánh dấu các bản ghi đã sync trong local store.

---

## Kịch bản lỗi

| Tình huống                        | HTTP/Trạng thái | Hành vi                                                      |
| --------------------------------- | --------------- | ------------------------------------------------------------ |
| **QR không hợp lệ/không tồn tại** | 404             | Báo lỗi "Mã QR không hợp lệ"                                 |
| **Đã check-in trước đó (Online)** | 409             | Báo lỗi "SV đã check-in lúc..."                              |
| **Check-in trùng (Offline)**      | Local           | Chặn bằng flag `alreadyCheckedIn` trong local database       |
| **Đứt mạng khi đang Sync**        | Local           | Giữ trạng thái pending, app retry lại khi có mạng           |

---

## Ràng buộc

- **Offline First:** Luôn kiểm tra trạng thái mạng, ưu tiên ghi log local nếu rớt mạng.
- **Idempotency Check-in:** Backend dùng `ON CONFLICT (registration_id) DO NOTHING` để tránh insert đúp nếu sync 2 lần.
- **Performance:** `html5-qrcode` quét đạt tốc độ < 1 giây/lần.

---

## Tiêu chí chấp nhận

- ✅ Mở app, tải được danh sách SV hôm nay về local database.
- ✅ Tắt Wifi, quét QR hợp lệ → Báo thành công, lưu local.
- ✅ Quét lại mã QR đó khi tắt Wifi → Báo đã check-in.
- ✅ Bật Wifi lại hoặc mở lại app → Payload tự động gửi lên server qua `POST /api/checkins/sync`.

## API Endpoints

#### `GET /api/checkins/preload?date={today}`

Tải trước danh sách QR hợp lệ cho các workshop trong ngày để phục vụ check-in offline.

#### `POST /api/checkins/sync`

Đồng bộ batch check-in từ thiết bị offline lên server khi có mạng trở lại.

#### `GET /api/checkins/{workshopId}` — Danh sách check-in

Cho phép CHECKIN_STAFF xem toàn bộ lượt check-in của một workshop cụ thể.

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




