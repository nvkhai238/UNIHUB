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

  const [phoneInput, setPhoneInput] = useState(user?.phone || '');
  const [telegramInput, setTelegramInput] = useState(user?.telegramId || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePhone = async () => {
    try {
      setIsUpdating(true);
      await api.put('/api/users/me/phone', { phone: phoneInput });
      user.phone = phoneInput; // Cập nhật local role object
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
      setIsUpdating(true);
      // Giả lập bot cấp một ID ngẫu nhiên cho Telegram
      const newTelegramId = telegramInput || 'TG-' + Math.random().toString(36).substring(2, 8);
      await api.put('/api/users/me/telegram', { telegramId: newTelegramId });
      user.telegramId = newTelegramId;
      saveUserProfile(user);
      setTelegramInput(newTelegramId);
      alert('Đã liên kết Telegram thành công!');
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
        <h3 className="mb-4 text-lg font-bold text-gray-950">Kênh nhận thông báo (Mở rộng)</h3>
        <p className="mb-4 text-sm text-gray-600">
          Ngoài Email, UniHub hỗ trợ gửi cập nhật workshop qua SMS và Telegram. Liên kết ngay để không bỏ lỡ thông báo.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* SMS Adapter UI */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
              <p className="text-sm font-semibold text-gray-800">Tin nhắn SMS</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${user?.phone ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                {user?.phone ? 'Đã liên kết' : 'Chưa cập nhật'}
              </span>
            </div>
            <div className="flex">
              <input 
                type="text" 
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="VD: 0912345678" 
                className="w-full rounded-l-md border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" 
              />
              <button 
                type="button"
                disabled={isUpdating}
                className="rounded-r-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
                onClick={handleUpdatePhone}
              >
                Lưu
              </button>
            </div>
          </div>
          
          {/* Telegram Adapter UI */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
              <p className="text-sm font-semibold text-gray-800">Telegram Bot ID: {user?.telegramId || '...'}</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${user?.telegramId ? 'bg-blue-100 text-blue-800' : 'bg-blue-50 text-blue-600'}`}>
                {user?.telegramId ? 'Đã liên kết' : 'Chưa liên kết'}
              </span>
            </div>
            <button 
              type="button"
              disabled={isUpdating}
              className="w-full rounded-md bg-[#0088cc] px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0077b3] transition-colors disabled:opacity-50"
              onClick={handleUpdateTelegram}
            >
              {user?.telegramId ? 'Huỷ liên kết / Kết nối lại @UniHub_Notify_Bot' : 'Kết nối với @UniHub_Notify_Bot'}
            </button>
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
