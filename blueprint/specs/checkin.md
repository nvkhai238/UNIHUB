# Module Spec: Check-in & CSV Import (Thành viên 3)

> **Phạm vi:** Quét QR tại cửa phòng (online và offline), đồng bộ nền khi mạng trở lại, Spring Batch import CSV sinh viên lúc 2:00 AM, gửi thông báo in-app và email.

---

## 1. Trách nhiệm module

| Trách nhiệm              | Mô tả                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Preload danh sách QR     | API cung cấp danh sách QR hợp lệ cho ngày hôm nay — PWA tải về và lưu IndexedDB   |
| Check-in online          | Nhận `qr_code` từ nhân sự → validate → ghi `checkins` table                        |
| Check-in offline         | Đọc từ IndexedDB → xác nhận local → ghi pending queue trong IndexedDB              |
| Background Sync          | Service Worker tự động POST `/checkins/sync` khi mạng trở lại                      |
| Upsert sync              | API nhận batch check-in offline → INSERT ON CONFLICT DO NOTHING vào PostgreSQL      |
| CSV Import               | Spring Batch Job chạy 2:00 AM, đọc CSV sinh viên từ hệ thống cũ, upsert vào DB     |
| Thông báo email          | Gửi email xác nhận sau đăng ký, thông báo workshop thay đổi/hủy                    |
| Thông báo in-app         | Ghi vào bảng notifications, frontend polling hoặc Supabase Realtime đẩy về         |

---

## 2. API Endpoints

### Base path: `/api/checkins`

#### `GET /api/checkins/preload`

Tải danh sách QR hợp lệ cho ngày hôm nay. Chỉ CHECKIN_STAFF.

**Header:** `Authorization: Bearer {accessToken}`

**Query Params:** `?date=2026-05-10` (mặc định: today)

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "date": "2026-05-10",
    "totalCount": 320,
    "entries": [
      {
        "qrCode": "q1q2q3q4-...",
        "studentName": "Nguyễn Văn A",
        "studentId": "21521234",
        "workshopId": "a1b2c3d4-...",
        "workshopTitle": "Workshop AI trong giáo dục",
        "workshopRoom": "B4-301",
        "workshopStartTime": "2026-05-10T08:00:00Z"
      }
    ]
  }
}
```

**Lưu ý:** Chỉ trả về registrations có status `CONFIRMED`, join với workshops có `start_time::date = ?`.

---

#### `POST /api/checkins`

Check-in online — nhân sự quét QR khi có mạng.

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "qrCode": "q1q2q3q4-...",
  "deviceId": "device-001",
  "checkedInAt": "2026-05-10T08:15:30Z"
}
```

**Response 201 — Check-in thành công:**
```json
{
  "status": 201,
  "data": {
    "checkinId": "c1c2c3c4-...",
    "studentName": "Nguyễn Văn A",
    "studentId": "21521234",
    "workshopTitle": "Workshop AI trong giáo dục",
    "checkedInAt": "2026-05-10T08:15:30Z"
  }
}
```

**Response 409 — Đã check-in rồi:**
```json
{
  "status": 409,
  "code": "ALREADY_CHECKED_IN",
  "message": "Sinh viên này đã check-in lúc 08:10:22."
}
```

**Response 404 — QR không hợp lệ:**
```json
{
  "status": 404,
  "code": "QR_NOT_FOUND",
  "message": "Mã QR không hợp lệ hoặc không thuộc workshop này."
}
```

---

#### `POST /api/checkins/sync`

Đồng bộ danh sách check-in đã thực hiện offline. Chỉ CHECKIN_STAFF.

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "entries": [
    {
      "qrCode": "q1q2q3q4-...",
      "deviceId": "device-001",
      "checkedInAt": "2026-05-10T08:15:30Z"
    },
    {
      "qrCode": "q5q6q7q8-...",
      "deviceId": "device-001",
      "checkedInAt": "2026-05-10T08:16:45Z"
    }
  ]
}
```

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "totalReceived": 2,
    "synced": 2,
    "skipped": 0,
    "errors": []
  }
}
```

**Server xử lý:**
```sql
INSERT INTO checkins (id, registration_id, checked_in_at, device_id, synced_at)
SELECT gen_random_uuid(), r.id, ?, ?, now()
FROM registrations r
WHERE r.qr_code = ?
ON CONFLICT (registration_id) DO NOTHING;
```

