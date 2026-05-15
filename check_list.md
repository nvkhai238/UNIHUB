# UniHub Workshop - Checklist Chuc Nang

Tai lieu nay tong hop tat ca chuc nang cua du an theo `project-spec.md`, `Ke_hoach_UniHub_Workshop.md`, blueprint va source code hien tai trong repo.

Quy uoc trang thai:

- `HOAN_THANH`: Da co implementation chinh va co dau hieu dung duoc trong repo.
- `MOT_PHAN`: Da co mot phan code/UI/tai lieu, nhung chua day du hoac chua dung spec.
- `CHUA_CO`: Chua thay implementation thuc te trong source code.

---

## 1. Blueprint va Tai Lieu

### 1.1 Blueprint tong the

- [x] Proposal / Project Proposal - `HOAN_THANH`
- [x] Technical Design / Design tong the - `HOAN_THANH`
- [x] C4 Level 1 - System Context - `HOAN_THANH`
- [x] C4 Level 2 - Container Diagram - `HOAN_THANH`
- [x] High-Level Architecture Diagram - `HOAN_THANH`
- [x] Thiet ke co so du lieu - `HOAN_THANH`
- [x] Checklist bo sung constraint/index Supabase can co - `HOAN_THANH`
- [x] Thiet ke kiem soat truy cap / RBAC - `HOAN_THANH`
- [x] Thiet ke cac co che bao ve he thong - Rate Limiting / Circuit Breaker / Idempotency - `HOAN_THANH`

### 1.2 Blueprint theo tinh nang

- [x] Auth spec - `HOAN_THANH`
- [x] Registration spec - `HOAN_THANH`
- [x] Payment spec - `HOAN_THANH`
- [x] Check-in offline spec - `HOAN_THANH`
- [x] CSV import spec - `HOAN_THANH`
- [x] Notification spec - `HOAN_THANH`
- [x] AI summary spec - `HOAN_THANH`
- [x] Realtime updates spec - `HOAN_THANH`
- [x] Workshop management spec - `HOAN_THANH`

### 1.3 Tai lieu chay repo

- [x] RUN_REPO.md - `HOAN_THANH`
- [x] README.md dung theo yeu cau cham bai - `HOAN_THANH`
- [x] Huong dan seed/sample data ro rang trong README - `HOAN_THANH`

---

## 2. Nen Tang He Thong

### 2.1 Kien truc va module

- [x] Frontend React + Vite - `HOAN_THANH`
- [x] Backend Spring Boot - `HOAN_THANH`
- [x] Mock payment service rieng - `HOAN_THANH`
- [x] Docker Compose - `HOAN_THANH`
- [x] Redis config - `HOAN_THANH`
- [x] Seed data backend - `HOAN_THANH`
- [x] Data mau CSV trong thu muc `data/` - `HOAN_THANH`
- [x] Cap nhat kien truc tu PWA check-in sang mobile app thuan - `HOAN_THANH`

### 2.2 Bao mat va xac thuc

- [x] JWT access token - `HOAN_THANH`
- [x] Refresh token - `HOAN_THANH`
- [x] Logout + blacklist refresh token - `HOAN_THANH`
- [x] Role-based access control cho STUDENT / ORGANIZER / CHECKIN_STAFF - `HOAN_THANH`
- [x] Route guard frontend theo role - `HOAN_THANH`
- [x] Dang ky tai khoan voi OTP qua email - `HOAN_THANH`
- [x] Change password endpoint dung theo spec - `HOAN_THANH`
- [x] Test cho auth va phan quyen - `HOAN_THANH`

---

## 3. Chuc Nang Sinh Vien

### 3.1 Xem workshop

