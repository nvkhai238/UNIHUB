# UniHub Workshop

UniHub Workshop is a full-stack workshop registration and check-in system for a university event week. The repo contains:

- `src/BE/workshop`: Spring Boot backend.
- `src`: React + Vite web app for students and organizers.
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

- Students browse workshops, register, pay for paid workshops through mock payment, view QR codes, and cancel registrations.
- Confirmed or pending cancellations release the seat; the first waitlisted student is promoted automatically.
- Organizers create/publish/cancel workshops, upload PDFs, retry AI summary generation, and view statistics.
- Check-in staff use the mobile-native check-in contract: preload valid QR data, store scans offline locally, then sync with `POST /api/checkins/sync`.

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
