# Module Spec: Workshop (Thành viên 2)

> **Phạm vi:** CRUD workshop, upload PDF, AI Summary qua Gemini API, thống kê đăng ký, quản lý trạng thái workshop.

---

## 1. Trách nhiệm module

| Trách nhiệm           | Mô tả                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------- |
| CRUD workshop         | Tạo, sửa, hủy workshop — chỉ ORGANIZER                                                     |
| Xem workshop          | Danh sách + chi tiết — public (không cần đăng nhập)                                        |
| Upload PDF            | ORGANIZER upload file PDF giới thiệu diễn giả → lưu Supabase Storage                      |
| AI Summary            | Sau khi upload PDF → async gọi Gemini API → lưu tóm tắt vào workshop                      |
| Thống kê              | ORGANIZER xem số đăng ký, tỷ lệ lấp đầy, danh sách chờ theo thời gian thực               |
| Supabase Realtime     | Frontend subscribe WebSocket để cập nhật `remaining_seats` không cần polling               |

---

## 2. API Endpoints

### Base path: `/api`

#### `GET /api/workshops`

Danh sách workshop đang PUBLISHED. Public, không cần đăng nhập.

**Query Params:**
- `?date=2026-05-10` — lọc theo ngày (tùy chọn)
- `?status=PUBLISHED` — mặc định PUBLISHED (ORGANIZER có thể query DRAFT)
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

#### `GET /api/workshops/{id}`

Chi tiết 1 workshop. Public.

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

#### `POST /api/workshops`

Tạo workshop mới. Chỉ ORGANIZER.

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
- `startTime` phải trước `endTime`
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

**Lưu ý:** Workshop mới tạo luôn ở trạng thái `DRAFT`. ORGANIZER phải publish thủ công.

---

#### `PUT /api/workshops/{id}`

Cập nhật workshop. Chỉ ORGANIZER, chỉ khi status là `DRAFT` hoặc `PUBLISHED`.

**Header:** `Authorization: Bearer {accessToken}`

**Request Body:** (tất cả field đều optional — partial update)
```json
{
  "title": "Workshop AI trong giáo dục (Updated)",
  "room": "B4-302",
  "startTime": "2026-05-10T09:00:00Z"
}
```

**Ràng buộc:** Không được giảm `capacity` xuống thấp hơn số chỗ đã đăng ký.

**Response 200:** Workshop đã được cập nhật đầy đủ.

---

#### `PATCH /api/workshops/{id}/status`

Thay đổi trạng thái workshop. Chỉ ORGANIZER.

**Request Body:**
```json
{
  "status": "PUBLISHED",
  "cancellationReason": null
}
```

Khi `status = "CANCELLED"`:
- Bắt buộc có `cancellationReason`
- Server tự động gửi email + in-app đến tất cả SV đã đăng ký (CONFIRMED)
- Các registration chuyển sang CANCELLED

**State machine hợp lệ:**
```
DRAFT → PUBLISHED
DRAFT → CANCELLED
PUBLISHED → CANCELLED
(không thể quay lại DRAFT từ PUBLISHED)
```

**Response 200:**
```json
{
  "status": 200,
  "data": { "id": "a1b2c3d4-...", "status": "PUBLISHED" }
}
```

---

#### `POST /api/workshops/{id}/pdf`

Upload PDF giới thiệu diễn giả. Chỉ ORGANIZER. Multipart form.

**Header:** `Authorization: Bearer {accessToken}`  
**Content-Type:** `multipart/form-data`

**Form fields:**
- `file`: PDF file, tối đa 10MB

**Response 202 — Chấp nhận, đang xử lý AI Summary:**
```json
{
  "status": 202,
  "data": {
    "pdfUrl": "https://storage.supabase.co/...",
    "aiSummaryStatus": "PROCESSING",
    "message": "PDF đã được upload. Tóm tắt AI đang được xử lý, vui lòng chờ vài phút."
  }
}
```

**Response 422 — File không hợp lệ:**
```json
{
  "status": 422,
  "code": "INVALID_FILE",
  "message": "Chỉ chấp nhận file PDF, dung lượng tối đa 10MB."
}
```

---

#### `POST /api/workshops/{id}/ai-summary/retry`

Thử lại tạo AI Summary khi trạng thái là `FAILED`. Chỉ ORGANIZER.

**Response 202:** `aiSummaryStatus` chuyển về `PROCESSING`.

---

#### `GET /api/admin/workshops`

Danh sách tất cả workshop cho ORGANIZER — bao gồm cả DRAFT và CANCELLED.

**Response 200:** Giống `GET /api/workshops` nhưng trả về tất cả status + thêm trường thống kê:
```json
{
  "id": "a1b2c3d4-...",
  "confirmedCount": 45,
  "waitlistedCount": 12,
  "checkinCount": 38
}
```

---

#### `GET /api/admin/workshops/{id}/stats`

Thống kê chi tiết 1 workshop. Chỉ ORGANIZER.

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

## 3. Luồng AI Summary

