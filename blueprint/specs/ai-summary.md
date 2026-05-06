# Đặc tả: Tóm tắt AI (Thành viên 2)

> **Phạm vi:** Upload PDF workshop, tự động trích xuất & tóm tắt bằng Gemini API.

---

## Mô tả

Ban tổ chức upload file PDF giới thiệu workshop. Hệ thống:
1. Lưu file vào Supabase Storage
2. Async: trích text từ PDF (Apache PDFBox)
3. Gửi Gemini API để tạo tóm tắt 3-5 câu tiếng Việt
4. Lưu tóm tắt vào database
5. Frontend hiển thị tóm tắt tự động

---

## Luồng chính

### Luồng: Upload PDF & Trigger AI Summary

```
POST /api/workshops/{workshopId}/pdf
  ├── Header: Authorization: Bearer {accessToken} (ORGANIZER only)
  ├── Content-Type: multipart/form-data
  ├── Body: file (PDF file, max 10MB)
  │
  ├── [1] Validate
  │       ├── File type: application/pdf
  │       ├── File size: ≤ 10MB
  │       └── Workshop status: DRAFT or PUBLISHED (không upload nếu CANCELLED)
  │
  ├── [2] Upload to Supabase Storage
  │       ├── Bucket: "workshop-files"
  │       ├── Path: pdf/{workshopId}/{timestamp}_{filename}.pdf
  │       ├── Public read access
  │       └── Return: pdf_url (https://...)
  │
  ├── [3] Update workshop metadata
  │       ├── UPDATE workshops
  │       │   SET pdf_url = ?,
  │       │       ai_summary_status = 'PROCESSING'
  │       └── COMMIT
  │
  ├── [4] Return 202 Accepted
  │       └── {pdfUrl, aiSummaryStatus: PROCESSING, message: "PDF đang xử lý..."}
  │
  └── [5] Async trigger: AiSummaryService.processAsync(workshopId, pdfUrl)
         └── Background thread xử lý (không block response)
```

### Async Processing Flow

```
AiSummaryService.processAsync(workshopId, pdfUrl)
  │
  ├── [1] Download PDF bytes from Supabase Storage
  │       ├── Timeout: 30s
  │       └── Lỗi → ai_summary_status = FAILED, log error, kết thúc
  │
  ├── [2] Extract text using Apache PDFBox
  │       ├── PdfTextExtractor.getTextFromPage(...)
  │       ├── Loop all pages, concat text
  │       └── Lỗi → ai_summary_status = FAILED
  │
  ├── [3] Clean text
  │       ├── Remove header/footer patterns (page number, date)
  │       ├── Remove extra whitespace & special chars
  │       ├── Truncate to 30,000 characters (Gemini input limit)
  │       └── Result: cleanText
  │
  ├── [4] POST to Gemini API
  │       ├── Model: "gemini-2.0-flash"
  │       ├── Prompt: "Hãy tóm tắt nội dung workshop sau trong 3-5 câu
  │       │             bằng tiếng Việt, tập trung vào kiến thức chính
  │       │             mà người tham dự sẽ học được:\n\n{cleanText}"
  │       ├── Timeout: 10s
  │       ├── Retry: 2 lần nếu 5xx error
  │       └── Lỗi → ai_summary_status = FAILED
  │
  ├── [5] Parse response
  │       ├── Extract: response.candidates[0].content.parts[0].text
  │       └── Truncate to 500 characters max
  │
  ├── [6] Update workshop
  │       ├── UPDATE workshops
  │       │   SET ai_summary = ?,
  │       │       ai_summary_status = 'DONE',
  │       │       updated_at = now()
  │       └── COMMIT
  │
  └── [7] Log success
         └── "AI summary completed for workshop {id}"
```

### Manual Retry

