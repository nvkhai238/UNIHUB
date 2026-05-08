import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api';

export default function MyRegistrationsPage() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/api/registrations/my')
      .then(({ data }) => setRegistrations(data.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const retryPayment = async (id) => {
    setMessage('');
    await api.post(`/api/registrations/${id}/payment/retry`);
    setMessage('Đã đưa thanh toán vào hàng xử lý lại. Trạng thái sẽ cập nhật sau ít phút.');
    load();
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-normal">Đăng ký của tôi</h1>
        <p className="mt-2 text-sm text-gray-600">Xem trạng thái giữ chỗ, thanh toán và mã QR check-in.</p>
      </div>

      {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Đang tải...</p>
        ) : registrations.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Bạn chưa đăng ký workshop nào.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {registrations.map((registration) => (
              <div key={registration.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-gray-950">{registration.workshopTitle || registration.workshopId}</h2>
                    <StatusBadge status={registration.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Đăng ký lúc {formatDate(registration.registeredAt)}</p>
                  {registration.confirmedAt && <p className="text-sm text-gray-500">Xác nhận lúc {formatDate(registration.confirmedAt)}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    to={`/student/registrations/${registration.id}`}
                  >
                    Chi tiết
                  </Link>
                  {registration.status === 'CONFIRMED' && (
                    <Link className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" to={`/student/registrations/${registration.id}/qr`}>
                      Xem QR
                    </Link>
                  )}
                  {(registration.status === 'PENDING' || registration.status === 'CANCELLED') && (
                    <button
                      type="button"
                      onClick={() => retryPayment(registration.id)}
                      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      Xử lý lại thanh toán
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
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
