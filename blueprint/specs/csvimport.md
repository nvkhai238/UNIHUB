# Đặc tả: Nhập CSV (Thành viên 3)

> **Phạm vi:** Spring Batch job đọc file CSV sinh viên từ hệ thống cũ, upsert vào database lúc 2 AM.

---

## Mô tả

Mỗi đêm lúc 2:00 AM, hệ thống:
1. Đọc file CSV đã được legacy system export vào filesystem/bind mount `/data`
2. Parse & validate từng dòng
3. UPSERT vào bảng `users` (không xóa account, không ảnh hưởng existing role/registration)
4. Log báo cáo (success, fail, skip count)

---

## Luồng chính

### Luồng: Spring Batch StudentImportJob (Cron 2:00 AM)

```
Scheduler (Cron) kích hoạt lúc 02:00 AM
  │
  └── JobLauncher.run(studentImportJob, jobParameters)
      │
      ├── Step 1: Preprocess/Validate CSV file
      │   ├── [1] Kiểm tra file tồn tại: /data/students_{today}.csv
      │   ├── [2] Kiểm tra file size > 0
      │   ├── [3] Đọc dòng đầu (header): student_id,full_name,email
      │   │       ├── Match header → OK
      │   │       └── Khác → Job status=SKIPPED, gửi alert email admin
      │   ├── [4] Validate từng dòng, dedupe student_id, ghi file tạm sanitized
      │   └── Lỗi file-level → Job SKIPPED, không chạy Step 2
      │
      ├── Step 2: ImportStudentsStep (Chunk-oriented, chunk size=100)
      │   │
      │   ├── [1] ItemReader: FlatFileItemReader
      │   │       ├── File: /data/students_{today}.csv
      │   │       ├── Encoding: UTF-8
      │   │       ├── Skip: 1 (header row)
      │   │       ├── Delimiter: ","
      │   │       └── Parse into StudentDto {student_id, full_name, email}
      │   │
      │   ├── [2] ItemProcessor: Validate & Normalize
      │   │       ├── Validate student_id: không rỗng, regex: ^[0-9]{8}$
      │   │       │   └── Fail → SkipPolicy: log warning, skip dòng
      │   │       ├── Validate full_name: không rỗng, max 255 char
      │   │       │   └── Fail → skip
      │   │       ├── Validate email: email format hợp lệ
      │   │       │   └── Fail → skip
      │   │       ├── Normalize: 
      │   │       │   ├── email = email.toLowerCase().trim()
      │   │       │   ├── full_name = full_name.trim()
      │   │       │   └── student_id = student_id.trim()
      │   │       └── Map → UserEntity {
      │   │           student_id, full_name, email,
      │   │           role=STUDENT, is_active=true,
      │   │           password_hash=BCrypt(student_id + "@UniHub")
      │   │         }
      │   │
      │   ├── [3] ItemWriter: UserRepository.saveAll(...) (batch 100 rows)
      │   │       ├── Nếu student_id đã tồn tại và role=STUDENT: update full_name/email
      │   │       ├── Nếu chưa tồn tại: tạo STUDENT, is_active=true
      │   │       ├── password_hash=BCrypt(student_id + "@UniHub")
      │   │       └── Nếu email thuộc user khác hoặc role không phải STUDENT: skip
      │   │
      │   └── Loop: Đọc next chunk, repeat [1-3] cho đến EOF
      │
      └── Step 3: ReportTasklet
          ├── [1] Tính stats: total_rows, success_rows, error_rows
          ├── [2] UPDATE student_import_batches
          │       SET status=COMPLETED, success_rows=?, error_rows=?,
          │           error_log={details}, completed_at=now()
          │       WHERE id={batch_id}
          ├── [3] Nếu error_rows > 0 → EmailService.sendAdminAlert(summary)
          └── [4] Log job result: "CSV import completed: {success} success, {error} errors"
```

---

## Kịch bản lỗi

