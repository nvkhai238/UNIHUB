# Cai app UniHub Check-in len dien thoai Android

Tai lieu nay mo ta cach cai va chay app mobile `UniHub Check-in` tren dien thoai Android that. App nay nam o `src/mobile-checkin` va duoc viet bang React Native + Expo. Muc dich cua app la ho tro tai khoan `CHECKIN_STAFF` quet QR check-in workshop.

## 1. App nay dung cho ai

- Dung cho nhan su check-in, khong phai cho sinh vien
- Dang nhap bang tai khoan co role `CHECKIN_STAFF`
- Can backend UniHub dang chay de app goi API

## 2. Cach cai de nghi

Voi repo hien tai, cach nhanh va on dinh nhat de cai len Android la:

1. Chay backend tren may tinh
2. Chay Expo dev server trong `src/mobile-checkin`
3. Cai app `Expo Go` tren dien thoai Android
4. Quet QR cua Expo de mo app tren dien thoai

Day la cach phu hop nhat cho demo, test va nghiem thu noi bo.

## 3. Yeu cau truoc khi cai

### Tren may tinh

- Windows co PowerShell
- Node.js 20 tro len
- npm
- Backend UniHub chay duoc
- May tinh va dien thoai cung mot mang Wi-Fi

### Tren dien thoai Android

- Android co ket noi cung mang Wi-Fi voi may tinh
- Cai san app `Expo Go` tu CH Play
- Cap quyen camera khi app yeu cau

## 4. Kiem tra cau truc repo

App mobile nam o:

```text
src/mobile-checkin
```

Mot so file quan trong:

- `src/mobile-checkin/package.json`
- `src/mobile-checkin/app.json`
- `src/mobile-checkin/README.md`

Script hien co:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios"
  }
}
```

Voi dien thoai that, ban thuong chi can `expo start` va `Expo Go`.

## 5. Chuan bi backend truoc khi mo app

App mobile khong tu chay doc lap. No can backend UniHub dang hoat dong.

Tu repo root:

```powershell
cd src
```

Ban co the chay bang Docker:

```powershell
docker compose up --build
```

Hoac chay rieng backend:

```powershell
cd src\BE\workshop
.\mvnw.cmd spring-boot:run
```

Neu can mock payment:

```powershell
cd src\mock-payment
npm.cmd install
npm.cmd start
```

Sau khi backend chay, kiem tra API:

```text
http://localhost:8080
```

Luu y: `localhost` chi dung tren may tinh. Tren dien thoai, app phai goi bang IP LAN cua may tinh.

## 6. Tim IP LAN cua may tinh

Mo PowerShell:

```powershell
ipconfig
```

Tim dia chi IPv4 cua card mang dang dung Wi-Fi, vi du:

```text
IPv4 Address. . . . . . . . . . . : 192.168.100.246
```

Khi do backend se duoc mobile goi bang:

```text
http://192.168.100.246:8080
```

Neu doi Wi-Fi hoac may tinh doi IP, ban phai cap nhat lai cau hinh app.

## 7. Cau hinh mobile app goi dung backend

### Cach 1: Sua truc tiep trong `app.json`

Mo file [app.json](/d:/UNIHUB/src/mobile-checkin/app.json).

Muc hien tai:

```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "http://192.168.100.246:8080"
    }
  }
}
```

Hay doi thanh IP LAN dung cua may ban. Vi du:

```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "http://192.168.1.15:8080"
    }
  }
}
```

### Cach 2: Truyen bien moi truong luc chay Expo

Thay vi sua file, co the chay:

```powershell
cd src\mobile-checkin
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.1.15:8080"
npx expo start
```

Neu du an dang doc `expo.extra.apiBaseUrl` la chinh, cach sua `app.json` se de hieu hon cho ca nhom.

## 8. Cai va chay app tren Android that

### Buoc 1: Cai dependency cho mobile

```powershell
cd src\mobile-checkin
npm.cmd install
```

### Buoc 2: Khoi dong Expo dev server

```powershell
npx expo start
```

Neu muon dung LAN mode ro rang hon:

```powershell
npx expo start --lan
```

Sau khi chay, terminal se hien QR code.

### Buoc 3: Cai `Expo Go` tren dien thoai

Tren Android:

1. Mo CH Play
2. Tim `Expo Go`
3. Cai dat

### Buoc 4: Mo app tren dien thoai

1. Mo `Expo Go`
2. Chon quet QR
3. Quet QR code hien trong terminal Expo
4. Doi Expo tai bundle va mo app `UniHub Check-in`

Lan dau tien co the mat mot chut de download phan can thiet.

### Buoc 5: Cap quyen camera

App check-in can camera de quet QR. Hay chon `Allow` khi Android hoi quyen camera.

## 9. Tai khoan de dang nhap

Theo README tong cua repo, tai khoan seed mau cho check-in staff la:

```text
staff@unihub.edu.vn / staff123
```

App mobile nay danh cho role `CHECKIN_STAFF`, vi vay hay dung dung tai khoan nay hoac tai khoan cung quyen.

## 10. Luong test sau khi cai xong

Sau khi app mo thanh cong tren Android:

1. Dang nhap bang tai khoan `CHECKIN_STAFF`
2. Bam preload cho ngay hien tai
3. Thu quet mot ma QR hop le khi dang online
4. Tat Wi-Fi hoac ngat mang
5. Quet tiep de tao queue offline
6. Bat mang lai
7. Dua app ve foreground de app tu dong sync lai

## 11. Cach xac nhan app dang noi dung backend

Neu dang nhap thanh cong, preload thanh cong, quet QR thanh cong thi thong thuong la API da noi duoc.

Neu muon kiem tra ky hon:

1. Xem backend console co request vao `/api/...`
2. Xem dien thoai va may tinh co cung Wi-Fi khong
3. Thu mo tren dien thoai:

```text
http://YOUR_LAN_IP:8080
```

neu backend co mo truy cap trong mang noi bo

## 12. Loi thuong gap va cach xu ly

### 12.1 Quet QR Expo nhung app khong mo

Nguyen nhan thuong gap:

- Dien thoai khong cung Wi-Fi voi may tinh
- Firewall chan ket noi
- Expo dang o che do khac LAN

Cach xu ly:

1. Dam bao hai thiet bi cung mang
2. Chay lai:

```powershell
npx expo start --lan
```

3. Tam thoi tat firewall de thu, neu moi vao duoc thi can mo cong phu hop

### 12.2 App mo duoc nhung dang nhap that bai

Kiem tra:

- Backend co dang chay khong
- `apiBaseUrl` co dung IP LAN khong
- Dien thoai co truy cap duoc `http://YOUR_LAN_IP:8080` khong
- Tai khoan co dung role `CHECKIN_STAFF` khong

