import { useEffect, useMemo, useState } from 'react';
import api from '../../api/api';
import LogoutButton from '../../components/LogoutButton';
import { getCurrentUser, saveUserProfile } from '../../router/jwtUtils';

export default function StudentProfilePage() {
  const user = getCurrentUser();
  const displayName = user?.fullName || 'Sinh viên UniHub';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.get('/api/registrations/my?size=50')
      .then(({ data }) => mounted && setRegistrations(data.data?.content ?? []))
      .catch(() => mounted && setRegistrations([]))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => ({
    total: registrations.length,
    confirmed: registrations.filter((item) => item.status === 'CONFIRMED').length,
    pending: registrations.filter((item) => item.status === 'PENDING').length,
  }), [registrations]);

  const [phonePrefix, setPhonePrefix] = useState('+84');
  const [phoneNumberStr, setPhoneNumberStr] = useState(() => {
    if (user?.phone) {
      if (user.phone.startsWith('+84')) return user.phone.substring(3);
      if (user.phone.startsWith('+1')) {
        setPhonePrefix('+1');
        return user.phone.substring(2);
      }
    }
    return user?.phone || '';
  });
  const [telegramInput, setTelegramInput] = useState(user?.telegramId || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePhone = async () => {
    try {
      setIsUpdating(true);
      const finalPhone = phonePrefix + phoneNumberStr;
      await api.put('/api/users/me/phone', { phone: finalPhone });
      user.phone = finalPhone;
      saveUserProfile(user);
      alert('Đã lưu số điện thoại thành công!');
    } catch (error) {
      alert(error.response?.data?.message || 'Có lỗi xảy ra khi lưu số điện thoại');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateTelegram = async () => {
    try {
      if (!telegramInput.trim()) {
        alert('Vui lòng nhập Telegram Chat ID trước khi lưu.');
        return;
      }
      setIsUpdating(true);
      const newTelegramId = telegramInput.trim();
      await api.put('/api/users/me/telegram', { telegramId: newTelegramId });
      user.telegramId = newTelegramId;
      saveUserProfile(user);
      setTelegramInput(newTelegramId);
      alert('Đã lưu dữ liệu Telegram thành công!');
    } catch (error) {
      alert(error.response?.data?.message || 'Có lỗi xảy ra khi liên kết Telegram');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-normal">Hồ sơ sinh viên</h1>
        <p className="mt-2 text-sm text-gray-600">Thông tin tài khoản và hoạt động đăng ký workshop của bạn.</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-3xl font-bold text-white shadow-sm">
            {initial}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-gray-950">{displayName}</h2>
            <p className="mt-1 text-sm text-gray-500">{user?.email || 'Chưa có email'}</p>
            <span className="mt-3 inline-flex rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {roleLabel(user?.role)}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <InfoItem label="Email" value={user?.email} />
          <InfoItem label="Vai trò" value={roleLabel(user?.role)} />
          <InfoItem label="Mã tài khoản" value={shortId(user?.id)} />
          <InfoItem label="Trạng thái" value="Đang hoạt động" />
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-gray-950">Kênh nhận thông báo</h3>
        <p className="mb-4 text-sm text-gray-600">
          Ngoài email, UniHub hỗ trợ gửi cập nhật workshop qua SMS và Telegram. Liên kết ngay để không bỏ lỡ thông báo.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">Tin nhắn SMS</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${user?.phone ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                {user?.phone ? 'Đã liên kết' : 'Chưa cập nhật'}
              </span>
            </div>
            <div className="flex">
              <select
                value={phonePrefix}
                onChange={(e) => setPhonePrefix(e.target.value)}
                className="rounded-l-md border border-gray-300 border-r-0 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none"
              >
                <option value="+84">VN +84</option>
                <option value="+1">US +1</option>
              </select>
              <input
                type="text"
                value={phoneNumberStr}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val.startsWith('0')) val = val.substring(1);
                  setPhoneNumberStr(val);
                }}
                placeholder="Nhập số, ví dụ 912345678"
                className="w-full border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                disabled={isUpdating}
                className="rounded-r-md border border-gray-300 border-l-0 bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:opacity-50"
                onClick={handleUpdatePhone}
              >
                Lưu
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">Telegram Chat ID: {user?.telegramId || '...'}</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${user?.telegramId ? 'bg-blue-100 text-blue-800' : 'bg-blue-50 text-blue-600'}`}>
                {user?.telegramId ? 'Đã liên kết' : 'Chưa liên kết'}
              </span>
            </div>
            <div className="flex">
              <input
                type="text"
                className="w-full rounded-l-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Nhập Chat ID thật, ví dụ 123456789"
                value={telegramInput}
                onChange={(e) => setTelegramInput(e.target.value)}
              />
              <button
                type="button"
                disabled={isUpdating}
                className="flex-shrink-0 rounded-r-md bg-[#0088cc] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0077b3] disabled:opacity-50"
                onClick={handleUpdateTelegram}
              >
                Kết nối
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Bạn cần nhắn <span className="font-semibold">/start</span> cho bot Telegram trước, sau đó lấy đúng <span className="font-semibold">chat_id</span> để lưu ở đây.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Tất cả đăng ký" value={loading ? '...' : summary.total} />
        <Metric label="Đã xác nhận" value={loading ? '...' : summary.confirmed} />
        <Metric label="Đang xử lý" value={loading ? '...' : summary.pending} />
      </div>

      <div className="mt-8 border-t border-gray-200 pt-4">
        <LogoutButton className="inline-flex w-full justify-center border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" />
      </div>
    </section>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-800">{value || 'Chưa cập nhật'}</p>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
    </div>
  );
}

function roleLabel(role) {
  if (role === 'STUDENT') return 'Sinh viên';
  return role || 'Sinh viên';
}

function shortId(id) {
  if (!id) return '';
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}