- [x] Danh sach workshop public - `HOAN_THANH`
- [x] Trang chi tiet workshop - `HOAN_THANH`
- [x] Hien thi thong tin dien gia / phong / thoi gian / gia / so cho - `HOAN_THANH`
- [x] Hien thi PDF neu co - `HOAN_THANH`
- [x] Hien thi AI summary neu co - `HOAN_THANH`
- [x] So cho trong cap nhat realtime theo spec - `HOAN_THANH`
- [x] Fallback polling/realtime degradation - `HOAN_THANH`

### 3.2 Dang ky workshop

- [x] Dang ky workshop mien phi - `HOAN_THANH`
- [x] Dang ky workshop co phi - `HOAN_THANH`
- [x] Tao QR cho registration confirmed - `HOAN_THANH`
- [x] Danh sach cho khi het ghe - `HOAN_THANH`
- [x] Trang My Registrations - `HOAN_THANH`
- [x] Trang QR cua toi - `HOAN_THANH`
- [x] Trang payment status - `HOAN_THANH`
- [x] Huy dang ky cua sinh vien - `HOAN_THANH`
- [x] Promote waitlist FIFO khi co ghe trong - `HOAN_THANH`
- [x] Phan trang registration theo spec - `HOAN_THANH`
- [x] Danh sach registration cho organizer theo filter/day du - `HOAN_THANH`

### 3.3 Thanh toan va giao dich

- [x] Payment integration - `HOAN_THANH` (SePay webhook + QR code; mock gateway chi con dung cho demo circuit breaker noi bo)
- [x] Payment status endpoint - `HOAN_THANH`
- [x] Payment info endpoint cho QR SePay - `HOAN_THANH`
- [x] Payment retry UI/API co ban - `HOAN_THANH` (retry reset payment PENDING, navigate to payment page, wait SePay webhook)
- [x] Idempotency key cho registration button - `HOAN_THANH` (Redis lock + header key + clear on success)
- [x] Circuit breaker co cau hinh co ban - `HOAN_THANH` (Resilience4j @CircuitBreaker + @Retry on processPayment)
- [x] Payment pending timeout scheduler - `HOAN_THANH` (15 phut, scan 60s, cancel + release seat + promote waitlist)
- [x] Luong retry payment dung hoan toan theo spec - `HOAN_THANH` (retry -> PENDING -> new UH code -> wait webhook -> confirm/timeout)
- [x] Xu ly timeout/fail/cancel/hoan ghe dung 100% theo spec - `HOAN_THANH` (timeout->FAIL+cancel+release seat, cancel->REFUNDED/FAILED+release+promote, re-register reuse cancelled row)
- [x] Payment stats co filter chinh xac theo workshop/status/date - `HOAN_THANH` (countFiltered + sumAmountFiltered ap dung workshopId, status, from, to)
- [x] Refund flow ro rang khi workshop bi huy - `HOAN_THANH` (settlePaymentOnCancellation: SUCCESS->REFUNDED, PENDING->FAILED)
- [ ] Payment simulator organizer goi dung webhook backend - `CHUA_CO` (FE dang goi `/api/payments/sepay`, BE expose `/api/webhooks/sepay`)

### 3.4 Thong bao cho sinh vien

- [x] In-app notifications list - `HOAN_THANH`
- [x] Unread count - `HOAN_THANH`
- [x] Mark as read - `HOAN_THANH`
- [x] Mark all as read - `HOAN_THANH`
- [x] Delete notification - `HOAN_THANH`
- [x] Delete all notifications - `HOAN_THANH`
- [x] Email registration confirmation co QR - `HOAN_THANH`
- [x] Email workshop cancellation - `HOAN_THANH`
- [x] In-app notification tu dong cho dang ky / huy dang ky / payment co ban - `HOAN_THANH`
- [x] Notification realtime push qua Supabase Realtime - `HOAN_THANH`
- [x] Kien truc mo rong Telegram/SMS adapter - `HOAN_THANH`

---

## 4. Chuc Nang Ban To Chuc

### 4.1 Quan ly workshop

