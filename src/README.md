# UniHub Source Code

Thu muc nay chua toan bo source code co the chay cua UniHub Workshop.

## Chay nhanh bang Docker

```powershell
cd src
docker compose up --build
```

## Cac service

- `BE/workshop`: backend Spring Boot.
- `FE`: source frontend React.
- `mock-payment`: mock payment gateway.
- `mobile-checkin`: app React Native/Expo cho nhan su check-in.
- `data`: CSV seed/import files.

## Cau hinh

Tao `src/.env` tu `src/.env.example`, sau do dien Supabase, database, SMTP va cac key can thiet.

Tai lieu chay chi tiet nam o `../README.md` va `../RUN_REPO.md`.
