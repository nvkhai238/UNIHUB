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
- [ ] Change password endpoint dung theo spec - `CHUA_CO`
- [ ] Test day du cho auth va phan quyen - `CHUA_CO`

---

## 3. Chuc Nang Sinh Vien

### 3.1 Xem workshop

- [x] Danh sach workshop public - `HOAN_THANH`
- [x] Trang chi tiet workshop - `HOAN_THANH`
- [x] Hien thi thong tin dien gia / phong / thoi gian / gia / so cho - `HOAN_THANH`
- [x] Hien thi PDF neu co - `HOAN_THANH`
- [x] Hien thi AI summary neu co - `HOAN_THANH`
- [ ] So cho trong cap nhat realtime theo spec - `CHUA_CO`
- [ ] Fallback polling/realtime degradation - `CHUA_CO`

### 3.2 Dang ky workshop

- [x] Dang ky workshop mien phi - `HOAN_THANH`
- [x] Dang ky workshop co phi - `MOT_PHAN`
- [x] Tao QR cho registration confirmed - `HOAN_THANH`
- [x] Danh sach cho khi het ghe - `HOAN_THANH`
- [x] Trang My Registrations - `HOAN_THANH`
- [x] Trang QR cua toi - `HOAN_THANH`
- [x] Trang payment status - `HOAN_THANH`
- [x] Huy dang ky cua sinh vien - `HOAN_THANH`
- [x] Promote waitlist FIFO khi co ghe trong - `HOAN_THANH`
- [ ] Phan trang registration theo spec - `CHUA_CO`
- [ ] Danh sach registration cho organizer theo filter/day du - `CHUA_CO`

### 3.3 Thanh toan va giao dich

- [x] Mock payment integration - `HOAN_THANH`
- [x] Payment status endpoint - `HOAN_THANH`
- [x] Payment retry UI/API co ban - `MOT_PHAN`
- [x] Idempotency key cho registration button - `MOT_PHAN`
- [x] Circuit breaker co cau hinh co ban - `MOT_PHAN`
- [x] Payment pending timeout scheduler - `MOT_PHAN`
- [ ] Luong retry payment dung hoan toan theo spec - `CHUA_CO`
- [ ] Xu ly timeout/fail/cancel/hoan ghe dung 100% theo spec - `CHUA_CO`
- [ ] Payment stats co filter chinh xac theo workshop/status/date - `MOT_PHAN`
- [ ] Refund flow ro rang khi workshop bi huy - `MOT_PHAN`

### 3.4 Thong bao cho sinh vien

- [x] In-app notifications list - `HOAN_THANH`
- [x] Unread count - `HOAN_THANH`
- [x] Mark as read - `HOAN_THANH`
- [x] Mark all as read - `HOAN_THANH`
- [x] Delete notification - `HOAN_THANH`
- [x] Delete all notifications - `HOAN_THANH`
- [x] Email registration confirmation co QR - `HOAN_THANH`
- [x] Email workshop cancellation - `HOAN_THANH`
- [ ] In-app notification tu dong tao day du cho moi su kien nghiep vu - `MOT_PHAN`
- [ ] Notification realtime push qua Supabase Realtime - `CHUA_CO`
- [ ] Kien truc mo rong Telegram/SMS adapter - `CHUA_CO`

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
- [ ] Doi phong / doi gio co notify day du den sinh vien - `MOT_PHAN`
- [ ] Xem danh sach registration theo workshop/day du - `CHUA_CO`

### 4.2 AI Summary

- [x] Upload PDF workshop - `HOAN_THANH`
- [x] Luu file len Supabase Storage - `HOAN_THANH`
- [x] Xu ly async PDF -> text -> Gemini - `HOAN_THANH`
- [x] Luu ai_summary va ai_summary_status - `HOAN_THANH`
- [ ] Validate file size/type/workshop status day du theo spec - `MOT_PHAN`
- [x] Retry AI summary endpoint - `HOAN_THANH`
- [x] API lay trang thai AI summary rieng - `HOAN_THANH`
- [x] UI retry khi FAILED - `HOAN_THANH`