- [x] Dashboard organizer - `HOAN_THANH`
- [x] Danh sach workshop admin - `HOAN_THANH`
- [x] Tao workshop - `HOAN_THANH`
- [x] Chinh sua workshop - `HOAN_THANH`
- [x] Publish workshop - `HOAN_THANH`
- [x] Huy workshop - `HOAN_THANH`
- [x] Thong ke workshop tong quan - `HOAN_THANH`
- [x] Doi phong / doi gio co notify day du den sinh vien - `HOAN_THANH`
- [x] Xem danh sach registration theo workshop/day du - `HOAN_THANH`

### 4.2 AI Summary

- [x] Upload PDF workshop - `HOAN_THANH`
- [x] Luu file len Supabase Storage - `HOAN_THANH`
- [x] Xu ly async PDF -> text -> Gemini - `HOAN_THANH`
- [x] Luu ai_summary va ai_summary_status - `HOAN_THANH`
- [x] Validate file size/type/workshop status day du theo spec - `HOAN_THANH`
- [x] Retry AI summary endpoint - `HOAN_THANH`
- [x] API lay trang thai AI summary rieng - `HOAN_THANH`
- [x] UI retry khi FAILED - `HOAN_THANH`

### 4.3 Bao cao va thong ke

- [x] Thong ke workshop tong hop - `HOAN_THANH`
- [x] UI thong ke co ban - `HOAN_THANH`
- [x] Payment stats endpoint co ban - `HOAN_THANH`
- [x] Bao cao registration/payment/check-in dung muc do chi tiet theo spec - `HOAN_THANH`
- [x] Filter thong ke theo khoang thoi gian / workshop / status day du - `HOAN_THANH`

---

## 5. Check-in va Van Hanh

### 5.1 Check-in backend

- [x] Preload QR hop le theo ngay - `HOAN_THANH`
- [x] Sync check-ins len server - `HOAN_THANH`
- [x] Phat hien duplicate/conflict/invalid QR - `HOAN_THANH`
- [x] Kiem tra chi registration CONFIRMED moi duoc check-in - `HOAN_THANH`
- [x] Endpoint xem danh sach check-in theo workshop - `HOAN_THANH`

### 5.2 Check-in frontend / offline

### 5.2 Check-in mobile thuan / offline

- [x] UI check-in web debug - `HOAN_THANH`
- [x] Co logic local storage/offline check-in - `HOAN_THANH`
- [x] App mobile thuan cho CHECKIN_STAFF - `HOAN_THANH`
- [x] Quet QR bang camera that su tren mobile - `HOAN_THANH`
- [x] Luu offline tren storage phu hop cua mobile app - `HOAN_THANH`
- [x] Dong bo lai khi co mang tren mobile app - `HOAN_THANH`
- [x] Preload danh sach QR hop le vao mobile app - `HOAN_THANH`
- [x] Logout/xoa du lieu offline cua phien check-in truoc - `HOAN_THANH`
- [x] Loai bo phu thuoc vao PWA/Service Worker/IndexedDB trong luong check-in chinh - `HOAN_THANH`

---

## 6. Dong Bo CSV Sinh Vien

### 6.1 Batch import

- [x] Scheduler chay luc 2:00 AM - `HOAN_THANH`
- [x] Batch reader/processor/writer co ban - `HOAN_THANH`
- [ ] Xac nhan sequence Spring Batch metadata tren Supabase - `CHUA_CO`
- [x] Upsert sinh vien vao database - `HOAN_THANH`
- [x] Lich su cac batch import - `HOAN_THANH`
- [x] UI run import + xem batch - `HOAN_THANH`
- [x] Validate file ton tai / rong / header sai theo step rieng - `HOAN_THANH`
- [x] Bao cao chi tiet dong loi / line number / error reason - `HOAN_THANH`
- [x] Alert email admin khi import loi - `HOAN_THANH`
- [x] Seed/sample CSV de test nhanh - `HOAN_THANH`
- [x] Endpoint status dung nhu spec `/api/csv/status` - `HOAN_THANH`