```
POST /api/workshops/{workshopId}/ai-summary/retry
  ├── Header: Authorization (ORGANIZER only)
  ├── Condition: ai_summary_status = FAILED
  │
  ├── [1] UPDATE workshops SET ai_summary_status = PROCESSING
  ├── [2] Async trigger: AiSummaryService.processAsync(...) (như trên)
  └── Return 202 {aiSummaryStatus: PROCESSING}
```

---

## Kịch bản lỗi

| Tình huống | HTTP | Code | Hành vi |
|-----------|------|------|--------|
| **File không phải PDF** | 422 | `INVALID_FILE` | Reject |
| **File > 10MB** | 422 | `INVALID_FILE` | Reject |
| **Workshop CANCELLED** | 409 | `WORKSHOP_CANCELLED` | Không cho upload |
| **Supabase upload fail** | 500 | `STORAGE_ERROR` | Return 500, user retry |
| **PDF extraction fail (corrupt file)** | — | — | ai_summary_status = FAILED, log error |
| **Gemini API timeout (>10s)** | — | — | Retry 2 lần, nếu vẫn fail → FAILED |
| **Gemini API rate limit** | — | — | Retry sau 1 phút (exponential backoff) |
| **Gemini API invalid key** | — | — | ai_summary_status = FAILED, alert admin |
| **Database update fail** | — | — | Retry 3 lần, nếu vẫn fail → log error, manual intervention |
| **Thử retry khi DONE** | 409 | `SUMMARY_ALREADY_DONE` | Báo lỗi, không xử lý |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **File size** | Max 10MB, timeout upload 30s |
| **Text extraction** | Max 30,000 characters sent to Gemini (Gemini token limit) |
| **API latency** | Gemini response timeout 10s, retry 2 lần |
| **Async pool** | ThreadPool size ≥ 2 cho AI processing, queue ≥ 50 |
| **State machine** | NONE → PROCESSING → DONE / FAILED |
| **Retry policy** | Max 3 times per original request (manual retries unlimited) |
| **Summary length** | Max 500 characters stored in database |
| **Language** | Luôn tiếng Việt, không dùng ngôn ngữ khác |
| **Rate limit (Gemini)** | Không vượt 100 requests/phút (nếu setup quá, phải throttle) |

---

## Tiêu chí chấp nhận

- ✅ Upload PDF nhận response 202 (async processing)
- ✅ Frontend hiển thị "Đang xử lý..." khi ai_summary_status = PROCESSING
- ✅ Sau 10-30 giây, tóm tắt xuất hiện tự động trên trang chi tiết workshop
- ✅ Nếu Gemini API fail, admin thấy status FAILED + nút "Thử lại"
- ✅ Click "Thử lại" → tóm tắt được tạo lại (không mất dữ liệu cũ)
- ✅ Corrupt PDF → ai_summary_status = FAILED, không crash hệ thống
- ✅ Text cleaning: bỏ được header/footer, ký tự lạ, text sạch
- ✅ Gemini timeout → retry 2 lần, nếu vẫn timeout → FAILED
- ✅ Tóm tắt tiếng Việt 3-5 câu, chứa kiến thức chính của workshop
- ✅ Xem workshop vẫn hoạt động bình thường dù Gemini API down (graceful degradation)

## API Endpoints

#### `POST /api/workshops/{workshopId}/pdf`

Upload file PDF và kích hoạt tiến trình tạo tóm tắt AI bất đồng bộ.

#### `POST /api/workshops/{workshopId}/ai-summary/retry`

Thử lại tiến trình tạo tóm tắt AI khi trạng thái trước đó là `FAILED`.

#### `GET /api/workshops/{workshopId}/ai-summary`

Lấy trạng thái xử lý và nội dung tóm tắt AI theo namespace workshop.

#### `GET /api/ai-summary/{workshopId}` — Lấy tóm tắt AI

Cho phép ORGANIZER lấy bản tóm tắt AI của một workshop cụ thể.

**Response 200:**
```json
{
  "status": 200,
  "data": {
    "summary": "This workshop covers the basics of AI in education..."
  }
}
```




