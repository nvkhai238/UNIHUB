

## KẾ HOẠCH THỰC HIỆN ĐỒ ÁN UNIHUB
## WORKSHOP
Phân chia công việc | Kiến trúc hệ thống | Điều kiện chuẩn bị
## I. PHÂN CHIA CÔNG VIỆC (MÔ HÌNH FULLSTACK)
Dưới đây là phương án phân chia 3 module lớn cho 3 thành viên. Mỗi người sẽ phụ trách
trọn gói từ giao diện người dùng đến xử lý logic backend cho module đó.
Module & Vai trò
Nhiệm vụ cụ thể
## THÀNH VIÊN 1
Đăng ký & Giao dịch
(Core)
React: Trang danh sách workshop (Real-time),
luồng đăng ký & thanh toán, UI hiển thị vé/QR.
Java: Xử lý Concurrency (giữ chỗ), cơ chế
Idempotency chống trả tiền trùng, Rate Limiting
(chịu tải 12k user).
## THÀNH VIÊN 2
Quản trị & Nội dung AI
(Admin)
React: Dashboard cho BTC, CRUD workshop, giao
diện tóm tắt nội dung từ AI.
Java: Tích hợp Gemini API (xử lý PDF giới thiệu), hệ
thống phân quyền (RBAC), API báo cáo/thống kê.
## THÀNH VIÊN 3
Vận hành & Đồng bộ
(Operations)
Mobile: App check-in native cho CHECKIN_STAFF,
quét mã QR qua camera, lưu trữ offline cục bộ
và đồng bộ lại khi có mạng.
Java: Spring Batch xử lý file CSV sinh viên, API ghi
nhận tham dự, hệ thống gửi Email thông báo.
## •
## •
## •
## •
## •
## •

## II. ĐỊNH HƯỚNG KIẾN TRÚC PHẦN MỀM
- Công nghệ sử dụng
Frontend: React + Vite cho student/admin web. Check-in dùng mobile app native riêng.
Backend: Java Spring Boot (v3.x). Sử dụng Spring Security và Resilience4j
(cho Circuit Breaker/Rate Limiter).
Database: Supabase (PostgreSQL). Tận dụng tính năng Real-time cho số chỗ
trống workshop.
- Cơ chế trọng tâm
Tính nhất quán: Sử dụng Database Locking (Pessimistic/Optimistic) để đảm bảo
không bị quá tải số lượng chỗ ngồi.
Tính sẵn sàng: Circuit Breaker ngăn lỗi từ cổng thanh toán làm sập cả hệ thống
xem lịch workshop.
Offline-first: Luồng check-in ưu tiên lưu local trên mobile và đồng bộ lại
khi có mạng hoặc khi app foreground.
## III. ĐIỀU KIỆN TIÊN QUYẾT (LÀM CHUNG)
Để đảm bảo 3 thành viên có thể làm việc song song hiệu quả, nhóm cần hoàn tất các mục
sau trong tuần đầu tiên:
Database Schema chung: Thiết kế bảng Users, Workshops, Registrations trên
Supabase và export file SQL cho cả nhóm.
Auth & API Standard: Cài đặt xong Supabase Auth + Spring Security JWT. Thống
nhất Format JSON trả về (Ví dụ: {status, code, data, message}).
Chuẩn bị app mobile check-in: chốt contract API preload/sync, auth, camera,
local storage và quy trình test trên emulator/thiet bi that.
Đồ án UniHub Workshop | Tài liệu lưu hành nội bộ nhóm | 2026
## •
## •
## •
## •
## •
## •
## 1.
## 2.
## 3.