---

#### `GET /api/admin/workshops/{workshopId}/checkins`

Thống kê check-in cho 1 workshop (chỉ ORGANIZER).

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "workshopId": "a1b2c3d4-...",
    "totalRegistered": 45,
    "checkedIn": 38,
    "notCheckedIn": 7,
    "checkins": [
      {
        "studentName": "Nguyễn Văn A",
        "studentId": "21521234",
        "checkedInAt": "2026-05-10T08:15:30Z",
        "deviceId": "device-001",
        "syncedAt": "2026-05-10T08:20:00Z"
      }
    ]
  }
}
```

---

## 3. PWA Offline Architecture

### Service Worker

Đăng ký trong `main.tsx`:

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
```

### IndexedDB Schema

Database tên `unihub-checkin`, version 1:

| Object Store    | Key                   | Indexes              | Mục đích                                       |
| --------------- | --------------------- | -------------------- | ---------------------------------------------- |
| `qr_registry`   | `qrCode`              | `workshopId`         | Cache danh sách QR hợp lệ từ preload           |
| `pending_sync`  | `id` (autoIncrement)  | `synced`             | Hàng đợi check-in cần sync lên server         |

**Schema `qr_registry`:**
```javascript
{
  qrCode: "q1q2q3q4-...",
  studentName: "Nguyễn Văn A",
  studentId: "21521234",
  workshopId: "a1b2c3d4-...",
  workshopTitle: "Workshop AI trong giáo dục",
  workshopRoom: "B4-301",
  workshopStartTime: "2026-05-10T08:00:00Z",
  alreadyCheckedIn: false
}
```

**Schema `pending_sync`:**
```javascript
{
  id: 1,                            // autoIncrement
  qrCode: "q1q2q3q4-...",
  deviceId: "device-001",
  checkedInAt: "2026-05-10T08:15:30Z",
  synced: 0                         // 0 = chưa sync, 1 = đã sync
}
```

---

### Luồng check-in offline

```
Nhân sự quét QR
      │
      ▼
navigator.onLine?
      │
    false                                              true
      │                                                │
      ▼                                                ▼
IndexedDB.get('qr_registry', qrCode)        POST /api/checkins (online flow)
      │
   null → Hiển thị "Không tìm thấy SV"
           Ghi error log IndexedDB
           Cho nhập mã SV thủ công
      │
   found → alreadyCheckedIn?
               │
             true → Hiển thị cảnh báo "Đã check-in rồi"
               │
            false → IndexedDB.add('pending_sync', entry)
                    IndexedDB.put('qr_registry', {..., alreadyCheckedIn: true})
                    Hiển thị "Check-in OK! - Nguyễn Văn A"
                    navigator.serviceWorker.ready.sync.register('checkin-sync')
```

---

### Background Sync (sw.js)

```javascript
self.addEventListener('sync', async (event) => {
  if (event.tag === 'checkin-sync') {
    event.waitUntil(syncPendingCheckins());
  }
});

async function syncPendingCheckins() {
  const db = await openDB('unihub-checkin', 1);
  const pending = await db.getAllFromIndex('pending_sync', 'synced', 0);

  if (pending.length === 0) return;

  const token = await getAccessToken(); // từ IndexedDB hoặc localStorage
  const response = await fetch('/api/checkins/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ entries: pending })
  });

  if (response.ok) {
    for (const entry of pending) {
      await db.put('pending_sync', { ...entry, synced: 1 });
    }
  }
  // Nếu thất bại: giữ synced=0, Background Sync retry tự động
}
```

---

### Xử lý lỗi offline

| Tình huống                      | Hành vi                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| QR không có trong IndexedDB    | Hiện "Không tìm thấy sinh viên", ghi log, cho phép nhập mã SV thủ công                    |
| Sync thất bại (mạng đứt lại)   | Giữ nguyên `synced=0`, Background Sync retry tự động khi mạng trở lại                     |
| Check-in trùng (đã scan)        | `alreadyCheckedIn` flag ngăn IndexedDB; Server `ON CONFLICT DO NOTHING` ngăn server-side   |
| File preload quá lớn            | Phân trang theo `workshopId`, chỉ load workshop của ngày hôm nay                           |
| Access token hết hạn khi sync  | Service Worker gọi `/api/auth/refresh` trước khi sync                                     |

