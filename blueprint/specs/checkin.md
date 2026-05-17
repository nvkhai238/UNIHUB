# Đặc tả: Check-in và đồng bộ offline (Thành viên 3)

> **Phạm vi:** Quét QR tại cửa phòng (online và offline), đồng bộ lại khi mạng trở lại qua mobile app native. (Phần CSV và Notification đã được tách riêng).

---

## Mô tả

Hệ thống cho phép nhân sự (CHECKIN_STAFF) quét mã QR để ghi nhận sinh viên tham dự. Hỗ trợ preload danh sách để quét offline (không có mạng) và tự động đồng bộ khi có mạng trở lại hoặc khi app quay lại foreground.

---

## Luồng chính

### Luồng 1: Preload dữ liệu (Khi có mạng)

1. Staff mở mobile app vào buổi sáng, gọi `GET /api/checkins/workshops?date={today}` để chọn workshop/ca check-in.
2. App gọi `GET /api/checkins/preload?date={today}&workshopId={id}` để tải QR hợp lệ; nếu không truyền `workshopId`, backend trả QR của các workshop trong ngày.
3. App lưu registry QR vào local database của thiết bị.

### Luồng 2: Check-in Offline

1. Staff quét QR qua camera thiết bị bằng `expo-camera`.
2. Nếu mất mạng: App tra cứu `qrCode` trong Expo SQLite local database.
   - Nếu không tìm thấy: Báo lỗi "Không tìm thấy SV".
   - Nếu đã check-in: Cảnh báo trùng lặp.
   - Nếu hợp lệ: Ghi vào local pending store, báo thành công.

### Luồng 3: Re-sync khi có mạng

1. Mạng có lại hoặc app quay lại foreground.
2. Đọc local pending store lấy các bản ghi chưa sync.
3. Gửi batch lên `POST /api/checkins/sync`.
4. Backend kiểm tra QR, status `CONFIRMED`, unique `registration_id`, phân loại `CREATED` / `DUPLICATE` / `CONFLICT` / `INVALID_QR`.
5. Trả về 200 OK → App đánh dấu từng bản ghi theo kết quả trong SQLite local store.

---

## Kịch bản lỗi

| Tình huống                        | HTTP/Trạng thái | Hành vi                                                      |
| --------------------------------- | --------------- | ------------------------------------------------------------ |
| **QR không hợp lệ/không tồn tại** | 404             | Báo lỗi "Mã QR không hợp lệ"                                 |
| **Đã check-in trước đó (Online)** | 409             | Báo lỗi "SV đã check-in lúc..."                              |
| **Check-in trùng (Offline)**      | Local           | Chặn bằng flag `alreadyCheckedIn` trong local database       |
| **Đứt mạng khi đang Sync**        | Local           | Giữ trạng thái pending, app retry lại khi có mạng           |
| **QR đã check-in ở thiết bị khác** | 200/item        | Item status=`CONFLICT`, app hiển thị cảnh báo và bỏ pending |
| **QR chưa confirmed / sai ngày**  | 200/item        | Item status=`NOT_CONFIRMED` hoặc lookup `WRONG_DATE`        |

---

## Ràng buộc

- **Offline First:** App kiểm tra trạng thái mạng bằng NetInfo, ưu tiên ghi local nếu rớt mạng.
- **Local persistence:** QR registry và pending check-ins lưu trong Expo SQLite; token lưu trong Expo SecureStore.
- **Idempotency Check-in:** Backend enforce unique `registration_id`; nếu sync lại cùng device trả `DUPLICATE`, khác device trả `CONFLICT`.
- **Performance:** `expo-camera` quét QR trực tiếp trên thiết bị/emulator, debounce scan gần nhất để tránh bắn nhiều request.

---

## Tiêu chí chấp nhận

- ✅ Mở app, tải được danh sách SV hôm nay về local database.
- ✅ Tắt Wifi, quét QR hợp lệ → Báo thành công, lưu local.
- ✅ Quét lại mã QR đó khi tắt Wifi → Báo đã check-in.
- ✅ Bật Wifi lại hoặc mở lại app → Payload tự động gửi lên server qua `POST /api/checkins/sync`.

## API Endpoints

#### `GET /api/checkins/workshops?date={today}`

Cho phép `CHECKIN_STAFF` xem danh sách workshop `PUBLISHED` trong ngày để chọn ca check-in.

#### `GET /api/checkins/preload?date={today}&workshopId={workshopId}`

Tải trước danh sách QR hợp lệ cho các workshop trong ngày để phục vụ check-in offline.

#### `GET /api/checkins/lookup?qrCode={qrCode}&date={today}&workshopId={workshopId}`

Tra cứu QR online khi mã không nằm trong registry preload hoặc cần biết lý do không hợp lệ.

#### `POST /api/checkins/sync`

Đồng bộ batch check-in từ thiết bị offline lên server khi có mạng trở lại.

#### `GET /api/checkins/workshops/{workshopId}` — Danh sách check-in

Cho phép `ORGANIZER` xem toàn bộ lượt check-in của một workshop cụ thể. `CHECKIN_STAFF` không dùng endpoint báo cáo này; staff chỉ dùng preload/lookup/sync.

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




