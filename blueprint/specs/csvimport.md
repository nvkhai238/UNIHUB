# Đặc tả: CSV Import (Thành viên 3)

> **Phạm vi:** Spring Batch job đọc file CSV sinh viên từ hệ thống cũ, upsert vào database lúc 2 AM.

---

## Mô tả

Mỗi đêm lúc 2:00 AM, hệ thống:
1. Lấy file CSV từ legacy system (FTP hoặc filesystem)
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
      ├── Step 1: ValidateFileTasklet
      │   ├── [1] Kiểm tra file tồn tại: /data/students_{today}.csv
      │   ├── [2] Kiểm tra file size > 0
      │   ├── [3] Đọc dòng đầu (header): student_id,full_name,email
      │   │       ├── Match header → OK
      │   │       └── Khác → Job status=SKIPPED, gửi alert email admin
      │   └── Lỗi bất kỳ → Job SKIPPED, không chạy Step 2
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
      │   ├── [3] ItemWriter: JdbcBatchItemWriter (batch 100 rows)
      │   │       └── SQL: INSERT INTO users (...)
      │   │           ON CONFLICT (student_id) DO UPDATE
      │   │           SET full_name = EXCLUDED.full_name,
      │   │               email = EXCLUDED.email,
      │   │               updated_at = now()
      │   │           WHERE is_active = true
      │   │           (KHÔNG cập nhật: role, password_hash, is_active)
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
| **FTP connection timeout** | Step 1 fail → SKIPPED, alert admin |
| **Dòng CSV có format sai (thiếu cột)** | ItemProcessor: skip dòng, log warning, tiếp tục xử lý các dòng khác |
| **student_id không hợp lệ (không phải 8 chữ số)** | Skip dòng, log cảnh báo chi tiết dòng số mấy |
| **Email format sai** | Skip dòng |
| **Trùng lặp student_id (cùng trong file)** | UPSERT: row sau ghi đè row trước (OK) |
| **Database connection fail** | Spring Batch rollback chunk, retry 3 lần, nếu vẫn fail → Job FAILED |
| **Batch size quá lớn (memory leak)** | Chunk size = 100, manageable |
| **Job chạy 2 lần cùng lúc** | JobLauncher lock job, job thứ 2 đợi → không có duplicate |
| **Dữ liệu cũ của SV được xóa** | TUYỆT ĐỐI KHÔNG → ON CONFLICT DO UPDATE chỉ cập nhật name/email |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Chunk size** | 100 rows/commit → balance memory & performance |
| **Encoding** | UTF-8 only |
| **Retry policy** | Max 3 attempts per chunk, nếu vẫn fail → Job FAILED |
| **Error tolerance** | Skip individual row không dừng job, nhưng fail at step 1 → SKIPPED toàn bộ |
| **File naming** | `/data/students_{YYYY-MM-DD}.csv` (phải match ngày chạy) |
| **Field format** | student_id: 8 chữ số, email: valid email, full_name: max 255 char |
| **Data integrity** | KHÔNG xóa existing accounts, KHÔNG downgrade role, KHÔNG reset password |
| **Performance** | Job chạy xong trong 5 phút (nếu file ≤ 100k dòng) |
| **Concurrency** | Chỉ 1 job chạy cùng lúc (lock mechanism) |
| **Schedule** | Cron: `0 0 2 * * *` = 2:00 AM mỗi ngày |

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
- ✅ Nếu FTP fail → SKIPPED, không insert partial data
- ✅ 2 lần chạy job → không có duplicate hoặc data corruption
- ✅ Log file ghi chi tiết từng dòng lỗi (line number, error reason)
