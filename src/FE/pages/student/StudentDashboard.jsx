import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api';

export default function StudentDashboard() {
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
    confirmed: registrations.filter((r) => r.status === 'CONFIRMED').length,
    pending: registrations.filter((r) => r.status === 'PENDING').length,
    waitlisted: registrations.filter((r) => r.status === 'WAITLISTED').length,
  }), [registrations]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Tổng quan sinh viên</h1>
          <p className="mt-2 text-sm text-gray-600">Theo dõi đăng ký, thanh toán pending và mã QR check-in.</p>
        </div>
        <Link to="/" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Xem lịch workshop
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric label="Đã xác nhận" value={summary.confirmed} />
        <Metric label="Đang thanh toán" value={summary.pending} />
        <Metric label="Danh sách chờ" value={summary.waitlisted} />
        <Metric label="Thông báo" value="—" to="/student/notifications" />
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Đăng ký gần đây</h2>
          <Link to="/student/registrations" className="text-sm font-semibold text-emerald-700">Xem tất cả</Link>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Đang tải...</p>
        ) : registrations.length === 0 ? (
          <p className="text-sm text-gray-500">Bạn chưa đăng ký workshop nào.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {registrations.slice(0, 5).map((registration) => (
              <div key={registration.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-gray-950">{registration.workshopTitle || registration.workshopId}</p>
                  <p className="text-sm text-gray-500">{formatDate(registration.registeredAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={registration.status} />
                  <Link
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    to={`/student/registrations/${registration.id}`}
                  >
                    Chi tiết
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, to }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${to ? 'cursor-pointer hover:border-emerald-300 hover:shadow-md' : ''}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
      {to && <Link to={to} className="mt-1 block text-xs font-medium text-emerald-600 hover:underline">Xem →</Link>}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    CONFIRMED: 'bg-emerald-50 text-emerald-700',
    PENDING: 'bg-amber-50 text-amber-700',
    WAITLISTED: 'bg-sky-50 text-sky-700',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${styles[status] ?? styles.CANCELLED}`}>{status}</span>;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