---

## 4. QR Code

### Sinh mã QR

QR code là UUID v4 ngẫu nhiên, sinh tại server khi registration chuyển sang CONFIRMED:

```java
registration.setQrCode(UUID.randomUUID().toString());
```

Không encode thông tin SV vào QR — chỉ là UUID opaque. Server lookup `registrations WHERE qr_code = ?`.

### Hiển thị QR cho sinh viên

Frontend dùng `qrcode.react` để render QR dạng SVG từ UUID string.

### Quét QR của nhân sự

Frontend dùng `html5-qrcode`:

```javascript
const html5QrCode = new Html5Qrcode("reader");
html5QrCode.start(
  { facingMode: "environment" },
  { fps: 10, qrbox: { width: 250, height: 250 } },
  (decodedText) => handleCheckin(decodedText),
  (_errorMessage) => { /* bỏ qua lỗi scan */ }
);
```

**Lưu ý iOS Safari:** `getUserMedia` hoạt động từ iOS 14.3+. Cần test kỹ trên iPhone trước sự kiện.

---

## 5. CSV Import (Spring Batch)

### Cấu trúc file CSV

```
File: /data/students_2026-05-03.csv
Encoding: UTF-8
Header: student_id,full_name,email
```

### Spring Batch Job — StudentImportJob

```
StudentImportJob
    │
    ├── Step 1: ValidateFileTasklet
    │   ├── Kiểm tra file: /data/students_{today}.csv tồn tại
    │   ├── Kiểm tra header: student_id,full_name,email
    │   ├── Lỗi → INSERT student_import_batches (status='SKIPPED')
    │   │         EmailService.sendAdminAlert("CSV SKIPPED: " + reason)
    │   │         ExitStatus.FAILED
    │   └── OK → tiếp tục Step 2
    │
    ├── Step 2: ImportStudentsStep (chunk-oriented, size=100)
    │   ├── ItemReader: FlatFileItemReader
    │   │     linesToSkip: 1, encoding: UTF-8, delimiter: ","
    │   ├── ItemProcessor:
    │   │     ├── Validate student_id không rỗng → skip nếu thiếu
    │   │     ├── Validate email format → skip nếu sai
    │   │     ├── Normalize: email.toLowerCase().trim(), fullName.trim()
    │   │     ├── Map → UserEntity (role=STUDENT, is_active=true)
    │   │     │    password_hash = BCrypt(student_id + "@UniHub")
    │   │     └── SkipPolicy: ghi log dòng lỗi, không dừng job
    │   └── ItemWriter: JpaItemWriter
    │         INSERT INTO users (student_id, full_name, email, role, password_hash, ...)
    │         ON CONFLICT (student_id) DO UPDATE
    │           SET full_name = EXCLUDED.full_name,
    │               email = EXCLUDED.email,
    │               updated_at = now()
    │         -- KHÔNG cập nhật role, password, is_active
    │
    └── Step 3: ReportTasklet
        ├── UPDATE student_import_batches SET status='COMPLETED',
        │     success_rows=?, error_rows=?, error_log=?, completed_at=now()
        └── Nếu error_rows > 0: EmailService.sendAdminAlert(summary)
```

### Cron Trigger

```java
@Scheduled(cron = "0 0 2 * * *")  // 2:00 AM mỗi ngày
public void runCsvImportJob() {
    JobParameters params = new JobParametersBuilder()
        .addDate("runDate", new Date())
        .toJobParameters();
    jobLauncher.run(studentImportJob, params);
}
```

### Bảo vệ dữ liệu hiện có

- `ON CONFLICT (student_id) DO UPDATE` — không xóa tài khoản
- Không cập nhật `role` → ORGANIZER/CHECKIN_STAFF không bị downgrade
- Không cập nhật `password_hash` → SV đã đổi mật khẩu không bị reset
- Không cập nhật `is_active` → tài khoản bị khóa không tự kích hoạt

---

## 6. Hệ thống thông báo

### Kênh thông báo

