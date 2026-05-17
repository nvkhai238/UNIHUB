# UniHub Workshop — Project Proposal

> **Nguồn ưu tiên:** Blueprint này bám theo đề bài UniHub Workshop. Khi có khác biệt giữa ý tưởng mở rộng và đề, yêu cầu trong đề luôn được ưu tiên; phần cài đặt/codebase chỉ được mô tả nếu không làm lệch các yêu cầu bắt buộc của đề.

## 1. Vấn đề

### Hiện trạng

Trường Đại học A hiện quản lý "Tuần lễ kỹ năng và nghề nghiệp" bằng Google Form để nhận đăng ký và gửi email thủ công để thông báo. Sự kiện kéo dài 5 ngày với 8–12 workshop diễn ra song song mỗi ngày, quy mô lên đến hàng nghìn sinh viên tham dự.

### Hậu quả cụ thể

**Overbooking không kiểm soát được:** Google Form không có cơ chế giới hạn chỗ ngồi theo thời gian thực. Khi nhiều sinh viên submit form cùng một lúc, hệ thống không phát hiện được việc số lượng đăng ký vượt quá sức chứa phòng, dẫn đến tình trạng bán lố chỗ.

**Tải trọng không chịu được:** Khi mở đăng ký, hàng nghìn sinh viên truy cập đồng thời khiến Google Form bị chậm hoặc không phản hồi, gây mất công bằng giữa các sinh viên.

**Quy trình check-in thủ công:** Ban tổ chức phải đối chiếu danh sách in ra giấy tại cửa phòng, dễ sai sót và tốn nhiều nhân lực.

**Thông báo chậm trễ và không nhất quán:** Email phải gửi tay từng đợt. Khi workshop bị đổi phòng hoặc hủy đột xuất, ban tổ chức không có cơ chế thông báo nhanh đến sinh viên đã đăng ký.

**Không có dữ liệu thống kê:** Ban tổ chức không biết được workshop nào đang hot, tỷ lệ lấp đầy chỗ ngồi như thế nào, hay sinh viên nào thường xuyên đăng ký mà không đến.

---

## 2. Mục tiêu

### Mục tiêu chính

Xây dựng hệ thống **UniHub Workshop** tự động hóa toàn bộ quy trình từ đăng ký đến check-in, thay thế hoàn toàn Google Form và quy trình email thủ công.

### Mục tiêu định lượng

| Chỉ tiêu                | Mục tiêu                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Tải trọng đỉnh          | Xử lý ổn định 12.000 sinh viên truy cập trong 10 phút đầu mở đăng ký (60% dồn vào 3 phút đầu) |
| Tính nhất quán chỗ ngồi | 0% overbooking — không có hai sinh viên nào nhận cùng một suất cuối cùng                      |
| Độ chính xác thanh toán | 0 giao dịch bị trừ tiền hai lần dù client retry nhiều lần                                     |
| Check-in offline        | Nhân sự check-in được tại khu vực mất mạng, dữ liệu không mất khi kết nối trở lại             |
| Thông báo tự động       | Sinh viên nhận xác nhận qua email + in-app ngay sau khi đăng ký thành công                    |

---

## 3. Người dùng và nhu cầu

### Sinh viên

**Nhu cầu:** Xem lịch workshop theo ngày/phòng, biết số chỗ còn lại theo thời gian thực, đăng ký nhanh, nhận mã QR để check-in, nhận thông báo khi workshop thay đổi.

**Điều quan trọng nhất:** Tốc độ và tính công bằng — sinh viên cần biết ngay mình có đăng ký được không, và không muốn bị "mất chỗ oan" do lỗi hệ thống.

### Ban tổ chức (Organizer)

**Nhu cầu:** Tạo, chỉnh sửa, hủy workshop; upload PDF giới thiệu diễn giả để AI tự tóm tắt; xem thống kê đăng ký theo thời gian thực; gửi thông báo đến sinh viên đã đăng ký khi có thay đổi.

**Điều quan trọng nhất:** Kiểm soát hoàn toàn nội dung và trạng thái workshop; biết nhanh workshop nào còn chỗ, workshop nào sắp đầy.

### Nhân sự check-in

**Nhu cầu:** Dùng ứng dụng mobile native để quét mã QR tại cửa phòng, xác nhận sinh viên có đăng ký hợp lệ không. **Đặc biệt phải hoạt động được khi kết nối mạng nội bộ không ổn định.**

**Điều quan trọng nhất:** Không để sinh viên chờ lâu tại cửa; dữ liệu check-in không được mất dù mạng có bị đứt.

---

## 4. Phạm vi

### Trong phạm vi