### 4.3 Bao cao va thong ke

- [x] Thong ke workshop tong hop - `HOAN_THANH`
- [x] UI thong ke co ban - `HOAN_THANH`
- [x] Payment stats endpoint co ban - `MOT_PHAN`
- [ ] Bao cao registration/payment/check-in dung muc do chi tiet theo spec - `MOT_PHAN`
- [ ] Filter thong ke theo khoang thoi gian / workshop / status day du - `MOT_PHAN`

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

- [x] UI check-in web/PWA tam thoi de test backend - `MOT_PHAN`
- [x] Co logic local storage/offline muc do ban dau tren FE - `MOT_PHAN`
- [ ] App mobile thuan cho CHECKIN_STAFF - `CHUA_CO`
- [ ] Quet QR bang camera that su tren mobile - `CHUA_CO`
- [ ] Luu offline tren storage phu hop cua mobile app - `CHUA_CO`
- [ ] Dong bo lai khi co mang tren mobile app - `CHUA_CO`
- [ ] Preload danh sach QR hop le vao mobile app - `CHUA_CO`
- [ ] Logout/xoa du lieu offline cua phien check-in truoc - `CHUA_CO`
- [ ] Loai bo phu thuoc vao PWA/Service Worker/IndexedDB trong luong check-in chinh - `CHUA_CO`

---

## 6. Dong Bo CSV Sinh Vien

### 6.1 Batch import

- [x] Scheduler chay luc 2:00 AM - `HOAN_THANH`
- [x] Batch reader/processor/writer co ban - `HOAN_THANH`
- [x] Upsert sinh vien vao database - `HOAN_THANH`
- [x] Lich su cac batch import - `HOAN_THANH`
- [x] UI run import + xem batch - `HOAN_THANH`
- [ ] Validate file ton tai / rong / header sai theo step rieng - `CHUA_CO`
- [ ] Bao cao chi tiet dong loi / line number / error reason - `CHUA_CO`
- [ ] Alert email admin khi import loi - `CHUA_CO`
- [x] Seed/sample CSV de test nhanh - `HOAN_THANH`
- [x] Endpoint status dung nhu spec `/api/csv/status` - `HOAN_THANH`

---

## 7. Co Che Bao Ve He Thong

### 7.1 Rate limiting

- [x] Rate limiter cho registration - `HOAN_THANH`
- [x] Retry-After header + UI cooldown button - `HOAN_THANH`
- [ ] Rate limiter cho workshop-read - `CHUA_CO`
- [ ] Metrics/health cho rate limiter - `CHUA_CO`
- [ ] Co che per-user sliding window dung muc blueprint - `MOT_PHAN`

### 7.2 Chong overbooking

- [x] DB lock `findByIdForUpdate` khi dang ky - `HOAN_THANH`
- [x] Redis lock bo sung cho registration/workshop seat - `HOAN_THANH`
- [ ] Test concurrency xac nhan khong overbooking - `CHUA_CO`

### 7.3 Circuit breaker

- [x] Annotation circuit breaker cho payment - `HOAN_THANH`
- [x] Retry cho payment gateway - `HOAN_THANH`
- [ ] Config circuit breaker day du: half-open / slow-call / metrics - `MOT_PHAN`
- [ ] Endpoint/admin status circuit breaker - `CHUA_CO`

### 7.4 Idempotency

- [x] Validate UUID v4 Idempotency-Key - `HOAN_THANH`
- [x] Cache response tren Redis - `HOAN_THANH`
- [x] Frontend sinh va gui idempotency key - `HOAN_THANH`
- [ ] Bind idempotency key voi user nhu design mo ta - `CHUA_CO`
- [ ] Idempotency cho retry payment day du - `CHUA_CO`

---

## 8. Frontend Mobile / Realtime / UX

