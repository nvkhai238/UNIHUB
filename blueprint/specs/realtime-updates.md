# Đặc tả: Cập nhật thời gian thực (Xuyên suốt - TV1, TV2, TV3)

> **Phạm vi:** Supabase Realtime WebSocket để cập nhật số ghế còn lại, notification, trạng thái registration/payment trên web app.

---

## Mô tả

Khi một sinh viên đăng ký thành công, tất cả sinh viên khác đang xem cùng workshop sẽ thấy số chỗ còn lại giảm xuống **ngay lập tức** (mà không cần refresh trang).

Cơ chế:
- Backend update `remaining_seats` / insert `notifications` / update `registrations` → PostgreSQL change event
- Supabase Realtime nhận thay đổi → publish via WebSocket
- Frontend subscribe → setState → re-render UI

---

## Luồng chính

### Backend: Trigger Insert Event

```
Registration được tạo → remaining_seats được giảm
  │
  ├── UPDATE workshops SET remaining_seats = remaining_seats - 1
  │       WHERE id = ? (trong transaction của POST /registrations)
  │
  └── PostgreSQL NOTIFY/LISTEN (Supabase auto-manages)
      └── Event: UPDATE workshops
          Payload: {id, remaining_seats, updated_at}
```

### Frontend: Subscribe to Channel

```
React Component (trang chi tiết workshop)

useEffect(() => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const channel = supabase
    .channel('workshop-seats')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'workshops',
      filter: `id=eq.${workshopId}`
    }, (payload) => {
      // payload.new.remaining_seats được cập nhật
      setRemainingSeats(payload.new.remaining_seats);
      console.log(`Workshop ${workshopId}: ${payload.new.remaining_seats} seats left`);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [workshopId]);

// UI render
<div className="seats-left">
  Chỗ còn lại: {remainingSeats} / {capacity}
</div>
```

### Luồng Realtime Update

```
Admin UI / Student UI

// Subscribe to workshop, notification, registration updates
const channel = supabase
  .channel(`workshop-${workshopId}`)
  .on('postgres_changes', {
    event: '*',  // ALL events (INSERT, UPDATE, DELETE)
    schema: 'public',
    table: 'workshops',
    filter: `id=eq.${workshopId}`
  }, (payload) => {
    if (payload.eventType === 'UPDATE') {
      // Refresh workshop data
      fetchWorkshop(workshopId);
    }
  })
  .subscribe();
```

## Kịch bản lỗi

| Tình huống | Hành vi |
|-----------|--------|
| **WebSocket disconnected** | Frontend automatically reconnect (Supabase built-in) |
| **Supabase Realtime down** | Fallback to polling (setInterval 2s) hoặc disable realtime gracefully |
| **Network latency > 5s** | Realtime message vẫn đi, nhưng user thấy update chậm; acceptable |
| **User mở multiple tabs cùng workshop** | Mỗi tab có channel riêng, đều nhận update (independent subscriptions) |
| **Close tab mà forget unsubscribe** | Browser unload event auto-cleanup (Supabase handles) |
| **Database trigger fail** | Realtime message không được send, nhưng workshop data still updated; next polling sẽ sync |
| **Frontend subscribe nhưng DB không change** | Channel hoạt động bình thường, chỉ nhận message khi có update |

---

## Ràng buộc

| Ràng buộc | Chi tiết |
|----------|---------|
| **Latency** | Realtime update ≤ 500ms (WebSocket propagation time) |
| **Bandwidth** | Không broadcast quá thường xuyên (debounce updates nếu cần) |
| **Channel naming** | `workshop-seats` hoặc `workshop-{workshopId}` (format consistent) |
| **Payload** | Supabase `postgres_changes` payload; frontend gọi REST lại khi cần dữ liệu đầy đủ |
| **Scalability** | Supabase Realtime hỗ trợ 10k+ concurrent connections |
| **Authentication** | Supabase RLS (Row-Level Security) kiểm soát ai có thể subscribe |
| **Reconnection** | Supabase client auto-reconnect 3 lần, exponential backoff |

---

## Tiêu chí chấp nhận

- ✅ Sinh viên A đăng ký → UI của sinh viên B thấy remaining_seats giảm trong ≤ 500ms
- ✅ Không cần F5 hoặc refresh trang
- ✅ 100 sinh viên xem cùng workshop → mỗi người thấy update realtime
- ✅ Đóng tab → WebSocket disconnect, không leak connection
- ✅ Mạng tạm yếu → Realtime reconnect tự động
- ✅ Admin update workshop (room, title) → trang SV/organizer refresh state qua subscription hoặc fetch lại
- ✅ Notification mới → unread badge/list cập nhật theo Supabase Realtime
- ✅ Registration/payment status page subscribe thay đổi registration để cập nhật trạng thái
- ✅ Browser offline → Realtime pause, online trở lại → kết nối & sync lại
- ✅ Supabase Realtime down → Fallback to polling hoặc hiển thị thông báo
- ✅ Data consistency: UI thấy realtime + REST API response luôn match
- ✅ Không có memory leak từ multiple subscriptions (Unsubscribe cleanup)

---

## API Endpoints

#### Supabase Realtime channel — Subscribe to Workshop/Notification/Registration Updates

Không có REST endpoint `/api/realtime/...` trong backend. Frontend dùng `@supabase/supabase-js` để subscribe trực tiếp các bảng được publish realtime (`workshops`, `notifications`, `registrations` nếu cấu hình DB bật publication).

---