```
ORGANIZER upload PDF
      │
      ▼
POST /api/workshops/{id}/pdf
      │
      ├── Validate: content-type = application/pdf, size <= 10MB
      ├── Upload to Supabase Storage → nhận pdf_url
      ├── UPDATE workshops SET pdf_url = ?, ai_summary_status = 'PROCESSING'
      ├── Return 202
      │
      └── @Async: AiSummaryService.processAsync(workshopId, pdfUrl)
                │
                ├── Download PDF bytes từ Supabase Storage
                ├── Extract text bằng Apache PDFBox
                │     PdfTextExtractor.getTextFromPage(...)
                ├── Clean text: bỏ header/footer, ký tự đặc biệt, whitespace thừa
                ├── Truncate: tối đa 30.000 ký tự (giới hạn token Gemini)
                │
                ├── POST Gemini API:
                │   {
                │     "model": "gemini-2.0-flash",
                │     "contents": [{
                │       "parts": [{
                │         "text": "Hãy tóm tắt nội dung workshop sau trong 3-5 câu
                │                  bằng tiếng Việt, tập trung vào kiến thức chính
                │                  mà người tham dự sẽ học được:\n\n{extractedText}"
                │       }]
                │     }]
                │   }
                │
                ├── SUCCESS:
                │   UPDATE workshops SET
                │     ai_summary = '{summary_text}',
                │     ai_summary_status = 'DONE'
                │
                └── FAILURE (API error / timeout):
                    UPDATE workshops SET ai_summary_status = 'FAILED'
                    (Admin thấy nút "Thử lại" trên UI)
```

**aiSummaryStatus state machine:**
```
NONE → PROCESSING → DONE
                 → FAILED → PROCESSING (retry)
```

**Frontend behavior:**
- Status `PROCESSING`: hiện skeleton loading ở phần AI Summary
- Status `DONE`: hiện nội dung tóm tắt
- Status `FAILED`: hiện nút "Thử lại" (chỉ ORGANIZER thấy)
- Status `NONE`: không hiện phần AI Summary

---

## 4. Supabase Realtime — Cập nhật số ghế

Frontend subscribe Supabase Realtime channel để tự động cập nhật `remaining_seats` mà không cần polling:

```javascript
// React component
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

useEffect(() => {
  const channel = supabase
    .channel('workshop-seats')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'workshops',
      filter: `id=eq.${workshopId}`
    }, (payload) => {
      setRemainingSeats(payload.new.remaining_seats);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [workshopId]);
```

Điều này có nghĩa khi nhiều sinh viên đang xem cùng 1 workshop, số ghế còn lại trên UI tất cả đều tự cập nhật ngay sau khi ai đó đăng ký thành công — không cần F5.

---

## 5. File upload — Supabase Storage

**Bucket:** `workshop-files` (public read, authenticated write)

**Cấu trúc path:**
```
workshop-files/
  pdf/{workshopId}/{timestamp}_{originalName}.pdf
  layouts/{workshopId}/room-layout.jpg
```

**Triển khai upload trong Spring Boot:**

```java
@Service
public class SupabaseStorageService {

    public String uploadPdf(UUID workshopId, MultipartFile file) {
        String path = "pdf/" + workshopId + "/" +
                      System.currentTimeMillis() + "_" +
                      sanitizeFilename(file.getOriginalFilename());

        // Dùng Supabase Storage REST API
        String url = supabaseUrl + "/storage/v1/object/" + bucket + "/" + path;
        // PUT request với Authorization: Bearer {SERVICE_ROLE_KEY}
        // Return public URL
        return supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + path;
    }

    private String sanitizeFilename(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
```

---

## 6. Cấu hình `application.yml`

```yaml
app:
  gemini:
    api-key: "${GEMINI_API_KEY}"
    model: "gemini-2.0-flash"
    api-url: "https://generativelanguage.googleapis.com/v1beta/models"
    max-text-length: 30000

  supabase:
    url: "${SUPABASE_URL}"
    anon-key: "${SUPABASE_ANON_KEY}"
    service-role-key: "${SUPABASE_SERVICE_ROLE_KEY}"
    storage-bucket: "workshop-files"

  file:
    max-pdf-size: 10485760  # 10MB in bytes
    allowed-types:
      - application/pdf

spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 12MB

  async:
    executor:
      core-pool-size: 2
      max-pool-size: 5
      queue-capacity: 100
```

---

## 7. Xử lý lỗi

| Tình huống                               | HTTP | Code                       |
| ---------------------------------------- | ---- | -------------------------- |
| Workshop không tồn tại                  | 404  | `WORKSHOP_NOT_FOUND`       |
| Cập nhật workshop đã CANCELLED          | 409  | `WORKSHOP_ALREADY_CANCELLED` |
| Giảm capacity dưới số đã đăng ký        | 409  | `CAPACITY_BELOW_REGISTERED` |
| File không phải PDF hoặc quá lớn        | 422  | `INVALID_FILE`             |
| Gemini API lỗi                          | —    | ai_summary_status = FAILED (không trả lỗi cho client ngay) |
| Hủy workshop khi không có lý do         | 400  | `CANCELLATION_REASON_REQUIRED` |

---

## 8. Checklist triển khai (Thành viên 2)

- [ ] Tạo `WorkshopController` với tất cả endpoints public + admin
- [ ] Tạo `WorkshopService` — CRUD, validate state machine, capacity check
- [ ] Tạo `SupabaseStorageService` — upload PDF + room layout
- [ ] Tạo `AiSummaryService` với `@Async` — PDFBox extract → Gemini API → update DB
- [ ] Implement Gemini API client (RestTemplate hoặc WebClient)
- [ ] Implement Apache PDFBox dependency trong `pom.xml`
- [ ] Tạo endpoint retry AI Summary
- [ ] Khi hủy workshop: trigger notification đến tất cả SV đã CONFIRMED
- [ ] Test: tạo DRAFT → publish → update → cancel
- [ ] Test: upload PDF → ai_summary_status PROCESSING → DONE
- [ ] Test: Gemini API down → ai_summary_status FAILED → retry → DONE
- [ ] Test: capacity validation khi giảm xuống dưới confirmed count