- [x] Routing theo role - `HOAN_THANH`
- [x] Auth token refresh interceptor - `HOAN_THANH`
- [x] Public / student / organizer / checkin pages co ban - `HOAN_THANH`
- [x] Web check-in tam thoi de debug API - `MOT_PHAN`
- [ ] Mobile app thuan cho check-in offline - `CHUA_CO`
- [ ] Co che local persistence phu hop mobile thay cho IndexedDB/Service Worker - `CHUA_CO`
- [ ] Realtime seats qua Supabase/WebSocket - `CHUA_CO`
- [ ] Realtime notifications - `CHUA_CO`
- [ ] Dong bo contract mobile app va API check-in sync - `CHUA_CO`

---

## 8A. Cac Muc Bat Buoc Phai Sua Khi Chuyen Tu PWA Sang Mobile

- [ ] Sua `project-spec` noi bo / demo scope de check-in khong con duoc mo ta la PWA
- [x] Sua blueprint `design.md` tu `Check-in PWA` thanh `Mobile App`
- [x] Sua C4 Container Diagram: thay `Check-in PWA` bang `Check-in Mobile App`
- [x] Sua luong offline: bo `Service Worker`, `Background Sync`, `IndexedDB`; thay bang local DB cua mobile + sync job/app lifecycle
- [ ] Sua checklist kiem thu de bo cac buoc lien quan PWA browser va thay bang test tren thiet bi/emulator mobile
- [ ] Danh gia lai auth cho app mobile: luu token, refresh token, logout, xoa du lieu offline
- [ ] Danh gia lai camera permission, storage permission, network recovery tren mobile
- [ ] Giu web check-in hien tai chi lam cong cu test tam, khong xem la implementation chinh nua

---

## 9. Kiem Thu va Chat Luong

- [x] Spring Boot app test context - `HOAN_THANH`
- [ ] Unit test auth - `CHUA_CO`
- [ ] Unit test registration - `CHUA_CO`
- [ ] Unit test payment - `CHUA_CO`
- [ ] Unit test CSV import - `CHUA_CO`
- [ ] Unit test check-in - `CHUA_CO`
- [ ] Integration test role security - `CHUA_CO`
- [ ] Integration test payment failure/circuit breaker/idempotency - `CHUA_CO`
- [ ] Concurrency test 1 ghe cuoi cung - `CHUA_CO`
- [ ] Frontend test / e2e test - `CHUA_CO`

---

## 10. Tong Ket Theo Nhom Chuc Nang

### Da o muc kha on

- Auth/JWT/RBAC co ban
- CRUD workshop co ban
- Registration co ban
- QR code cho registration confirmed
- Notification list va email co ban
- CSV import co ban
- Thong ke tong hop co ban

### Dang do / can hoan thien gap

- Payment flow dung spec
- Waitlist promote
- Check-in offline that su
- AI summary retry + status
- Realtime updates
- README + sample data + test

### Chua co hoac thieu ro

- Huy dang ky
- Endpoint/view check-in list
- Realtime notification
- Workshop-read rate limit
- Test concurrency va integration

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

- [ ] Hoan thien `DELETE /api/registrations/{id}` de huy dang ky
- [ ] Hoan thien waitlist promotion FIFO khi co ghe trong
- [ ] Chinh sua retry payment dung spec
- [ ] Chinh sua payment fail/timeout/cancel/release-seat cho khop blueprint
- [ ] Hoan thien payment stats filter
- [ ] Them workshop-read rate limiter
- [ ] Them test concurrency cho 1 ghe cuoi cung
- [ ] Them test idempotency, retry, circuit breaker

Checklist kiem thu:

- [ ] 2 sinh vien dang ky cung luc 1 ghe cuoi -> chi 1 nguoi confirmed
- [ ] Workshop het cho -> nguoi sau vao waitlist
- [ ] Huy dang ky -> nguoi dau waitlist duoc promote
- [ ] Retry cung Idempotency-Key -> khong tao duplicate registration/payment
- [ ] Payment gateway fail lien tuc -> circuit breaker open, route khac van song
- [ ] Payment timeout -> ghe duoc xu ly dung theo spec

