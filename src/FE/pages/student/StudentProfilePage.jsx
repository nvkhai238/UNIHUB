import { useEffect, useMemo, useState } from 'react';
import api from '../../api/api';
import LogoutButton from '../../components/LogoutButton';
import { getCurrentUser } from '../../router/jwtUtils';

export default function StudentProfilePage() {
  const user = getCurrentUser();
  const displayName = user?.fullName || 'Sinh viên UniHub';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.get('/api/registrations/my')
      .then(({ data }) => mounted && setRegistrations(data.data ?? []))
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
