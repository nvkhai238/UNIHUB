# UniHub Workshop

UniHub Workshop is a full-stack workshop registration and check-in system for a university event week. The repo contains:

- `src/BE/workshop`: Spring Boot backend.
- `src`: React + Vite web app for students and organizers.
- `mobile-checkin`: React Native + Expo app for `CHECKIN_STAFF`.
- `mock-payment`: Node.js mock payment gateway.
- `data`: sample CSV files for nightly student import.
- `blueprint`: system design and feature specs.

## Prerequisites

- Docker Desktop.
- Node.js 20+ if running the frontend outside Docker.
- Java 21 if running the backend outside Docker.
- A PostgreSQL/Supabase database matching the schema in the blueprint.

## Environment

Create `.env` at the repo root. The existing `.env` can be used as the local template. Required values:

```env
DB_URL=jdbc:postgresql://...
DB_USER=...
DB_PASS=...
JWT_SECRET=replace-with-a-32-byte-or-longer-secret
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
MAIL_ENABLED=true
MAIL_FROM=...
MAIL_ADMIN=...
SMTP_PORT=587
SMTP_AUTH=true
SMTP_STARTTLS_ENABLE=true
```

For local demo without real email, keep `MAIL_ENABLED=false` in backend config or leave SMTP empty.

## Run With Docker

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- Mock payment gateway: `http://localhost:3001`
- Redis: `localhost:6379`

## Run Without Docker

Backend:

```bash
cd src/BE/workshop
./mvnw spring-boot:run
```

Frontend:

```bash
cd src
npm ci
npm run dev
```

Mock payment:

```bash
cd mock-payment
npm ci
npm start
```

Mobile check-in app:

```bash
cd mobile-checkin
npm install
npx expo start
```

Set `mobile-checkin/app.json -> expo.extra.apiBaseUrl` to your backend LAN IP, for example `http://192.168.1.23:8080`.

## Demo Accounts

The backend seeder creates sample users when the database is empty. Typical passwords follow the seeded values in `DataSeederConfig`; imported students use:

```text
password = {student_id}@UniHub
```

Example for `data/students_2026-05-10.csv`:

```text
email: an.nguyen@unihub.edu.vn
password: 22120001@UniHub
```

## Student CSV Import

The scheduled job runs daily at 02:00 and reads:

```text
/data/students_{yyyy-MM-dd}.csv
```

When using Docker, root `data/` is mounted to backend `/data`. For the current demo date, the repo includes:

```text
data/students_2026-05-10.csv
```

Organizer APIs:

- `POST /api/admin/student-imports/run`
- `GET /api/admin/student-imports`
- `GET /api/csv/status`

## Key Flows

- Students create accounts with email OTP verification, browse workshops, register, pay for paid workshops through mock payment, view QR codes, and cancel registrations.
- Confirmed or pending cancellations release the seat; the first waitlisted student is promoted automatically.
- Organizers create/publish/cancel workshops, upload PDFs, retry AI summary generation, and view statistics.
- Check-in staff use the mobile-native check-in contract: preload valid QR data, store scans offline locally, then sync with `POST /api/checkins/sync`.

## Demo Walkthrough

Organizer flow:

1. Log in with an `ORGANIZER` account on the web app.
2. Create a workshop in draft state, then publish it.
3. Edit room/time to trigger workshop update notifications.
4. Upload a PDF and monitor AI summary status or retry when failed.
5. Open the statistics page and apply workshop/date/status filters.

Check-in flow:

1. Log in on `mobile-checkin` with a `CHECKIN_STAFF` account.
2. Preload the QR list for today.
3. Scan QR online for direct sync.
4. Turn off the network and scan again to queue offline entries.
5. Restore network or bring the app back to foreground to trigger sync.

## Verification

Backend compile:

```bash
cd src/BE/workshop
./mvnw test
```

Frontend build:

```bash
cd src
npm run build
```