### Thanh vien 2 - Quan tri & Noi dung AI

Pham vi chinh:

- Admin UI
- Workshop management
- AI summary
- Reporting/statistics
- Realtime updates cho workshop

Checklist thuc hien:

- [ ] Hoan thien validate upload PDF theo spec
- [ ] Them retry AI summary endpoint + UI
- [ ] Them API lay trang thai AI summary rieng
- [ ] Hoan thien stats/payment reporting cho organizer
- [ ] Bo sung realtime seats/workshop updates
- [ ] Bo sung README.md va huong dan demo cho organizer luong

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

- [ ] Chot cong nghe mobile thuan cho app check-in
- [ ] Tao app mobile check-in cho CHECKIN_STAFF
- [ ] Hoan thien quet QR bang camera that tren mobile
- [ ] Chon va tich hop local database/storage tren mobile
- [ ] Sua flow sync offline theo mo hinh mobile, khong dung Service Worker
- [ ] Them preload/save/mark pending offline dung flow mobile
- [ ] Them logout cleanup du lieu local check-in tren mobile
- [ ] Bo sung endpoint danh sach check-in theo workshop
- [ ] Hoan thien CSV validation/report/email alert
- [ ] Bo sung in-app notification tao tu dong day du cho event

Checklist kiem thu:

- [ ] Preload QR cho ngay hom nay thanh cong tren mobile
- [ ] Tat mang -> scan QR hop le -> luu local tren mobile
- [ ] Scan lai cung QR khi offline -> bao duplicate local
- [ ] Bat mang -> sync thanh cong len server
- [ ] Dong app/mo lai -> pending offline van con
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

- [ ] Dang nhap student
- [ ] Xem danh sach workshop
- [ ] Vao chi tiet workshop mien phi
- [ ] Dang ky thanh cong
- [ ] Nhan notification in-app
- [ ] Xem QR

### Luong B - Sinh vien dang ky workshop co phi

Nguoi phu trach chinh: Thanh vien 1
Phoi hop: Thanh vien 2

- [ ] Dang ky workshop co phi
- [ ] Payment success
- [ ] Payment fail
- [ ] Payment timeout
- [ ] Retry payment
- [ ] Circuit breaker khi mock payment loi hang loat

### Luong C - Organizer quan ly workshop

Nguoi phu trach chinh: Thanh vien 2

- [ ] Tao workshop
- [ ] Publish workshop
- [ ] Chinh sua workshop
- [ ] Upload PDF va AI summary
- [ ] Xem thong ke
- [ ] Huy workshop

### Luong D - Check-in online/offline

Nguoi phu trach chinh: Thanh vien 3

- [ ] Preload QR tren mobile
- [ ] Check-in online tren mobile
- [ ] Check-in offline tren mobile
- [ ] Dong bo lai khi co mang tren mobile
- [ ] Xung dot duplicate/conflict

### Luong E - CSV import va notification

Nguoi phu trach chinh: Thanh vien 3
Phoi hop: Thanh vien 2

- [ ] Chay import CSV
- [ ] Kiem tra user duoc upsert
- [ ] Kiem tra batch history
- [ ] Kiem tra in-app notification
- [ ] Kiem tra email notification

---

## 13. Thu Tu Uu Tien Nen Lam Tiep

### Uu tien 1 - Bat buoc de dung spec

- [x] Huy dang ky + promote waitlist
- [ ] Payment flow dung spec
- [ ] Chot va chuyen hoan toan luong check-in tu PWA sang mobile thuan
- [ ] Check-in offline that su tren mobile
- [x] Retry AI summary
- [x] README.md + sample data

### Uu tien 2 - Bao ve he thong va chat luong

- [ ] Test concurrency / integration
- [ ] Workshop-read rate limiting
- [ ] Circuit breaker metrics / status
- [ ] CSV validation/report day du

### Uu tien 3 - Nang cap trai nghiem

- [ ] Realtime seats
- [ ] Realtime notifications
- [ ] Dashboard/reporting chi tiet hon
