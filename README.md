# UniHub Workshop

UniHub Workshop là hệ thống full-stack phục vụ đăng ký workshop và check-in cho tuần sự kiện của trường đại học.

Cấu trúc nộp bài gồm:

- `blueprint/`: tài liệu thiết kế và đặc tả tính năng.
- `src/`: toàn bộ source code có thể chạy, template môi trường, dữ liệu seed/import, Docker Compose và các service của ứng dụng.
- `clips/`: video thuyết trình/demo nếu nhóm bổ sung khi nộp bài.

## Cấu trúc source code

```text
src/
  BE/workshop/        Backend Spring Boot
  FE/                 Source code React
  mobile-checkin/     App React Native + Expo cho CHECKIN_STAFF
  mock-payment/       Mock payment gateway bằng Node.js
  data/               File CSV seed/import
  docker-compose.yml  File Docker Compose chính
  .env.example        Template biến môi trường
```

## Yêu cầu cài đặt

- Docker Desktop, nếu chạy toàn bộ stack bằng Docker.
- Node.js 20+ và npm, nếu chạy frontend/mock-payment/mobile ngoài Docker.
- Java 21, nếu chạy backend ngoài Docker.
- Expo Go trên điện thoại hoặc Android Emulator/iOS Simulator để chạy app mobile check-in.
- PostgreSQL/Supabase database khớp với schema trong `blueprint/`.

## Cấu hình môi trường

Tạo `src/.env` từ `src/.env.example` và điền các giá trị local.

```powershell
cd src
Copy-Item .env.example .env
```

Các biến quan trọng:

```env
DB_URL=jdbc:postgresql://...
DB_USER=postgres
DB_PASS=...
JWT_SECRET=replace-with-a-32-byte-or-longer-secret
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=http://localhost:8080
GEMINI_API_KEY=...
SMTP_HOST=smtp.gmail.com
SMTP_USER=...
SMTP_PASS=...
MAIL_ENABLED=true
MAIL_FROM=...
MAIL_ADMIN=...
```

Nếu demo local không dùng email thật, đặt `MAIL_ENABLED=false`.

## Chạy bằng Docker

Tất cả lệnh runtime nên được chạy bên trong thư mục `src/`:

```powershell
cd src
docker compose up --build
```

Các service sau khi chạy:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- Mock payment gateway: `http://localhost:3001`
- Redis: `localhost:6379`

Dừng stack:

```powershell
docker compose down
```

Dừng stack và xóa volume:

```powershell
docker compose down -v
```

## Chạy không dùng Docker

Mở các terminal riêng từ root repo.

Backend:

```powershell
cd src\BE\workshop
.\mvnw.cmd spring-boot:run
```

Nếu Maven báo lỗi `release version 21 not supported`, hãy trỏ `JAVA_HOME` về JDK 21 trước khi chạy backend.

Frontend:

```powershell
cd src\FE
npm install
npm run dev
```

Mock payment:

```powershell
cd src\mock-payment
npm install
npm start
```

Redis vẫn cần thiết cho rate limiting/idempotency khi chạy các service local. Cách đơn giản nhất là giữ Redis chạy bằng Docker:

```powershell
cd src
docker compose up redis
```

## App mobile check-in

App mobile nằm trong `src/mobile-checkin` và được dùng bởi `CHECKIN_STAFF` để quét QR, lưu offline và đồng bộ check-in.

Cài dependencies và chạy Expo:

```powershell
cd src\mobile-checkin
npm install
npx expo start
```

Các cách chạy:

- Nhấn `a` trong terminal Expo để mở Android Emulator.
- Quét QR của Expo bằng Expo Go trên điện thoại thật.
- Đăng nhập bằng tài khoản staff ở phần bên dưới.

Khi test trên điện thoại thật, điện thoại phải truy cập được backend qua IP LAN của máy tính. Có thể truyền biến môi trường khi chạy Expo:

```powershell
cd src\mobile-checkin
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.2.100:8080"
npx expo start
```

Hoặc cấu hình trong `src/mobile-checkin/app.json -> expo.extra.apiBaseUrl`:

```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "http://192.168.2.100:8080"
    }
  }
}
```

Nếu cả hai giá trị trên đều không được cấu hình, app sẽ fallback về `http://localhost:8080`, chỉ phù hợp khi môi trường mobile có thể resolve `localhost` tới backend.

## Tài khoản demo

Các tài khoản seed được tạo bởi `DataSeederConfig`.

```text
Organizer: organizer@unihub.edu.vn / admin123
Check-in staff: staff@unihub.edu.vn / staff123
Student example: 21521001@university.edu.vn / 21521001@UniHub
```

Sinh viên được import dùng mật khẩu mặc định:

```text
password = {student_id}@UniHub
```

## Import CSV sinh viên

Scheduled job chạy hằng ngày lúc 02:00 và đọc file:

```text
/data/students_{yyyy-MM-dd}.csv
```

Khi chạy Docker từ `src/`, thư mục host `src/data/` được mount vào container backend tại `/data`.

Các API dành cho Organizer:

- `POST /api/admin/student-imports/run`
- `GET /api/admin/student-imports`
- `GET /api/csv/status`

## Kiểm tra

Chạy test backend:

```powershell
cd src\BE\workshop
.\mvnw.cmd test
```

Build frontend:

```powershell
cd src\FE
npm run build
```

Smoke check mock payment:

```powershell
cd src\mock-payment
npm start
```