| Kênh    | Công nghệ         | Khi nào gửi                                          |
| ------- | ----------------- | ---------------------------------------------------- |
| Email   | SMTP (JavaMail)   | Đăng ký thành công, workshop bị hủy/đổi phòng        |
| In-app  | Supabase Realtime | Cùng các sự kiện trên + thông báo từ Ban tổ chức     |

### Email Templates

**Xác nhận đăng ký:**
```
Tiêu đề: [UniHub] Đăng ký thành công - {workshopTitle}

Chào {studentName},
Bạn đã đăng ký thành công workshop "{workshopTitle}".
Thời gian: {startTime} | Phòng: {room}
Mã QR của bạn đã được đính kèm bên dưới.
```

**Workshop bị hủy:**
```
Tiêu đề: [UniHub] Thông báo hủy workshop - {workshopTitle}

Chào {studentName},
Workshop "{workshopTitle}" đã bị hủy. Lý do: {reason}
Nếu đã thanh toán, tiền sẽ được hoàn trả theo quy trình ban tổ chức.
```

### In-app Notification — bảng `notifications`

```sql
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    type        VARCHAR(50) NOT NULL,  -- REGISTRATION_CONFIRMED / WORKSHOP_CANCELLED / WORKSHOP_UPDATED
    title       VARCHAR(255) NOT NULL,
    body        TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = false;
```

### EmailNotificationService

```java
@Service
public class EmailNotificationService {

    @Async
    public void sendRegistrationConfirmation(String toEmail, String studentName,
                                              String workshopTitle, String qrCode) {
        // Tạo QR image từ UUID, đính kèm vào email
    }

    @Async
    public void sendWorkshopCancellation(List<String> toEmails, String workshopTitle,
                                          String reason) {
        // Batch send đến tất cả SV đã đăng ký workshop
    }
}
```

**Thiết kế mở rộng:** `NotificationChannel` là interface — có thể thêm `TelegramNotificationChannel` sau mà không sửa business logic.

---

## 7. Cấu hình `application.yml`

```yaml
spring:
  mail:
    host: "${SMTP_HOST}"
    port: 587
    username: "${SMTP_USER}"
    password: "${SMTP_PASS}"
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true

  batch:
    job:
      enabled: false   # Không auto-run khi start app — chỉ chạy theo cron

app:
  csv-import:
    directory: "/data"
    filename-pattern: "students_{date}.csv"

  notification:
    from-email: "noreply@unihub.university.edu.vn"
    from-name: "UniHub Workshop"
```

---

## 8. Checklist triển khai (Thành viên 3)

**Check-in API:**
- [ ] Tạo `CheckinController` với 3 endpoints: preload, online checkin, sync
- [ ] Tạo `CheckinService` — validate QR, upsert với ON CONFLICT DO NOTHING
- [ ] Query preload: `registrations JOIN workshops WHERE workshops.start_time::date = ?`
- [ ] Test: check-in trùng → 409; QR không tồn tại → 404; sync batch → đúng count returned

**PWA Frontend:**
- [ ] Tạo `checkin-db.js` — wrapper IndexedDB với 2 stores: `qr_registry`, `pending_sync`
- [ ] Tạo `sw.js` — Service Worker với `sync` event handler
- [ ] Tích hợp `html5-qrcode` cho camera scanning tại `/checkin`
- [ ] Test offline: tắt mạng → quét QR → bật mạng → verify dữ liệu sync lên server

**CSV Import:**
- [ ] Tạo `StudentImportJob` với 3 steps (Validate → Import → Report)
- [ ] Cấu hình `FlatFileItemReader` với UTF-8, `linesToSkip: 1`
- [ ] Implement `SkipPolicy` — ghi log dòng lỗi, không dừng job
- [ ] Test: SV mới được tạo; SV cũ được update name/email; role không bị thay đổi
- [ ] Test: file không tồn tại → status SKIPPED + email alert admin

**Notifications:**
- [ ] Tạo `EmailNotificationService` với `@Async`
- [ ] Viết email templates HTML cho: xác nhận đăng ký, hủy workshop, đổi phòng
- [ ] Tạo bảng `notifications` và `NotificationService`
- [ ] Test: gửi email xác nhận sau đăng ký thành công
- [ ] Test: gửi email hủy đến tất cả SV khi ORGANIZER hủy workshop