---

## 7. Co Che Bao Ve He Thong

### 7.1 Rate limiting

- [x] Rate limiter cho registration - `HOAN_THANH`
- [x] Retry-After header + UI cooldown button - `HOAN_THANH`
- [x] Rate limiter cho workshop-read - `HOAN_THANH`
- [x] Metrics/health cho rate limiter - `HOAN_THANH`
- [x] Co che per-user sliding window dung muc blueprint - `HOAN_THANH`

### 7.2 Chong overbooking

- [x] DB lock `findByIdForUpdate` khi dang ky - `HOAN_THANH`
- [x] Redis lock bo sung cho registration/workshop seat - `HOAN_THANH`
- [ ] Xac nhan Supabase co unique `registrations(user_id, workshop_id)` - `CHUA_CO`
- [ ] Xac nhan Supabase co check `remaining_seats <= capacity` - `CHUA_CO`
- [x] Test concurrency xac nhan khong overbooking - `HOAN_THANH`

### 7.3 Circuit breaker

- [x] Annotation circuit breaker cho payment - `HOAN_THANH`
- [x] Retry cho payment gateway - `HOAN_THANH`
- [x] Config circuit breaker day du: half-open / slow-call / metrics - `HOAN_THANH`
- [x] Endpoint/admin status circuit breaker - `HOAN_THANH`

### 7.4 Idempotency

- [x] Validate UUID v4 Idempotency-Key - `HOAN_THANH`
- [x] Cache response tren Redis - `HOAN_THANH`
- [x] Frontend sinh va gui idempotency key - `HOAN_THANH`
- [x] Bind idempotency key voi user nhu design mo ta - `HOAN_THANH`
- [x] Idempotency cho retry payment day du - `HOAN_THANH`
- [ ] Xac nhan Supabase co unique index `payments.gateway_ref` khi khac null - `CHUA_CO`

---

## 8. Frontend Mobile / Realtime / UX

- [x] Routing theo role - `HOAN_THANH`
- [x] Auth token refresh interceptor - `HOAN_THANH`
- [x] Public / student / organizer / checkin pages co ban - `HOAN_THANH`
- [x] Web check-in tam thoi de debug API - `MOT_PHAN`
- [x] Mobile app thuan cho check-in offline - `HOAN_THANH`
- [x] Co che local persistence phu hop mobile thay cho IndexedDB/Service Worker - `HOAN_THANH`
- [x] Realtime seats qua Supabase/WebSocket - `HOAN_THANH`
- [x] Realtime notifications - `HOAN_THANH`
- [x] Dong bo contract mobile app va API check-in sync - `HOAN_THANH`

---

## 8A. Cac Muc Bat Buoc Phai Sua Khi Chuyen Tu PWA Sang Mobile

- [x] Sua `project-spec` noi bo / demo scope de check-in khong con duoc mo ta la PWA
- [x] Sua blueprint `design.md` tu `Check-in PWA` thanh `Mobile App`
- [x] Sua C4 Container Diagram: thay `Check-in PWA` bang `Check-in Mobile App`
- [x] Sua luong offline: bo `Service Worker`, `Background Sync`, `IndexedDB`; thay bang local DB cua mobile + sync job/app lifecycle
- [x] Sua checklist kiem thu de bo cac buoc lien quan PWA browser va thay bang test tren thiet bi/emulator mobile
- [x] Danh gia lai auth cho app mobile: luu token, refresh token, logout, xoa du lieu offline
- [x] Danh gia lai camera permission, storage permission, network recovery tren mobile
- [x] Giu web check-in hien tai chi lam cong cu test tam, khong xem la implementation chinh nua

---

## 9. Kiem Thu va Chat Luong