| Tình huống | Hành vi |
|-----------|--------|
| **File không tồn tại** | Step 1 fail → Job status=SKIPPED, gửi alert email admin, không insert bất kỳ dữ liệu |
| **File rỗng** | Step 1 fail → SKIPPED |
| **Header không khớp** | Step 1 fail → SKIPPED (không xử lý file với format sai) |
| **Không có file hôm nay khi chạy manual** | Manual fallback chọn file `students_YYYY-MM-DD.csv` mới nhất nếu có |
| **Dòng CSV có format sai (thiếu cột)** | ItemProcessor: skip dòng, log warning, tiếp tục xử lý các dòng khác |
| **student_id không hợp lệ (không phải 8 chữ số)** | Skip dòng, log cảnh báo chi tiết dòng số mấy |
| **Email format sai** | Skip dòng |
| **Trùng lặp student_id (cùng trong file)** | Preprocess giữ dòng hợp lệ cuối cùng theo student_id |
| **Database connection fail** | Spring Batch rollback chunk, retry 3 lần, nếu vẫn fail → Job FAILED |
| **Batch size quá lớn (memory leak)** | Chunk size = 100, manageable |
| **Job chạy 2 lần cùng lúc** | ReentrantLock đánh dấu batch thứ 2 `SKIPPED` |
| **Dữ liệu cũ của SV được xóa** | TUYỆT ĐỐI KHÔNG → chỉ cập nhật name/email cho user STUDENT |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Chunk size** | 100 rows/commit → balance memory & performance |
| **Encoding** | UTF-8 only |
| **Retry policy** | Max 3 attempts per chunk, nếu vẫn fail → Job FAILED |
| **Error tolerance** | Skip individual row không dừng job, nhưng fail at step 1 → SKIPPED toàn bộ |
| **File naming** | `/data/students_{YYYY-MM-DD}.csv`; manual run có fallback lấy file mới nhất |
| **Field format** | student_id: 8 chữ số, email: valid email, full_name: max 255 char |
| **Data integrity** | KHÔNG xóa existing accounts, KHÔNG downgrade role, KHÔNG reset password |
| **Performance** | Job chạy xong trong 5 phút (nếu file ≤ 100k dòng) |
| **Concurrency** | Chỉ 1 job chạy cùng lúc (`ReentrantLock`) |
| **Schedule** | Cron: `0 0 2 * * *` = 2:00 AM mỗi ngày |
| **Spring Batch metadata** | DB phải có các bảng `batch_job_*`, `batch_step_*` và sequence `batch_job_seq`, `batch_job_execution_seq`, `batch_step_execution_seq` |

---

## Tiêu chí chấp nhận

- ✅ File CSV được đọc và parse đúng format
- ✅ Dòng format sai được skip (không crash), log chi tiết dòng nào lỗi
- ✅ 100 rows được insert/update đúng trong 1 transaction
- ✅ Trùng lặp student_id: row mới update name/email của row cũ
- ✅ Existing role (ORGANIZER, CHECKIN_STAFF) KHÔNG bị downgrade về STUDENT
- ✅ Existing registration & payment KHÔNG bị xóa khi student data update
- ✅ Job chạy xong trong 5 phút (file ≤ 100k rows)
- ✅ Admin nhận email báo cáo: X rows success, Y rows skip
- ✅ Nếu file không tồn tại → Job SKIPPED, alert email admin
- ✅ Nếu không có file/hỏng header → SKIPPED, không insert partial data
- ✅ 2 lần chạy job → không có duplicate hoặc data corruption
- ✅ Log file ghi chi tiết từng dòng lỗi (line number, error reason)

## API Endpoints

#### `GET /api/csv/status` — Check Import Job Status

Cho phép ORGANIZER xem trạng thái của lần chạy CSV import gần nhất.

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "jobId": "job123",
    "status": "COMPLETED",
    "processedRecords": 1000,
    "failedRecords": 10
  }
}
```

#### `GET /api/admin/student-imports`

Organizer xem lịch sử batch import có phân trang.

#### `POST /api/admin/student-imports/run`

Organizer chạy import thủ công. Nếu file ngày hôm nay chưa có, hệ thống thử dùng file `students_YYYY-MM-DD.csv` mới nhất trong thư mục dữ liệu.

#### `GET /api/admin/student-imports/status`

Organizer xem trạng thái batch import mới nhất theo payload tương tự `/api/csv/status`.




