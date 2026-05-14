# UniHub Workshop

UniHub Workshop is a full-stack workshop registration and check-in system for a university event week.

The submission layout is:

- `blueprint/`: design and feature specifications.
- `src/`: all runnable source code, environment templates, seed data, Docker Compose, and app services.
- `clips/`: presentation videos if the team adds them for submission.

## Source Layout

```text
src/
  BE/workshop/        Spring Boot backend
  FE/                 React source code
  mobile-checkin/     React Native + Expo app for CHECKIN_STAFF
  mock-payment/       Node.js mock payment gateway
  data/               CSV seed/import files
  docker-compose.yml  Main Compose file
  .env.example        Environment template
```

## Prerequisites

- Docker Desktop.
- Node.js 20+ if running services outside Docker.
- Java 21 if running the backend outside Docker.
- A PostgreSQL/Supabase database matching the schema in `blueprint/`.

## Environment

Create `src/.env` from `src/.env.example` and fill in your local values.

Important variables:

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

For local demos without real email, set `MAIL_ENABLED=false`.

## Run With Docker

All runtime commands should start inside `src/`:

```powershell
cd src
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- Mock payment gateway: `http://localhost:3001`
- Redis: `localhost:6379`

Stop the stack:

```powershell
docker compose down
```

## Run Without Docker

Open separate terminals from the repo root.

Backend:

```powershell
cd src\BE\workshop
.\mvnw.cmd spring-boot:run
```

Frontend:

```powershell
cd src
npm install
npm run dev
```

Mock payment:

```powershell
cd src\mock-payment
npm install
npm start
```

Mobile check-in app:

```powershell
cd src\mobile-checkin
npm install
npx expo start
```

Set `src/mobile-checkin/app.json -> expo.extra.apiBaseUrl` to your backend LAN IP when testing on a real phone, for example `http://192.168.2.100:8080`.

## Demo Accounts

Seeded accounts are created by `DataSeederConfig`.

```text
Organizer: organizer@unihub.edu.vn / admin123
Check-in staff: staff@unihub.edu.vn / staff123
Student example: 21521001@university.edu.vn / 21521001@UniHub
```

Imported students use:

```text
password = {student_id}@UniHub
```

## Student CSV Import

The scheduled job runs daily at 02:00 and reads:

```text
/data/students_{yyyy-MM-dd}.csv
```

When using Docker from `src/`, the host folder `src/data/` is mounted into the backend container as `/data`.

Organizer APIs:

- `POST /api/admin/student-imports/run`
- `GET /api/admin/student-imports`
- `GET /api/csv/status`

## Verification

Backend tests:

```powershell
cd src\BE\workshop
.\mvnw.cmd test
```

Frontend build:

```powershell
cd src
npm run build
```

Mock payment smoke check:

```powershell
cd src\mock-payment
npm start
```