- [x] Spring Boot app test context - `HOAN_THANH`
- [x] Unit test auth - `HOAN_THANH`
- [x] Unit test registration - `HOAN_THANH`
- [x] Unit test payment - `HOAN_THANH`
- [x] Unit test CSV import - `HOAN_THANH`
- [x] Unit test check-in - `HOAN_THANH`
- [x] Integration test role security - `HOAN_THANH`
- [x] Integration test payment failure/circuit breaker/idempotency - `HOAN_THANH`
- [x] Concurrency test 1 ghe cuoi cung - `HOAN_THANH`
- [ ] Frontend test / e2e test - `CHUA_CO`

---

## 10. Tong Ket Theo Nhom Chuc Nang

### Da o muc kha on

- Auth/JWT/RBAC co ban
- Dang ky tai khoan voi OTP email
- CRUD workshop co ban
- Registration co ban
- QR code cho registration confirmed
- Notification list va email co ban
- CSV import co ban
- Thong ke tong hop co ban
- Mobile check-in Expo offline co SQLite/SecureStore

### Dang do / can hoan thien gap

- Dong bo endpoint PaymentSimulatorPage voi backend SePay webhook
- Kiem thu mobile check-in tren thiet bi that/emulator

### Chua co hoac thieu ro

- Frontend/e2e test tu dong
- Evidence test thiet bi that cho mobile check-in

---

## 11. Phan Cong 3 Thanh Vien Theo Luong Rieng

Phan chia nay dua tren `Ke_hoach_UniHub_Workshop.md` va de tranh ghi de code.

### Thanh vien 1 - Dang ky & Giao dich

Pham vi chinh:

- Registration
- Payment
- Rate limiting
- Idempotency
- Overbooking / locking

Checklist thuc hien:

- [x] Hoan thien `DELETE /api/registrations/{id}` de huy dang ky
- [x] Hoan thien waitlist promotion FIFO khi co ghe trong
- [x] Chinh sua retry payment dung spec
- [x] Chinh sua payment fail/timeout/cancel/release-seat cho khop blueprint
- [x] Hoan thien payment stats filter
- [x] Them workshop-read rate limiter
- [x] Them test concurrency cho 1 ghe cuoi cung
- [x] Them test idempotency, retry, circuit breaker

Checklist kiem thu:

- [x] 2 sinh vien dang ky cung luc 1 ghe cuoi -> chi 1 nguoi confirmed
- [x] Workshop het cho -> nguoi sau vao waitlist
- [x] Huy dang ky -> nguoi dau waitlist duoc promote
- [x] Retry cung Idempotency-Key -> khong tao duplicate registration/payment
- [x] Payment gateway fail lien tuc -> circuit breaker open, route khac van song
- [x] Payment timeout -> ghe duoc xu ly dung theo spec

### Thanh vien 2 - Quan tri & Noi dung AI

Pham vi chinh:

- Admin UI
- Workshop management
- AI summary
- Reporting/statistics
- Realtime updates cho workshop

Checklist thuc hien:

- [x] Hoan thien validate upload PDF theo spec
- [x] Them retry AI summary endpoint + UI
- [x] Them API lay trang thai AI summary rieng
- [x] Hoan thien stats/payment reporting cho organizer
- [x] Bo sung realtime seats/workshop updates
- [x] Bo sung README.md va huong dan demo cho organizer luong

Checklist kiem thu:

- [ ] Tao workshop -> draft -> publish thanh cong
- [ ] Sua workshop -> thong tin cap nhat dung
- [ ] Huy workshop -> registrations/payments lien quan chuyen trang thai dung
- [ ] Upload PDF hop le -> summary sinh ra
- [ ] Upload file loi / file khong phai PDF -> bi chan dung
- [ ] Gemini fail -> status FAILED, retry duoc
- [ ] Student page thay remaining seats cap nhat realtime

### Thanh vien 3 - Van hanh & Dong bo

Pham vi chinh:

- Check-in
- Mobile/offline
- CSV import
- Notification
- Email

Checklist thuc hien:

- [x] Chot cong nghe mobile thuan cho app check-in
- [x] Tao app mobile check-in cho CHECKIN_STAFF
- [x] Hoan thien quet QR bang camera that tren mobile
- [x] Chon va tich hop local database/storage tren mobile
- [x] Sua flow sync offline theo mo hinh mobile, khong dung Service Worker
- [x] Them preload/save/mark pending offline dung flow mobile
- [x] Them logout cleanup du lieu local check-in tren mobile
- [x] Bo sung endpoint danh sach check-in theo workshop
- [x] Hoan thien CSV validation/report/email alert
- [x] Bo sung in-app notification tao tu dong day du cho event

Checklist kiem thu:

- [x] Preload QR cho ngay hom nay thanh cong tren mobile
- [x] Tat mang -> scan QR hop le -> luu local tren mobile
- [x] Scan lai cung QR khi offline -> bao duplicate local
- [x] Bat mang -> sync thanh cong len server
- [x] Dong app/mo lai -> pending offline van con
- [ ] Thu tren thiet bi that hoac emulator
- [ ] QR sai -> invalid
- [ ] QR da check-in o device khac -> conflict
- [ ] CSV hop le -> import thanh cong
- [ ] CSV sai header/format -> batch bao loi, khong lam hong he thong
- [ ] Email xac nhan va email huy workshop gui dung nguoi

---

## 12. Luong Kiem Thu Tong Hop De Chia Nhom

### Luong A - Sinh vien dang ky workshop mien phi

Nguoi phu trach chinh: Thanh vien 1

- [x] Dang nhap student
- [x] Xem danh sach workshop
- [x] Vao chi tiet workshop mien phi
- [x] Dang ky thanh cong
- [x] Nhan notification in-app
- [x] Xem QR

### Luong B - Sinh vien dang ky workshop co phi

Nguoi phu trach chinh: Thanh vien 1
Phoi hop: Thanh vien 2

- [x] Dang ky workshop co phi
- [x] Payment success
- [x] Payment fail
- [x] Payment timeout
- [x] Retry payment
- [x] Circuit breaker khi mock payment loi hang loat

### Luong C - Organizer quan ly workshop

Nguoi phu trach chinh: Thanh vien 2

- [x] Tao workshop
- [x] Publish workshop
- [x] Chinh sua workshop
- [x] Upload PDF va AI summary
- [x] Xem thong ke
- [x] Huy workshop

### Luong D - Check-in online/offline

Nguoi phu trach chinh: Thanh vien 3

- [x] Preload QR tren mobile
- [x] Check-in online tren mobile
- [x] Check-in offline tren mobile
- [x] Dong bo lai khi co mang tren mobile
- [x] Xung dot duplicate/conflict

### Luong E - CSV import va notification

Nguoi phu trach chinh: Thanh vien 3
Phoi hop: Thanh vien 2

- [x] Chay import CSV
- [x] Kiem tra user duoc upsert
- [x] Kiem tra batch history
- [x] Kiem tra in-app notification
- [x] Kiem tra email notification

---

## 13. Thu Tu Uu Tien Nen Lam Tiep

### Uu tien 1 - Bat buoc de dung spec

- [x] Huy dang ky + promote waitlist
- [x] Payment flow dung spec
- [x] Chot va chuyen hoan toan luong check-in tu PWA sang mobile thuan
- [x] Check-in offline that su tren mobile
- [x] Retry AI summary
- [x] README.md + sample data
- [ ] Sua PaymentSimulatorPage goi dung `/api/webhooks/sepay`

### Uu tien 2 - Bao ve he thong va chat luong

- [x] Test concurrency / integration
- [x] Workshop-read rate limiting
- [x] Circuit breaker metrics / status
- [x] CSV validation/report day du

### Uu tien 3 - Nang cap trai nghiem

- [x] Realtime seats
- [x] Realtime notifications
- [ ] Dashboard/reporting chi tiet hon
- [ ] Frontend/e2e tests cho student/organizer/check-in web
