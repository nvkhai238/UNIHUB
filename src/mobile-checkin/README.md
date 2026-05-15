# UniHub Check-in Mobile

Ung dung mobile native cho `CHECKIN_STAFF`, duoc scaffold bang React Native + Expo de thay the luong PWA cu.

Tai lieu cai dat chi tiet cho dien thoai Android: [ANDROID_INSTALL.md](/d:/UNIHUB/src/mobile-checkin/ANDROID_INSTALL.md)

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
cd src/mobile-checkin
npm install
npx expo start
```

## Cau hinh API

Mobile app khong dung duoc `localhost` de goi backend tren laptop. Hay dung IP LAN cua may dang chay backend, va dam bao dien thoai/emulator cung truy cap duoc IP do.

Co the chay Expo voi bien moi truong:

```bash
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8080 npx expo start
```

Hoac sua `src/mobile-checkin/app.json`:

```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "http://YOUR_LAN_IP:8080"
    }
  }
}
```

Dien thoai va may tinh phai cung Wi-Fi. `YOUR_LAN_IP` la IP LAN cua may dang chay backend. Neu doi IP/Wi-Fi, restart Expo de app nap lai cau hinh.

## Luong test nhanh

1. Dang nhap bang tai khoan `CHECKIN_STAFF`
2. Bam preload cho ngay hom nay
3. Quet QR khi online
4. Tat mang, quet lai QR khac de tao pending offline
5. Bat mang lai hoac dua app ve foreground de sync