### 12.3 Dien thoai bao khong quet duoc camera

Kiem tra quyen camera trong Android:

1. Vao `Settings`
2. Tim `Expo Go`
3. Bat quyen `Camera`

### 12.4 Da doi IP Wi-Fi nhung app van goi dia chi cu

Xu ly:

1. Sua lai `app.json`
2. Tat Expo server
3. Chay lai `npx expo start`
4. Mo lai app trong Expo Go

### 12.5 Backend chay tren `localhost` nhung mobile khong goi duoc

Day la hanh vi dung. `localhost` tren dien thoai khong phai la may tinh cua ban.

Hay dung:

```text
http://IP_LAN_CUA_MAY_TINH:8080
```

### 12.6 App dang o Expo Go, day co phai da "cai len may" chua

Co, theo nghia phuc vu demo va test noi bo: app da duoc mo va chay tren Android thong qua `Expo Go`.

Neu ban can:

- icon rieng tren man hinh chinh
- file APK/AAB de cai truc tiep
- phat hanh cho nhieu may

thi can them buoc build ban phan phoi bang EAS/Android build. Repo hien tai chua co tai lieu phat hanh APK rieng.

## 13. Cach thao tac nhanh cho nguoi moi

Tu repo root:

```powershell
cd src\mobile-checkin
npm.cmd install
npx expo start --lan
```

Sau do:

1. Mo `Expo Go` tren Android
2. Quet QR
3. Dang nhap bang `staff@unihub.edu.vn / staff123`

## 14. Checklist truoc khi demo

- Backend dang chay
- Dien thoai va laptop cung Wi-Fi
- `app.json` dang tro toi dung IP LAN
- Da cai `Expo Go`
- Tai khoan `CHECKIN_STAFF` dang dung
- Camera da duoc cap quyen

## 15. File lien quan de doi chieu

- [README.md](/d:/UNIHUB/README.md)
- [RUN_REPO.md](/d:/UNIHUB/RUN_REPO.md)
- [src/mobile-checkin/README.md](/d:/UNIHUB/src/mobile-checkin/README.md)
- [src/mobile-checkin/app.json](/d:/UNIHUB/src/mobile-checkin/app.json)
- [src/mobile-checkin/package.json](/d:/UNIHUB/src/mobile-checkin/package.json)

## 16. Ghi chu cuoi

Neu muc tieu cua ban la "cai de dung ngay tren may Android that" thi Expo Go la cach nhanh nhat va phu hop voi repo hien tai.

Neu muc tieu cua ban la "dong goi thanh APK de gui cho nguoi khac tu cai" thi minh nen viet them mot tai lieu rieng ve build APK/AAB bang Expo EAS, vi luong do khac voi luong cai dat de demo/noi bo.
