# UniHub Check-in Mobile

Ung dung mobile native cho `CHECKIN_STAFF`, duoc scaffold bang React Native + Expo de thay the luong PWA cu.

## Chuc nang da co

- Dang nhap bang tai khoan `CHECKIN_STAFF`
- Luu `accessToken` va `refreshToken` trong `SecureStore`
- Sinh `deviceId` rieng tren thiet bi
- Preload QR hop le qua `GET /api/checkins/preload`
- Quet QR bang camera tren mobile
- Kiem tra duplicate local
- Luu queue offline vao SQLite khi mat mang
- Tu dong sync lai khi co mang hoac app quay lai foreground
- Logout va xoa du lieu offline cua phien truoc

## Cai dat

```bash
cd mobile-checkin
npm install
npx expo start
```

## Cau hinh API

Sua `mobile-checkin/app.json`:

```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "http://YOUR_LAN_IP:8080"
    }
  }
}
```

Dien thoai va may tinh phai cung Wi-Fi. `YOUR_LAN_IP` la IP LAN cua may dang chay backend.

## Luong test nhanh

1. Dang nhap bang tai khoan `CHECKIN_STAFF`
2. Bam preload cho ngay hom nay
3. Quet QR khi online
4. Tat mang, quet lai QR khac de tao pending offline
5. Bat mang lai hoac dua app ve foreground de sync
