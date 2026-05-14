# UniHub Workshop - Run Commands

Tai lieu nay tong hop cac lenh chay repo tren Windows PowerShell sau khi source code duoc gom vao thu muc `src/`.

## Yeu cau

- `Node.js` 20+
- `npm`
- `Java 21`
- `Docker Desktop` neu chay bang Docker

## Cau truc chay moi

Tu root repo:

```powershell
cd src
```

Sau khi vao `src/`, cac thu muc chinh la:

```text
BE/workshop
FE
mock-payment
mobile-checkin
data
docker-compose.yml
.env
.env.example
```

## 1. Chay bang Docker

### Chuan bi bien moi truong

Tao `src/.env` tu `src/.env.example`.

```powershell
cd src
Copy-Item .env.example .env
```

Dien cac bien chinh:

```env
DB_URL=
DB_USER=
DB_PASS=
JWT_SECRET=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:8080
GEMINI_API_KEY=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
MAIL_ENABLED=true
MAIL_FROM=
MAIL_ADMIN=
```

### Chay toan bo stack

```powershell
cd src
docker compose up --build
```

### Dung stack

```powershell
docker compose down
```

### Dung stack va xoa volume

```powershell
docker compose down -v
```

### URL sau khi chay

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- Mock payment: `http://localhost:3001`
- Redis: `localhost:6379`

## 2. Chay local tung service

### 2.1 Frontend

Thu muc lam viec:

```powershell
cd src\FE
```

Cai dependencies:

```powershell
npm.cmd install
```

Chay dev server:

```powershell
npm.cmd run dev
```

Build production:

```powershell
npm.cmd run build
```

Frontend doc API base URL tu `VITE_API_BASE_URL` trong `src/.env`.

### 2.2 Backend

Thu muc lam viec:

```powershell
cd src\BE\workshop
```

Dat `JAVA_HOME` ve JDK 21 neu may dang mac dinh JDK khac:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\openjdk\jdk-21.0.8"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
```

Neu chay backend local, dat bien moi truong tu `src/.env` trong terminal hien tai hoac cau hinh trong IDE. Backend doc cac bien:

```env
DB_URL=
DB_USER=
DB_PASS=
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
```

Chay ung dung:

```powershell
.\mvnw.cmd spring-boot:run
```

Chay test:

```powershell
.\mvnw.cmd test
```

### 2.3 Mock Payment

Thu muc lam viec:

```powershell
cd src\mock-payment
```

Cai dependencies:

```powershell
npm.cmd install
```

Chay service:

```powershell
npm.cmd start
```

Service mac dinh chay tai `http://localhost:3001`.

### 2.4 Mobile Check-in

Thu muc lam viec:

```powershell
cd src\mobile-checkin
```

Cai dependencies va chay Expo:

```powershell
npm.cmd install
npx expo start
```

Neu test tren dien thoai that, sua `src/mobile-checkin/app.json`:

```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "http://YOUR_LAN_IP:8080"
    }
  }
}
```

## 3. Thu tu khoi dong local de it loi nhat

1. Chay Redis.
2. Chay `src\mock-payment`.
3. Chay backend Spring Boot.
4. Chay frontend Vite.
5. Chay mobile Expo neu can check-in tren dien thoai.

## 4. CSV import

CSV import doc file theo format:

```text
/data/students_YYYY-MM-DD.csv
```

Khi chay bang Docker tu `src/`, thu muc `src/data` tren may duoc mount vao `/data` trong backend container.

## 5. Lenh nhanh

```powershell
# Full Docker
cd src
docker compose up --build

# Frontend
cd src\FE
npm.cmd run dev

# Backend
cd src\BE\workshop
.\mvnw.cmd spring-boot:run

# Mock payment
cd src\mock-payment
npm.cmd start

# Mobile
cd src\mobile-checkin
npx expo start
```

## 6. Khac phuc loi thuong gap

### Docker khong chay

Neu gap loi `dockerDesktopLinuxEngine`, mo Docker Desktop va cho den khi engine running.

### Docker BuildKit snapshot loi

Neu `docker compose up --build` bao loi:

```text
parent snapshot ... does not exist
```

thu lan luot:

```powershell
docker builder prune -af
docker compose build --no-cache
docker compose up
```

### Maven bao `release version 21 not supported`

Mo PowerShell moi va dat lai JDK 21:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\openjdk\jdk-21.0.8"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
```
