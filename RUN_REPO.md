# UniHub Workshop - Run Commands

Tai lieu nay tong hop cac lenh de chay repo tren Windows PowerShell.

## Yeu cau

- `Node.js` 20+
- `npm`
- `Java 21`
- `Docker Desktop` neu chay bang Docker

## 1. Chay bang Docker

### Chuan bi bien moi truong

`docker-compose.yml` doc cac bien moi truong o root repo:

```env
DB_URL=
DB_USER=
DB_PASS=
JWT_SECRET=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
MAIL_ADMIN=
```

Ban co the tao file `.env` o root repo va dien cac gia tri tren.

### Chay toan bo stack

```powershell
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
cd src
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

Preview ban build:

```powershell
npm.cmd run preview
```

Frontend doc API base URL tu `VITE_API_BASE_URL`.

Vi du file `src/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

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

Chay ung dung:

```powershell
.\mvnw.cmd spring-boot:run
```

Chay test:

```powershell
.\mvnw.cmd test
```

Dong goi:

```powershell
.\mvnw.cmd clean package
```

Backend doc cac bien moi truong chinh:

```env
SPRING_DATASOURCE_URL=
SPRING_DATASOURCE_USERNAME=
SPRING_DATASOURCE_PASSWORD=
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=
SUPABASE_URL=
SUPABASE_KEY=
GEMINI_API_KEY=
SMTP_HOST=
SMTP_USERNAME=
SMTP_PASSWORD=
```

### 2.3 Mock Payment

Thu muc lam viec:

```powershell
cd mock-payment
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

## 3. Thu tu khoi dong local de it loi nhat

1. Chay Redis.
2. Chay `mock-payment`.
3. Chay backend Spring Boot.
4. Chay frontend Vite.

## 4. Neu can CSV import

CSV import doc file theo format:

```text
/data/students_YYYY-MM-DD.csv
```

Khi chay bang Docker, thu muc `./data` o root repo duoc mount vao `/data` trong backend container.

## 5. Lenh nhanh

```powershell
# Frontend
cd src
npm.cmd run dev

# Backend
cd src\BE\workshop
.\mvnw.cmd spring-boot:run

# Mock payment
cd mock-payment
npm.cmd start

# Full Docker
docker compose up --build
```

## 6. Khac phuc loi thuong gap

### Docker BuildKit snapshot loi

Neu `docker compose up --build` bao loi kieu:

```text
parent snapshot ... does not exist
```

thi day thuong la loi cache build cua Docker, khong phai loi source code. Thu lan luot:

```powershell
docker builder prune -af
docker compose build --no-cache
docker compose up
```

Neu van loi, khoi dong lai Docker Desktop roi chay lai lenh tren.

### Maven bao `release version 21 not supported`

Mo PowerShell moi va dat lai JDK 21 truoc khi chay backend:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\openjdk\jdk-21.0.8"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
```
