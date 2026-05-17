# Đặc tả: Check-in và đồng bộ offline (Thành viên 3)

> **Phạm vi:** Quét QR tại cửa phòng (online và offline), đồng bộ lại khi mạng trở lại qua mobile app native. (Phần CSV và Notification đã được tách riêng).

---

## Mô tả

Hệ thống cho phép nhân sự (CHECKIN_STAFF) quét mã QR để ghi nhận sinh viên tham dự. Hỗ trợ preload danh sách để quét offline (không có mạng) và tự động đồng bộ khi có mạng trở lại hoặc khi app quay lại foreground.

---

## Luồng chính

### Luồng 1: Preload dữ liệu (Khi có mạng)

1. Staff mở mobile app, chọn ngày và gọi `GET /api/checkins/workshops?date={date}` để lấy danh sách workshop `PUBLISHED` trong ngày.
2. Staff chọn một workshop cụ thể, app gọi `GET /api/checkins/preload?date={date}&workshopId={workshopId}`.
3. Trả về danh sách QR hợp lệ của các registration `CONFIRMED` trong workshop đã chọn.
4. App lưu QR registry vào Expo SQLite local database của thiết bị.

### Luồng 2: Check-in Offline

1. Staff quét QR qua camera thiết bị bằng `expo-camera`.
2. Nếu mất mạng: App tra cứu `qrCode` trong Expo SQLite local database theo workshop đã chọn.
   - Nếu không tìm thấy: Báo lỗi QR không nằm trong danh sách preload của ca đã chọn.
   - Nếu đã check-in/lưu pending trên thiết bị: Cảnh báo trùng lặp.
   - Nếu hợp lệ: Ghi vào local pending store, hiển thị trạng thái `PENDING` và tăng số pending trên UI.

### Luồng 3: Re-sync khi có mạng

1. Mạng có lại hoặc app quay lại foreground.
2. Đọc local pending store lấy các bản ghi chưa sync.
3. Gửi batch lên `POST /api/checkins/sync`.
4. Backend kiểm tra QR, status `CONFIRMED`, unique `registration_id`, phân loại `CREATED` / `DUPLICATE` / `CONFLICT` / `INVALID_QR`.
5. Trả về 200 OK → App đánh dấu từng bản ghi theo kết quả trong SQLite local store.
6. App hiển thị kết quả sync gần nhất, gồm số pending trước khi sync và breakdown `created` / `duplicate` / `conflict` / `invalid`, để phân biệt auto-sync với thao tác sync thủ công.

---

## Kịch bản lỗi

| Tình huống                        | HTTP/Trạng thái | Hành vi                                                      |
| --------------------------------- | --------------- | ------------------------------------------------------------ |
| **QR không hợp lệ/không tồn tại** | 200/item hoặc lookup | Item status=`INVALID_QR`, app báo QR không hợp lệ hoặc không thuộc registry preload |
| **Đã check-in trước đó (Online)** | 200/item             | Item status=`DUPLICATE` nếu cùng device, `CONFLICT` nếu khác device              |
| **Check-in trùng (Offline)**      | Local                | Chặn bằng `checked_in_local`/pending local trong Expo SQLite                     |
| **Đứt mạng khi đang Sync**        | Local                | Giữ trạng thái pending, app retry lại khi có mạng                               |
| **QR đã check-in ở thiết bị khác** | 200/item             | Item status=`CONFLICT`, app hiển thị cảnh báo và bỏ pending                     |
| **QR chưa confirmed / sai ngày**  | 200/item hoặc lookup | Item status=`NOT_CONFIRMED` hoặc lookup `WRONG_DATE`                            |

---

## Ràng buộc

- **Offline First:** App kiểm tra trạng thái mạng bằng NetInfo, ưu tiên ghi local nếu rớt mạng.
- **Local persistence:** QR registry và pending check-ins lưu trong Expo SQLite; token lưu trong Expo SecureStore.
- **Idempotency Check-in:** Backend enforce unique `registration_id`; nếu sync lại cùng device trả `DUPLICATE`, khác device trả `CONFLICT`.
- **Performance:** `expo-camera` quét QR trực tiếp trên thiết bị/emulator, debounce scan gần nhất để tránh bắn nhiều request.

---

## Tiêu chí chấp nhận

- ✅ Mở app, chọn ngày/workshop và tải được QR confirmed của ca đó về local database.
- ✅ Tắt Wifi, quét QR hợp lệ → Hiển thị `PENDING`, lưu local và tăng pending count.
- ✅ Quét lại mã QR đó khi tắt Wifi → Báo đã check-in/lưu pending trên thiết bị.
- ✅ Bật Wifi lại hoặc mở lại app → Payload tự động gửi lên server qua `POST /api/checkins/sync`.
- ✅ UI hiển thị kết quả sync gần nhất để biết pending đã được auto-sync hay chưa có pending cần đồng bộ.

## API Endpoints

#### `GET /api/checkins/workshops?date={date}`

Cho phép `CHECKIN_STAFF` lấy danh sách workshop `PUBLISHED` diễn ra trong ngày để chọn ca check-in trước khi preload.

#### `GET /api/checkins/preload?date={date}&workshopId={workshopId}`

Tải trước danh sách QR hợp lệ của workshop đã chọn để phục vụ check-in offline. `workshopId` là optional ở backend nhưng mobile app dùng để giới hạn registry theo ca.

#### `GET /api/checkins/lookup?qrCode={qrCode}&date={date}&workshopId={workshopId}`

Tra cứu QR online khi mã không nằm trong registry preload hoặc cần biết lý do không hợp lệ; nếu truyền `workshopId`, backend validate QR thuộc đúng workshop đó.

#### `POST /api/checkins/sync`

Đồng bộ batch check-in từ thiết bị offline lên server khi có mạng trở lại. Response luôn là batch summary kèm từng item status như `CREATED`, `DUPLICATE`, `CONFLICT`, `INVALID_QR`, `NOT_CONFIRMED`.

#### `GET /api/checkins/workshops/{workshopId}` — Danh sách check-in

Cho phép `ORGANIZER` xem toàn bộ lượt check-in của một workshop cụ thể.

**Response 200:**
```json
{
  "status": 200,
  "data": [
    {
      "id": "checkin123",
      "registrationId": "registration123",
      "userId": "user456",
      "studentId": "21521001",
      "fullName": "Lê Minh Tuấn",
      "workshopId": "workshop789",
      "workshopTitle": "Demo Check-in Free 14/05/2026",
      "checkedInAt": "2026-05-14T09:15:00+07:00",
      "syncedAt": "2026-05-14T09:16:00+07:00",
      "deviceId": "mobile-..."
    }
  ]
}
```