- **Web App cho Sinh viên:** Xem danh sách workshop, đăng ký (miễn phí và có phí), xem mã QR, nhận thông báo in-app.
- **Web App cho Ban tổ chức (Admin):** Dashboard CRUD workshop, upload PDF/room layout, đổi phòng/giờ, hủy workshop, xem thống kê đăng ký/thanh toán/check-in và lịch sử import CSV.
- **Check-in Mobile App:** Quét QR bằng camera thiết bị, hỗ trợ offline qua local database, đồng bộ lại khi có mạng trở lại hoặc app foreground.
- **Backend API (Spring Boot 3.x):** Toàn bộ logic nghiệp vụ, bảo mật JWT, Rate Limiting, Circuit Breaker, Idempotency Key, phân quyền RBAC.
- **Tích hợp AI Summary:** Nhận PDF → trích xuất văn bản → gửi Gemini API → lưu bản tóm tắt vào trang chi tiết workshop.
- **Đồng bộ CSV sinh viên:** Spring Batch đọc file CSV export từ hệ thống cũ mỗi đêm trong thư mục `/data` (Docker bind mount), upsert dữ liệu vào PostgreSQL.
- **Hệ thống thông báo:** Email (SMTP) và thông báo in-app sau mỗi sự kiện quan trọng (đăng ký thành công, workshop bị hủy/đổi phòng). Thiết kế mở rộng được để thêm kênh mới (Telegram, v.v.) mà không sửa logic core.

### Ngoài phạm vi

| Hạng mục                                      | Lý do loại trừ                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Cổng thanh toán thực tế (VNPay, Momo)         | Dùng luồng SePay webhook/mã chuyển khoản `UHxxxxxx` và payment demo để kiểm thử timeout, Circuit Breaker, Idempotency mà không cần tài khoản merchant thật |
| Triển khai production (AWS, GCP, domain, SSL) | Đóng gói bằng Docker Compose để chạy local — đủ để chấm điểm, không cần hạ tầng cloud thật                              |
| Đăng nhập qua SSO/tài khoản trường            | Hệ thống trường không có API auth; sinh viên đăng nhập bằng email được xác thực qua dữ liệu CSV đồng bộ hàng đêm        |
| App mobile đầy đủ cho sinh viên/organizer (iOS/Android) | Phạm vi mobile hiện tại chỉ gồm app check-in Expo/React Native cho CHECKIN_STAFF; sinh viên và organizer dùng web React. |
| Thanh toán hoàn tiền tự động (refund)         | Admin xử lý hoàn tiền thủ công; hệ thống chỉ ghi nhận trạng thái `REFUNDED`                                             |

---

## 5. Rủi ro và ràng buộc đã biết

### Rủi ro kỹ thuật

**Tranh chấp chỗ ngồi (Race Condition):** Workshop 60 chỗ có thể có hàng trăm sinh viên cố đăng ký trong vài giây đầu mở đăng ký. Hệ thống phải đảm bảo tuyệt đối không có hai sinh viên cùng nhận suất cuối.
→ _Giải pháp: Pessimistic Locking tại tầng PostgreSQL (`SELECT FOR UPDATE`) kết hợp với `UPDATE workshops SET remaining_seats = remaining_seats - 1 WHERE remaining_seats > 0`._

**Tải trọng đột biến (Burst Traffic):** 12.000 sinh viên, 60% dồn trong 3 phút đầu ≈ ~40 requests/giây chỉ cho endpoint đăng ký. Nếu không kiểm soát, backend sẽ sụp.
→ _Giải pháp: Rate Limiting bằng Resilience4j kết hợp Redis, chặn sớm tại tầng filter trước khi vào business logic._

**Cổng thanh toán không ổn định:** Luồng thanh toán chính xác nhận qua SePay webhook, còn payment adapter demo sinh success/fail/timeout để kiểm thử resilience. Hệ thống phải đảm bảo các tính năng không liên quan đến thanh toán vẫn hoạt động bình thường khi payment gateway gặp sự cố kéo dài.
→ _Giải pháp: SePay webhook idempotent cho xác nhận chuyển khoản, PaymentTimeoutScheduler cho payment treo, Circuit Breaker (Resilience4j) với Graceful Degradation cho payment adapter demo._

**Trừ tiền hai lần (Double Charge):** Nếu client timeout và retry, cùng một giao dịch có thể được gửi hai lần.
→ _Giải pháp: Idempotency Key — client sinh UUID trước khi gọi API, server cache kết quả trong Redis 24h._

**Check-in mất mạng:** Nhiều khu vực trong trường có WiFi không ổn định.
→ _Giải pháp: Mobile app native với local database, preload danh sách QR hợp lệ trước khi vào phòng, đồng bộ lại khi có mạng hoặc app foreground._

**Tích hợp một chiều với hệ thống cũ:** Hệ thống quản lý sinh viên không có API. Dữ liệu chỉ có thể lấy qua file CSV export ban đêm.
→ _Giải pháp: Spring Batch chạy cron job lúc 2:00 AM, xử lý file CSV với error handling đầy đủ, không làm gián đoạn hệ thống đang chạy._

### Ràng buộc thời gian

Đồ án được phát triển trong vòng **1 tuần**. Để 3 thành viên làm song song hiệu quả, toàn bộ nhóm phải hoàn tất các điều kiện tiên quyết vào ngày đầu tiên:

1. Chốt Database Schema chung (bảng `users`, `workshops`, `registrations`) trên Supabase và export file SQL cho cả nhóm.
2. Cài đặt xong Spring Security + JWT và thống nhất Response Format JSON toàn hệ thống.
3. Chốt contract mobile check-in: preload, sync, local storage, camera permission và quy trình test thiết bị.
